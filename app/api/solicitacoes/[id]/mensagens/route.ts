import { NextResponse } from "next/server";
import { getSessao, podeVer } from "@/lib/auth";
import { adicionarMensagem, anexarTemporarios, buscar } from "@/lib/solicitacoes";
import { avisarMensagem } from "@/lib/emails";
import type { AnexoEnviado } from "@/lib/tipos";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ erro: "faça login" }, { status: 401 });
  const { id } = await ctx.params;
  const sol = await buscar(id);
  if (!sol || !podeVer(sol, sessao)) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { texto?: string; interna?: boolean; anexos?: AnexoEnviado[] };
  const texto = (b.texto || "").trim();
  const anexos = Array.isArray(b.anexos) ? b.anexos : [];
  if (!texto && anexos.length === 0) return NextResponse.json({ erro: "escreva algo ou anexe um arquivo" }, { status: 400 });
  const interna = sessao.financeiro && !!b.interna;
  const msg = await adicionarMensagem(sol, {
    autor_email: sessao.email,
    autor_nome: sessao.nome,
    autor_tipo: sessao.financeiro ? "financeiro" : "solicitante",
    texto,
    origem: "portal",
    interna,
  });
  const qtd = await anexarTemporarios(anexos, sol.id, msg.id, sessao.id, sessao.email);
  if (!interna) {
    await avisarMensagem(sol, {
      autor_nome: sessao.nome,
      autor_tipo: sessao.financeiro ? "financeiro" : "solicitante",
      texto,
      qtdAnexos: qtd,
      autor_email: sessao.email,
    }).catch((e) => console.error("e-mail mensagem", e));
  }
  return NextResponse.json({ ok: true });
}
