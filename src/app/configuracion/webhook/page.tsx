import { WebhookInspector } from "@/components/configuracion/webhook-inspector";

export const dynamic = "force-dynamic";

export default function WebhookInspectorPage() {
  return (
    <div className="px-10 py-6 space-y-6">
      <div>
        <div className="label-xs">Configuración · Webhook</div>
        <h1 className="font-serif-display text-5xl leading-none mt-1">
          Inspector del webhook
        </h1>
        <div className="text-[13px] text-muted-foreground mt-2">
          Últimos 50 POSTs recibidos en{" "}
          <code className="text-foreground">/api/webhook/manychat</code>. Se
          refresca cada 5s. El buffer vive en memoria y se vacía al reiniciar
          el servidor.
        </div>
      </div>

      <WebhookInspector />
    </div>
  );
}
