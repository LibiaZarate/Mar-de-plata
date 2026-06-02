// Mutaciones del dashboard: cierres, mover lead.
// Todo via endpoints server-side para saltar RLS.

"use client";

import { mutate } from "swr";
import { createClient } from "@/lib/supabase/client";
import type { Cierre, LeadEstado } from "./types";

export async function uploadComprobante(file: File, numero: string): Promise<string> {
  // El upload a Storage SÍ va por browser anon — el bucket "comprobantes"
  // debe tener policy de INSERT para anon. Si no, esto falla con error
  // claro.
  const sb = createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${numero}/${Date.now()}.${ext}`;
  const bucket =
    process.env.NEXT_PUBLIC_SUPABASE_BUCKET_COMPROBANTES ?? "comprobantes";
  const { error } = await sb.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function registrarCierre(input: {
  numero_whatsapp: string;
  asesora_id: string;
  monto: number;
  canal: Cierre["canal"];
  notas?: string;
  comprobante_url?: string;
}): Promise<void> {
  const r = await fetch("/api/dashboard/cierres", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const d = (await r.json()) as { ok: boolean; error?: string };
  if (!d.ok) throw new Error(d.error || "Error desconocido al registrar cierre");
  // invalidar caches
  await Promise.all([
    mutate("/api/dashboard/inicio"),
    mutate("/api/dashboard/asesoras"),
    mutate((k) => typeof k === "string" && k.startsWith("/api/dashboard/cierres")),
    mutate((k) => typeof k === "string" && k.startsWith("/api/dashboard/pipeline")),
  ]);
}

export async function actualizarEstadoLead(numero: string, estado: LeadEstado): Promise<void> {
  const r = await fetch("/api/dashboard/lead", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ numero, estado }),
  });
  const d = (await r.json()) as { ok: boolean; error?: string };
  if (!d.ok) throw new Error(d.error || "Error al actualizar el estado");
  await Promise.all([
    mutate((k) => typeof k === "string" && k.startsWith("/api/dashboard/pipeline")),
    mutate("/api/dashboard/inicio"),
  ]);
}
