import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { dominioPermitido } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const volta = url.searchParams.get("volta") || "/";
  const destino = volta.startsWith("/") && !volta.startsWith("//") ? volta : "/";
  if (code) {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    if (!error && data.user?.email) {
      if (!dominioPermitido(data.user.email)) {
        await sb.auth.signOut();
        return NextResponse.redirect(new URL("/login?erro=dominio", url.origin));
      }
      return NextResponse.redirect(new URL(destino, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?erro=link", url.origin));
}
