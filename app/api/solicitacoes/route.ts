import { NextResponse } from "next/server";
import { getSessao } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { anexarTemporarios, registrarEvento, adicionarMensagem } from "@/lib/solicitacoes";
import { avisarNovaSolicitacao } from "@/lib/emails";
import { foraDoPrazo } from "@/lib/datas";
import { FORMAS_PAGAMENTO, type AnexoEnviado, type Solicitacao } from "@/lib/tipos";

export const runtime = "nodejs";
export const maxDuration = 60;

const txt = (v: unknown, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const emailOk = (v: string | null) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export async function POST(req: Request) {
  const s = await getSessao();
  if (!s) return NextResponse.json({ erro: "faça login" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const tipo = b.tipo === "orcamento" ? "orcamento" : b.tipo === "pagamento" ? "pagamento" : null;
  if (!tipo) return NextResponse.json({ erro: "escolha o tipo" }, { status: 400 });
  const descricao = txt(b.descricao, 8000);
  const fornecedor = txt(b.fornecedor);
  const gestor = txt(b.gestor_email)?.toLowerCase() || null;
  const vencimento = txt(b.vencimento, 10);
  const valor = b.valor === "" || b.valor === null || b.valor === undefined ? null : Number(b.valor);
  const forma = txt(b.forma_pagamento);
  const anexos = (Array.isArray(b.anexos) ? b.anexos : []) as AnexoEnviado[];

  const erros: string[] = [];
  if (!descricao) erros.push("descreva o pedido");
  if (!txt(b.setor)) erros.push("informe o setor");
  if (!emailOk(gestor)) erros.push("e-mail do gestor inválido");
  if (valor !== null && (!isFinite(valor) || valor < 0)) erros.push("valor inválido");
  if (vencimento && !/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) erros.push("vencimento inválido");
  if (forma && !FORMAS_PAGAMENTO.includes(forma)) erros.push("forma de pagamento inválida");
  if (tipo === "pagamento") {
    if (!fornecedor) erros.push("informe o fornecedor");
    if (!vencimento) erros.push("informe o vencimento");
    if (valor === null) erros.push("informe o valor");
    if (anexos.length === 0) erros.push("anexe a nota fiscal ou o boleto");
  }
  const atrasado = tipo === "pagamento" && !!vencimento && foraDoPrazo(vencimento);
  const justificativa = txt(b.justificativa_prazo, 2000);
  if (atrasado && !justificativa) erros.push("explique por que o documento está fora do prazo");
  if (erros.length) return NextResponse.json({ erro: erros.join("; ") }, { status: 400 });

  const { data, error } = await admin()
    .from("solicitacoes")
    .insert({
      tipo,
      status: gestor ? "Aguardando aprovação" : "Recebido",
      origem: "portal",
      solicitante_email: s.email,
      solicitante_nome: s.nome,
      setor: txt(b.setor),
      centro_custo: txt(b.centro_custo),
      categoria: txt(b.categoria),
      fornecedor,
      cnpj: txt(b.cnpj, 30),
      numero_documento: txt(b.numero_documento, 60),
      pedido_compra: txt(b.pedido_compra, 60),
      descricao,
      valor,
      vencimento,
      forma_pagamento: forma,
      dados_pagamento: txt(b.dados_pagamento, 1000),
      gestor_email: gestor,
      fora_do_prazo: atrasado,
      justificativa_prazo: atrasado ? justificativa : null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  const sol = data as Solicitacao;

  await registrarEvento(sol.id, "Solicitação aberta pelo portal", s.email);
  const msg = await adicionarMensagem(sol, {
    autor_email: s.email,
    autor_nome: s.nome,
    autor_tipo: "solicitante",
    texto: descricao!,
    origem: "portal",
    interna: false,
  });
  const qtd = await anexarTemporarios(anexos, sol.id, msg.id, s.id, s.email);
  await avisarNovaSolicitacao(sol, qtd).catch((e) => console.error("e-mail nova solicitação", e));
  return NextResponse.json({ id: sol.id, protocolo: sol.protocolo });
}
