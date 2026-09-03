import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      live: true,
      name: "virello-ai-optimizer",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
