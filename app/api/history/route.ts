import { NextResponse } from "next/server";
import {
  handleHistoryGet,
  handleHistoryPost,
  handleHistoryDelete,
} from "../../../lib/api-handlers";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";

const createClient = () => createSupabaseServerClient();

export async function GET(request: Request) {
  void request;
  const result = await handleHistoryGet(createClient);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}

export async function POST(request: Request) {
  const result = await handleHistoryPost(request, createClient);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}

export async function DELETE(request: Request) {
  const result = await handleHistoryDelete(request, createClient);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}
