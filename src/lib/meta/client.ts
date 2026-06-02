// Cliente de Meta Marketing API (Graph API).
// Las credenciales viven en env vars · NUNCA en código.

const GRAPH_VERSION = "v19.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

type MetaCreds = {
  token: string | null;
  appId: string | null;
  adAccountId: string | null;
  businessId: string | null;
};

export function getMetaCreds(): MetaCreds {
  return {
    token: process.env.META_ACCESS_TOKEN ?? null,
    appId: process.env.META_APP_ID ?? null,
    adAccountId: process.env.META_AD_ACCOUNT_ID ?? null,
    businessId: process.env.META_BUSINESS_ID ?? null,
  };
}

export class MetaApiError extends Error {
  status: number;
  metaCode?: number;
  metaSubcode?: number;
  metaType?: string;
  constructor(status: number, message: string, extra?: Partial<MetaApiError>) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

export async function metaGet<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const { token } = getMetaCreds();
  if (!token) {
    throw new MetaApiError(0, "META_ACCESS_TOKEN no está definida");
  }
  const url = new URL(GRAPH_URL + path);
  url.searchParams.set("access_token", token);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const r = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!r.ok) {
    let body: { error?: { message: string; code?: number; error_subcode?: number; type?: string } } = {};
    try {
      body = await r.json();
    } catch {
      // no-op
    }
    const msg = body.error?.message ?? `HTTP ${r.status}`;
    throw new MetaApiError(r.status, msg, {
      metaCode: body.error?.code,
      metaSubcode: body.error?.error_subcode,
      metaType: body.error?.type,
    });
  }
  return (await r.json()) as T;
}

// Auto-detecta el primer ad account si no está configurado
export async function resolveAdAccountId(): Promise<string> {
  const { adAccountId } = getMetaCreds();
  if (adAccountId) {
    return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  }
  const resp = await metaGet<{ data: { id: string; name: string }[] }>(
    "/me/adaccounts",
    { fields: "id,name", limit: "1" },
  );
  const first = resp.data[0];
  if (!first) {
    throw new MetaApiError(404, "El token no tiene acceso a ningún ad account");
  }
  return first.id;
}
