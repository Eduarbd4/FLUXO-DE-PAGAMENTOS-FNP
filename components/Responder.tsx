"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Anexador from "./Anexador";
import type { AnexoEnviado } from "@/lib/tipos";

export default function Responder({ solicitacaoId, financeiro, caixa }: { solicitacaoId: string; financeiro: boolean; caixa: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [anexos, setAnexos] = useState<AnexoEnviado[]>([]);
  const [interna, setInterna] = useState(false);
  const [subindo, setSubindo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setOcupado(true);
    const r = await fetch(`/api/solicitacoes/${solicitacaoId}/mensagens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto, anexos, interna }),
    });
    const j = await r.json();
    setOcupado(false);
    if (!r.ok) return setErro(j.erro || "falhou");
    setTexto("");
    setAnexos([]);
    setInterna(false);
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="cartao space-y-3">
      <textarea
        className="campo min-h-[90px]"
        placeholder={financeiro ? "Responder ao solicitante…" : "Escreva para o Financeiro…"}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <Anexador anexos={anexos} onChange={setAnexos} onEnviando={setSubindo} />
      {erro && <p className="text-sm text-marca">{erro}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {financeiro ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={interna} onChange={(e) => setInterna(e.target.checked)} />
            Nota interna (não envia e-mail, só a equipe vê)
          </label>
        ) : (
          <span className="text-xs text-gray-500">Também dá para responder pelo e-mail{caixa ? ` (${caixa})` : ""}.</span>
        )}
        <button className="btn-primario" disabled={ocupado || subindo || (!texto.trim() && anexos.length === 0)}>
          {ocupado ? "Enviando…" : interna ? "Salvar nota" : "Enviar"}
        </button>
      </div>
    </form>
  );
}
