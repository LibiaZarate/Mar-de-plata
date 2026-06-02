// GET: devuelve qué credenciales están configuradas (sin exponer
// valores reales — solo máscaras). PUT: guarda/actualiza. DELETE:
// borra todas.

import { NextRequest, NextResponse } from "next/server";
import { getMetaCreds } from "@/lib/meta/client";
import { setSecret, deleteSecret, mascaraSecret } from "@/lib/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  app_id?: string;
  access_token?: string;
  ad_account_id?: string;
  business_id?: string;
};

export async function GET() {
  try {
    const creds = await getMetaCreds();
    return NextResponse.json({
      ok: true,
      configured: {
        app_id: !!creds.appId,
        access_token: !!creds.token,
        ad_account_id: !!creds.adAccountId,
        business_id: !!creds.businessId,
      },
      mascaras: {
        app_id: creds.appId ?? "",
        access_token: mascaraSecret(creds.token),
        ad_account_id: creds.adAccountId ?? "",
        business_id: creds.businessId ?? "",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const updates: { clave: string; valor: string; descripcion: string }[] = [];

    if (body.app_id !== undefined && body.app_id.trim()) {
      updates.push({
        clave: "meta_app_id",
        valor: body.app_id.trim(),
        descripcion: "Meta · App ID (Marketing API)",
      });
    }
    if (body.access_token !== undefined && body.access_token.trim()) {
      updates.push({
        clave: "meta_access_token",
        valor: body.access_token.trim(),
        descripcion: "Meta · Access Token (auto, set desde UI)",
      });
    }
    if (body.ad_account_id !== undefined && body.ad_account_id.trim()) {
      const v = body.ad_account_id.trim();
      const normalized = v.startsWith("act_") ? v : `act_${v}`;
      updates.push({
        clave: "meta_ad_account_id",
        valor: normalized,
        descripcion: "Meta · Ad Account ID (formato act_xxxxx)",
      });
    }
    if (body.business_id !== undefined && body.business_id.trim()) {
      updates.push({
        clave: "meta_business_id",
        valor: body.business_id.trim(),
        descripcion: "Meta · Business Manager ID",
      });
    }

    for (const u of updates) {
      await setSecret(u.clave, u.valor, u.descripcion);
    }

    return NextResponse.json({ ok: true, updated: updates.length });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    await Promise.all([
      deleteSecret("meta_app_id"),
      deleteSecret("meta_access_token"),
      deleteSecret("meta_ad_account_id"),
      deleteSecret("meta_business_id"),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
