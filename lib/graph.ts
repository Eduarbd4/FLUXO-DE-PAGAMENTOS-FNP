// Microsoft Graph (Microsoft 365): envio e leitura de e-mails da caixa compartilhada do Financeiro.
// Autenticação "app-only" (client credentials). Permissões de APLICATIVO: Mail.Send e Mail.ReadWrite.

const GRAPH = "https://graph.microsoft.com/v1.0";
export const CABECALHO_PORTAL = "X-Portal-Financeiro";
export const RODAPE_PORTAL = "Mensagem automática do Portal Financeiro";

let cacheToken: { valor: string; expira: number } | null = null;

export function emailConfigurado(): boolean {
  return Boolean(
    process.env.MS_TENANT_ID && process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET && process.env.MAILBOX_ADDRESS
  );
}

export function caixa(): string {
  return (process.env.MAILBOX_ADDRESS || "").toLowerCase();
}

async function token(): Promise<string> {
  if (cacheToken && cacheToken.expira > Date.now() + 60_000) return cacheToken.valor;
  const corpo = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID!,
    client_secret: process.env.MS_CLIENT_SECRET!,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const r = await fetch(`https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: corpo,
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Falha ao autenticar no Microsoft 365: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  cacheToken = { valor: j.access_token, expira: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

export async function graph<T = unknown>(
  caminho: string,
  init: RequestInit & { prefer?: string } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await token()}`,
    "Content-Type": "application/json",
  };
  if (init.prefer) headers.Prefer = init.prefer;
  const r = await fetch(caminho.startsWith("http") ? caminho : GRAPH + caminho, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    cache: "no-store",
  });
  if (!r.ok) {
    const erro = new Error(`Graph ${r.status} em ${caminho}: ${await r.text()}`) as Error & { status?: number };
    erro.status = r.status;
    throw erro;
  }
  if (r.status === 202 || r.status === 204) return null as T;
  return (await r.json()) as T;
}

export type EmailSaida = { para: string[]; cc?: string[]; assunto: string; html: string };

function destinatarios(lista: string[] = []) {
  const unicos = Array.from(new Set(lista.map((e) => e.trim().toLowerCase()).filter(Boolean)));
  // nunca manda para a própria caixa (evita o portal ler o próprio aviso como resposta)
  return unicos.filter((e) => e !== caixa()).map((address) => ({ emailAddress: { address } }));
}

/** Envia um e-mail a partir da caixa do Financeiro. Sem configuração, só registra no log. */
export async function enviarEmail(e: EmailSaida): Promise<void> {
  const to = destinatarios(e.para);
  if (to.length === 0) return;
  if (!emailConfigurado()) {
    console.warn("[e-mail desativado] para:", e.para.join(", "), "| assunto:", e.assunto);
    return;
  }
  await graph(`/users/${encodeURIComponent(caixa())}/sendMail`, {
    method: "POST",
    body: JSON.stringify({
      message: {
        subject: e.assunto,
        body: { contentType: "HTML", content: e.html },
        toRecipients: to,
        ccRecipients: destinatarios(e.cc),
        replyTo: [{ emailAddress: { address: caixa() } }],
        internetMessageHeaders: [{ name: CABECALHO_PORTAL, value: "1" }],
      },
      saveToSentItems: true,
    }),
  });
}
