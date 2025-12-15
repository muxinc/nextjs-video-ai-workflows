import { NextResponse } from "next/server";
import { getRun, start } from "workflow/api";

import { env } from "@/app/lib/env";
import { translateAudioWorkflow } from "@/workflows/translate-audio";

/**
 * POST: Start a new audio translation workflow (non-blocking)
 * Returns the run ID immediately so client can poll for status
 */
export async function POST(request: Request) {
  try {
    if (!env.ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: "ElevenLabs env key required" },
        { status: 501 },
      );
    }

    const { assetId, targetLang } = await request.json();

    if (!assetId || !targetLang) {
      return NextResponse.json(
        { error: "Missing required fields: assetId and targetLang" },
        { status: 400 },
      );
    }

    // Start workflow and return immediately (non-blocking)
    const run = await start(translateAudioWorkflow, [
      assetId,
      targetLang,
    ]);

    return NextResponse.json({
      message: "Audio translation workflow started",
      runId: run.runId,
      status: "running",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET: Poll for workflow status by run ID
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId");

    if (!runId) {
      return NextResponse.json(
        { error: "Missing required query param: runId" },
        { status: 400 },
      );
    }

    const run = getRun(runId);

    // Check the workflow status directly - no artificial timeout needed
    const workflowStatus = await run.status;

    if (workflowStatus === "completed") {
      const result = await run.returnValue;
      return NextResponse.json({
        runId,
        status: "completed",
        success: (result as { success: boolean }).success,
        completedSteps: (result as { completedSteps: string[] }).completedSteps,
        result: (result as { result: unknown }).result,
      });
    }

    if (workflowStatus === "failed") {
      const result = await run.returnValue;
      return NextResponse.json({
        runId,
        status: "failed",
        success: false,
        error: (result as { error?: string }).error,
      });
    }

    // Workflow still running (pending, running, etc.)
    return NextResponse.json({
      runId,
      status: "running",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get workflow status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
