// Leitura dos e-mails da caixa do Financeiro:
//  • Caixa de Entrada: respostas de solicitantes/gestores/equipe e pedidos novos por e-mail
//  • Itens Enviados: respostas que a equipe escreveu direto no Outlook da caixa compartilhada
import { admin } from "./supabase/admin";
import { caixa, emailConfigurado, graph, CABECALHO_PORTAL, RODAPE_PORTAL } from "./graph";
import { dominioPermitido, ehFinanceiro } from "./auth";
import {
  adicionarMensagem,
  anexarBinario,
  buscarPorProtocolo,
  decidirAprovacao,
  registrarEvento,
} from "./solicitacoes";
import { avisarMensagem, avisarNovaSolicitacao, responderPedidoPorEmail } from "./emails";
import type { Solicitacao } from "./tipos";

type Endereco = { emailAddress?: { address?: string; name?: string } };
type MensagemGraph = {
  id: string;
  subject?: string;
  from?: Endereco;
  toRecipients?: Endereco[];
  ccRecipients?: Endereco[];
  uniqueBody?: { content?: string };
  body?: { content?: string };
  hasAttachments?: boolean;
  isDraft?: boolean;
  internetMessageHeaders?: { name: string; value: string }[];
};
type AnexoGraph = {
  "@odata.type": string;
  name: string;
  contentType?: string;
  contentBytes?: string;
  isInline?: boolean;
  size?: number;
};

const AUTOMATICA =
  /^(resposta autom[aá]tica|automatic reply|auto(matic)?[- ]?reply|fora do escrit[oó]rio|out of office|n[aã]o [eé] poss[ií]vel entregar|undeliverable|delivery status|mail delivery)/i;
const PROTOCOLO = /\[#(\d{3,9})\]/;

function limparTexto(t: string): string {
  // corta a parte citada quando o cliente de e-mail não separa (uniqueBody às vezes vem completo)
  const marcadores = [/^\s*De:\s.+$/im, /^\s*From:\s.+$/im, /^-{2,}\s*Mensagem original/im, /^Em .+ escreveu:$/im, /^On .+ wrote:$/im];
  let fim = t.length;
  for (const m of marcadores) {
    const x = t.search(m);
    if (x > 0 && x < fim) fim = x;
  }
  return t.slice(0, fim).replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

/** Marca como processada; devolve false se outra execução já pegou este e-mail. */
async function reservar(id: string): Promise<boolean> {
  const { error } = await admin().from("emails_processados").insert({ message_id: id });
  return !error;
}

async function salvarAnexos(msgId: string, s: Solicitacao, mensagemId: string, remetente: string): Promise<number> {
  const r = await graph<{ value: AnexoGraph[] }>(
    `/users/${encodeURIComponent(caixa())}/messages/${encodeURIComponent(msgId)}/attachments`
  );
  let n = 0;
  for (const a of r.value || []) {
    if (a["@odata.type"] !== "#microsoft.graph.fileAttachment" || !a.contentBytes) continue;
    if (a.isInline && (a.contentType || "").startsWith("image/")) continue; // logos e assinaturas
    if (await anexarBinario(s.id, mensagemId, a.name, Buffer.from(a.contentBytes, "base64"), a.contentType || "", remetente)) n++;
  }
  return n;
}

function adivinharTipo(assunto: string, texto: string): "orcamento" | "pagamento" {
  return /or[cç]amento|cota[cç][aã]o/i.test(assunto + " " + texto.slice(0, 300)) ? "orcamento" : "pagamento";
}

export async function processarMensagem(id: string): Promise<string> {
  if (!id || !(await reservar(id))) return "já processado";
  try {
    return await processar(id);
  } catch (e) {
    // libera para tentar de novo na próxima sincronização
    await admin().from("emails_processados").delete().eq("message_id", id);
    throw e;
  }
}

async function processar(id: string): Promise<string> {
  const m = await graph<MensagemGraph>(
    `/users/${encodeURIComponent(caixa())}/messages/${encodeURIComponent(id)}?$select=subject,from,toRecipients,ccRecipients,uniqueBody,body,hasAttachments,isDraft,internetMessageHeaders`,
    { prefer: 'outlook.body-content-type="text"' }
  );
  if (m.isDraft) return "rascunho";
  const assunto = m.subject || "";
  const remetente = (m.from?.emailAddress?.address || "").toLowerCase();
  const nome = m.from?.emailAddress?.name || remetente;
  const textoBruto = m.uniqueBody?.content || m.body?.content || "";
  const texto = limparTexto(textoBruto);

  if (AUTOMATICA.test(assunto) || /mailer-daemon|postmaster|no-?reply/i.test(remetente)) return "automática";
  if ((m.internetMessageHeaders || []).some((h) => h.name.toLowerCase() === CABECALHO_PORTAL.toLowerCase())) return "enviada pelo portal";
  if (textoBruto.includes(RODAPE_PORTAL) && remetente === caixa()) return "enviada pelo portal";

  const achou = assunto.match(PROTOCOLO);
  const s = achou ? await buscarPorProtocolo(Number(achou[1])) : null;

  // ---- Itens Enviados: a equipe respondeu direto pelo Outlook da caixa compartilhada
  if (remetente === caixa()) {
    if (!s) return "enviado sem protocolo";
    const msg = await adicionarMensagem(s, {
      autor_email: caixa(),
      autor_nome: "Financeiro (e-mail)",
      autor_tipo: "financeiro",
      texto,
      origem: "email",
      interna: false,
    });
    if (m.hasAttachments) await salvarAnexos(id, s, msg.id, caixa());
    return `resposta do financeiro em #${s.protocolo}`;
  }

  // ---- Caixa de Entrada, e-mail de um pedido existente
  if (s) {
    const ehGestor = !!s.gestor_email && s.gestor_email.toLowerCase() === remetente;
    const ehEquipe = await ehFinanceiro(remetente);
    const ehSolicitante = s.solicitante_email.toLowerCase() === remetente;
    if (!ehGestor && !ehEquipe && !ehSolicitante && !dominioPermitido(remetente)) return "remetente não autorizado";

    // gestor respondendo APROVADO / RECUSADO
    if (ehGestor && s.aprovacao_token) {
      const inicio = texto.slice(0, 40).toLowerCase();
      const aprova = /^\s*(aprovado|aprovo|de acordo|ok,? aprovado)/.test(inicio);
      const recusa = /^\s*(recusado|recuso|reprovado|n[aã]o aprovado|negado)/.test(inicio);
      if (aprova || recusa) {
        const comentario = texto.replace(/^\s*\S+[.!,:]?\s*/, "").trim();
        await decidirAprovacao(s, aprova, remetente, comentario, "email");
        return `${aprova ? "aprovado" : "recusado"} por e-mail #${s.protocolo}`;
      }
    }

    const tipo = ehEquipe ? "financeiro" : ehGestor ? "gestor" : "solicitante";
    const msg = await adicionarMensagem(s, {
      autor_email: remetente,
      autor_nome: nome,
      autor_tipo: tipo,
      texto,
      origem: "email",
      interna: false,
    });
    const qtd = m.hasAttachments ? await salvarAnexos(id, s, msg.id, remetente) : 0;
    await registrarEvento(s.id, `Resposta por e-mail de ${remetente}${qtd ? ` com ${qtd} anexo(s)` : ""}`, remetente);
    // equipe respondendo pelo próprio Outlook → repassa ao solicitante; solicitante/gestor → avisa a equipe
    await avisarMensagem(s, { autor_nome: nome, autor_tipo: tipo, texto, qtdAnexos: qtd, autor_email: remetente });
    return `mensagem em #${s.protocolo}`;
  }

  // ---- Caixa de Entrada, e-mail novo: vira uma solicitação
  if (achou) return "protocolo inexistente";
  if (!dominioPermitido(remetente)) return "domínio não permitido";
  const tipoSol = adivinharTipo(assunto, texto);
  const { data, error } = await admin()
    .from("solicitacoes")
    .insert({
      tipo: tipoSol,
      status: "Recebido",
      origem: "email",
      solicitante_email: remetente,
      solicitante_nome: nome,
      descricao: [assunto, texto].filter(Boolean).join("\n\n").slice(0, 8000),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const nova = data as Solicitacao;
  await registrarEvento(nova.id, "Solicitação aberta por e-mail", remetente);
  const msg = await adicionarMensagem(nova, {
    autor_email: remetente,
    autor_nome: nome,
    autor_tipo: "solicitante",
    texto: texto || "(e-mail sem texto)",
    origem: "email",
    interna: false,
  });
  const qtd = m.hasAttachments ? await salvarAnexos(id, nova, msg.id, remetente) : 0;
  await responderPedidoPorEmail(nova, qtd);
  await avisarNovaSolicitacao({ ...nova, gestor_email: null }, qtd, false).catch(() => undefined);
  return `nova solicitação #${nova.protocolo}`;
}

/** Varredura de segurança: pega e-mails dos últimos dias que o aviso automático possa ter perdido. */
export async function sincronizar(dias = 3): Promise<string[]> {
  if (!emailConfigurado()) return ["e-mail não configurado"];
  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const log: string[] = [];
  for (const [pasta, campo] of [
    ["inbox", "receivedDateTime"],
    ["sentitems", "sentDateTime"],
  ] as const) {
    let proxima: string | null =
      `/users/${encodeURIComponent(caixa())}/mailFolders/${pasta}/messages?$select=id&$top=50&$filter=${campo} ge ${desde}`;
    let paginas = 0;
    while (proxima && paginas < 10) {
      const r: { value: { id: string }[]; "@odata.nextLink"?: string } = await graph(proxima);
      for (const { id } of r.value) {
        const { data } = await admin().from("emails_processados").select("message_id").eq("message_id", id).maybeSingle();
        if (data) continue;
        try {
          log.push(`${pasta}: ${await processarMensagem(id)}`);
        } catch (e) {
          log.push(`${pasta}: erro ${(e as Error).message}`);
        }
      }
      proxima = r["@odata.nextLink"] || null;
      paginas++;
    }
  }
  return log;
}

/** Cria/renova as assinaturas do Microsoft 365 que avisam o portal de cada e-mail novo. */
export async function garantirAssinaturas(): Promise<string[]> {
  if (!emailConfigurado()) return ["e-mail não configurado"];
  const base = (process.env.APP_URL || "").replace(/\/$/, "");
  if (!base.startsWith("https://")) return ["APP_URL precisa ser https para receber avisos"];
  const log: string[] = [];
  const expira = new Date(Date.now() + 2.5 * 86400000).toISOString(); // renovada todo dia pelo cron
  for (const pasta of ["inbox", "sentitems"]) {
    const { data: atual } = await admin().from("graph_assinatura").select("*").eq("pasta", pasta).maybeSingle();
    if (atual) {
      try {
        await graph(`/subscriptions/${atual.id}`, { method: "PATCH", body: JSON.stringify({ expirationDateTime: expira }) });
        await admin().from("graph_assinatura").update({ expira_em: expira }).eq("pasta", pasta);
        log.push(`${pasta}: renovada`);
        continue;
      } catch (e) {
        log.push(`${pasta}: não renovou (${(e as Error).message.slice(0, 80)}), criando outra`);
      }
    }
    const nova = await graph<{ id: string }>("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        changeType: "created",
        notificationUrl: `${base}/api/email/inbound`,
        resource: `users/${caixa()}/mailFolders('${pasta}')/messages`,
        expirationDateTime: expira,
        clientState: process.env.GRAPH_CLIENT_STATE,
      }),
    });
    await admin().from("graph_assinatura").upsert({ pasta, id: nova.id, expira_em: expira });
    log.push(`${pasta}: criada`);
  }
  return log;
}
