import { getSummaryAndTags } from '@mux/ai/workflows';
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { assetId } = await request.json();

  if (!assetId) {
    return NextResponse.json({ error: 'assetId is required' }, { status: 400 });
  }

  const resp = await getSummaryAndTags(assetId);

  return NextResponse.json({ resp });
}
