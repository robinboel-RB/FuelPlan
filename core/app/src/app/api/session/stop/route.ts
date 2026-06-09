import { NextResponse } from "next/server";
import { stopServerSession } from "@/lib/session/sessionActions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const result = await stopServerSession(request);
  return NextResponse.json(result.body, { status: result.status });
}
