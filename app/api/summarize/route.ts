import { getSummaryAndTags } from '@mux/ai/workflows';
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const assetId = "X9F02RxSEEBbC02lXPzAeGgsi4Ypowr9ds"
  const result = await getSummaryAndTags(assetId);

  return NextResponse.json(result);
}




