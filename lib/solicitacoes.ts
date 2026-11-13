import { randomUUID } from "crypto";
import { admin, BUCKET } from "./supabase/admin";
import { avisarMensagem, avisarStatus } from "./emails";
import type { AnexoEnviado, Mensagem, Solicitacao } from "./tipos";

export function nomeSeguro(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(-120);
  return limpo || "arquivo";
}

export async function buscar(id: string): Promise<Solicitacao | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await admin().from("solicitacoes").select("*").eq("id", id).maybeSingle();
  return (data as Solicitacao) || null;
}

export async function buscarPorProtocolo(protocolo: number): Promise<Solicitacao | null> {
  const { data } = await admin().from("solicitacoes").select("*").eq("protocolo", protocolo).maybeSingle();
  return (data as Solicitacao) || null;
}

export async function registrarEvento(solId: string, descricao: string, autor?: string | null) {
  await admin().from("eventos").insert({ solicitacao_id: solId, descricao, autor_email: autor || null });
}

async function tocar(solId: string) {
  await admin().from("solicitacoes").update({ atualizado_em: new Date().toISOString() }).eq("id", solId);
}

/** Move arquivos que o navegador subiu para tmp/<usuário>/ para a pasta definitiva do pedido. */
export async function anexarTemporarios(
  lista: AnexoEnviado[],
  solId: string,
  mensagemId: string | null,
  usuarioId: string,
  enviadoPor: string
): Promise<number> {
  let n = 0;
  for (const a of lista.slice(0, 20)) {
    if (!a?.caminho?.startsWith(`tmp/${usuarioId}/`) || a.caminho.includes("..")) continue;
    const destino = `sol/${solId}/${randomUUID()}-${nomeSeguro(a.nome)}`;
    const { error } = await admin().storage.from(BUCKET).move(a.caminho, destino);
    if (error) {
      console.error("Falha ao mover anexo", a.caminho, error.message);
      continue;
    }
    await admin().from("anexos").insert({
      solicitacao_id: solId,
      mensagem_id: mensagemId,
      nome: a.nome.slice(0, 200),
      caminho: destino,
      tamanho: a.tamanho || null,
      tipo_mime: a.tipo_mime || null,
      enviado_por: enviadoPor,
    });
    n++;
  }
  return n;
}

/** Guarda um arquivo recebido por e-mail. */
export async function anexarBinario(
  solId: string,
  mensagemId: string | null,
  nome: string,
  conteudo: Buffer,
  tipoMime: string,
  enviadoPor: string
): Promise<boolean> {
  const destino = `sol/${solId}/${randomUUID()}-${nomeSeguro(nome)}`;
  const { error } = await admin().storage.from(BUCKET).upload(destino, conteudo, {
    contentType: tipoMime || "application/octet-stream",
    upsert: false,
  });
  if (error) {
    console.error("Falha ao guardar anexo do e-mail", nome, error.message);
    return false;
  }
  await admin().from("anexos").insert({
    solicitacao_id: solId,
    mensagem_id: mensagemId,
    nome: nome.slice(0, 200),
    caminho: destino,
    tamanho: conteudo.length,
    tipo_mime: tipoMime || null,
    enviado_por: enviadoPor,
  });
  return true;
}

export async function adicionarMensagem(
  s: Solicitacao,
  m: Pick<Mensagem, "autor_email" | "autor_nome" | "autor_tipo" | "texto" | "origem" | "interna">
): Promise<Mensagem> {
  const { data, error } = await admin()
    .from("mensagens")
    .insert({ ...m, solicitacao_id: s.id, texto: (m.texto || "").slice(0, 20000) })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await tocar(s.id);
  return data as Mensagem;
}

export async function mudarStatus(s: Solicitacao, novo: string, autor: string, motivo?: string): Promise<Solicitacao> {
  if (novo === s.status) return s;
  const { data, error } = await admin()
    .from("solicitacoes")
    .update({ status: novo, atualizado_em: new Date().toISOString() })
    .eq("id", s.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await registrarEvento(s.id, `Etapa: ${s.status} → ${novo}${motivo ? ` (${motivo})` : ""}`, autor);
  const atual = data as Solicitacao;
  await avisarStatus(atual, s.status, motivo).catch((e) => console.error("e-mail de etapa", e));
  return atual;
}

/** Decisão do gestor (pelo link do e-mail ou respondendo APROVADO/RECUSADO). */
export async function decidirAprovacao(
  s: Solicitacao,
  aprovado: boolean,
  gestor: string,
  comentario: string,
  origem: "portal" | "email"
): Promise<Solicitacao> {
  const novo = aprovado ? "Aprovado" : s.tipo === "orcamento" ? "Recusado" : "Devolvido";
  const { data, error } = await admin()
    .from("solicitacoes")
    .update({
      aprovacao_token: null,
      aprovado_em: aprovado ? new Date().toISOString() : null,
      aprovado_por: aprovado ? gestor : null,
    })
    .eq("id", s.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const texto = `${aprovado ? "APROVADO" : "RECUSADO"} pelo gestor.${comentario ? "\n" + comentario : ""}`;
  await adicionarMensagem(data as Solicitacao, {
    autor_email: gestor,
    autor_nome: gestor,
    autor_tipo: "gestor",
    texto,
    origem,
    interna: false,
  });
  await avisarMensagem(data as Solicitacao, {
    autor_nome: `Gestor (${gestor})`,
    autor_tipo: "gestor",
    texto,
    qtdAnexos: 0,
    autor_email: gestor,
  }).catch((e) => console.error("e-mail aprovação", e));
  return mudarStatus(data as Solicitacao, novo, gestor, aprovado ? "aprovação do gestor" : comentario || "recusado pelo gestor");
}
