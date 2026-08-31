import { NextRequest, NextResponse } from "next/server";
import { hasActiveSubscriber } from "../../_lib/subscriber";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest
) {
  const active =
    await hasActiveSubscriber(request);

  return NextResponse.json(
    {
      success: true,
      active,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
