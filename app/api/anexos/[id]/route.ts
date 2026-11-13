import { NextResponse } from "next/server";
import { getSessao, podeVer } from "@/lib/auth";
import { admin, BUCKET } from "@/lib/supabase/admin";
import { buscar } from "@/lib/solicitacoes";

export const runtime = "nodejs";

// Abre um anexo: confere permissão e redireciona para um link temporário (5 min).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ erro: "faça login" }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
  const { data: a } = await admin().from("anexos").select("*").eq("id", id).maybeSingle();
  if (!a) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
  const sol = await buscar(a.solicitacao_id);
  if (!sol || !podeVer(sol, sessao)) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
  if (a.mensagem_id && !sessao.financeiro) {
    const { data: m } = await admin().from("mensagens").select("interna").eq("id", a.mensagem_id).maybeSingle();
    if (m?.interna) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
  }
  const { data, error } = await admin().storage.from(BUCKET).createSignedUrl(a.caminho, 300, { download: a.nome });
  if (error || !data) return NextResponse.json({ erro: error?.message || "falhou" }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
