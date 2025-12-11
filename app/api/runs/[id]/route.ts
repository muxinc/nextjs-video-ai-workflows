import { getRun } from 'workflow/api';
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const run = getRun(id);
    const [status, workflowName, createdAt, startedAt] = await Promise.all([
      run.status,
      run.workflowName,
      run.createdAt,
      run.startedAt,
    ]);

    const response: {
      runId: string;
      status: string;
      workflowName?: string;
      createdAt?: string;
      startedAt?: string;
      result?: any;
    } = {
      runId: id,
      status,
      workflowName,
      createdAt: createdAt?.toISOString(),
      startedAt: startedAt?.toISOString(),
    };

    if (status === 'completed') {
      response.result = await run.returnValue;
    }

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: 'Run not found or error fetching run status' },
      { status: 404 }
    );
  }
}
