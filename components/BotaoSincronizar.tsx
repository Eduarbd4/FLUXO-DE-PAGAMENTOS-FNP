"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BotaoSincronizar() {
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();
  async function rodar() {
    setOcupado(true);
    setMsg("");
    try {
      const r = await fetch("/api/email/sincronizar", { method: "POST" });
      const j = await r.json();
      const novos = (j.varredura || []).filter((x: string) => !x.includes("já processado"));
      setMsg(r.ok ? `${novos.length} e-mail(s) processado(s)` : j.erro || "falhou");
      router.refresh();
    } catch {
      setMsg("falhou");
    } finally {
      setOcupado(false);
    }
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={rodar} disabled={ocupado} className="btn-claro">{ocupado ? "Lendo e-mails…" : "Sincronizar e-mails"}</button>
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </span>
  );
}
