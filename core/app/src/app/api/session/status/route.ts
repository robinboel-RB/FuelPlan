import { NextResponse } from "next/server";
import { getServerSessionStatus } from "@/lib/session/sessionActions";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const result = await getServerSessionStatus(request);
  return NextResponse.json(result.body, { status: result.status });
}
