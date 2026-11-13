import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth";
import Cabecalho from "@/components/Cabecalho";
import FormNova from "@/components/FormNova";

export default async function Nova() {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");
  return (
    <>
      <Cabecalho sessao={sessao} />
      <main className="mx-auto max-w-3xl px-5 py-6">
        <h1 className="text-2xl font-extrabold">Nova solicitação</h1>
        <p className="mb-5 text-sm text-gray-600">Você recebe a confirmação por e-mail e pode responder por lá ou por aqui.</p>
        <FormNova />
      </main>
    </>
  );
}
