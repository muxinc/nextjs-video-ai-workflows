"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { Level1SummaryState, SummaryTone } from "./level-1-actions";
import { generateSummaryAndTagsAction } from "./level-1-actions";

const TONE_OPTIONS: { value: SummaryTone; label: string; description: string }[] = [
  { value: "normal", label: "Normal", description: "Balanced and clear" },
  { value: "professional", label: "Professional", description: "Formal and polished" },
  { value: "sassy", label: "Playful", description: "Bold and playful" },
];

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="btn-primary w-full"
      disabled={pending}
    >
      {pending ? "Generating..." : "Generate summary & tags"}
    </button>
  );
}

function TagChip({ tag }: { tag: string }) {
  return (
    <span
      className="inline-flex items-center rounded-none border-2 border-border bg-surface-elevated px-2 py-1 text-[11px] font-bold"
      style={{ fontFamily: "var(--font-space-mono)" }}
    >
      {tag}
    </span>
  );
}

export function Level1SummaryAndTags({ assetId }: { assetId: string }) {
  return <Level1SummaryAndTagsInner assetId={assetId} />;
}

function ToneSelector({
  selectedTone,
  onToneChange,
}: {
  selectedTone: SummaryTone;
  onToneChange: (tone: SummaryTone) => void;
}) {
  return (
    <div className="space-y-2">
      <label
        className="block text-[10px] font-bold tracking-[0.2em] text-foreground-muted"
        style={{ fontFamily: "var(--font-space-mono)" }}
      >
        TONE
      </label>
      <div className="flex gap-2">
        {TONE_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => onToneChange(option.value)}
            className={`flex-1 border-2 px-3 py-2 text-xs font-bold transition-colors ${
              selectedTone === option.value ?
                "border-foreground bg-foreground text-surface" :
                "border-border bg-surface hover:bg-surface-elevated"
            }`}
            title={option.description}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Level1SummaryAndTagsInner({ assetId }: { assetId: string }) {
  const [state, action] = useActionState<Level1SummaryState, FormData>(
    generateSummaryAndTagsAction,
    { status: "idle" },
  );
  const [selectedTone, setSelectedTone] = useState<SummaryTone>("normal");

  const isError = state.status === "error";
  const isSuccess = state.status === "success";

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="assetId" value={assetId} />
        <input type="hidden" name="tone" value={selectedTone} />

        <ToneSelector selectedTone={selectedTone} onToneChange={setSelectedTone} />

        <SubmitButton />

        {isError && (
          <div className="border-2 border-border bg-surface-elevated p-4 text-sm">
            <div className="mb-1 font-bold">Generation failed</div>
            <div className="text-foreground-muted">{state.error}</div>
          </div>
        )}
      </form>

      {isSuccess && (
        <div className="space-y-4">
          <div className="border-2 border-border bg-surface-elevated p-4">
            <div
              className="mb-2 text-[10px] font-bold tracking-[0.2em] text-foreground-muted"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              GENERATED METADATA
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs font-bold text-foreground-muted">Title</div>
                <div className="text-base font-bold">{state.result.title}</div>
              </div>

              <div>
                <div className="text-xs font-bold text-foreground-muted">Description</div>
                <p className="text-sm text-foreground-muted">{state.result.description}</p>
              </div>

              <div>
                <div className="mb-2 text-xs font-bold text-foreground-muted">Tags</div>
                <div className="flex flex-wrap gap-2">
                  {state.result.tags.map(tag => (
                    <TagChip key={tag} tag={tag} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <details className="border-2 border-border bg-surface-elevated p-4">
            <summary
              className="cursor-pointer text-sm font-bold"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              How it was made (inputs)
            </summary>

            <div className="mt-3 space-y-3 text-sm text-foreground-muted">
              <div>
                <div className="text-xs font-bold text-foreground-muted">Storyboard URL</div>
                <a
                  className="break-all underline decoration-accent decoration-2 underline-offset-2"
                  href={state.result.storyboardUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {state.result.storyboardUrl}
                </a>
              </div>

              {state.result.transcriptText && (
                <div>
                  <div className="mb-1 text-xs font-bold text-foreground-muted">Transcript excerpt</div>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap border-2 border-border/50 bg-surface p-3 text-xs text-foreground-muted">
                    {state.result.transcriptText.slice(0, 900)}
                    {state.result.transcriptText.length > 900 ? "…" : ""}
                  </pre>
                </div>
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
