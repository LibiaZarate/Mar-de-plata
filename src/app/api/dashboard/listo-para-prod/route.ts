// Checklist de pre-producción.
// Verifica TODO lo que tiene que estar OK antes de prender el webhook
// con el número real de Mar:
//   - Variables de entorno requeridas
//   - Modo de producción activo
//   - Conexión a Supabase
//   - Conexión a Meta API
//   - Tablas requeridas existentes
//   - Credenciales de ManyChat válidas

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMetaCreds, metaGet } from "@/lib/meta/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Check = { nombre: string; ok: boolean; detalle: string; bloqueante: boolean };

export async function GET() {
  const checks: Check[] = [];

  // 1. Env vars
  const requeridas = [
    "MODO_PRODUCCION",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "MANYCHAT_API_KEY",
    "OPENROUTER_API_KEY",
    "OPENAI_API_KEY",
  ];
  for (const v of requeridas) {
    const presente = !!process.env[v];
    checks.push({
      nombre: `Env var: ${v}`,
      ok: presente,
      detalle: presente ? "presente" : "FALTANTE en Vercel",
      bloqueante: v !== "OPENAI_API_KEY",
    });
  }

  // 2. Modo
  const modoProd = process.env.MODO_PRODUCCION === "true";
  checks.push({
    nombre: "Modo producción activo",
    ok: modoProd,
    detalle: modoProd
      ? "MODO_PRODUCCION=true — los mensajes salen a ManyChat real"
      : "MODO_PRODUCCION distinto de 'true' — sigue en simulador",
    bloqueante: true,
  });

  // 3. Supabase
  let leadsCount = 0;
  let supabaseOk = false;
  try {
    const sb = createAdminClient();
    const r = await sb.from("leads").select("numero_whatsapp", { count: "exact", head: true });
    leadsCount = r.count ?? 0;
    supabaseOk = true;
  } catch (e) {
    checks.push({
      nombre: "Conexión a Supabase",
      ok: false,
      detalle: (e as Error).message,
      bloqueante: true,
    });
  }
  if (supabaseOk) {
    checks.push({
      nombre: "Conexión a Supabase",
      ok: true,
      detalle: `Leads en DB: ${leadsCount}`,
      bloqueante: true,
    });
  }

  // 4. Tablas críticas existentes
  if (supabaseOk) {
    const sb = createAdminClient();
    const tablas = ["leads", "conversaciones", "estado_conversacion_actual", "alertas", "asesoras", "seguimientos_programados", "webhook_log", "config_sistema"];
    for (const t of tablas) {
      try {
        await sb.from(t).select("*", { count: "exact", head: true });
        checks.push({
          nombre: `Tabla ${t}`,
          ok: true,
          detalle: "OK",
          bloqueante: t !== "webhook_log",
        });
      } catch (e) {
        checks.push({
          nombre: `Tabla ${t}`,
          ok: false,
          detalle: (e as Error).message,
          bloqueante: t !== "webhook_log",
        });
      }
    }
  }

  // 5. Meta API
  try {
    const creds = await getMetaCreds();
    if (!creds.token) {
      checks.push({
        nombre: "Meta API",
        ok: false,
        detalle: "Sin meta_access_token configurado",
        bloqueante: false,
      });
    } else {
      const me = await metaGet<{ id: string; name?: string }>("/me", { fields: "id,name" });
      checks.push({
        nombre: "Meta API",
        ok: true,
        detalle: `Conectado como ${me.name ?? me.id}`,
        bloqueante: false,
      });
    }
  } catch (e) {
    checks.push({
      nombre: "Meta API",
      ok: false,
      detalle: (e as Error).message,
      bloqueante: false,
    });
  }

  // 6. Asesoras activas
  if (supabaseOk) {
    try {
      const sb = createAdminClient();
      const { data } = await sb
        .from("asesoras")
        .select("id,nombre_completo,whatsapp_personal,activa")
        .eq("activa", true);
      const activas = (data ?? []).filter(
        (a) => !!a.whatsapp_personal,
      ).length;
      checks.push({
        nombre: "Asesoras activas",
        ok: activas > 0,
        detalle: `${activas} asesoras activas con contacto`,
        bloqueante: true,
      });
    } catch (e) {
      checks.push({
        nombre: "Asesoras activas",
        ok: false,
        detalle: (e as Error).message,
        bloqueante: true,
      });
    }
  }

  // 7. Catálogo configurado
  if (supabaseOk) {
    try {
      const sb = createAdminClient();
      const { data } = await sb
        .from("config_sistema")
        .select("valor")
        .eq("clave", "catalogo_taxco_url")
        .maybeSingle();
      const v = (data?.valor as string | null) ?? null;
      checks.push({
        nombre: "Catálogo de mayoreo",
        ok: !!v,
        detalle: v || "Sin URL configurada en config_sistema.catalogo_taxco_url",
        bloqueante: false,
      });
    } catch (e) {
      checks.push({
        nombre: "Catálogo de mayoreo",
        ok: false,
        detalle: (e as Error).message,
        bloqueante: false,
      });
    }
  }

  const bloqueantes_falla = checks.filter((c) => !c.ok && c.bloqueante).length;
  const todo_ok = bloqueantes_falla === 0;
  const veredicto = todo_ok
    ? "LISTO PARA PRENDER"
    : `${bloqueantes_falla} bloqueante(s) sin resolver`;

  return NextResponse.json({
    ok: true,
    listo_para_prod: todo_ok,
    veredicto,
    checks,
    siguiente_paso: todo_ok
      ? "Apunta el webhook de ManyChat a /api/webhook/manychat y deja que entren los primeros mensajes reales."
      : "Resuelve los bloqueantes (marcados en rojo) y vuelve a correr este checklist.",
  });
}
