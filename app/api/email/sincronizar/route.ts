import { NextResponse } from "next/server";
import { getSessao } from "@/lib/auth";
import { garantirAssinaturas, sincronizar } from "@/lib/inbound";

export const runtime = "nodejs";
export const maxDuration = 60;

// Botão "Sincronizar e-mails" (só Financeiro): útil na primeira configuração e se algo atrasar.
export async function POST() {
  const s = await getSessao();
  if (!s?.financeiro) return NextResponse.json({ erro: "só o Financeiro" }, { status: 403 });
  const assinaturas = await garantirAssinaturas().catch((e) => [`erro: ${(e as Error).message}`]);
  const varredura = await sincronizar(3).catch((e) => [`erro: ${(e as Error).message}`]);
  return NextResponse.json({ assinaturas, varredura });
}
