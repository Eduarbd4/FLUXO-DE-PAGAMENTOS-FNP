"use client";
import { useState } from "react";

export default function Aprovacao({ token }: { token: string }) {
  const [comentario, setComentario] = useState("");
  const [estado, setEstado] = useState<"" | "enviando" | "aprovado" | "recusado">("");
  const [erro, setErro] = useState("");

  async function decidir(aprovado: boolean) {
    setErro("");
    if (!aprovado && !comentario.trim()) return setErro("Escreva o motivo da recusa.");
    setEstado("enviando");
    const r = await fetch(`/api/aprovar/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aprovado, comentario }),
    });
    const j = await r.json();
    if (!r.ok) {
      setErro(j.erro || "falhou");
      setEstado("");
      return;
    }
    setEstado(aprovado ? "aprovado" : "recusado");
  }

  if (estado === "aprovado" || estado === "recusado") {
    return (
      <p className={`mt-5 rounded-xl p-4 font-semibold ${estado === "aprovado" ? "bg-green-50 text-green-800" : "bg-gray-100 text-gray-800"}`}>
        {estado === "aprovado" ? "Aprovado! O Financeiro e o solicitante foram avisados." : "Recusado. O solicitante recebeu o motivo por e-mail."}
      </p>
    );
  }
  return (
    <div className="mt-5 space-y-3">
      <textarea className="campo" placeholder="Comentário (obrigatório para recusar)" value={comentario} onChange={(e) => setComentario(e.target.value)} />
      {erro && <p className="text-sm text-marca">{erro}</p>}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => decidir(false)} disabled={estado === "enviando"} className="btn-claro py-3">Recusar</button>
        <button onClick={() => decidir(true)} disabled={estado === "enviando"} className="btn bg-teal-700 py-3 text-white hover:bg-teal-800">Aprovar</button>
      </div>
    </div>
  );
}
