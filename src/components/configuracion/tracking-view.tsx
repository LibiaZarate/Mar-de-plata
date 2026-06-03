"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import {
  Copy,
  Check,
  Camera,
  ThumbsUp,
  Music2,
  Globe,
  CreditCard,
  Megaphone,
  Users,
  ExternalLink,
  Plus,
  Trash2,
  Sparkles,
} from "lucide-react";
import { cn, formatMxn } from "@/lib/utils";

type Source = {
  codigo: string;
  nombre: string;
  Icon: typeof Camera;
  texto: string;
  donde: string;
};

const SOURCES: Source[] = [
  { codigo: "ig_bio", nombre: "Instagram (bio)", Icon: Camera, texto: "Hola, vi su Instagram y me interesa 💗", donde: "El link de WhatsApp en tu bio de Instagram" },
  { codigo: "fb_bio", nombre: "Facebook (bio)", Icon: ThumbsUp, texto: "Hola, vi su Facebook y me interesa 💗", donde: "El link de WhatsApp en tu página de Facebook" },
  { codigo: "tt_bio", nombre: "TikTok (bio)", Icon: Music2, texto: "Hola, vi su TikTok y me interesa 💗", donde: "El link de WhatsApp en tu bio de TikTok" },
  { codigo: "web", nombre: "Sitio web", Icon: Globe, texto: "Hola, vi su sitio web y me interesa 💗", donde: "Botón de WhatsApp de tu página web" },
  { codigo: "card", nombre: "Tarjeta de presentación", Icon: CreditCard, texto: "Hola, me dieron su tarjeta de presentación 💗", donde: "QR de tarjetas físicas" },
  { codigo: "wsp_group", nombre: "Grupo de WhatsApp", Icon: Users, texto: "Hola, vi en el grupo 💗", donde: "Cuando compartes el WhatsApp en el grupo abierto" },
];

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

type TrackingResponse = {
  ok: boolean;
  whatsappNegocio: string | null;
  porOrigen: { origen: string; leads: number; pagados: number; facturacion: number; conversion_pct: number }[];
  porCodigo: { codigo: string; leads: number; pagados: number; facturacion: number; conversion_pct: number }[];
  totalLeads: number;
  error?: string;
};

type Campana = {
  codigo: string;
  nombre: string;
  texto: string;
  tipo: "meta_ad" | "ig_post" | "fb_post" | "tiktok" | "otro";
  notas?: string;
  created_at: string;
  archivado: boolean;
};

export function TrackingView() {
  const { data, isLoading } = useSWR<TrackingResponse>(
    "/api/dashboard/tracking?days=30",
    fetcher,
    { refreshInterval: 30_000 },
  );
  const { data: camp } = useSWR<{ ok: boolean; campanas: Campana[] }>(
    "/api/dashboard/tracking-campanas",
    fetcher,
    { refreshInterval: 30_000 },
  );

  const whatsappNegocio = data?.whatsappNegocio ?? null;
  const porOrigen = data?.porOrigen ?? [];
  const porCodigo = data?.porCodigo ?? [];
  const campanas = camp?.campanas ?? [];
  const error = data && !data.ok ? data.error : null;

  const numeroLimpio = whatsappNegocio?.replace(/\D/g, "") ?? "";
  const numeroValidacion = validarWhatsapp(numeroLimpio);

  return (
    <div className="px-10 py-6 space-y-6">
      <div>
        <div className="label-xs">Configuración · Tracking de origen</div>
        <h1 className="font-serif-display text-[56px] leading-[1.05] mt-1">
          ¿De dónde viene cada lead?
        </h1>
        <div className="text-[13px] text-foreground/60 mt-2 max-w-3xl">
          Aquí generas un link de WhatsApp distinto por cada lugar donde aparece tu número. Copias
          y pegas. El dashboard detecta de dónde viene cada lead. Sin tocar Meta. Sin tocar ManyChat.
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
                </a>
                . Solo dígitos, con código de país. Para México:{" "}
                <code className="text-foreground">527771234567</code> (52 + número de 10 dígitos).
              </p>
            </div>
          </div>
        </div>
      )}

      {whatsappNegocio && (
        <div
          className={cn(
            "rounded-lg border px-5 py-4",
            numeroValidacion.ok
              ? "border-sage-300 bg-sage-50/40"
              : "border-ambr-300 bg-ambr-50",
          )}
        >
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="label-xs">Número que se va a usar en los links</div>
              <div className="mt-1 flex items-center gap-3 flex-wrap">
                <code className="font-mono text-[15px] text-foreground bg-cream-100 px-2 py-1 rounded">
                  +{numeroLimpio || "—"}
                </code>
                <span
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded",
                    numeroValidacion.ok
                      ? "bg-sage-100 text-sage-600"
                      : "bg-ambr-100 text-ambr-600",
                  )}
                >
                  {numeroValidacion.ok ? "formato válido" : numeroValidacion.msg}
                </span>
              </div>
              {!numeroValidacion.ok && (
                <div className="text-[12px] text-foreground/70 mt-2 max-w-2xl">
                  {numeroValidacion.detalle}{" "}
                  <a href="/configuracion/sistema" className="text-rosey-500 underline">
                    Corrígelo en Sistema
                  </a>
                  .
                </div>
              )}
            </div>
            {numeroLimpio && (
              <a
                href={`https://api.whatsapp.com/send?phone=${numeroLimpio}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded border border-foreground/20 bg-cream-50 hover:bg-cream-100"
              >
                <ExternalLink className="h-3 w-3" />
                Probar el número solo
              </a>
            )}
          </div>
        </div>
      )}

      {/* Sección 1: links predefinidos */}
      <section className="space-y-3">
        <div className="label-xs">Links por origen · siempre los mismos</div>
        <div className="grid grid-cols-2 gap-3">
          {SOURCES.map((src) => {
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

      {/* Sección 2: campañas custom de anuncios */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-2 flex-wrap">
          <div>
            <div className="label-xs">Campañas de anuncios · custom</div>
            <div className="text-[12px] text-foreground/55 mt-1">
              Cada vez que lances un anuncio nuevo, créalo aquí y obtén su link único.
            </div>
          </div>
        </div>

        <NuevaCampanaForm onCreated={() => mutate("/api/dashboard/tracking-campanas")} />

        {campanas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-foreground/20 bg-cream-50 px-5 py-8 text-center">
            <Megaphone className="h-8 w-8 mx-auto text-foreground/30 mb-2" strokeWidth={1.3} />
            <div className="font-italic-serif text-foreground/55">
              Aún no has creado campañas de anuncios
            </div>
            <div className="text-[12px] text-foreground/55 mt-1">
              Usa el formulario de arriba. Ejemplo: &ldquo;Día de las Madres 2026&rdquo;.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {campanas.map((c) => {
              const stats = porCodigo.find((x) => x.codigo === c.codigo);
              return (
                <CampanaCard
                  key={c.codigo}
                  campana={c}
                  whatsappNegocio={whatsappNegocio}
                  stats={stats}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Sección 3: tabla agregada por canal */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="label-xs">Métricas por canal · últimos 30 días</div>
            <div className="text-[12px] text-foreground/55 mt-1">
              Agregado por red (Meta, Instagram, etc.). Para drill-down por anuncio específico mira las tarjetas de arriba.
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

function validarWhatsapp(digitos: string): {
  ok: boolean;
  msg: string;
  detalle: string;
} {
  if (digitos.length === 0) {
    return { ok: false, msg: "vacío", detalle: "Falta el número." };
  }
  if (digitos.length < 10) {
    return {
      ok: false,
      msg: `solo ${digitos.length} dígitos`,
      detalle: "Muy corto. Debe ser código de país + número (mínimo 11 dígitos en total).",
    };
  }
  if (digitos.length > 15) {
    return {
      ok: false,
      msg: `${digitos.length} dígitos (máx 15)`,
      detalle: "Demasiado largo. Revisa que no hayas pegado dos números juntos.",
    };
  }
  // Para México: si empieza con 521 (formato viejo con "1" de móvil),
  // wa.me sí lo acepta pero algunos números no responden bien.
  // El formato actual recomendado por Meta es 52 + 10 dígitos sin el 1.
  if (digitos.startsWith("521") && digitos.length === 13) {
    return {
      ok: true,
      msg: "formato MX antiguo (con 1)",
      detalle:
        "Si los links abren WhatsApp pero dicen 'no encontrado', borra el 1 después del 52.",
    };
  }
  if (digitos.startsWith("52") && digitos.length === 12) {
    return { ok: true, msg: "formato MX correcto", detalle: "" };
  }
  if (!digitos.startsWith("52") && digitos.length === 10) {
    return {
      ok: false,
      msg: "falta código de país",
      detalle: "Para México agrega 52 al inicio. Ej: 527771234567.",
    };
  }
  return { ok: true, msg: "formato OK", detalle: "" };
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

function NuevaCampanaForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<Campana["tipo"]>("meta_ad");
  const [texto, setTexto] = useState("");
  const [saving, setSaving] = useState(false);

  async function crear() {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/dashboard/tracking-campanas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          tipo,
          texto: texto.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (!d.ok) {
        alert(d.error || "Error al crear");
        return;
      }
      setNombre("");
      setTexto("");
      setOpen(false);
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-rosey-300 bg-rosey-50/30 hover:bg-rosey-50/60 px-5 py-4 flex items-center gap-3 transition-colors"
      >
        <Plus className="h-4 w-4 text-rosey-500" />
        <span className="font-medium text-foreground">Crear campaña nueva</span>
        <span className="text-[12px] text-foreground/55 ml-2">
          ej. &ldquo;Día de las Madres 2026&rdquo;, &ldquo;Black Friday Pandora&rdquo;
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-rosey-300 bg-rosey-50/30 px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">Nueva campaña</div>
        <button
          onClick={() => setOpen(false)}
          className="text-[11px] text-foreground/55 hover:text-foreground"
        >
          cancelar
        </button>
      </div>

      <div className="grid grid-cols-[1fr_180px] gap-3">
        <Field label="Nombre de la campaña">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Día de las Madres 2026"
            className="input"
            autoFocus
          />
        </Field>
        <Field label="Tipo">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as Campana["tipo"])}
            className="input"
          >
            <option value="meta_ad">Anuncio de Meta (FB/IG)</option>
            <option value="ig_post">Post de Instagram</option>
            <option value="fb_post">Post de Facebook</option>
            <option value="tiktok">TikTok</option>
            <option value="otro">Otro</option>
          </select>
        </Field>
      </div>

      <Field label="Mensaje pre-llenado (opcional)">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={`Hola, vi su ${nombre || "anuncio"} 💗`}
          className="input"
        />
        <span className="text-[10px] text-foreground/45 mt-1">
          Es el texto que la clienta ve pre-llenado cuando hace click. Si lo dejas vacío, lo armamos.
        </span>
      </Field>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={crear}
          disabled={!nombre.trim() || saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rosey-300 hover:bg-rosey-400 text-cream-50 text-sm font-medium disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {saving ? "Creando…" : "Crear y generar link"}
        </button>
        <div className="text-[11px] text-foreground/55">
          Se va a llamar:{" "}
          <code className="font-mono text-foreground">
            {tipo === "meta_ad" ? "ad" : tipo}_{slugifyPreview(nombre)}
          </code>
        </div>
      </div>

      <style>{`
        .input { width:100%; padding:8px 10px; border:1px solid hsl(var(--border)); border-radius:6px; background:hsl(var(--card)); font-size:14px; color:hsl(var(--foreground)); outline:none; }
        .input:focus { border-color:hsl(var(--primary)); }
      `}</style>
    </div>
  );
}

function slugifyPreview(nombre: string): string {
  if (!nombre.trim()) return "...";
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-xs">{label}</span>
      {children}
    </label>
  );
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
    ? `https://api.whatsapp.com/send?phone=${whatsappNegocio.replace(/\D/g, "")}&text=${encodeURIComponent(texto)}`
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

      <LinkRow
        link={link}
        copied={copied}
        onCopy={copyLink}
        whatsappNegocio={whatsappNegocio}
      />

      {stats && stats.leads > 0 && <StatsRow stats={stats} />}
    </div>
  );
}

function CampanaCard({
  campana,
  whatsappNegocio,
  stats,
}: {
  campana: Campana;
  whatsappNegocio: string | null;
  stats?: { leads: number; pagados: number; facturacion: number; conversion_pct: number };
}) {
  const [copied, setCopied] = useState(false);
  const texto = `${campana.texto} [src:${campana.codigo}]`;
  const link = whatsappNegocio
    ? `https://api.whatsapp.com/send?phone=${whatsappNegocio.replace(/\D/g, "")}&text=${encodeURIComponent(texto)}`
    : null;

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function archivar() {
    if (!confirm(`¿Archivar campaña "${campana.nombre}"? Sus métricas se conservan.`)) return;
    await fetch(`/api/dashboard/tracking-campanas?codigo=${encodeURIComponent(campana.codigo)}`, {
      method: "DELETE",
    });
    mutate("/api/dashboard/tracking-campanas");
  }

  const tipoLabel = {
    meta_ad: "Anuncio Meta",
    ig_post: "Post Instagram",
    fb_post: "Post Facebook",
    tiktok: "TikTok",
    otro: "Otro",
  }[campana.tipo];

  return (
    <div className="rounded-lg border border-rosey-200 bg-cream-50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="rounded-md border border-rosey-200 bg-rosey-50/50 p-2 shrink-0">
          <Megaphone className="h-4 w-4 text-rosey-500" strokeWidth={1.6} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-serif-display text-[18px] leading-none truncate">
              {campana.nombre}
            </div>
            <span className="text-[9px] tracking-wider uppercase px-1.5 py-0.5 rounded border border-foreground/15 text-foreground/55">
              {tipoLabel}
            </span>
          </div>
          <div className="text-[10px] font-mono text-foreground/45 mt-1">{campana.codigo}</div>
        </div>
        <div className="flex items-start gap-2">
          {stats && stats.leads > 0 && (
            <div className="text-right">
              <div className="font-serif-display text-[20px] leading-none">{stats.leads}</div>
              <div className="text-[10px] tracking-wider uppercase text-foreground/55">leads</div>
            </div>
          )}
          <button
            onClick={archivar}
            className="text-foreground/40 hover:text-rosey-500 mt-1"
            title="Archivar campaña"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <LinkRow
        link={link}
        copied={copied}
        onCopy={copyLink}
        whatsappNegocio={whatsappNegocio}
      />

      {stats && stats.leads > 0 && <StatsRow stats={stats} />}
    </div>
  );
}

function LinkRow({
  link,
  copied,
  onCopy,
  whatsappNegocio,
}: {
  link: string | null;
  copied: boolean;
  onCopy: () => void;
  whatsappNegocio: string | null;
}) {
  return (
    <div className="flex items-center gap-2">
      {link ? (
        <>
          <code className="flex-1 text-[10px] font-mono text-foreground/65 truncate bg-cream-100 border border-foreground/10 rounded px-2 py-1.5">
            {link}
          </code>
          <button
            onClick={onCopy}
            className={cn(
              "inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded border transition-colors shrink-0",
              copied
                ? "border-sage-300 text-sage-600 bg-sage-50"
                : "border-foreground/20 hover:bg-cream-100",
            )}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center text-[11px] px-2 py-1.5 rounded border border-foreground/20 hover:bg-cream-100"
            title="Probar"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </>
      ) : (
        <div className="text-[11px] text-foreground/55 italic">
          Configura primero <code>whatsapp_negocio</code> en{" "}
          <a href="/configuracion/sistema" className="text-rosey-500 underline">
            Sistema
          </a>
          {whatsappNegocio === null && ""}
        </div>
      )}
    </div>
  );
}

function StatsRow({
  stats,
}: {
  stats: { leads: number; pagados: number; facturacion: number; conversion_pct: number };
}) {
  return (
    <div className="text-[11px] text-foreground/65 pt-2 border-t border-foreground/10 flex items-center justify-between">
      <span>
        {stats.pagados} cerrados · {formatMxn(stats.facturacion)}
      </span>
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
  );
}
