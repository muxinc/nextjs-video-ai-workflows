import { getSummaryAndTags } from '@mux/ai/workflows';
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const result = await getSummaryAndTags("X9F02RxSEEBbC02lXPzAeGgsi4Ypowr9ds");

  return NextResponse.json(result);
}
