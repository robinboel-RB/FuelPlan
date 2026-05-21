import { NextResponse } from "next/server";
import {
  parsePushSubscription,
  saveSubscription
} from "@/lib/push/subscriptions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const subscription = parsePushSubscription(body);

  if (!subscription) {
    return NextResponse.json(
      { ok: false, error: "Invalid push subscription" },
      { status: 400 }
    );
  }

  saveSubscription(subscription);

  return NextResponse.json({ ok: true });
}
