import { admin, BUCKET } from "@/lib/supabase/admin";
import Aprovacao from "@/components/Aprovacao";
import { dataBR, moeda } from "@/lib/datas";
import { TIPO_ROTULO, type Anexo, type Solicitacao } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// Página que o gestor abre pelo e-mail (não precisa de login).
export default async function Aprovar({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valido = /^[0-9a-f-]{36}$/i.test(token);
  const { data } = valido
    ? await admin().from("solicitacoes").select("*").eq("aprovacao_token", token).maybeSingle()
    : { data: null };
  if (!data) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16 text-center">
        <h1 className="text-2xl font-extrabold">Link já utilizado</h1>
        <p className="mt-2 text-gray-600">Esta solicitação já foi aprovada ou recusada, ou o link não é mais válido.</p>
      </main>
    );
  }
  const s = data as Solicitacao;
  const { data: anx } = await admin().from("anexos").select("*").eq("solicitacao_id", s.id).order("criado_em");
  const links = await Promise.all(
    ((anx || []) as Anexo[]).map(async (a) => {
      const { data: u } = await admin().storage.from(BUCKET).createSignedUrl(a.caminho, 3600, { download: a.nome });
      return { nome: a.nome, url: u?.signedUrl || "#" };
    })
  );
  const linhas: [string, string][] = [
    ["Solicitante", `${s.solicitante_nome || ""} (${s.solicitante_email})`],
    ["Setor", [s.setor, s.centro_custo].filter(Boolean).join(" · ") || "—"],
    ["Fornecedor", s.fornecedor || "—"],
    ["Valor", moeda(s.valor)],
  ];
  if (s.tipo === "pagamento") linhas.push(["Vencimento", dataBR(s.vencimento)]);

  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <div className="text-xs font-bold uppercase tracking-widest text-marca">Financeiro · aprovação do gestor</div>
      <h1 className="mt-1 text-2xl font-extrabold">#{s.protocolo} · {TIPO_ROTULO[s.tipo]}</h1>
      <div className="cartao mt-4 space-y-3">
        <dl className="grid grid-cols-[140px_1fr] gap-y-1 text-sm">
          {linhas.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-gray-500">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        {s.descricao && <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm">{s.descricao}</p>}
        {s.fora_do_prazo && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><b>Fora do prazo:</b> {s.justificativa_prazo}</p>}
        {links.length > 0 && (
          <ul className="space-y-1 text-sm">
            {links.map((l, i) => (
              <li key={i}><a href={l.url} className="text-tinta underline">📎 {l.nome}</a></li>
            ))}
          </ul>
        )}
      </div>
      <Aprovacao token={token} />
    </main>
  );
}
