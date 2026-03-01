import { Daytona } from "@daytonaio/sdk";
import type { Sandbox } from "@daytonaio/sdk";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Types matching the RunContext schema from ai/agent/src/context.ts
// ---------------------------------------------------------------------------

interface RunInput {
  stack_trace: string;
  app_url: string;
  app_description: string;
  source_dir: string;
}

interface RunContext {
  runId: string;
  createdAt: string;
  status: "in_progress" | "fixed" | "failed";
  input: RunInput;
  reproduce: { reproduced: boolean } | null;
  attempts: Array<{ n: number; fix: unknown; validate: { fixed: boolean } | null }>;
  resolvedAtAttempt: number | null;
}

// ---------------------------------------------------------------------------
// Error event shape (from the /api/events route)
// ---------------------------------------------------------------------------

export interface ErrorEvent {
  type: "error" | "unhandledrejection";
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
  pageUrl: string;
  userAgent: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SNAPSHOT_NAME = process.env.DAYTONA_SNAPSHOT_NAME || "exterminator-ai";
const MAX_FIX_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Singleton Daytona client
// ---------------------------------------------------------------------------

let _client: Daytona | null = null;

function getDaytonaClient(): Daytona {
  if (!_client) {
    _client = new Daytona();
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Build RunContext JSON from an error event
// ---------------------------------------------------------------------------

function buildRunContext(event: ErrorEvent, runId: string): RunContext {
  const stackTrace =
    event.stack || `${event.message} at ${event.filename || "unknown"}:${event.lineno ?? 0}:${event.colno ?? 0}`;

  return {
    runId,
    createdAt: new Date().toISOString(),
    status: "in_progress",
    input: {
      stack_trace: stackTrace,
      app_url: process.env.APP_URL || event.pageUrl,
      app_description: "",
      source_dir: "/app/runner",
    },
    reproduce: null,
    attempts: [],
    resolvedAtAttempt: null,
  };
}

function buildEnvVars(): Record<string, string> {
  const envVars: Record<string, string> = {};
  if (process.env.ANTHROPIC_API_KEY) {
    envVars.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  }
  if (process.env.APP_URL) {
    envVars.APP_URL = process.env.APP_URL;
  }
  return envVars;
}

// ---------------------------------------------------------------------------
// Create sandbox (quick — returns immediately with sandbox handle + IDs)
// ---------------------------------------------------------------------------

export async function createSandboxForError(
  event: ErrorEvent,
): Promise<{ sandbox: Sandbox; sandboxId: string; runId: string }> {
  const daytona = getDaytonaClient();
  const runId = randomUUID().slice(0, 8);
  const envVars = buildEnvVars();

  const sandbox = await daytona.create({
    snapshot: SNAPSHOT_NAME,
    envVars,
    autoStopInterval: 30,
  });

  const ctx = buildRunContext(event, runId);
  const contextPath = `/app/runner/runs/${runId}.json`;
  await sandbox.fs.uploadFile(
    Buffer.from(JSON.stringify(ctx, null, 2)),
    contextPath,
  );

  return { sandbox, sandboxId: sandbox.id, runId };
}

// ---------------------------------------------------------------------------
// Run pipeline (long — reproduce then fix/validate loop)
//
// Takes an `onStatus` callback so the caller can persist status transitions
// (e.g. update Convex). The sandbox is intentionally NOT deleted so it can
// be polled for results later.
// ---------------------------------------------------------------------------

export async function runPipeline(
  sandbox: Sandbox,
  runId: string,
  onStatus?: (status: "reproducing" | "fixing" | "fixed" | "failed") => void,
): Promise<void> {
  const envVars = buildEnvVars();

  // --- Stage 1: Reproduce ---
  onStatus?.("reproducing");
  console.log(`[daytona] [${runId}] Running reproduce...`);
  const reproduceResult = await sandbox.process.executeCommand(
    `python3 run_browser_agent.py reproduce --run-id ${runId}`,
    "/app/runner",
    envVars,
    300,
  );
  console.log(`[daytona] [${runId}] Reproduce exit code: ${reproduceResult.exitCode}`);

  const afterReproduce = await readContext(sandbox, runId);
  if (!afterReproduce.reproduce?.reproduced) {
    console.log(`[daytona] [${runId}] Could not reproduce error. Stopping.`);
    onStatus?.("failed");
    return;
  }

  // --- Stage 2: Fix → Validate loop ---
  onStatus?.("fixing");
  for (let attempt = 1; attempt <= MAX_FIX_ATTEMPTS; attempt++) {
    console.log(`[daytona] [${runId}] Fix attempt ${attempt}/${MAX_FIX_ATTEMPTS}...`);

    const fixResult = await sandbox.process.executeCommand(
      `python3 run_fix.py --run-id ${runId}`,
      "/app/runner",
      envVars,
      300,
    );
    console.log(`[daytona] [${runId}] Fix exit code: ${fixResult.exitCode}`);

    console.log(`[daytona] [${runId}] Validating fix...`);
    const validateResult = await sandbox.process.executeCommand(
      `python3 run_browser_agent.py validate --run-id ${runId}`,
      "/app/runner",
      envVars,
      300,
    );
    console.log(`[daytona] [${runId}] Validate exit code: ${validateResult.exitCode}`);

    const afterValidate = await readContext(sandbox, runId);
    if (afterValidate.status === "fixed") {
      console.log(`[daytona] [${runId}] Fixed at attempt ${attempt}!`);
      onStatus?.("fixed");
      return;
    }

    console.log(`[daytona] [${runId}] Not fixed after attempt ${attempt}`);
  }

  console.log(`[daytona] [${runId}] Exhausted ${MAX_FIX_ATTEMPTS} attempts.`);
  onStatus?.("failed");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readContext(sandbox: Sandbox, runId: string): Promise<RunContext> {
  const result = await sandbox.process.executeCommand(
    `cat /app/runner/runs/${runId}.json`,
    "/app/runner",
  );
  return JSON.parse(result.result) as RunContext;
}
