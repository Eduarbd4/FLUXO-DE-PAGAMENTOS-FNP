const CORES: Record<string, string> = {
  Recebido: "bg-orange-50 text-orange-800 ring-orange-200",
  "Em análise": "bg-amber-50 text-amber-800 ring-amber-200",
  "Aguardando aprovação": "bg-yellow-50 text-yellow-800 ring-yellow-300",
  Aprovado: "bg-teal-50 text-teal-800 ring-teal-200",
  "Lançado no ERP": "bg-blue-50 text-blue-800 ring-blue-200",
  Agendado: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  Pago: "bg-green-50 text-green-800 ring-green-200",
  Devolvido: "bg-gray-100 text-gray-700 ring-gray-300",
  Recusado: "bg-gray-100 text-gray-700 ring-gray-300",
};

export default function Etiqueta({ status }: { status: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${CORES[status] || "bg-gray-50 ring-gray-200"}`}>
      {status}
    </span>
  );
}
