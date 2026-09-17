import { NextResponse } from "next/server";
import { handleAnalyze } from "../../../lib/api-handlers";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const result = await handleAnalyze(request);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}
