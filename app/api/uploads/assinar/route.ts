import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSessao } from "@/lib/auth";
import { admin, BUCKET } from "@/lib/supabase/admin";
import { nomeSeguro } from "@/lib/solicitacoes";

export const runtime = "nodejs";

// Gera links de envio direto para o Storage (os arquivos não passam pelo servidor, então não há limite de 4,5 MB).
export async function POST(req: Request) {
  const s = await getSessao();
  if (!s) return NextResponse.json({ erro: "faça login" }, { status: 401 });
  const { nomes } = (await req.json().catch(() => ({}))) as { nomes?: string[] };
  if (!Array.isArray(nomes) || nomes.length === 0 || nomes.length > 20) {
    return NextResponse.json({ erro: "envie de 1 a 20 arquivos" }, { status: 400 });
  }
  const links = [];
  for (const nome of nomes) {
    const caminho = `tmp/${s.id}/${randomUUID()}-${nomeSeguro(String(nome))}`;
    const { data, error } = await admin().storage.from(BUCKET).createSignedUploadUrl(caminho);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    links.push({ caminho, token: data.token });
  }
  return NextResponse.json({ links });
}
