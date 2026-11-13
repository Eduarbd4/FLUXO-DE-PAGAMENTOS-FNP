import Link from "next/link";
export default function NaoEncontrado() {
  return (
    <main className="mx-auto max-w-md px-5 py-20 text-center">
      <h1 className="text-2xl font-extrabold">Não encontrado</h1>
      <p className="mt-2 text-gray-600">Essa solicitação não existe ou você não tem acesso a ela.</p>
      <Link href="/" className="btn-escuro mt-5">Voltar</Link>
    </main>
  );
}
