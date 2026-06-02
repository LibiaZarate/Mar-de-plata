// Status de la conexión Meta Marketing API.
// Devuelve info del token + lista de ad accounts visibles + el configurado.

import { NextResponse } from "next/server";
import { getMetaCreds, metaGet, MetaApiError } from "@/lib/meta/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Me = { id: string; name?: string };
type AdAccount = {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
};

export async function GET() {
  const { token, appId, adAccountId, businessId } = getMetaCreds();
  if (!token) {
    return NextResponse.json({
      ok: false,
      configured: false,
      missing: ["META_ACCESS_TOKEN"],
      message: "Falta META_ACCESS_TOKEN. Agrégalo a .env.local o a Vercel Env Vars.",
    });
  }
  try {
    const [me, accounts] = await Promise.all([
      metaGet<Me>("/me", { fields: "id,name" }),
      metaGet<{ data: AdAccount[] }>("/me/adaccounts", {
        fields: "id,name,account_status,currency,timezone_name",
        limit: "25",
      }),
    ]);

    return NextResponse.json({
      ok: true,
      configured: true,
      app_id: appId,
      business_id: businessId,
      configured_ad_account: adAccountId,
      user: me,
      ad_accounts: accounts.data,
      auto_selected: adAccountId ? null : accounts.data[0]?.id ?? null,
    });
  } catch (e) {
    const err = e as MetaApiError;
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        error: err.message,
        meta_code: err.metaCode,
        meta_type: err.metaType,
        hint: hintFromError(err),
      },
      { status: err.status >= 400 ? 200 : 500 },
    );
  }
}

function hintFromError(err: MetaApiError): string | null {
  if (err.metaCode === 190) {
    return "Token inválido o expirado. Genera uno nuevo en https://developers.facebook.com/tools/explorer";
  }
  if (err.metaCode === 200 || err.metaCode === 10) {
    return "El token no tiene los permisos necesarios. Necesitas ads_read o ads_management.";
  }
  if (err.metaCode === 100) {
    return "Parámetro inválido. Verifica META_AD_ACCOUNT_ID (debe empezar con act_).";
  }
  return null;
}
