import { NextResponse } from "next/server";
import {
  parsePushSubscription,
  removeSubscription
} from "@/lib/push/subscriptions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const subscription = parsePushSubscription(body);
  const endpoint =
    subscription?.endpoint ||
    (body && typeof body.endpoint === "string" ? body.endpoint : "");

  if (!endpoint) {
    return NextResponse.json(
      { ok: false, error: "Missing endpoint" },
      { status: 400 }
    );
  }

  removeSubscription(endpoint);

  return NextResponse.json({ ok: true });
}
