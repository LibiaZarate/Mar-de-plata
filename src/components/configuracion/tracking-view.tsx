"use client";

import { useState } from "react";
import useSWR from "swr";
import { Copy, Check, Camera, ThumbsUp, Music2, Globe, CreditCard, Megaphone, Users, ExternalLink } from "lucide-react";
import { cn, formatMxn } from "@/lib/utils";

type Source = {
  codigo: string;
  nombre: string;
  Icon: typeof Camera;
  texto: string;
  donde: string;
};

const SOURCES: Source[] = [
  {
    codigo: "ig_bio",
    nombre: "Instagram (bio)",
    Icon: Camera,
    texto: "Hola, vi su Instagram y me interesa 💗",
    donde: "El link de WhatsApp en tu bio de Instagram",
  },
  {
    codigo: "fb_bio",
    nombre: "Facebook (bio)",
    Icon: ThumbsUp,
    texto: "Hola, vi su Facebook y me interesa 💗",
    donde: "El link de WhatsApp en tu página de Facebook",
  },
  {
    codigo: "tt_bio",
    nombre: "TikTok (bio)",
    Icon: Music2,
    texto: "Hola, vi su TikTok y me interesa 💗",
    donde: "El link de WhatsApp en tu bio de TikTok",
  },
  {
    codigo: "ad_pandora",
    nombre: "Anuncio · Pandora",
    Icon: Megaphone,
    texto: "Hola, vi su anuncio de Pandora 💗",
    donde: "Welcome message del anuncio de Meta · línea Pandora",
  },
  {
    codigo: "ad_taxco",
    nombre: "Anuncio · Taxco",
    Icon: Megaphone,
    texto: "Hola, vi su anuncio de Taxco artesanal 💗",
    donde: "Welcome message del anuncio de Meta · línea Taxco",
  },
  {
    codigo: "ad_tows",
    nombre: "Anuncio · TOWS",
    Icon: Megaphone,
    texto: "Hola, vi su anuncio de TOWS 💗",
    donde: "Welcome message del anuncio de Meta · línea TOWS",
  },
  {
    codigo: "web",
    nombre: "Sitio web",
    Icon: Globe,
    texto: "Hola, vi su sitio web y me interesa 💗",
    donde: "Botón de WhatsApp de tu página web",
  },
  {
    codigo: "card",
    nombre: "Tarjeta de presentación",
    Icon: CreditCard,
    texto: "Hola, me dieron su tarjeta de presentación 💗",
    donde: "QR de tarjetas físicas",
  },
  {
    codigo: "wsp_group",
    nombre: "Grupo de WhatsApp",
    Icon: Users,
    texto: "Hola, vi en el grupo 💗",
    donde: "Cuando compartes el link del WhatsApp del negocio en el grupo",
  },
];

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

type TrackingResponse = {
  ok: boolean;
  whatsappNegocio: string | null;
  porOrigen: { origen: string; leads: number; pagados: number; facturacion: number; conversion_pct: number }[];
  totalLeads: number;
  error?: string;
};

export function TrackingView() {
  const { data, isLoading } = useSWR<TrackingResponse>(
    "/api/dashboard/tracking?days=30",
    fetcher,
    { refreshInterval: 30_000 },
  );

  const whatsappNegocio = data?.whatsappNegocio ?? null;
  const porOrigen = data?.porOrigen ?? [];
  const error = data && !data.ok ? data.error : null;

  return (
    <div className="px-10 py-6 space-y-6">
      <div>
        <div className="label-xs">Configuración · Tracking de origen</div>
        <h1 className="font-serif-display text-[56px] leading-[1.05] mt-1">
          ¿De dónde viene cada lead?
        </h1>
        <div className="text-[13px] text-foreground/60 mt-2 max-w-3xl">
          Aquí generas un link de WhatsApp distinto para cada lugar donde
          aparece tu número (Instagram, Facebook, anuncios, etc.). Copias y
          pegas. Cuando alguien hace click y manda el mensaje, el dashboard
          detecta solo de dónde viene. Sin tocar Meta. Sin tocar ManyChat.
        </div>
      </div>

      {error && (
        <div className="border border-rosey-300 bg-rosey-50/50 rounded px-3 py-2 text-[12px] text-rosey-500">
          {error}
        </div>
      )}

      {!whatsappNegocio && !isLoading && (
        <div className="border border-ambr-300 bg-ambr-50 rounded-lg px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="font-italic-serif text-ambr-600 mt-0.5">primero →</div>
            <div>
              <div className="font-medium text-foreground">
                Configura el número de WhatsApp del negocio
              </div>
              <p className="text-[12px] text-foreground/70 mt-1">
                Para que pueda generarte los links, agrega la clave{" "}
                <code className="text-foreground">whatsapp_negocio</code> en{" "}
                <a href="/configuracion/sistema" className="text-rosey-500 underline">
                  Configuración · Sistema
                </a>{" "}
                con el número del WhatsApp Business (solo dígitos, con lada del país,
                ej. <code className="text-foreground">5217771234567</code>).
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <div className="label-xs">Links por origen</div>
        <div className="grid grid-cols-2 gap-3">
          {SOURCES.map((src) => {
            // Buscar métricas del origen detectado
            const canalAmigable = mapearCodigoANombre(src.codigo);
            const stats = porOrigen.find((o) => o.origen === canalAmigable);
            return (
              <SourceCard
                key={src.codigo}
                source={src}
                whatsappNegocio={whatsappNegocio}
                stats={stats}
              />
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="label-xs">Métricas por origen · últimos 30 días</div>
            <div className="text-[12px] text-foreground/55 mt-1">
              Cada lead llega con el canal_origen que detectamos del mensaje.
            </div>
          </div>
          <div className="text-[11px] text-foreground/55">
            {data?.totalLeads ?? 0} leads totales
          </div>
        </div>

        <div className="rounded-lg border border-foreground/15 bg-cream-50 overflow-hidden">
          <div className="grid grid-cols-[1.5fr_90px_90px_140px_90px] text-[10px] tracking-wider uppercase text-foreground/55 px-5 py-3 border-b border-foreground/10">
            <div>Origen</div>
            <div className="text-right">Leads</div>
            <div className="text-right">Cerrados</div>
            <div className="text-right">Facturación</div>
            <div className="text-right">Conv. %</div>
          </div>
          {porOrigen.length === 0 ? (
            <div className="px-5 py-8 text-center text-[12px] text-foreground/55 italic">
              Aún no hay leads en los últimos 30 días.
            </div>
          ) : (
            porOrigen.map((o) => (
              <div
                key={o.origen}
                className="grid grid-cols-[1.5fr_90px_90px_140px_90px] items-center px-5 py-3 border-b border-foreground/10 last:border-0 text-sm hover:bg-cream-100/40"
              >
                <div className="font-medium">{o.origen}</div>
                <div className="text-right tabular-nums">{o.leads}</div>
                <div className="text-right tabular-nums">{o.pagados}</div>
                <div className="text-right tabular-nums">
                  {o.facturacion > 0 ? formatMxn(o.facturacion) : <span className="text-foreground/40">—</span>}
                </div>
                <div className="text-right tabular-nums">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[11px] font-medium",
                      o.conversion_pct >= 20
                        ? "bg-sage-100 text-sage-600"
                        : o.conversion_pct >= 5
                          ? "bg-ambr-100 text-ambr-600"
                          : "text-foreground/55",
                    )}
                  >
                    {o.conversion_pct.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function mapearCodigoANombre(codigo: string): string {
  if (codigo.startsWith("ig")) return "Instagram";
  if (codigo.startsWith("fb")) return "Facebook";
  if (codigo.startsWith("tt")) return "TikTok";
  if (codigo === "web") return "Web";
  if (codigo === "card") return "Tarjeta";
  if (codigo.startsWith("ad")) return "Meta";
  if (codigo === "wsp_group") return "Grupo";
  return "Orgánico";
}

function SourceCard({
  source,
  whatsappNegocio,
  stats,
}: {
  source: Source;
  whatsappNegocio: string | null;
  stats?: { leads: number; pagados: number; facturacion: number; conversion_pct: number };
}) {
  const Icon = source.Icon;
  const [copied, setCopied] = useState(false);

  const texto = `${source.texto} [src:${source.codigo}]`;
  const link = whatsappNegocio
    ? `https://wa.me/${whatsappNegocio.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`
    : null;

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="rounded-lg border border-foreground/15 bg-cream-50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="rounded-md border border-foreground/15 bg-cream-100 p-2 shrink-0">
          <Icon className="h-4 w-4" strokeWidth={1.6} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-serif-display text-[20px] leading-none">{source.nombre}</div>
          <div className="text-[11px] text-foreground/55 mt-1">{source.donde}</div>
        </div>
        {stats && stats.leads > 0 && (
          <div className="text-right">
            <div className="font-serif-display text-[20px] leading-none">{stats.leads}</div>
            <div className="text-[10px] tracking-wider uppercase text-foreground/55">leads 30d</div>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="label-xs">Mensaje que se pre-llena</div>
        <div className="text-[12px] bg-cream-100 border border-foreground/10 rounded px-2.5 py-1.5 italic">
          {source.texto}{" "}
          <span className="text-foreground/40 not-italic font-mono">[src:{source.codigo}]</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {link ? (
          <>
            <code className="flex-1 text-[10px] font-mono text-foreground/65 truncate bg-cream-100 border border-foreground/10 rounded px-2 py-1.5">
              {link}
            </code>
            <button
              onClick={copyLink}
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded border transition-colors shrink-0",
                copied
                  ? "border-sage-300 text-sage-600 bg-sage-50"
                  : "border-foreground/20 hover:bg-cream-100",
              )}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copiado" : "Copiar link"}
            </button>
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-[11px] px-2.5 py-1.5 rounded border border-foreground/20 hover:bg-cream-100"
              title="Probar el link"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </>
        ) : (
          <div className="text-[11px] text-foreground/55 italic">
            Configura primero whatsapp_negocio en /configuracion/sistema
          </div>
        )}
      </div>

      {stats && stats.leads > 0 && (
        <div className="text-[11px] text-foreground/65 pt-2 border-t border-foreground/10 flex items-center justify-between">
          <span>{stats.pagados} cerrados · {formatMxn(stats.facturacion)}</span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-medium",
              stats.conversion_pct >= 20
                ? "bg-sage-100 text-sage-600"
                : stats.conversion_pct >= 5
                  ? "bg-ambr-100 text-ambr-600"
                  : "text-foreground/55",
            )}
          >
            {stats.conversion_pct.toFixed(0)}% conv.
          </span>
        </div>
      )}
    </div>
  );
}
