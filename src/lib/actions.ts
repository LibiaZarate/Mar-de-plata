// Acciones del lado cliente: cierres, mover lead.
// Usan el cliente browser de Supabase (anon + RLS).

"use client";

import { mutate } from "swr";
import { createClient } from "@/lib/supabase/client";
import type { Cierre, LeadEstado } from "./types";

export async function uploadComprobante(file: File, numero: string): Promise<string> {
  const sb = createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${numero}/${Date.now()}.${ext}`;
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_COMPROBANTES ?? "comprobantes";
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
  const sb = createClient();
  const fecha = new Date().toISOString();
  const { error } = await sb.from("cierres_diarios").insert({
    numero_whatsapp: input.numero_whatsapp,
    asesora_id: input.asesora_id,
    monto: input.monto,
    canal: input.canal,
    notas: input.notas ?? null,
    comprobante_url: input.comprobante_url ?? null,
    fecha_cierre: fecha,
  });
  if (error) throw new Error(error.message);
  await sb
    .from("leads")
    .update({ estado: "pagada", ultima_interaccion: fecha })
    .eq("numero_whatsapp", input.numero_whatsapp);
  await Promise.all([
    mutate("kpi:facturacion"),
    mutate("kpi:leads_hoy"),
    mutate("blocC:embudo"),
    mutate("equipo:metricas"),
    mutate((k) => Array.isArray(k) && k[0] === "cierres"),
    mutate((k) => Array.isArray(k) && k[0] === "pipeline"),
  ]);
}

export async function actualizarEstadoLead(numero: string, estado: LeadEstado): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from("leads")
    .update({ estado, ultima_interaccion: new Date().toISOString() })
    .eq("numero_whatsapp", numero);
  if (error) throw new Error(error.message);
  await Promise.all([
    mutate((k) => Array.isArray(k) && k[0] === "pipeline"),
    mutate("blocC:embudo"),
  ]);
}
