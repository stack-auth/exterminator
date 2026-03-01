/**
 * TypeScript mirror of the PipelineContext schema defined in ai/runner/context.py.
 *
 * Every run is persisted as ai/runner/runs/{runId}.json.
 * The Python agents read and write this file directly.
 * The TypeScript infra layer can read/write it too using these types.
 *
 * To create or update a run from TypeScript:
 *
 *   import { readRunContext, writeRunContext, createRunContext } from "./context";
 *
 *   // Start a new run
 *   const ctx = createRunContext({ stackTrace, appUrl, sourceDir });
 *   writeRunContext(ctx);
 *
 *   // Read after a Python agent has updated it
 *   const updated = readRunContext(ctx.runId);
 *   if (updated.reproduce?.reproduced) { ... }
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const RUNS_DIR = join(__dirname, "../../runner/runs");

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface RunInput {
  stack_trace: string;
  app_url: string;
  app_description: string;
  source_dir: string;
}

export interface ReproduceStep {
  index: number;
  action: "navigate" | "click" | "type" | "scroll" | "select" | "hover" | "wait" | "other";
  description: string;
  element: string | null;
  value: string | null;
  url: string;
}

export interface BrowserLog {
  level: "error" | "warn" | "log" | "info";
  message: string;
  source: string | null;
  timestamp: string | null;
}

export interface ReproduceResult {
  reproduced: boolean;
  error_message: string | null;
  steps: ReproduceStep[];
  browser_logs: BrowserLog[];
  notes: string;
}

export interface FixResult {
  summary: string;
  changed_files: string[];
}

export interface NewError {
  message: string;
  source: string | null;
  appeared_at_step: number | null;
}

export interface ValidateResult {
  fixed: boolean;
  verdict: "resolved" | "error_persists" | "regression" | "partial_fix";
  verdict_reason: string;
  original_error_seen: boolean;
  steps: ReproduceStep[];
  browser_logs: BrowserLog[];
  new_errors: NewError[];
  notes: string;
}

export interface Attempt {
  n: number;
  fix: FixResult | null;
  validate: ValidateResult | null;
}

export type RunStatus = "in_progress" | "fixed" | "failed";
export type AgentName = "reproduce" | "fix" | "validate";
export type Phase = "idle" | "running" | "done" | "error";

export interface LogEntry {
  ts: string;
  agent: AgentName;
  message: string;
  step: number | null;
  detail: string | null;       // e.g. tool name, URL, element clicked
}

export interface Progress {
  currentAgent: AgentName | null;
  phase: Phase;
  currentStep: number | null;
  currentGoal: string | null;  // what the agent is actively trying right now
  lastUpdatedAt: string;
  log: LogEntry[];             // full timeline -- every action taken, in order
}

export interface RunContext {
  runId: string;
  createdAt: string;
  status: RunStatus;
  input: RunInput;
  reproduce: ReproduceResult | null;
  attempts: Attempt[];
  resolvedAtAttempt: number | null;
  progress: Progress;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function createRunContext(
  input: Pick<RunInput, "stack_trace" | "app_url" | "source_dir"> &
    Partial<Pick<RunInput, "app_description">>,
  runId?: string
): RunContext {
  return {
    runId: runId ?? randomUUID().slice(0, 8),
    createdAt: new Date().toISOString(),
    status: "in_progress",
    input: {
      stack_trace: input.stack_trace,
      app_url: input.app_url,
      app_description: input.app_description ?? "",
      source_dir: input.source_dir,
    },
    reproduce: null,
    attempts: [],
    resolvedAtAttempt: null,
  };
}

export function readRunContext(runId: string): RunContext {
  const path = join(RUNS_DIR, `${runId}.json`);
  return JSON.parse(readFileSync(path, "utf-8")) as RunContext;
}

export function writeRunContext(ctx: RunContext): void {
  const path = join(RUNS_DIR, `${ctx.runId}.json`);
  writeFileSync(path, JSON.stringify(ctx, null, 2));
}

export function readLatestRunContext(): RunContext {
  const { readdirSync, statSync } = require("fs");
  const files = readdirSync(RUNS_DIR)
    .filter((f: string) => f.endsWith(".json"))
    .map((f: string) => ({ name: f, mtime: statSync(join(RUNS_DIR, f)).mtime }))
    .sort((a: any, b: any) => b.mtime - a.mtime);

  if (files.length === 0) throw new Error("No runs found in runner/runs/");
  return readRunContext(files[0].name.replace(".json", ""));
}
