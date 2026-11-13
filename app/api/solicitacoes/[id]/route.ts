import { NextResponse } from "next/server";
import { getSessao, podeVer } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { buscar, mudarStatus, registrarEvento } from "@/lib/solicitacoes";
import { ETAPAS, FORMAS_PAGAMENTO } from "@/lib/tipos";

export const runtime = "nodejs";

const EDITAVEIS = [
  "setor", "centro_custo", "categoria", "fornecedor", "cnpj", "numero_documento", "pedido_compra",
  "descricao", "valor", "vencimento", "forma_pagamento", "dados_pagamento",
] as const;

// Muda a etapa (Financeiro) e/ou completa dados (Financeiro sempre; solicitante enquanto Recebido/Devolvido)
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessao = await getSessao();
  if (!sessao) return NextResponse.json({ erro: "faça login" }, { status: 401 });
  const { id } = await ctx.params;
  let sol = await buscar(id);
  if (!sol || !podeVer(sol, sessao)) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const campos: Record<string, unknown> = {};
  for (const k of EDITAVEIS) {
    if (!(k in b)) continue;
    const v = b[k];
    if (k === "valor") {
      const n = v === "" || v === null ? null : Number(v);
      if (n !== null && (!isFinite(n) || n < 0)) return NextResponse.json({ erro: "valor inválido" }, { status: 400 });
      campos.valor = n;
    } else if (k === "vencimento") {
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return NextResponse.json({ erro: "vencimento inválido" }, { status: 400 });
      campos.vencimento = v || null;
    } else if (k === "forma_pagamento") {
      if (v && !FORMAS_PAGAMENTO.includes(String(v))) return NextResponse.json({ erro: "forma inválida" }, { status: 400 });
      campos.forma_pagamento = v || null;
    } else {
      campos[k] = typeof v === "string" && v.trim() ? v.trim().slice(0, k === "descricao" ? 8000 : 1000) : null;
    }
  }
  if (Object.keys(campos).length) {
    const solicitantePode = ["Recebido", "Devolvido", "Em análise"].includes(sol.status);
    if (!sessao.financeiro && !solicitantePode) {
      return NextResponse.json({ erro: "depois de aprovado, só o Financeiro altera os dados" }, { status: 403 });
    }
    const { data, error } = await admin()
      .from("solicitacoes")
      .update({ ...campos, atualizado_em: new Date().toISOString() })
      .eq("id", sol.id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    sol = data;
    await registrarEvento(sol!.id, `Dados atualizados: ${Object.keys(campos).join(", ")}`, sessao.email);
  }

  if (typeof b.status === "string" && b.status !== sol!.status) {
    if (!sessao.financeiro) return NextResponse.json({ erro: "só o Financeiro muda a etapa" }, { status: 403 });
    if (!ETAPAS[sol!.tipo].includes(b.status)) return NextResponse.json({ erro: "etapa inválida" }, { status: 400 });
    sol = await mudarStatus(sol!, b.status, sessao.email, typeof b.motivo === "string" ? b.motivo.slice(0, 1000) : undefined);
  }
  return NextResponse.json({ ok: true, status: sol!.status });
}
