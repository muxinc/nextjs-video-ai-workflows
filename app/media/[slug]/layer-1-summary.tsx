"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { Layer1SummaryState, SummaryTone } from "./layer-1-actions";
import { generateSummaryAndTagsAction } from "./layer-1-actions";

const TONE_OPTIONS: { value: SummaryTone; label: string }[] = [
  { value: "normal", label: "NORMAL" },
  { value: "professional", label: "PROFESSIONAL" },
  { value: "sassy", label: "PLAYFUL" },
];

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="btn-action w-full"
      disabled={pending}
    >
      {pending ? "GENERATING..." : "SUMMARIZE & TAG"}
      {!pending && (
        <span className="arrow-icon ml-2">↗</span>
      )}
    </button>
  );
}

function TagChip({ tag }: { tag: string }) {
  return (
    <span
      className="inline-flex items-center border-2 border-border bg-surface-elevated px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
      style={{ fontFamily: "var(--font-space-mono)" }}
    >
      {tag}
    </span>
  );
}

export function Layer1SummaryAndTags({ assetId }: { assetId: string }) {
  return <Layer1SummaryAndTagsInner assetId={assetId} />;
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
      <div className="flex flex-wrap gap-2">
        {TONE_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => onToneChange(option.value)}
            className={`tone-btn ${selectedTone === option.value ? "active" : ""}`}
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            [
            {option.label}
            ]
          </button>
        ))}
      </div>
    </div>
  );
}

function Layer1SummaryAndTagsInner({ assetId }: { assetId: string }) {
  const [state, action] = useActionState<Layer1SummaryState, FormData>(
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
          <div className="border-3 border-border bg-surface-elevated p-4">
            <div
              className="mb-1 text-xs font-bold uppercase tracking-wider text-foreground"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              Generation failed
            </div>
            <div className="text-sm text-foreground-muted">{state.error}</div>
          </div>
        )}
      </form>

      {isSuccess && (
        <div className="space-y-4">
          <div className="border-3 border-border bg-surface-elevated">
            <div
              className="border-b-2 border-border bg-surface px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground-muted"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              GENERATED METADATA
            </div>

            <div className="space-y-4 p-4">
              <div>
                <div
                  className="mb-1 text-[10px] font-bold uppercase tracking-wider text-foreground-muted"
                  style={{ fontFamily: "var(--font-space-mono)" }}
                >
                  Title
                </div>
                <div
                  className="text-base font-bold"
                  style={{ fontFamily: "var(--font-syne)" }}
                >
                  {state.result.title}
                </div>
              </div>

              <div>
                <div
                  className="mb-1 text-[10px] font-bold uppercase tracking-wider text-foreground-muted"
                  style={{ fontFamily: "var(--font-space-mono)" }}
                >
                  Description
                </div>
                <p className="text-sm leading-relaxed text-foreground-muted">
                  {state.result.description}
                </p>
              </div>

              <div>
                <div
                  className="mb-2 text-[10px] font-bold uppercase tracking-wider text-foreground-muted"
                  style={{ fontFamily: "var(--font-space-mono)" }}
                >
                  Tags
                </div>
                <div className="flex flex-wrap gap-2">
                  {state.result.tags.map(tag => (
                    <TagChip key={tag} tag={tag} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <details className="border-3 border-border bg-surface-elevated">
            <summary
              className="cursor-pointer border-b-2 border-border bg-surface px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-surface-elevated"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              How it was made (inputs)
            </summary>

            <div className="space-y-3 p-4 text-sm text-foreground-muted">
              <div>
                <div
                  className="mb-1 text-[10px] font-bold uppercase tracking-wider text-foreground-muted"
                  style={{ fontFamily: "var(--font-space-mono)" }}
                >
                  Storyboard URL
                </div>
                <a
                  className="break-all text-accent underline decoration-2 underline-offset-2 hover:text-foreground"
                  href={state.result.storyboardUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {state.result.storyboardUrl}
                </a>
              </div>

              {state.result.transcriptText && (
                <div>
                  <div
                    className="mb-1 text-[10px] font-bold uppercase tracking-wider text-foreground-muted"
                    style={{ fontFamily: "var(--font-space-mono)" }}
                  >
                    Transcript excerpt
                  </div>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap border-2 border-border bg-surface p-3 text-xs text-foreground-muted">
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
