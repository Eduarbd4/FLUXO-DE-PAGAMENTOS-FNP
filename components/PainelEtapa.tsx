"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PainelEtapa({ id, atual, etapas }: { id: string; atual: string; etapas: string[] }) {
  const router = useRouter();
  const [status, setStatus] = useState(atual);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const exigeMotivo = status === "Devolvido" || status === "Recusado";

  async function salvar() {
    setErro("");
    if (exigeMotivo && !motivo.trim()) return setErro("Diga o motivo — o solicitante recebe por e-mail.");
    setOcupado(true);
    const r = await fetch(`/api/solicitacoes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, motivo }),
    });
    const j = await r.json();
    setOcupado(false);
    if (!r.ok) return setErro(j.erro || "falhou");
    setMotivo("");
    router.refresh();
  }

  return (
    <section className="cartao space-y-3 border-tinta">
      <h2 className="font-bold">Etapa (Financeiro)</h2>
      <div className="flex flex-wrap gap-1.5">
        {etapas.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setStatus(e)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${status === e ? "bg-tinta text-white ring-tinta" : "bg-white ring-linha hover:bg-gray-50"}`}
          >
            {e}
          </button>
        ))}
      </div>
      <textarea className="campo text-sm" placeholder={exigeMotivo ? "Motivo (obrigatório)" : "Observação para o solicitante (opcional)"} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      {erro && <p className="text-xs text-marca">{erro}</p>}
      <button onClick={salvar} disabled={ocupado || status === atual} className="btn-escuro w-full">
        {ocupado ? "Salvando…" : status === atual ? "Escolha a nova etapa" : `Mover para “${status}” e avisar`}
      </button>
    </section>
  );
}
