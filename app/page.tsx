'use client';

import { useState } from 'react';

const DEFAULT_ASSET_ID = 'X9F02RxSEEBbC02lXPzAeGgsi4Ypowr9ds';

export default function Home() {
  const [assetId, setAssetId] = useState(DEFAULT_ASSET_ID);
  const [loading, setLoading] = useState(false);
  const [activeOperation, setActiveOperation] = useState<'sync' | 'async' | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [workflowInfo, setWorkflowInfo] = useState<{
    runId: string;
    status: string;
    workflowName?: string;
    createdAt?: string;
    startedAt?: string;
  } | null>(null);

  const handleSyncSummarize = async () => {
    setLoading(true);
    setActiveOperation('sync');
    setError(null);
    setResult(null);
    setWorkflowInfo(null);

    try {
      const response = await fetch('/api/summarize-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assetId }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch summary');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setActiveOperation(null);
    }
  };

  const pollRunStatus = async (runId: string, onStatusUpdate: (info: any) => void) => {
    const maxAttempts = 60;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const response = await fetch(`/api/runs/${runId}`);
      const data = await response.json();

      // Update workflow info with current status
      onStatusUpdate({
        runId: data.runId,
        status: data.status,
        workflowName: data.workflowName,
        createdAt: data.createdAt,
        startedAt: data.startedAt,
      });

      if (data.status === 'completed') {
        return data.result;
      }

      if (data.status === 'failed') {
        throw new Error('Workflow failed');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('Workflow timed out');
  };

  const handleAsyncSummarize = async () => {
    setLoading(true);
    setActiveOperation('async');
    setError(null);
    setResult(null);
    setWorkflowInfo(null);

    try {
      const response = await fetch('/api/summarize-async', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assetId }),
      });

      if (!response.ok) {
        throw new Error('Failed to start workflow');
      }

      const { runId } = await response.json();

      // Set initial workflow info with runId
      setWorkflowInfo({
        runId,
        status: 'pending',
      });

      const workflowResult = await pollRunStatus(runId, setWorkflowInfo);
      setResult(workflowResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setActiveOperation(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black p-8">
      <main className="w-full max-w-2xl space-y-6 bg-white dark:bg-zinc-900 p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Mux Asset Summarizer
        </h1>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="assetId"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
            >
              Mux Asset ID
            </label>
            <input
              id="assetId"
              type="text"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter Mux Asset ID"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleSyncSummarize}
              disabled={loading || !assetId}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors"
            >
              {activeOperation === 'sync' ? 'Processing...' : 'Get summary & tags (regular)'}
            </button>

            <button
              onClick={handleAsyncSummarize}
              disabled={loading || !assetId}
              className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors"
            >
              {activeOperation === 'async' ? 'Processing...' : 'Get summary & tags (workflow)'}
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {workflowInfo && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Workflow Status
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex gap-2">
                <span className="font-medium text-blue-800 dark:text-blue-200">Run ID:</span>
                <span className="text-blue-700 dark:text-blue-300 font-mono">{workflowInfo.runId}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium text-blue-800 dark:text-blue-200">Status:</span>
                <span className="text-blue-700 dark:text-blue-300 capitalize">{workflowInfo.status}</span>
              </div>
              {workflowInfo.workflowName && (
                <div className="flex gap-2">
                  <span className="font-medium text-blue-800 dark:text-blue-200">Workflow:</span>
                  <span className="text-blue-700 dark:text-blue-300">{workflowInfo.workflowName}</span>
                </div>
              )}
              {workflowInfo.createdAt && (
                <div className="flex gap-2">
                  <span className="font-medium text-blue-800 dark:text-blue-200">Created:</span>
                  <span className="text-blue-700 dark:text-blue-300">{new Date(workflowInfo.createdAt).toLocaleString()}</span>
                </div>
              )}
              {workflowInfo.startedAt && (
                <div className="flex gap-2">
                  <span className="font-medium text-blue-800 dark:text-blue-200">Started:</span>
                  <span className="text-blue-700 dark:text-blue-300">{new Date(workflowInfo.startedAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Results
            </h2>
            <pre className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-x-auto text-sm text-zinc-900 dark:text-zinc-100">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
