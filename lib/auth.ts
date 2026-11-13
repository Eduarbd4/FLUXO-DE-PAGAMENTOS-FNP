import { supabaseServer } from "./supabase/server";
import { admin } from "./supabase/admin";
import type { Solicitacao } from "./tipos";

export type Sessao = { id: string; email: string; nome: string; financeiro: boolean };

export function dominioPermitido(email: string): boolean {
  const dominios = (process.env.ALLOWED_EMAIL_DOMAINS || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (dominios.length === 0) return true;
  const e = email.toLowerCase();
  return dominios.some((d) => e.endsWith("@" + d));
}

export async function equipeFinanceiro(): Promise<{ email: string; nome: string }[]> {
  const { data } = await admin().from("financeiro_equipe").select("email, nome");
  return (data || []).map((m) => ({ email: String(m.email).toLowerCase(), nome: m.nome }));
}

export async function ehFinanceiro(email: string): Promise<boolean> {
  const { data } = await admin()
    .from("financeiro_equipe")
    .select("email")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  return !!data;
}

/** Quem está logado (ou null). Também barra e-mails de fora dos domínios permitidos. */
export async function getSessao(): Promise<Sessao | null> {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.email) return null;
  const email = user.email.toLowerCase();
  if (!dominioPermitido(email)) return null;
  const meta = (user.user_metadata || {}) as Record<string, string>;
  const nome = meta.full_name || meta.name || email.split("@")[0];
  return { id: user.id, email, nome, financeiro: await ehFinanceiro(email) };
}

export function podeVer(sol: Pick<Solicitacao, "solicitante_email">, s: Sessao): boolean {
  return s.financeiro || sol.solicitante_email.toLowerCase() === s.email;
}
