import { Daytona } from "@daytonaio/sdk";
import type { Sandbox } from "@daytonaio/sdk";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Types matching the RunContext schema from ai/runner/context.py
// ---------------------------------------------------------------------------

interface RunInput {
  stack_trace: string;
  app_url: string;
  app_description: string;
  source_dir: string;
}

interface LogEntry {
  ts: string;
  agent: string;
  message: string;
  step?: number | null;
  detail?: string | null;
}

interface Progress {
  currentAgent: string | null;
  phase: "idle" | "running" | "done" | "error";
  currentStep: number | null;
  currentGoal: string | null;
  lastUpdatedAt: string;
  log: LogEntry[];
}

interface ReproduceResult {
  reproduced: boolean;
  error_message: string | null;
  steps: Array<Record<string, unknown>>;
  browser_logs: Array<Record<string, unknown>>;
  notes: string;
  video_path?: string | null;
}

interface FixResult {
  summary: string;
  changed_files: string[];
}

interface ValidateResult {
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

interface Attempt {
  n: number;
  fix: FixResult | null;
  validate: ValidateResult | null;
}

interface RunContext {
  runId: string;
  createdAt: string;
  status: "in_progress" | "fixed" | "failed";
  input: RunInput;
  reproduce: ReproduceResult | null;
  attempts: Attempt[];
  resolvedAtAttempt: number | null;
  progress: Progress;
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

const SNAPSHOT_NAME = process.env.DAYTONA_SNAPSHOT_NAME || "exterminator-ai-2";
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
  const now = new Date().toISOString();

  return {
    runId,
    createdAt: now,
    status: "in_progress",
    input: {
      stack_trace: stackTrace,
      app_url: "http://localhost:3000",
      app_description: "",
      source_dir: "/code",
    },
    reproduce: null,
    attempts: [],
    resolvedAtAttempt: null,
    progress: {
      currentAgent: null,
      phase: "idle",
      currentStep: null,
      currentGoal: null,
      lastUpdatedAt: now,
      log: [],
    },
  };
}

function buildEnvVars(): Record<string, string> {
  const envVars: Record<string, string> = {};
  if (process.env.ANTHROPIC_API_KEY) {
    envVars.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  }
  if (process.env.BROWSER_USE_API_KEY) {
    envVars.BROWSER_USE_API_KEY = process.env.BROWSER_USE_API_KEY;
  }
  if (process.env.OPENAI_API_KEY) {
    envVars.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  }
  if (process.env.APP_URL) {
    envVars.APP_URL = process.env.APP_URL;
  }
  return envVars;
}

// ---------------------------------------------------------------------------
// Start the demo app inside the sandbox
// ---------------------------------------------------------------------------

async function startDemoApp(sandbox: Sandbox, envVars: Record<string, string>): Promise<void> {
  console.log("[daytona] Starting demo app on port 3000...");
  await sandbox.process.executeCommand(
    `nohup pnpm dev --port 3000 --host > /tmp/vite.log 2>&1 &`,
    "/code",
    envVars,
    10,
  );

  // Poll until the server is ready (up to 15 seconds)
  // Use a Node.js one-liner since curl may not be installed in the container
  const pollScript = `node -e "
    const http = require('http');
    const start = Date.now();
    (function poll() {
      if (Date.now() - start > 15000) { process.exit(1); }
      http.get('http://localhost:3000', (res) => {
        if (res.statusCode < 500) process.exit(0);
        setTimeout(poll, 500);
      }).on('error', () => setTimeout(poll, 500));
    })();
  "`;

  const pollResult = await sandbox.process.executeCommand(pollScript, "/code", envVars, 20);
  if (pollResult.exitCode !== 0) {
    const viteLog = await sandbox.process.executeCommand("cat /tmp/vite.log", "/code");
    console.error(`[daytona] Vite log:\n${viteLog.result?.slice(-1000)}`);
    throw new Error("Demo app failed to start on port 3000 within 15s");
  }
  console.log("[daytona] Demo app ready on port 3000");
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

  // Create the run directory, then upload the context file
  await sandbox.fs.createFolder(`/app/runner/runs/${runId}`, "0755");
  const contextPath = `/app/runner/runs/${runId}/run.json`;
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

  // --- Stage 0: Start the demo app ---
  await startDemoApp(sandbox, envVars);

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
  logCommandOutput(runId, "reproduce", reproduceResult.result);

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
    logCommandOutput(runId, `fix-${attempt}`, fixResult.result);

    console.log(`[daytona] [${runId}] Validating fix...`);
    const validateResult = await sandbox.process.executeCommand(
      `python3 run_browser_agent.py validate --run-id ${runId}`,
      "/app/runner",
      envVars,
      300,
    );
    console.log(`[daytona] [${runId}] Validate exit code: ${validateResult.exitCode}`);
    logCommandOutput(runId, `validate-${attempt}`, validateResult.result);

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
  // Try the directory layout first (runs/{runId}/run.json), fall back to flat file
  try {
    const buf = await sandbox.fs.downloadFile(`/app/runner/runs/${runId}/run.json`);
    return JSON.parse(buf.toString()) as RunContext;
  } catch {
    // Fallback to flat file for robustness
    const buf = await sandbox.fs.downloadFile(`/app/runner/runs/${runId}.json`);
    return JSON.parse(buf.toString()) as RunContext;
  }
}

function logCommandOutput(runId: string, stage: string, output: string | undefined): void {
  if (!output) return;
  const tail = output.slice(-500);
  console.log(`[daytona] [${runId}] [${stage}] output (last 500 chars):\n${tail}`);
}
