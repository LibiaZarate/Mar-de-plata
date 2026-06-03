"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Save, Check, AlertCircle } from "lucide-react";

const KEY = "/api/dashboard/config";
const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

const CLAVES_CONOCIDAS = [
  ["whatsapp_negocio", "WhatsApp del negocio · solo dígitos, con código de país. MX: 52 + 10 dígitos (ej. 527771234567, sin el 1 después del 52)"],
  ["link_grupo_abierto", "Link del grupo abierto de WhatsApp"],
  ["catalogo_pandora_url", "URL del catálogo Pandora (Canva)"],
  ["catalogo_taxco_url", "URL del catálogo Taxco artesanal"],
  ["catalogo_tows_url", "URL del catálogo TOWS"],
  ["redes_instagram_url", "Instagram (Sirena lo manda como referencia)"],
  ["redes_facebook_url", "Facebook (Sirena lo manda como referencia)"],
  ["redes_tiktok_url", "TikTok (Sirena lo manda como referencia)"],
  ["whatsapp_mar_personal", "WhatsApp personal de Mar"],
  ["subscriber_id_mar", "Subscriber ID de Mar en ManyChat"],
  ["monto_deposito_primera_vez", "Depósito primera vez (default 300)"],
  ["monto_minimo_mayoreo", "Mínimo de mayoreo (default 1500)"],
] as const;

type Row = { clave: string; valor: string; descripcion: string | null };

export function SistemaCrud() {
  const { data, isLoading } = useSWR<{ ok: boolean; items: Row[]; error?: string }>(
    KEY,
    fetcher,
    { refreshInterval: 60_000 },
  );
  const items = data?.items ?? [];
  const error = data && !data.ok ? data.error : null;

  const map = new Map(items.map((r) => [r.clave, r]));
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<
    Record<string, { state: "saving" | "ok" | "err"; msg?: string }>
  >({});

  async function save(clave: string) {
    const valor = edits[clave] ?? map.get(clave)?.valor ?? "";
    const desc = CLAVES_CONOCIDAS.find(([k]) => k === clave)?.[1] ?? null;
    setStatus((s) => ({ ...s, [clave]: { state: "saving" } }));
    try {
      const r = await fetch(KEY, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave, valor, descripcion: desc }),
      });
      const d = await r.json();
      if (!d.ok) {
        setStatus((s) => ({
          ...s,
          [clave]: { state: "err", msg: d.error || `HTTP ${r.status}` },
        }));
        return;
      }
      // Verificar leyendo de vuelta — confirma que llegó a la DB.
      const verify = await fetch(`${KEY}?_=${Date.now()}`, { cache: "no-store" }).then((x) => x.json());
      const persisted = (verify.items as Row[] | undefined)?.find((r) => r.clave === clave);
      if (!persisted || persisted.valor !== valor) {
        setStatus((s) => ({
          ...s,
          [clave]: { state: "err", msg: "Supabase no devolvió el valor guardado" },
        }));
        return;
      }
      const next = { ...edits };
      delete next[clave];
      setEdits(next);
      mutate(KEY);
      setStatus((s) => ({ ...s, [clave]: { state: "ok" } }));
      setTimeout(() => {
        setStatus((s) => {
          if (s[clave]?.state !== "ok") return s;
          const n = { ...s };
          delete n[clave];
          return n;
        });
      }, 2500);
    } catch (e) {
      setStatus((s) => ({
        ...s,
        [clave]: { state: "err", msg: (e as Error).message },
      }));
    }
  }

  return (
    <div className="px-10 py-6 space-y-5">
      <div>
        <div className="label-xs">Configuración · Sistema</div>
        <h1 className="font-serif-display text-[56px] leading-[1.05] mt-1">Config del sistema</h1>
        <div className="text-[13px] text-foreground/60 mt-2">
          Tabla <code>config_sistema</code> · URLs, montos y claves que Sirena lee en cada turno.
        </div>
      </div>

      {error && (
        <div className="border border-rosey-300 bg-rosey-50/50 rounded px-3 py-2 text-[12px] text-rosey-500">
          {error}
        </div>
      )}
      {isLoading && <div className="h-12 rounded bg-cream-200 animate-pulse" />}

      <section className="rounded-lg border border-foreground/15 bg-cream-50 divide-y divide-foreground/10">
        {CLAVES_CONOCIDAS.map(([clave, desc]) => {
          const row = map.get(clave);
          const value = edits[clave] ?? row?.valor ?? "";
          const changed = edits[clave] !== undefined && edits[clave] !== row?.valor;
          return (
            <div
              key={clave}
              className="grid grid-cols-[260px_1fr_120px] items-start gap-3 p-4"
            >
              <div>
                <div className="font-mono text-[12px] text-foreground">{clave}</div>
                <div className="text-[11px] text-foreground/55 mt-0.5">{desc}</div>
              </div>
              <input
                value={value}
                onChange={(e) => setEdits({ ...edits, [clave]: e.target.value })}
                placeholder={row ? "" : "(sin valor)"}
                className="input"
              />
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => save(clave)}
                  disabled={(!changed && !!row) || status[clave]?.state === "saving"}
                  className="text-[12px] px-3 py-1.5 rounded border border-foreground/20 bg-cream-50 hover:bg-cream-100 disabled:opacity-40 inline-flex items-center justify-center"
                >
                  {status[clave]?.state === "saving" ? (
                    <>guardando…</>
                  ) : status[clave]?.state === "ok" ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1 text-sage-600" />
                      <span className="text-sage-600">guardado</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5 mr-1" />
                      {row ? "Guardar" : "Crear"}
                    </>
                  )}
                </button>
                {status[clave]?.state === "err" && (
                  <div className="text-[10px] text-rosey-500 flex items-start gap-1 leading-tight">
                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span className="break-all">{status[clave].msg}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <style>{`
        .input { width:100%; padding:8px 10px; border:1px solid hsl(var(--border)); border-radius:6px; background:hsl(var(--card)); font-size:14px; color:hsl(var(--foreground)); outline:none; font-family: ui-monospace, monospace; }
        .input:focus { border-color:hsl(var(--primary)); }
      `}</style>
    </div>
  );
}
