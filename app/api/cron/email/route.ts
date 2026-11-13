import { NextResponse } from "next/server";
import { garantirAssinaturas, sincronizar } from "@/lib/inbound";

export const runtime = "nodejs";
export const maxDuration = 60;

// Roda 1x por dia (vercel.json): renova as assinaturas e varre e-mails que possam ter escapado.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  const assinaturas = await garantirAssinaturas().catch((e) => [`erro: ${(e as Error).message}`]);
  const varredura = await sincronizar(3).catch((e) => [`erro: ${(e as Error).message}`]);
  return NextResponse.json({ assinaturas, varredura });
}
