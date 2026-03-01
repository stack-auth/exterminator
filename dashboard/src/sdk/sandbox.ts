"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { ErrorEvent } from "@/lib/daytona";

export type SandboxId = Id<"sandboxes">;

export type PollStatus = "in_progress" | "completed" | "failed";

// ---------------------------------------------------------------------------
// RunContext types (mirrored from lib/daytona.ts for client use)
// ---------------------------------------------------------------------------

export interface LogEntry {
  ts: string;
  agent: string;
  message: string;
  step?: number | null;
  detail?: string | null;
}

export interface Progress {
  currentAgent: string | null;
  phase: "idle" | "running" | "done" | "error";
  currentStep: number | null;
  currentGoal: string | null;
  lastUpdatedAt: string;
  log: LogEntry[];
}

export interface ReproduceResult {
  reproduced: boolean;
  error_message: string | null;
  steps: Array<Record<string, unknown>>;
  browser_logs: Array<Record<string, unknown>>;
  notes: string;
  video_path?: string | null;
}

export interface FixResult {
  summary: string;
  changed_files: string[];
}

export interface ValidateResult {
  fixed: boolean;
  verdict: string;
  verdict_reason: string;
  original_error_seen: boolean;
  steps: Array<Record<string, unknown>>;
  browser_logs: Array<Record<string, unknown>>;
  new_errors: Array<Record<string, unknown>>;
  notes: string;
  video_path?: string | null;
}

export interface Attempt {
  n: number;
  fix: FixResult | null;
  validate: ValidateResult | null;
}

export interface RunContext {
  runId: string;
  createdAt: string;
  status: "in_progress" | "fixed" | "failed";
  input: {
    stack_trace: string;
    app_url: string;
    app_description: string;
    source_dir: string;
  };
  reproduce: ReproduceResult | null;
  attempts: Attempt[];
  resolvedAtAttempt: number | null;
  progress: Progress;
}

export interface PollResponse {
  status: PollStatus;
  data: RunContext | null;
}

export function useSandbox(errorId: Id<"errors">) {
  return useQuery(api.sandboxes.getByErrorId, { errorId });
}

export async function startSandbox(
  errorId: string,
  error: ErrorEvent,
): Promise<{ sandboxId: string } | null> {
  try {
    const res = await fetch("/api/sandbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ errorId, error }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.sandboxId ? { sandboxId: data.sandboxId } : null;
  } catch {
    return null;
  }
}

export async function pollSandboxStatus(
  sandboxId: string,
): Promise<PollResponse> {
  await new Promise(resolve => setTimeout(resolve, 1000));
  const res = await fetch(`/api/sandbox/${encodeURIComponent(sandboxId)}`);
  if (!res.ok) {
    return { status: "failed", data: null };
  }
  return res.json();
}
