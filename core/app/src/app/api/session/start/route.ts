import { NextResponse } from "next/server";
import { startServerSession } from "@/lib/session/sessionActions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const result = await startServerSession(request);
  return NextResponse.json(result.body, { status: result.status });
}
