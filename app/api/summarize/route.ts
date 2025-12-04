import { getSummaryAndTags } from '@/lib/mux-ai/workflows/index.mjs';
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const result = await getSummaryAndTags("88Lb01qNUqFJrOFMITk00Ck201F00Qmcbpc5qgopNV4fCOk");

  return NextResponse.json(result);
}
