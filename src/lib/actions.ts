import { mutate } from "swr";
import { BUCKET_COMPROBANTES, supabase } from "./supabase";
import type { Cierre, LeadEstado } from "./types";

export async function uploadComprobante(file: File, numero: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${numero}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET_COMPROBANTES)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET_COMPROBANTES).getPublicUrl(path);
  return data.publicUrl;
}

export type CierreInput = {
  numero_whatsapp: string;
  asesora_id: string;
  monto: number;
  canal: Cierre["canal"];
  notas?: string;
  comprobante_url?: string;
};

export async function registrarCierre(input: CierreInput): Promise<Cierre> {
  const fecha = new Date().toISOString();
  const { data, error } = await supabase
    .from("cierres_diarios")
    .insert({
      numero_whatsapp: input.numero_whatsapp,
      asesora_id: input.asesora_id,
      monto: input.monto,
      canal: input.canal,
      notas: input.notas ?? null,
      comprobante_url: input.comprobante_url ?? null,
      fecha_cierre: fecha,
    })
    .select("*")
    .single();
  if (error) throw error;

  // Marcar el lead como pagado.
  await supabase
    .from("leads")
    .update({ estado: "pagada", ultima_interaccion: fecha })
    .eq("numero_whatsapp", input.numero_whatsapp);

  // Invalidar todo lo que se afecta.
  await Promise.all([
    mutate("kpi:facturacion_hoy"),
    mutate("kpi:leads_hoy"),
    mutate("blocC:embudo_dia"),
    mutate("equipo:metricas"),
    mutate((k) => Array.isArray(k) && k[0] === "cierres:recientes"),
    mutate((k) => Array.isArray(k) && k[0] === "pipeline:leads"),
  ]);

  return data as Cierre;
}

export async function actualizarEstadoLead(numero: string, estado: LeadEstado): Promise<void> {
  const { error } = await supabase
    .from("leads")
    .update({ estado, ultima_interaccion: new Date().toISOString() })
    .eq("numero_whatsapp", numero);
  if (error) throw error;
  await Promise.all([
    mutate((k) => Array.isArray(k) && k[0] === "pipeline:leads"),
    mutate("blocC:embudo_dia"),
  ]);
}

export async function resolverAlerta(id: number, asesoraId: string, notas?: string): Promise<void> {
  const { error } = await supabase
    .from("alertas")
    .update({
      estado: "resuelta",
      resuelta_en: new Date().toISOString(),
      resuelta_por_id: asesoraId,
      notas_resolucion: notas ?? null,
    })
    .eq("id", id);
  if (error) throw error;
  await Promise.all([
    mutate("blocB:alertas_activas"),
    mutate("blocB:alertas_activas_list"),
  ]);
}
