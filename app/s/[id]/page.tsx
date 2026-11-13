import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessao, podeVer } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { buscar } from "@/lib/solicitacoes";
import Cabecalho from "@/components/Cabecalho";
import Etiqueta from "@/components/Etiqueta";
import PainelEtapa from "@/components/PainelEtapa";
import Responder from "@/components/Responder";
import EditarDados from "@/components/EditarDados";
import { tamanhoLegivel } from "@/components/Anexador";
import { dataBR, dataHoraBR, diasPara, moeda, prazoEnvio } from "@/lib/datas";
import { ETAPAS, STATUS_FINAIS, TIPO_ROTULO, type Anexo, type Mensagem } from "@/lib/tipos";

export const dynamic = "force-dynamic";

const COR_AUTOR: Record<string, string> = {
  financeiro: "border-tinta bg-blue-50/40",
  solicitante: "border-orange-300 bg-white",
  gestor: "border-teal-500 bg-teal-50/40",
  sistema: "border-gray-300 bg-gray-50",
};
const ROTULO_AUTOR: Record<string, string> = { financeiro: "Financeiro", solicitante: "Solicitante", gestor: "Gestor", sistema: "Sistema" };

export default async function Detalhe({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");
  const { id } = await params;
  const sp = await searchParams;
  const s = await buscar(id);
  if (!s || !podeVer(s, sessao)) notFound();

  const [{ data: msgs }, { data: anx }, { data: evs }] = await Promise.all([
    admin().from("mensagens").select("*").eq("solicitacao_id", s.id).order("criado_em"),
    admin().from("anexos").select("*").eq("solicitacao_id", s.id).order("criado_em"),
    admin().from("eventos").select("*").eq("solicitacao_id", s.id).order("criado_em", { ascending: false }),
  ]);
  const mensagens = ((msgs || []) as Mensagem[]).filter((m) => sessao.financeiro || !m.interna);
  const idsVisiveis = new Set(mensagens.map((m) => m.id));
  const anexos = ((anx || []) as Anexo[]).filter((a) => !a.mensagem_id || idsVisiveis.has(a.mensagem_id));
  const porMsg = new Map<string, Anexo[]>();
  anexos.forEach((a) => a.mensagem_id && porMsg.set(a.mensagem_id, [...(porMsg.get(a.mensagem_id) || []), a]));

  const d = s.vencimento ? diasPara(s.vencimento) : null;
  const podeEditar = sessao.financeiro || ["Recebido", "Devolvido", "Em análise"].includes(s.status);
  const dados: [string, string][] = [
    ["Solicitante", `${s.solicitante_nome || ""} · ${s.solicitante_email}`],
    ["Setor / centro de custo", [s.setor, s.centro_custo].filter(Boolean).join(" · ") || "—"],
    ["Categoria", s.categoria || "—"],
    ["Fornecedor", [s.fornecedor, s.cnpj].filter(Boolean).join(" · ") || "—"],
    ["Valor", moeda(s.valor)],
  ];
  if (s.tipo === "pagamento") {
    dados.push(["Vencimento", s.vencimento ? `${dataBR(s.vencimento)} · prazo de envio ${dataBR(prazoEnvio(s.vencimento))}` : "—"]);
    dados.push(["Nº documento / pedido", [s.numero_documento, s.pedido_compra].filter(Boolean).join(" · ") || "—"]);
    dados.push(["Forma de pagamento", [s.forma_pagamento, s.dados_pagamento].filter(Boolean).join(" · ") || "—"]);
  }
  dados.push(["Gestor aprovador", s.gestor_email ? `${s.gestor_email}${s.aprovado_em ? ` · aprovou em ${dataHoraBR(s.aprovado_em)}` : s.aprovacao_token ? " · aguardando" : ""}` : "—"]);

  return (
    <>
      <Cabecalho sessao={sessao} />
      <main className="mx-auto grid max-w-6xl gap-5 px-5 py-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <div>
            <Link href="/" className="text-sm text-gray-500 hover:underline">← voltar</Link>
            {sp.nova && (
              <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
                Solicitação enviada! Mandamos a confirmação para o seu e-mail{s.gestor_email ? " e o pedido de aprovação para o gestor" : ""}.
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-extrabold">#{s.protocolo} · {TIPO_ROTULO[s.tipo]}</h1>
              <Etiqueta status={s.status} />
              {s.origem === "email" && <span className="text-xs text-gray-500">✉️ aberto por e-mail</span>}
            </div>
            <p className="mt-1 text-gray-600">{s.fornecedor || (s.descricao || "").split("\n")[0]}</p>
            {s.fora_do_prazo && (
              <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><b>Fora do prazo.</b> {s.justificativa_prazo}</p>
            )}
            {d !== null && !STATUS_FINAIS.includes(s.status) && d <= 3 && (
              <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-marca">
                {d < 0 ? `Vencido há ${-d} dia(s).` : d === 0 ? "Vence hoje." : `Vence em ${d} dia(s).`}
              </p>
            )}
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-bold">Conversa</h2>
            {mensagens.map((m) => (
              <article key={m.id} className={`rounded-xl border-l-4 p-4 ring-1 ring-linha ${m.interna ? "border-amber-400 bg-amber-50" : COR_AUTOR[m.autor_tipo]}`}>
                <header className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                  <span>
                    <b className="text-sm text-tinta">{m.autor_nome || m.autor_email}</b> · {ROTULO_AUTOR[m.autor_tipo]}
                    {m.origem === "email" && " · por e-mail"}
                    {m.interna && " · nota interna (só Financeiro)"}
                  </span>
                  <span>{dataHoraBR(m.criado_em)}</span>
                </header>
                {m.texto && <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.texto}</p>}
                {(porMsg.get(m.id) || []).length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {porMsg.get(m.id)!.map((a) => (
                      <li key={a.id}>
                        <a href={`/api/anexos/${a.id}`} className="inline-block rounded-md bg-white px-2.5 py-1 text-xs font-medium ring-1 ring-linha hover:bg-gray-50">
                          📎 {a.nome}{a.tamanho ? ` · ${tamanhoLegivel(a.tamanho)}` : ""}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
            <Responder solicitacaoId={s.id} financeiro={sessao.financeiro} caixa={process.env.MAILBOX_ADDRESS || ""} />
          </section>
        </div>

        <aside className="space-y-5">
          {sessao.financeiro && <PainelEtapa id={s.id} atual={s.status} etapas={ETAPAS[s.tipo]} />}
          <section className="cartao">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-bold">Dados</h2>
              {podeEditar && <EditarDados s={s} />}
            </div>
            <dl className="space-y-2 text-sm">
              {dados.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{k}</dt>
                  <dd className="break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="cartao">
            <h2 className="mb-2 font-bold">Todos os anexos ({anexos.length})</h2>
            <ul className="space-y-1 text-sm">
              {anexos.map((a) => (
                <li key={a.id}>
                  <a href={`/api/anexos/${a.id}`} className="hover:underline">📎 {a.nome}</a>
                  <span className="block text-xs text-gray-500">{a.enviado_por} · {dataHoraBR(a.criado_em)}</span>
                </li>
              ))}
              {anexos.length === 0 && <li className="text-gray-500">Nenhum anexo.</li>}
            </ul>
          </section>
          <section className="cartao">
            <h2 className="mb-2 font-bold">Histórico</h2>
            <ul className="space-y-2 text-xs">
              {(evs || []).map((e) => (
                <li key={e.id}>
                  <span className="text-gray-500">{dataHoraBR(e.criado_em)}</span>
                  <span className="block">{e.descricao}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </main>
    </>
  );
}
