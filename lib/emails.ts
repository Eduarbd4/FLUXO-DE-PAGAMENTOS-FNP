import { enviarEmail, RODAPE_PORTAL } from "./graph";
import { equipeFinanceiro } from "./auth";
import { dataBR, moeda, prazoEnvio } from "./datas";
import { TIPO_ROTULO, type Solicitacao } from "./tipos";

const url = () => (process.env.APP_URL || "").replace(/\/$/, "");

export function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function assunto(s: Solicitacao): string {
  const partes = [`[#${s.protocolo}]`, TIPO_ROTULO[s.tipo]];
  if (s.fornecedor) partes.push(s.fornecedor);
  if (s.vencimento) partes.push(`venc. ${dataBR(s.vencimento).slice(0, 5)}`);
  return partes.join(" · ");
}

function texto(t: string): string {
  return esc(t).replace(/\n/g, "<br>");
}

function botao(rotulo: string, href: string, cor = "#14213D"): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:${cor};color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px;margin:4px 8px 4px 0">${esc(rotulo)}</a>`;
}

function resumo(s: Solicitacao): string {
  const linhas: [string, string][] = [
    ["Protocolo", `#${s.protocolo}`],
    ["Tipo", TIPO_ROTULO[s.tipo]],
    ["Etapa", s.status],
    ["Solicitante", `${s.solicitante_nome || ""} (${s.solicitante_email})`],
    ["Setor / centro de custo", [s.setor, s.centro_custo].filter(Boolean).join(" · ") || "—"],
    ["Fornecedor", s.fornecedor || "—"],
    ["Valor", moeda(s.valor)],
  ];
  if (s.tipo === "pagamento") {
    linhas.push(["Vencimento", dataBR(s.vencimento)]);
    linhas.push(["Forma de pagamento", s.forma_pagamento || "—"]);
  }
  return `<table style="border-collapse:collapse;font-size:14px;margin:12px 0">${linhas
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 14px 4px 0;color:#4B5563">${esc(k)}</td><td style="padding:4px 0;font-weight:600">${esc(v)}</td></tr>`
    )
    .join("")}</table>`;
}

function layout(s: Solicitacao, titulo: string, corpo: string, botoes = ""): string {
  return `<!doctype html><html><body style="margin:0;background:#F6F7F9;font-family:Segoe UI,Arial,sans-serif;color:#14213D">
<div style="max-width:620px;margin:0 auto;padding:24px">
<div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#B91C1C">FINANCEIRO · SOLICITAÇÃO #${s.protocolo}</div>
<h1 style="font-size:22px;margin:6px 0 14px">${esc(titulo)}</h1>
<div style="background:#fff;border:1px solid #D5DAE3;border-radius:12px;padding:20px;font-size:14px;line-height:1.55">
${corpo}
${resumo(s)}
<div style="margin-top:12px">${botoes}${botao("Abrir no portal", `${url()}/s/${s.id}`, "#B91C1C")}</div>
</div>
<p style="font-size:12px;color:#6B7280;margin-top:14px">Para responder, é só responder a este e-mail (mantenha o código [#${s.protocolo}] no assunto). Sua resposta e os anexos entram direto no pedido.<br>${RODAPE_PORTAL}.</p>
</div></body></html>`;
}

async function emailsEquipe(excluir?: string): Promise<string[]> {
  if (process.env.NOTIFICAR_EQUIPE === "false") return [];
  const eq = await equipeFinanceiro();
  return eq.map((m) => m.email).filter((e) => e !== excluir?.toLowerCase());
}

export async function avisarNovaSolicitacao(s: Solicitacao, qtdAnexos: number, confirmar = true): Promise<void> {
  const prazo =
    s.tipo === "pagamento" && s.fora_do_prazo
      ? `<p style="background:#FEF3C7;border-radius:8px;padding:10px;color:#78350F"><b>Fora do prazo:</b> o documento deveria chegar até ${dataBR(prazoEnvio(s.vencimento!))}. Justificativa: ${texto(s.justificativa_prazo || "não informada")}</p>`
      : "";
  // 1) confirmação para quem pediu
  if (confirmar) await enviarEmail({
    para: [s.solicitante_email],
    assunto: assunto(s),
    html: layout(
      s,
      "Recebemos sua solicitação",
      `<p>Olá${s.solicitante_nome ? ", " + esc(s.solicitante_nome.split(" ")[0]) : ""}! Sua solicitação foi registrada com ${qtdAnexos} anexo(s). Você recebe um e-mail a cada atualização.</p>${prazo}`
    ),
  });
  // 2) pedido de aprovação para o gestor
  if (s.gestor_email && s.aprovacao_token) {
    await enviarEmail({
      para: [s.gestor_email],
      assunto: assunto(s) + " · aprovação",
      html: layout(
        s,
        "Sua aprovação é necessária",
        `<p>${esc(s.solicitante_nome || s.solicitante_email)} enviou uma solicitação que precisa da sua aprovação.</p>${s.descricao ? `<p style="color:#374151">${texto(s.descricao)}</p>` : ""}${prazo}<p>Clique abaixo ou responda a este e-mail começando com <b>APROVADO</b> ou <b>RECUSADO</b>.</p>`,
        botao("Aprovar ou recusar", `${url()}/aprovar/${s.aprovacao_token}`, "#0F766E")
      ),
    });
  }
  // 3) aviso para a equipe do Financeiro
  const eq = await emailsEquipe(s.solicitante_email);
  if (eq.length) {
    await enviarEmail({
      para: eq,
      assunto: assunto(s),
      html: layout(
        s,
        `Nova solicitação de ${TIPO_ROTULO[s.tipo].toLowerCase()}`,
        `${s.origem === "email" ? "<p>Chegou <b>por e-mail</b>.</p>" : ""}${s.descricao ? `<p style="color:#374151">${texto(s.descricao)}</p>` : ""}${prazo}`
      ),
    });
  }
}

export async function avisarMensagem(
  s: Solicitacao,
  m: { autor_nome: string; autor_tipo: string; texto: string; qtdAnexos: number; autor_email?: string }
): Promise<void> {
  const corpo = `<p><b>${esc(m.autor_nome)}</b> escreveu:</p><blockquote style="margin:0;padding:10px 14px;border-left:4px solid #D5DAE3;background:#F9FAFB">${texto(m.texto) || "<i>(sem texto)</i>"}</blockquote>${m.qtdAnexos ? `<p>${m.qtdAnexos} anexo(s) incluído(s) — veja no portal.</p>` : ""}`;
  if (m.autor_tipo === "financeiro") {
    await enviarEmail({ para: [s.solicitante_email], assunto: assunto(s), html: layout(s, "Nova mensagem do Financeiro", corpo) });
  } else {
    const eq = await emailsEquipe(m.autor_email);
    if (eq.length) {
      await enviarEmail({ para: eq, assunto: assunto(s), html: layout(s, `Nova mensagem de ${m.autor_nome}`, corpo) });
    }
  }
}

export async function avisarStatus(s: Solicitacao, anterior: string, motivo?: string): Promise<void> {
  await enviarEmail({
    para: [s.solicitante_email],
    assunto: assunto(s),
    html: layout(
      s,
      `Etapa atualizada: ${s.status}`,
      `<p>Sua solicitação passou de <b>${esc(anterior)}</b> para <b>${esc(s.status)}</b>.</p>${motivo ? `<p style="color:#374151">${texto(motivo)}</p>` : ""}`
    ),
  });
}

export async function responderPedidoPorEmail(s: Solicitacao, qtdAnexos: number): Promise<void> {
  await enviarEmail({
    para: [s.solicitante_email],
    assunto: assunto(s),
    html: layout(
      s,
      "Recebemos seu e-mail e abrimos uma solicitação",
      `<p>Seu e-mail virou a solicitação <b>#${s.protocolo}</b>, com ${qtdAnexos} anexo(s).</p>
<p>Para andar mais rápido, responda este e-mail informando o que faltar: <b>valor, vencimento, setor/centro de custo, gestor que aprova e forma de pagamento</b> — ou complete pelo portal.</p>
<p style="color:#4B5563">Lembrete: documentos para pagamento devem chegar aprovados até 3 dias úteis antes do vencimento.</p>`
    ),
  });
}
