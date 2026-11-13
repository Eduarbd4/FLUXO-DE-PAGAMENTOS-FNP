import { getSessao } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { TIPO_ROTULO, type Solicitacao } from "@/lib/tipos";

export const runtime = "nodejs";

// CSV no formato da aba "Vencimentos" da planilha Controles_Contas_a_Pagar.xlsx
export async function GET() {
  const s = await getSessao();
  if (!s?.financeiro) return new Response("só o Financeiro", { status: 403 });
  const { data } = await admin()
    .from("solicitacoes")
    .select("*")
    .eq("tipo", "pagamento")
    .order("vencimento", { ascending: true, nullsFirst: false });
  const base = (process.env.APP_URL || "").replace(/\/$/, "");
  const br = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");
  const num = (v: number | null) => (v === null || v === undefined ? "" : Number(v).toFixed(2).replace(".", ","));
  const q = (v: unknown) => {
    const t = String(v ?? "");
    return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const cab = [
    "Recebido em", "Fornecedor", "CNPJ", "Tipo", "Nº NF / documento", "Categoria", "Setor / solicitante",
    "Gestor aprovador", "Pedido de compra", "Vencimento", "Valor bruto", "Retenções",
    "Forma de pagamento", "Etapa", "Data do pagamento", "Link do anexo", "Comentários",
  ];
  const linhas = ((data || []) as Solicitacao[]).map((x) => [
    br(x.criado_em), x.fornecedor, x.cnpj, x.forma_pagamento === "Guia" ? "Guia" : x.forma_pagamento === "Boleto" ? "Boleto" : "NF",
    x.numero_documento, x.categoria, [x.setor, x.solicitante_nome].filter(Boolean).join(" · "), x.gestor_email,
    x.pedido_compra, br(x.vencimento), num(x.valor), "", x.forma_pagamento, x.status, "",
    `${base}/s/${x.id}`, `#${x.protocolo} ${TIPO_ROTULO[x.tipo]}${x.fora_do_prazo ? " · fora do prazo" : ""}`,
  ]);
  const csv = "﻿" + [cab, ...linhas].map((l) => l.map(q).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="solicitacoes-pagamento.csv"`,
    },
  });
}
