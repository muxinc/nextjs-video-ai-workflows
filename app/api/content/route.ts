import { start } from 'workflow/api';
import { aiContentWorkflow } from "../../workflows/ai-content-workflow";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { topic } = await request.json();
  // gets called async
  const ret = await start(aiContentWorkflow, [topic]);

  return NextResponse.json(ret);
}
