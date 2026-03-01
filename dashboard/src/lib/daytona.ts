import { Daytona } from "@daytonaio/sdk";
import type { Sandbox } from "@daytonaio/sdk";
// randomUUID no longer needed — the agent creates the run ID

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
// Start the entrypoint (agent server on 4000 + demo app on 3000)
// ---------------------------------------------------------------------------

async function startServices(sandbox: Sandbox, envVars: Record<string, string>): Promise<void> {
  console.log("[daytona] Starting entrypoint (agent + demo app)...");
  await sandbox.process.executeCommand(
    `nohup /app/entrypoint.sh > /tmp/entrypoint.log 2>&1 &`,
    "/app",
    envVars,
    10,
  );

  // Poll until the agent server (port 4000) is ready
  const pollScript = `node -e "
    const http = require('http');
    const start = Date.now();
    (function poll() {
      if (Date.now() - start > 30000) { process.exit(1); }
      http.get('http://localhost:4000/api/runs/current', (res) => {
        if (res.statusCode < 500) process.exit(0);
        setTimeout(poll, 500);
      }).on('error', () => setTimeout(poll, 500));
    })();
  "`;

  const pollResult = await sandbox.process.executeCommand(pollScript, "/app", envVars, 35);
  if (pollResult.exitCode !== 0) {
    const entryLog = await sandbox.process.executeCommand("cat /tmp/entrypoint.log", "/app");
    console.error(`[daytona] Entrypoint log:\n${entryLog.result?.slice(-1500)}`);
    throw new Error("Agent server failed to start on port 4000 within 30s");
  }
  console.log("[daytona] Agent server ready on port 4000");
}

// ---------------------------------------------------------------------------
// Create sandbox (quick — returns immediately with sandbox handle + IDs)
// ---------------------------------------------------------------------------

export async function createSandboxForError(
  event: ErrorEvent,
): Promise<{ sandbox: Sandbox; sandboxId: string; runId: string }> {
  const daytona = getDaytonaClient();
  const envVars = buildEnvVars();

  const sandbox = await daytona.create({
    snapshot: SNAPSHOT_NAME,
    envVars,
    autoStopInterval: 30,
  });

  // Start the agent server + demo app via entrypoint
  await startServices(sandbox, envVars);

  // Create a run via the agent's HTTP API
  const stackTrace =
    event.stack || `${event.message} at ${event.filename || "unknown"}:${event.lineno ?? 0}:${event.colno ?? 0}`;

  const createRunScript = `
const http = require("http");
const body = JSON.stringify({
  stack_trace: ${JSON.stringify(stackTrace)},
  app_url: "http://localhost:3000",
  app_description: ""
});
const req = http.request({
  hostname: "localhost", port: 4000, path: "/api/runs",
  method: "POST",
  headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
}, function(res) {
  var d = "";
  res.on("data", function(c) { d += c; });
  res.on("end", function() { console.log(d); process.exit(res.statusCode < 300 ? 0 : 1); });
});
req.on("error", function(e) { console.error(e.message); process.exit(1); });
req.write(body);
req.end();
`;

  await sandbox.fs.uploadFile(
    Buffer.from(createRunScript),
    "/tmp/_create_run.js",
  );

  const createRes = await sandbox.process.executeCommand(
    "node /tmp/_create_run.js",
    "/app",
    envVars,
    15,
  );

  if (createRes.exitCode !== 0) {
    throw new Error(`Failed to create run via agent API: ${createRes.result}`);
  }

  const runData = JSON.parse(createRes.result?.trim() ?? "{}");
  const runId = runData.runId as string;

  console.log(`[daytona] Run created via agent API: ${runId}`);
  return { sandbox, sandboxId: sandbox.id, runId };
}

// ---------------------------------------------------------------------------
// Run pipeline — polls the agent API for status updates
//
// The agent server handles the full reproduce → fix → validate loop internally.
// We just poll GET /api/runs/current and forward status transitions to Convex.
// ---------------------------------------------------------------------------

const AGENT_POLL_INTERVAL_MS = 5000;

export async function runPipeline(
  sandbox: Sandbox,
  runId: string,
  onStatus?: (status: "reproducing" | "fixing" | "fixed" | "failed") => void,
): Promise<void> {
  let lastStatus = "";

  // Poll by reading run.json directly from disk — avoids HTTP stdout truncation
  const runJsonPath = `/app/runner/runs/${runId}/run.json`;

  for (;;) {
    await new Promise((r) => setTimeout(r, AGENT_POLL_INTERVAL_MS));

    let ctx: RunContext;
    try {
      const buf = await sandbox.fs.downloadFile(runJsonPath);
      ctx = JSON.parse(buf.toString()) as RunContext;
    } catch (err) {
      console.error(`[daytona] [${runId}] Poll error:`, err);
      continue;
    }

    // Map agent progress to Convex status updates
    const agent = ctx.progress?.currentAgent;
    const phase = ctx.progress?.phase;

    if (agent === "reproduce" && lastStatus !== "reproducing") {
      lastStatus = "reproducing";
      onStatus?.("reproducing");
      console.log(`[daytona] [${runId}] Status: reproducing`);
    } else if ((agent === "fix" || agent === "validate") && lastStatus !== "fixing") {
      lastStatus = "fixing";
      onStatus?.("fixing");
      console.log(`[daytona] [${runId}] Status: fixing`);
    }

    if (ctx.status === "fixed") {
      console.log(`[daytona] [${runId}] Fixed!`);
      onStatus?.("fixed");
      return;
    }

    if (ctx.status === "failed" || (phase === "done" && ctx.status !== "fixed")) {
      console.log(`[daytona] [${runId}] Failed or done without fix`);
      onStatus?.("failed");
      return;
    }

    // If the agent is no longer active and status is not terminal, it's done
    if (phase === "done" || phase === "error") {
      console.log(`[daytona] [${runId}] Pipeline ended with phase: ${phase}`);
      onStatus?.(ctx.status === "fixed" ? "fixed" : "failed");
      return;
    }
  }
}
