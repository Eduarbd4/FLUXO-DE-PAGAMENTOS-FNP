"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function LoginForm({ volta, erroInicial }: { volta: string; erroInicial: string }) {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"" | "enviando" | "enviado">("");
  const [erro, setErro] = useState(erroInicial);
  const retorno = () => `${window.location.origin}/auth/callback?volta=${encodeURIComponent(volta)}`;

  async function microsoft() {
    setErro("");
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "azure",
      options: { scopes: "email openid profile", redirectTo: retorno() },
    });
    if (error) setErro(error.message);
  }

  async function link(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEstado("enviando");
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: retorno() },
    });
    if (error) {
      setErro(error.message);
      setEstado("");
    } else setEstado("enviado");
  }

  return (
    <div className="cartao space-y-5">
      <button onClick={microsoft} className="btn-escuro w-full py-3">
        <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden><rect width="10" height="10" fill="#F25022"/><rect x="11" width="10" height="10" fill="#7FBA00"/><rect y="11" width="10" height="10" fill="#00A4EF"/><rect x="11" y="11" width="10" height="10" fill="#FFB900"/></svg>
        Entrar com a conta Microsoft da empresa
      </button>
      <div className="flex items-center gap-3 text-xs text-gray-400"><span className="h-px flex-1 bg-linha" />ou receba um link por e-mail<span className="h-px flex-1 bg-linha" /></div>
      {estado === "enviado" ? (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Pronto! Abra o e-mail que enviamos para <b>{email}</b> e clique no link para entrar.</p>
      ) : (
        <form onSubmit={link} className="space-y-3">
          <input type="email" required className="campo" placeholder="seu.nome@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn-claro w-full" disabled={estado === "enviando"}>{estado === "enviando" ? "Enviando…" : "Enviar link de acesso"}</button>
        </form>
      )}
      {erro && <p className="text-sm text-marca">{erro}</p>}
    </div>
  );
}
