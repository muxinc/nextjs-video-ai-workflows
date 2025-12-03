import { start } from 'workflow/api';
import { aiContentWorkflow } from "../../workflows/ai-content-workflow";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { topic } = await request.json();

  // Executes asynchronously and doesn't block your app
  const ret = await start(aiContentWorkflow, [topic]);
  console.log('debug', ret);

  return NextResponse.json({
    message: "AI content workflow started",
  });
}
