"use client";
import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { AnexoEnviado } from "@/lib/tipos";

const LIMITE = 25 * 1024 * 1024;

export function tamanhoLegivel(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

/** Caixa de anexos: arrastar/soltar ou escolher arquivos. Sobe direto para o Storage. */
export default function Anexador({
  anexos,
  onChange,
  onEnviando,
}: {
  anexos: AnexoEnviado[];
  onChange: (a: AnexoEnviado[]) => void;
  onEnviando?: (v: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sobre, setSobre] = useState(false);

  async function enviar(lista: FileList | File[]) {
    const arquivos = Array.from(lista);
    if (!arquivos.length) return;
    const grandes = arquivos.filter((f) => f.size > LIMITE);
    if (grandes.length) {
      setErro(`Maior que 25 MB: ${grandes.map((f) => f.name).join(", ")}`);
      return;
    }
    setErro("");
    setEnviando(true);
    onEnviando?.(true);
    try {
      const r = await fetch("/api/uploads/assinar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomes: arquivos.map((f) => f.name) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || "falha ao preparar envio");
      const sb = supabaseBrowser();
      const novos: AnexoEnviado[] = [];
      for (let i = 0; i < arquivos.length; i++) {
        const f = arquivos[i];
        const { caminho, token } = j.links[i];
        const { error } = await sb.storage.from("anexos").uploadToSignedUrl(caminho, token, f, {
          contentType: f.type || "application/octet-stream",
        });
        if (error) throw new Error(`${f.name}: ${error.message}`);
        novos.push({ caminho, nome: f.name, tamanho: f.size, tipo_mime: f.type });
      }
      onChange([...anexos, ...novos]);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
      onEnviando?.(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSobre(true);
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSobre(false);
          enviar(e.dataTransfer.files);
        }}
        onClick={() => input.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-5 text-center text-sm transition ${
          sobre ? "border-tinta bg-blue-50" : "border-linha bg-gray-50 hover:bg-gray-100"
        }`}
      >
        {enviando ? (
          <span className="font-semibold">Enviando arquivos…</span>
        ) : (
          <>
            <span className="font-semibold">Arraste os arquivos aqui ou clique para escolher</span>
            <span className="block text-xs text-gray-500">NF (PDF e XML), boleto, orçamentos, fotos, planilhas · até 25 MB cada</span>
          </>
        )}
        <input ref={input} type="file" multiple hidden onChange={(e) => e.target.files && enviar(e.target.files)} />
      </div>
      {erro && <p className="mt-2 text-sm text-marca">{erro}</p>}
      {anexos.length > 0 && (
        <ul className="mt-2 space-y-1">
          {anexos.map((a) => (
            <li key={a.caminho} className="flex items-center justify-between rounded-md bg-white px-3 py-1.5 text-sm ring-1 ring-linha">
              <span className="truncate">📎 {a.nome} <span className="text-gray-500">· {tamanhoLegivel(a.tamanho)}</span></span>
              <button type="button" className="ml-3 text-xs text-gray-500 hover:text-marca" onClick={() => onChange(anexos.filter((x) => x !== a))}>
                remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
