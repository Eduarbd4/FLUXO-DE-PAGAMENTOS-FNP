import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/admin";
import { decidirAprovacao } from "@/lib/solicitacoes";
import type { Solicitacao } from "@/lib/tipos";

export const runtime = "nodejs";
export const maxDuration = 60;

// Gestor aprova/recusa pelo link do e-mail (sem login; o link é secreto e vale uma vez).
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return NextResponse.json({ erro: "link inválido" }, { status: 404 });
  const { data } = await admin().from("solicitacoes").select("*").eq("aprovacao_token", token).maybeSingle();
  if (!data) return NextResponse.json({ erro: "este link já foi usado ou expirou" }, { status: 404 });
  const sol = data as Solicitacao;
  const b = (await req.json().catch(() => ({}))) as { aprovado?: boolean; comentario?: string };
  if (typeof b.aprovado !== "boolean") return NextResponse.json({ erro: "escolha aprovar ou recusar" }, { status: 400 });
  const comentario = (b.comentario || "").trim().slice(0, 2000);
  if (!b.aprovado && !comentario) return NextResponse.json({ erro: "diga o motivo da recusa" }, { status: 400 });
  const atual = await decidirAprovacao(sol, b.aprovado, sol.gestor_email || "gestor", comentario, "portal");
  return NextResponse.json({ ok: true, status: atual.status });
}
