// Datas no fuso de São Paulo, trabalhando com texto AAAA-MM-DD para não ter surpresa de fuso.

export const FERIADOS = new Set([
  // 2026
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-04-03", "2026-04-21", "2026-05-01", "2026-06-04",
  "2026-09-07", "2026-10-12", "2026-11-02", "2026-11-15", "2026-11-20", "2026-12-25",
  // 2027
  "2027-01-01", "2027-02-08", "2027-02-09", "2027-03-26", "2027-04-21", "2027-05-01", "2027-05-27",
  "2027-09-07", "2027-10-12", "2027-11-02", "2027-11-15", "2027-11-20", "2027-12-25",
  // acrescente aqui os feriados municipais/estaduais da empresa
]);

export const DIAS_UTEIS_PRAZO = 3;

export function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function paraData(s: string): Date {
  const [a, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}
function paraTexto(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function ehDiaUtil(s: string): boolean {
  const dia = paraData(s).getUTCDay();
  return dia !== 0 && dia !== 6 && !FERIADOS.has(s);
}
export function somarDias(s: string, n: number): string {
  const d = paraData(s);
  d.setUTCDate(d.getUTCDate() + n);
  return paraTexto(d);
}
/** Se cair em fim de semana/feriado, volta para o dia útil anterior (o pagamento é antecipado). */
export function diaUtilAnterior(s: string): string {
  let x = s;
  while (!ehDiaUtil(x)) x = somarDias(x, -1);
  return x;
}
export function subtrairDiasUteis(s: string, n: number): string {
  let x = s;
  let faltam = n;
  while (faltam > 0) {
    x = somarDias(x, -1);
    if (ehDiaUtil(x)) faltam--;
  }
  return x;
}
/** Último dia para o documento chegar (3 dias úteis antes do vencimento efetivo). */
export function prazoEnvio(vencimento: string): string {
  return subtrairDiasUteis(diaUtilAnterior(vencimento), DIAS_UTEIS_PRAZO);
}
export function foraDoPrazo(vencimento: string, hoje = hojeSP()): boolean {
  return hoje > prazoEnvio(vencimento);
}
export function diasPara(vencimento: string, hoje = hojeSP()): number {
  return Math.round((paraData(vencimento).getTime() - paraData(hoje).getTime()) / 86400000);
}

export function dataBR(s: string | null | undefined): string {
  if (!s) return "—";
  const [a, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}
export function dataHoraBR(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
export function moeda(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
