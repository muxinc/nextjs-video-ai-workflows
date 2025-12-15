"use client";

import { motion } from "motion/react";

import type { TranscriptCue, WorkflowStatus } from "../../types";
import { Layer2Localization } from "../localization/ui";
import { Layer3SocialClips } from "../social-clips/ui";
import { Layer1SummaryAndTags } from "../summarize-and-tag/ui";

// ─────────────────────────────────────────────────────────────────────────────
// Status Badge Component
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WorkflowStatus, { label: string; className: string }> = {
  idle: { label: "READY", className: "bg-surface-elevated text-foreground-muted" },
  starting: { label: "QUEUED", className: "bg-[#fff8e6] text-[#b8860b]" },
  running: { label: "RUNNING", className: "bg-[#e8f0fa] text-[#1c65be]" },
  completed: { label: "DONE", className: "bg-[#e9f5ec] text-[#22903d]" },
  failed: { label: "FAILED", className: "bg-[#fde8e8] text-[#dc2626]" },
};

export function StatusBadge({ status }: { status: WorkflowStatus }) {
  const { label, className } = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center border-2 border-border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${className}`}
      style={{ fontFamily: "var(--font-space-mono)" }}
    >
      {status === "running" && (
        <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step Icons
// ─────────────────────────────────────────────────────────────────────────────

export function CompletedStepIcon({ shouldReduceMotion }: { shouldReduceMotion: boolean | null }) {
  return (
    <motion.svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <motion.path
        d="M3 7.5 L6 10.2 L11 3.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
        strokeLinejoin="miter"
        initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: "easeOut" }}
      />
    </motion.svg>
  );
}

export function CurrentStepIcon({ shouldReduceMotion }: { shouldReduceMotion: boolean | null }) {
  const animate = shouldReduceMotion ?
      { opacity: 1 } :
      { opacity: [1, 0.4, 1], scale: [1, 1.25, 1] };

  const transition = shouldReduceMotion ?
      { duration: 0 } :
      { duration: 0.9, repeat: Number.POSITIVE_INFINITY, ease: [0.42, 0, 0.58, 1] as const };

  return (
    <motion.svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <motion.circle
        cx="7"
        cy="7"
        r="3"
        fill="currentColor"
        initial={false}
        animate={animate}
        transition={transition}
      />
    </motion.svg>
  );
}

export function PendingStepIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="3.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step Progress Component
// ─────────────────────────────────────────────────────────────────────────────

interface StepProgressProps<T extends string> {
  steps: readonly { id: T; label: string }[];
  completedSteps: T[];
  isRunning: boolean;
  shouldReduceMotion: boolean | null;
}

export function StepProgress<T extends string>({
  steps,
  completedSteps,
  isRunning,
  shouldReduceMotion,
}: StepProgressProps<T>) {
  // Find the current step (first incomplete step)
  const currentStepIndex = completedSteps.length;

  return (
    <div className="space-y-1.5">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = isRunning && index === currentStepIndex;

        let icon: React.ReactNode;
        let iconClassName: string;
        if (isCompleted) {
          icon = <CompletedStepIcon shouldReduceMotion={shouldReduceMotion} />;
          iconClassName = "text-[#22903d]";
        } else if (isCurrent) {
          icon = <CurrentStepIcon shouldReduceMotion={shouldReduceMotion} />;
          iconClassName = "text-[#1c65be]";
        } else {
          icon = <PendingStepIcon />;
          iconClassName = "text-foreground-muted";
        }

        let labelClassName: string;
        if (isCompleted) {
          labelClassName = "text-[#22903d]";
        } else if (isCurrent) {
          labelClassName = "font-bold text-[#1c65be]";
        } else {
          labelClassName = "text-foreground-muted";
        }

        return (
          <motion.div
            key={step.id}
            className="flex items-center gap-2 text-[10px]"
            style={{ fontFamily: "var(--font-space-mono)" }}
            initial={shouldReduceMotion ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut", delay: index * 0.03 }}
          >
            {/* Step indicator */}
            <span className="flex h-4 w-4 items-center justify-center">
              <span className={iconClassName}>{icon}</span>
            </span>
            {/* Step label */}
            <span className={labelClassName}>
              {step.label}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflows Panel Component
// ─────────────────────────────────────────────────────────────────────────────

interface WorkflowsPanelProps {
  assetId: string;
  playbackId: string;
  playbackPolicy: "public" | "signed";
  transcriptCues: TranscriptCue[];
  title: string;
  hasElevenLabsKey: boolean;
  hasRemotionLambdaKeys: boolean;
}

export function WorkflowsPanel({
  assetId,
  playbackId,
  playbackPolicy,
  transcriptCues,
  title,
  hasElevenLabsKey,
  hasRemotionLambdaKeys,
}: WorkflowsPanelProps) {
  return (
    <aside className="panel-brutal" aria-label="Workflows">
      {/* Panel Header with stripes */}
      <div className="stripes-accent panel-brutal-header text-foreground">
        <h2 style={{ fontFamily: "var(--font-syne)" }}>WORKFLOWS</h2>
      </div>

      {/* Layer 1: Smart Summary */}
      <section className="panel-section" aria-labelledby="smart-summary-heading">
        <div className="panel-section-header" style={{ fontFamily: "var(--font-space-mono)" }}>
          <h3 id="smart-summary-heading" className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 border border-border bg-[#ffb202]" />
            SMART SUMMARY
            <span className="ml-auto text-[9px] text-foreground-muted">LVL 1</span>
          </h3>
        </div>
        <div className="p-4">
          <Layer1SummaryAndTags assetId={assetId} />
        </div>
      </section>

      {/* Layer 2: Localization */}
      <section className="panel-section" aria-labelledby="localization-heading">
        <div className="panel-section-header" style={{ fontFamily: "var(--font-space-mono)" }}>
          <h3 id="localization-heading" className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 border border-border bg-[#1c65be]" />
            LOCALIZATION
            <span className="ml-auto text-[9px] text-foreground-muted">LVL 2</span>
          </h3>
        </div>
        <div className="p-4">
          <Layer2Localization assetId={assetId} hasElevenLabsKey={hasElevenLabsKey} />
        </div>
      </section>

      {/* Layer 3: Social Clips */}
      <section className="panel-section" aria-labelledby="social-clips-heading">
        <div className="panel-section-header" style={{ fontFamily: "var(--font-space-mono)" }}>
          <h3 id="social-clips-heading" className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 border border-border bg-[#22903d]" />
            SOCIAL CLIPS
            <span className="ml-auto text-[9px] text-foreground-muted">LVL 3</span>
          </h3>
        </div>
        <div className="p-4">
          <Layer3SocialClips
            assetId={assetId}
            playbackId={playbackId}
            playbackPolicy={playbackPolicy}
            transcriptCues={transcriptCues}
            title={title}
            hasRemotionLambdaKeys={hasRemotionLambdaKeys}
          />
        </div>
      </section>
    </aside>
  );
}
