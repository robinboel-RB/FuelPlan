import { NextResponse } from "next/server";
import { getQStashReadinessDebug } from "@/lib/session/sessionActions";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getQStashReadinessDebug());
}
