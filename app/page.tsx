import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import Cabecalho from "@/components/Cabecalho";
import Etiqueta from "@/components/Etiqueta";
import BotaoSincronizar from "@/components/BotaoSincronizar";
import { dataBR, dataHoraBR, diasPara, moeda } from "@/lib/datas";
import { ETAPAS, STATUS_FINAIS, TIPO_ROTULO, type Solicitacao } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function Inicio({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");
  const sp = await searchParams;
  const ver = sp.ver || "abertos";
  const tipo = sp.tipo === "orcamento" || sp.tipo === "pagamento" ? sp.tipo : "";
  const busca = (sp.q || "").replace(/[,()%*]/g, " ").trim().slice(0, 60);

  let q = admin().from("solicitacoes").select("*").order("atualizado_em", { ascending: false }).limit(300);
  if (!sessao.financeiro) q = q.eq("solicitante_email", sessao.email);
  if (ver === "abertos") q = q.not("status", "in", `(${STATUS_FINAIS.map((s) => `"${s}"`).join(",")})`);
  else if (ver !== "todos") q = q.eq("status", ver);
  if (tipo) q = q.eq("tipo", tipo);
  if (busca) {
    q = /^\d+$/.test(busca)
      ? q.eq("protocolo", Number(busca))
      : q.or(`fornecedor.ilike.%${busca}%,descricao.ilike.%${busca}%,solicitante_email.ilike.%${busca}%,setor.ilike.%${busca}%`);
  }
  const { data } = await q;
  const lista = (data || []) as Solicitacao[];

  const urgentes = lista.filter(
    (s) => s.tipo === "pagamento" && s.vencimento && !STATUS_FINAIS.includes(s.status) && diasPara(s.vencimento) <= 3
  ).length;
  const aguardando = lista.filter((s) => s.status === "Aguardando aprovação").length;
  const recebidos = lista.filter((s) => s.status === "Recebido").length;
  const todasEtapas = Array.from(new Set([...ETAPAS.pagamento, ...ETAPAS.orcamento]));

  return (
    <>
      <Cabecalho sessao={sessao} />
      <main className="mx-auto max-w-6xl space-y-5 px-5 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">{sessao.financeiro ? "Solicitações" : "Minhas solicitações"}</h1>
            <p className="text-sm text-gray-600">
              Pagamentos precisam chegar aprovados <b>até 3 dias úteis antes do vencimento</b>. Também dá para abrir pedido mandando e-mail para{" "}
              <b>{process.env.MAILBOX_ADDRESS || "o Financeiro"}</b>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {sessao.financeiro && <BotaoSincronizar />}
            {sessao.financeiro && <a href="/api/exportar" className="btn-claro">Exportar para a planilha</a>}
            <Link href="/nova" className="btn-primario">+ Nova solicitação</Link>
          </div>
        </div>

        {sessao.financeiro && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Na lista", lista.length, "text-tinta"],
              ["Recebidos (conferir)", recebidos, "text-orange-700"],
              ["Aguardando gestor", aguardando, "text-yellow-700"],
              ["Vencem em até 3 dias", urgentes, "text-marca"],
            ].map(([r, n, c]) => (
              <div key={r as string} className="cartao py-4">
                <div className={`text-3xl font-extrabold ${c}`}>{n}</div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{r}</div>
              </div>
            ))}
          </div>
        )}

        <form className="flex flex-wrap gap-2" method="get">
          <select name="ver" defaultValue={ver} className="campo w-auto">
            <option value="abertos">Em aberto</option>
            <option value="todos">Todos</option>
            {todasEtapas.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <select name="tipo" defaultValue={tipo} className="campo w-auto">
            <option value="">Orçamentos e pagamentos</option>
            <option value="pagamento">Só pagamentos</option>
            <option value="orcamento">Só orçamentos</option>
          </select>
          <input name="q" defaultValue={busca} placeholder="Buscar fornecedor, setor, protocolo…" className="campo w-64" />
          <button className="btn-escuro">Filtrar</button>
        </form>

        <div className="overflow-x-auto rounded-xl border border-linha bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Fornecedor / pedido</th>
                {sessao.financeiro && <th className="px-4 py-3">Solicitante</th>}
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500">Nada por aqui com esses filtros.</td>
                </tr>
              )}
              {lista.map((s) => {
                const d = s.vencimento ? diasPara(s.vencimento) : null;
                const alerta = d !== null && !STATUS_FINAIS.includes(s.status) && d <= 3;
                return (
                  <tr key={s.id} className="border-t border-linha hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold"><Link href={`/s/${s.id}`} className="hover:underline">#{s.protocolo}</Link></td>
                    <td className="px-4 py-3">{TIPO_ROTULO[s.tipo]}{s.origem === "email" && <span title="aberto por e-mail"> ✉️</span>}</td>
                    <td className="max-w-xs px-4 py-3">
                      <Link href={`/s/${s.id}`} className="block truncate font-medium hover:underline">{s.fornecedor || (s.descricao || "").split("\n")[0] || "—"}</Link>
                      <span className="text-xs text-gray-500">{s.setor || ""}</span>
                    </td>
                    {sessao.financeiro && <td className="px-4 py-3 text-xs">{s.solicitante_nome || s.solicitante_email}</td>}
                    <td className="px-4 py-3 text-right tabular-nums">{moeda(s.valor)}</td>
                    <td className={`px-4 py-3 whitespace-nowrap ${alerta ? "font-bold text-marca" : ""}`}>
                      {dataBR(s.vencimento)}
                      {alerta && <span className="block text-xs">{d! < 0 ? "vencido" : d === 0 ? "vence hoje" : `em ${d} dia(s)`}</span>}
                      {s.fora_do_prazo && <span className="block text-xs text-amber-700">fora do prazo</span>}
                    </td>
                    <td className="px-4 py-3"><Etiqueta status={s.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">{dataHoraBR(s.atualizado_em)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
