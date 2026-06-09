import { NextResponse } from "next/server";
import { runSessionWatchdog } from "@/lib/session/sessionActions";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  } else if (!/vercel-cron/i.test(userAgent)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSessionWatchdog();
  return NextResponse.json({ ok: true, ...result });
}
