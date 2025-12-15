// ─────────────────────────────────────────────────────────────────────────────
// Workflow State (localStorage)
// ─────────────────────────────────────────────────────────────────────────────
// Client-side state management for tracking in-flight workflows.
// This persists across page refreshes so users can see progress.
// Note: This is browser-local only—different tabs/devices won't share state.

"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type WorkflowStatus = "queued" | "running" | "completed" | "failed";

export type WorkflowType = "summarizeAndTag" | "translateCaptions" | "translateAudio" | "createClip" | "renderVideo" | "socialClip";

export interface WorkflowProgress {
  workflowRunId: string;
  status: WorkflowStatus;
  startedAt: string; // ISO timestamp
  completedAt?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Key Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a consistent localStorage key for a workflow.
 *
 * @param assetId - The Mux asset ID
 * @param workflowType - The type of workflow
 * @param targetLang - The target language (optional for some workflows)
 * @returns The localStorage key
 */
function getWorkflowKey(
  assetId: string,
  workflowType: WorkflowType,
  targetLang?: string,
): string {
  if (targetLang) {
    return `workflow:${assetId}:${workflowType}:${targetLang}`;
  }
  return `workflow:${assetId}:${workflowType}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads the current workflow progress from localStorage.
 *
 * @param assetId - The Mux asset ID
 * @param workflowType - The type of workflow
 * @param targetLang - The target language (optional)
 * @returns The workflow progress, or null if not found
 */
export function getWorkflowProgress(
  assetId: string,
  workflowType: WorkflowType,
  targetLang?: string,
): WorkflowProgress | null {
  if (typeof window === "undefined") {
    return null;
  }

  const key = getWorkflowKey(assetId, workflowType, targetLang);
  const stored = localStorage.getItem(key);

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as WorkflowProgress;
  } catch {
    // Corrupted data, remove it
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * Updates the workflow progress in localStorage.
 *
 * @param assetId - The Mux asset ID
 * @param workflowType - The type of workflow
 * @param targetLang - The target language (optional)
 * @param progress - The workflow progress to store
 */
export function setWorkflowProgress(
  assetId: string,
  workflowType: WorkflowType,
  targetLang: string | undefined,
  progress: WorkflowProgress,
): void {
  if (typeof window === "undefined") {
    return;
  }

  const key = getWorkflowKey(assetId, workflowType, targetLang);
  localStorage.setItem(key, JSON.stringify(progress));
}

/**
 * Removes workflow progress from localStorage.
 * Typically called when a workflow completes or fails.
 *
 * @param assetId - The Mux asset ID
 * @param workflowType - The type of workflow
 * @param targetLang - The target language (optional)
 */
export function clearWorkflowProgress(
  assetId: string,
  workflowType: WorkflowType,
  targetLang?: string,
): void {
  if (typeof window === "undefined") {
    return;
  }

  const key = getWorkflowKey(assetId, workflowType, targetLang);
  localStorage.removeItem(key);
}

/**
 * Lists all in-flight workflows for a given asset.
 * Scans localStorage for keys matching the workflow pattern.
 *
 * @param assetId - The Mux asset ID
 * @returns Array of workflow progress objects with their types and languages
 */
export function getAllInFlightWorkflows(assetId: string): Array<{
  workflowType: WorkflowType;
  targetLang?: string;
  progress: WorkflowProgress;
}> {
  if (typeof window === "undefined") {
    return [];
  }

  const prefix = `workflow:${assetId}:`;
  const results: Array<{
    workflowType: WorkflowType;
    targetLang?: string;
    progress: WorkflowProgress;
  }> = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) {
      continue;
    }

    // Parse the key: workflow:assetId:workflowType:targetLang?
    const parts = key.slice(prefix.length).split(":");
    const workflowType = parts[0] as WorkflowType;
    const targetLang = parts[1];

    const stored = localStorage.getItem(key);
    if (!stored) {
      continue;
    }

    try {
      const progress = JSON.parse(stored) as WorkflowProgress;

      // Only include in-flight (queued or running) workflows
      if (progress.status === "queued" || progress.status === "running") {
        results.push({ workflowType, targetLang, progress });
      }
    } catch {
      // Skip corrupted entries
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Starts a new workflow and stores its initial progress.
 *
 * @param assetId - The Mux asset ID
 * @param workflowType - The type of workflow
 * @param targetLang - The target language (optional)
 * @param workflowRunId - The workflow run ID from the server
 */
export function startWorkflow(
  assetId: string,
  workflowType: WorkflowType,
  targetLang: string | undefined,
  workflowRunId: string,
): void {
  setWorkflowProgress(assetId, workflowType, targetLang, {
    workflowRunId,
    status: "queued",
    startedAt: new Date().toISOString(),
  });
}

/**
 * Marks a workflow as running.
 *
 * @param assetId - The Mux asset ID
 * @param workflowType - The type of workflow
 * @param targetLang - The target language (optional)
 */
export function markWorkflowRunning(
  assetId: string,
  workflowType: WorkflowType,
  targetLang?: string,
): void {
  const current = getWorkflowProgress(assetId, workflowType, targetLang);
  if (current) {
    setWorkflowProgress(assetId, workflowType, targetLang, {
      ...current,
      status: "running",
    });
  }
}

/**
 * Marks a workflow as completed and optionally clears it.
 *
 * @param assetId - The Mux asset ID
 * @param workflowType - The type of workflow
 * @param targetLang - The target language (optional)
 * @param clearAfterComplete - Whether to remove from storage (default: true)
 */
export function markWorkflowCompleted(
  assetId: string,
  workflowType: WorkflowType,
  targetLang?: string,
  clearAfterComplete = true,
): void {
  if (clearAfterComplete) {
    clearWorkflowProgress(assetId, workflowType, targetLang);
  } else {
    const current = getWorkflowProgress(assetId, workflowType, targetLang);
    if (current) {
      setWorkflowProgress(assetId, workflowType, targetLang, {
        ...current,
        status: "completed",
        completedAt: new Date().toISOString(),
      });
    }
  }
}

/**
 * Marks a workflow as failed with an error message.
 *
 * @param assetId - The Mux asset ID
 * @param workflowType - The type of workflow
 * @param targetLang - The target language (optional)
 * @param error - The error message
 */
export function markWorkflowFailed(
  assetId: string,
  workflowType: WorkflowType,
  targetLang: string | undefined,
  error: string,
): void {
  const current = getWorkflowProgress(assetId, workflowType, targetLang);
  if (current) {
    setWorkflowProgress(assetId, workflowType, targetLang, {
      ...current,
      status: "failed",
      completedAt: new Date().toISOString(),
      error,
    });
  }
}
