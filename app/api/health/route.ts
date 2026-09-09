import { NextResponse } from "next/server";
import { envIsReady, envReadiness } from "../_lib/env-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const env = envReadiness();
  return NextResponse.json(
    {
      ok: true,
      live: true,
      name: "virello-ai-optimizer",
      ready: envIsReady(env),
      env,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
