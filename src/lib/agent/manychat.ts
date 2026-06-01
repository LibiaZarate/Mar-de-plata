// Cliente ManyChat — POST a /fb/sending/sendContent.
// Soporta modo Kaizen (testing) via X-Kaizen-Session header.
// Si MANYCHAT_API_KEY no está definida, solo loguea y retorna ok=false.

const MANYCHAT_URL = "https://api.manychat.com/fb/sending/sendContent";
const KAIZEN_URL = "https://kaizen.azxion.com/api/simulator/inbound";

export type WhatsappMessage =
  | { type: "text"; text: string }
  | { type: "image"; url: string };

export type SendResult = {
  ok: boolean;
  delivered: boolean;
  via: "manychat" | "kaizen" | "stub";
  status?: number;
  error?: string;
};

export async function sendToClient(input: {
  subscriberId: string | null;
  messages: WhatsappMessage[];
  kaizenSessionId?: string | null;
}): Promise<SendResult> {
  // Modo Kaizen
  if (input.kaizenSessionId) {
    try {
      const r = await fetch(KAIZEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Kaizen-Session": input.kaizenSessionId,
        },
        body: JSON.stringify({
          subscriber_id: input.subscriberId,
          data: {
            version: "v2",
            content: { type: "whatsapp", messages: input.messages },
          },
        }),
      });
      return { ok: r.ok, delivered: r.ok, via: "kaizen", status: r.status };
    } catch (e) {
      return { ok: false, delivered: false, via: "kaizen", error: (e as Error).message };
    }
  }

  const key = process.env.MANYCHAT_API_KEY;
  if (!key || !input.subscriberId) {
    console.info(
      `[manychat·stub] subscriber=${input.subscriberId} msgs=${input.messages.length}`,
    );
    return { ok: true, delivered: false, via: "stub" };
  }

  try {
    const r = await fetch(MANYCHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscriber_id: input.subscriberId,
        data: {
          version: "v2",
          content: { type: "whatsapp", messages: input.messages },
        },
      }),
    });
    return { ok: r.ok, delivered: r.ok, via: "manychat", status: r.status };
  } catch (e) {
    return { ok: false, delivered: false, via: "manychat", error: (e as Error).message };
  }
}
