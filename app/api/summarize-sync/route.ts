import { start } from 'workflow/api';
import { getSummaryAndTags } from '@mux/ai/workflows';
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { assetId } = await request.json();

  if (!assetId) {
    return NextResponse.json({ error: 'assetId is required' }, { status: 400 });
  }

  const run = await start(getSummaryAndTags, [assetId]);
  const result = await run.returnValue;

  return NextResponse.json(result);
}
