import { NextResponse } from "next/server";
import { handleTemplates } from "../../../lib/api-handlers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const result = await handleTemplates(request);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}
