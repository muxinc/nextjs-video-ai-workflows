// ─────────────────────────────────────────────────────────────────────────────
// Shared utilities for workflow server actions
// ─────────────────────────────────────────────────────────────────────────────

import type { WorkflowStatus } from "../../types";

/**
 * Maps Vercel Workflow status strings to our UI-friendly WorkflowStatus type.
 */
export function mapWorkflowStatus(status: string): WorkflowStatus {
  if (status === "pending") {
    return "starting";
  }
  if (status === "running") {
    return "running";
  }
  if (status === "completed") {
    return "completed";
  }
  if (status === "failed") {
    return "failed";
  }
  // paused/cancelled/unknown: treat as failed for UI
  return "failed";
}

/**
 * Reads events from a workflow progress stream without blocking.
 * Uses a short timeout to prevent hanging server actions.
 *
 * @param stream - ReadableStream of progress events from the workflow
 * @returns Array of events that were immediately available
 */
export async function readProgressEvents<TEvent extends { type: string }>(
  stream: ReadableStream<TEvent>,
): Promise<TEvent[]> {
  const reader = stream.getReader();
  const events: TEvent[] = [];

  // Read as many buffered events as are immediately available.
  // Guard with a short timeout so we never hang a server action.
  try {
    for (let i = 0; i < 50; i++) {
      const readPromise = reader.read();
      // Attach no-op catch to prevent unhandled rejection if timeout wins
      readPromise.catch(() => {});

      const next = await Promise.race([
        readPromise,
        new Promise<"timeout">(resolve => setTimeout(() => resolve("timeout"), 50)),
      ]);

      if (next === "timeout") {
        break;
      }

      if (next.done) {
        break;
      }

      if (next.value) {
        events.push(next.value);
      }
    }
  } finally {
    // Always release the reader lock to prevent listener accumulation
    try {
      reader.releaseLock();
    } catch {
      // ignore - reader may already be released
    }
  }

  return events;
}

/**
 * Merges step arrays, deduplicating while preserving order.
 */
export function mergeSteps<TStep extends string>(prev: TStep[], next: TStep[]): TStep[] {
  return next.length ? Array.from(new Set([...prev, ...next])) : prev;
}
