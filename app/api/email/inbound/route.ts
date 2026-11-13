import { after } from "next/server";
import { processarMensagem } from "@/lib/inbound";

export const runtime = "nodejs";
export const maxDuration = 60;

type Aviso = { clientState?: string; resourceData?: { id?: string } };

// O Microsoft 365 chama este endereço a cada e-mail novo na caixa do Financeiro.
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("validationToken");
  if (token) {
    // validação feita pela Microsoft ao criar a assinatura
    return new Response(token, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  let corpo: { value?: Aviso[] } = {};
  try {
    corpo = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const ids = (corpo.value || [])
    .filter((n) => n.clientState && n.clientState === process.env.GRAPH_CLIENT_STATE)
    .map((n) => n.resourceData?.id)
    .filter((x): x is string => !!x);

  // responde na hora (a Microsoft exige < 3 s) e processa logo depois
  after(async () => {
    for (const id of ids) {
      try {
        console.log("[e-mail]", await processarMensagem(id));
      } catch (e) {
        console.error("[e-mail] erro", id, e);
      }
    }
  });
  return new Response(null, { status: 202 });
}
