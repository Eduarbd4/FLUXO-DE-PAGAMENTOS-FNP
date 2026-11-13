import LoginForm from "@/components/LoginForm";

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const erro =
    sp.erro === "dominio"
      ? "Use o seu e-mail da empresa para entrar."
      : sp.erro === "link"
        ? "O link de acesso expirou ou já foi usado. Peça outro."
        : "";
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <div className="text-xs font-bold uppercase tracking-widest text-marca">Financeiro</div>
          <h1 className="mt-1 text-3xl font-extrabold">Portal de Solicitações</h1>
          <p className="mt-2 text-gray-600">Peça orçamentos e envie notas, boletos e guias para pagamento. Acompanhe tudo e converse com o Financeiro por aqui ou por e-mail.</p>
        </div>
        <LoginForm volta={sp.volta || "/"} erroInicial={erro} />
      </div>
    </main>
  );
}
