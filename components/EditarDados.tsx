"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIAS } from "@/lib/categorias";
import { FORMAS_PAGAMENTO, type Solicitacao } from "@/lib/tipos";
import { paraNumero } from "./FormNova";

const CAMPOS: [keyof Solicitacao, string, string?][] = [
  ["setor", "Setor"],
  ["centro_custo", "Centro de custo"],
  ["categoria", "Categoria", "categoria"],
  ["fornecedor", "Fornecedor"],
  ["cnpj", "CNPJ"],
  ["numero_documento", "Nº NF / documento"],
  ["pedido_compra", "Pedido de compra"],
  ["valor", "Valor (R$)"],
  ["vencimento", "Vencimento", "date"],
  ["forma_pagamento", "Forma de pagamento", "forma"],
  ["dados_pagamento", "Dados bancários / PIX"],
];

export default function EditarDados({ s }: { s: Solicitacao }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState<Record<string, string>>(() =>
    Object.fromEntries(CAMPOS.map(([k]) => [k, s[k] === null || s[k] === undefined ? "" : String(s[k]).replace(".", k === "valor" ? "," : ".")]))
  );
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function salvar() {
    setErro("");
    setOcupado(true);
    const r = await fetch(`/api/solicitacoes/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, valor: paraNumero(f.valor) }),
    });
    const j = await r.json();
    setOcupado(false);
    if (!r.ok) return setErro(j.erro || "falhou");
    setAberto(false);
    router.refresh();
  }

  if (!aberto) return <button onClick={() => setAberto(true)} className="text-xs font-semibold text-marca hover:underline">completar / editar</button>;
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4" onClick={() => setAberto(false)}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-lg font-bold">Completar dados</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {CAMPOS.filter(([k]) => s.tipo === "pagamento" || !["vencimento", "numero_documento", "pedido_compra", "forma_pagamento", "dados_pagamento"].includes(k)).map(([k, rot, tipo]) => (
            <div key={k} className={k === "dados_pagamento" ? "sm:col-span-2" : ""}>
              <label className="rotulo">{rot}</label>
              {tipo === "categoria" ? (
                <select className="campo" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
                  <option value="">—</option>
                  {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                </select>
              ) : tipo === "forma" ? (
                <select className="campo" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
                  <option value="">—</option>
                  {FORMAS_PAGAMENTO.map((c) => <option key={c}>{c}</option>)}
                </select>
              ) : (
                <input className="campo" type={tipo === "date" ? "date" : "text"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
              )}
            </div>
          ))}
        </div>
        {erro && <p className="mt-3 text-sm text-marca">{erro}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setAberto(false)} className="btn-claro">Cancelar</button>
          <button onClick={salvar} disabled={ocupado} className="btn-escuro">{ocupado ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}
