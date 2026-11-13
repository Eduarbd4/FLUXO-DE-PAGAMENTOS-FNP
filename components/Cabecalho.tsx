import Link from "next/link";
import type { Sessao } from "@/lib/auth";

export default function Cabecalho({ sessao }: { sessao: Sessao }) {
  return (
    <header className="border-b border-linha bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="leading-tight">
          <span className="block text-[11px] font-bold uppercase tracking-widest text-marca">Financeiro</span>
          <span className="text-lg font-extrabold">Portal de Solicitações</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-right sm:block">
            <span className="block font-semibold">{sessao.nome}</span>
            <span className="text-xs text-gray-500">{sessao.financeiro ? "Equipe Financeiro" : sessao.email}</span>
          </span>
          <form action="/auth/sair" method="post">
            <button className="btn-claro">Sair</button>
          </form>
        </div>
      </div>
    </header>
  );
}
