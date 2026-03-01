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
  video_path: string | null;
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
  video_path: string | null;
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
  input: Pick<RunInput, "stack_trace" | "app_url"> &
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
      source_dir: "/code",
    },
    reproduce: null,
    attempts: [],
    resolvedAtAttempt: null,
  };
}

function resolveRunPath(runId: string): string {
  const dirPath = join(RUNS_DIR, runId, "run.json");
  const flat = join(RUNS_DIR, `${runId}.json`);
  const { existsSync } = require("fs");
  if (existsSync(dirPath)) return dirPath;
  if (existsSync(flat)) return flat;
  return dirPath;
}

export function readRunContext(runId: string): RunContext {
  return JSON.parse(readFileSync(resolveRunPath(runId), "utf-8")) as RunContext;
}

export function writeRunContext(ctx: RunContext): void {
  const { mkdirSync } = require("fs");
  const runDir = join(RUNS_DIR, ctx.runId);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(runDir, "run.json"), JSON.stringify(ctx, null, 2));
}

export function readLatestRunContext(): RunContext {
  const { readdirSync, statSync, existsSync } = require("fs");
  const entries: { id: string; mtime: Date }[] = [];

  for (const entry of readdirSync(RUNS_DIR)) {
    const dirJson = join(RUNS_DIR, entry, "run.json");
    const flatJson = join(RUNS_DIR, `${entry}.json`);
    if (existsSync(dirJson)) {
      entries.push({ id: entry, mtime: statSync(dirJson).mtime });
    } else if (entry.endsWith(".json") && statSync(join(RUNS_DIR, entry)).isFile()) {
      entries.push({ id: entry.replace(".json", ""), mtime: statSync(join(RUNS_DIR, entry)).mtime });
    }
  }

  entries.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  if (entries.length === 0) throw new Error("No runs found in runner/runs/");
  return readRunContext(entries[0].id);
}
