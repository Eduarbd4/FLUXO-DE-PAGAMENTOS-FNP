"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Anexador from "./Anexador";
import { CATEGORIAS } from "@/lib/categorias";
import { FORMAS_PAGAMENTO, type AnexoEnviado, type Tipo } from "@/lib/tipos";
import { dataBR, foraDoPrazo, prazoEnvio } from "@/lib/datas";

export function paraNumero(v?: string): string {
  if (!v) return "";
  const t = v.replace(/[^\d.,-]/g, "");
  return t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
}

export default function FormNova() {
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>("pagamento");
  const [f, setF] = useState<Record<string, string>>({ forma_pagamento: "Boleto" });
  const [anexos, setAnexos] = useState<AnexoEnviado[]>([]);
  const [subindo, setSubindo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  const prazo = useMemo(() => {
    if (tipo !== "pagamento" || !/^\d{4}-\d{2}-\d{2}$/.test(f.vencimento || "")) return null;
    return { limite: prazoEnvio(f.vencimento), atrasado: foraDoPrazo(f.vencimento) };
  }, [tipo, f.vencimento]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const r = await fetch("/api/solicitacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, tipo, valor: paraNumero(f.valor), anexos }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || "não foi possível enviar");
      router.push(`/s/${j.id}?nova=1`);
    } catch (e) {
      setErro((e as Error).message);
      setEnviando(false);
    }
  }

  const pag = tipo === "pagamento";
  return (
    <form onSubmit={enviar} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {([
          ["pagamento", "Pagamento", "Tenho a NF, boleto ou guia para pagar"],
          ["orcamento", "Orçamento", "Quero aprovar uma compra / cotação antes de comprar"],
        ] as const).map(([v, t, d]) => (
          <button
            type="button"
            key={v}
            onClick={() => setTipo(v)}
            className={`rounded-xl border-2 p-4 text-left transition ${tipo === v ? "border-marca bg-marca-claro" : "border-linha bg-white hover:border-gray-400"}`}
          >
            <span className="block font-bold">{t}</span>
            <span className="text-sm text-gray-600">{d}</span>
          </button>
        ))}
      </div>

      <section className="cartao grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo">Setor *</label>
          <input className="campo" required value={f.setor || ""} onChange={set("setor")} placeholder="Ex.: Cozinha central" />
        </div>
        <div>
          <label className="rotulo">Centro de custo</label>
          <input className="campo" value={f.centro_custo || ""} onChange={set("centro_custo")} placeholder="Se souber" />
        </div>
        <div>
          <label className="rotulo">Fornecedor {pag && "*"}</label>
          <input className="campo" required={pag} value={f.fornecedor || ""} onChange={set("fornecedor")} />
        </div>
        <div>
          <label className="rotulo">CNPJ do fornecedor</label>
          <input className="campo" value={f.cnpj || ""} onChange={set("cnpj")} placeholder="00.000.000/0000-00" />
        </div>
        <div>
          <label className="rotulo">Categoria</label>
          <select className="campo" value={f.categoria || ""} onChange={set("categoria")}>
            <option value="">—</option>
            {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo">Valor (R$) {pag && "*"}</label>
          <input className="campo" required={pag} inputMode="decimal" value={f.valor || ""} onChange={set("valor")} placeholder="1.850,40" />
        </div>
        {pag && (
          <>
            <div>
              <label className="rotulo">Nº da NF / documento</label>
              <input className="campo" value={f.numero_documento || ""} onChange={set("numero_documento")} />
            </div>
            <div>
              <label className="rotulo">Pedido de compra / orçamento aprovado</label>
              <input className="campo" value={f.pedido_compra || ""} onChange={set("pedido_compra")} />
            </div>
            <div>
              <label className="rotulo">Vencimento *</label>
              <input className="campo" type="date" required value={f.vencimento || ""} onChange={set("vencimento")} />
              {prazo && (
                <p className={`mt-1 text-xs ${prazo.atrasado ? "font-semibold text-marca" : "text-gray-500"}`}>
                  {prazo.atrasado ? `Fora do prazo: deveria chegar até ${dataBR(prazo.limite)}.` : `Prazo para enviar: até ${dataBR(prazo.limite)}.`}
                </p>
              )}
            </div>
            <div>
              <label className="rotulo">Forma de pagamento</label>
              <select className="campo" value={f.forma_pagamento || ""} onChange={set("forma_pagamento")}>
                {FORMAS_PAGAMENTO.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            {(f.forma_pagamento === "PIX" || f.forma_pagamento === "TED") && (
              <div className="sm:col-span-2">
                <label className="rotulo">Dados bancários / chave PIX (no CNPJ da nota)</label>
                <input className="campo" value={f.dados_pagamento || ""} onChange={set("dados_pagamento")} />
              </div>
            )}
          </>
        )}
        <div className="sm:col-span-2">
          <label className="rotulo">{pag ? "O que está sendo pago? *" : "O que você precisa comprar/contratar? *"}</label>
          <textarea className="campo min-h-[96px]" required value={f.descricao || ""} onChange={set("descricao")}
            placeholder={pag ? "Ex.: manutenção da câmara fria realizada em 05/11, conforme orçamento aprovado" : "Ex.: 2 orçamentos para troca do exaustor da cozinha. Prazo desejado: dezembro."} />
        </div>
        <div className="sm:col-span-2">
          <label className="rotulo">E-mail do gestor que aprova</label>
          <input className="campo" type="email" value={f.gestor_email || ""} onChange={set("gestor_email")} placeholder="gestor@empresa.com.br" />
          <p className="mt-1 text-xs text-gray-500">O gestor recebe um e-mail com o botão Aprovar/Recusar (ou responde APROVADO).</p>
        </div>
        {prazo?.atrasado && (
          <div className="sm:col-span-2">
            <label className="rotulo text-marca">Por que está fora do prazo? *</label>
            <textarea className="campo" required value={f.justificativa_prazo || ""} onChange={set("justificativa_prazo")} />
          </div>
        )}
      </section>

      <section className="cartao">
        <label className="rotulo">Anexos {pag && "* (NF em PDF/XML, boleto)"}</label>
        <Anexador anexos={anexos} onChange={setAnexos} onEnviando={setSubindo} />
      </section>

      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-marca">{erro}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.back()} className="btn-claro">Cancelar</button>
        <button className="btn-primario" disabled={enviando || subindo}>{enviando ? "Enviando…" : "Enviar solicitação"}</button>
      </div>
    </form>
  );
}
