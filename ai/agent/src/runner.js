import { spawn } from "child_process";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
} from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const MAX_ATTEMPTS = 5;

function resolvePython(runnerDir) {
  const venvPython = join(runnerDir, ".venv", "bin", "python3");
  if (existsSync(venvPython)) return venvPython;
  return "python3";
}

export class PipelineRunner {
  constructor(runnerDir, runsDir) {
    this.runnerDir = runnerDir;
    this.runsDir = runsDir;
    this.python = resolvePython(runnerDir);
    console.log("[runner] python:", this.python);
    this.currentRunId = null;
    this.process = null;
    this.aborted = false;
    this.running = false;
    this.error = null;
    mkdirSync(runsDir, { recursive: true });
  }

  // -- Run CRUD ---------------------------------------------------------------

  _runPath(runId) {
    const dirPath = join(this.runsDir, runId, "run.json");
    if (existsSync(dirPath)) return dirPath;
    const flat = join(this.runsDir, `${runId}.json`);
    if (existsSync(flat)) return flat;
    return dirPath;
  }

  createRun({ stack_trace, app_url, source_dir, app_description }) {
    const runId = randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    const ctx = {
      runId,
      createdAt: now,
      status: "in_progress",
      input: {
        stack_trace,
        app_url,
        app_description: app_description || "",
        source_dir,
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
    const runDir = join(this.runsDir, runId);
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, "run.json"), JSON.stringify(ctx, null, 2));
    return ctx;
  }

  readRun(runId) {
    const p = this._runPath(runId);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf-8"));
  }

  listRuns() {
    if (!existsSync(this.runsDir)) return [];
    const seen = new Map();
    for (const entry of readdirSync(this.runsDir)) {
      const dirJson = join(this.runsDir, entry, "run.json");
      if (existsSync(dirJson)) {
        seen.set(entry, { id: entry, mtime: statSync(dirJson).mtime });
      } else if (entry.endsWith(".json") && statSync(join(this.runsDir, entry)).isFile()) {
        const id = entry.replace(".json", "");
        if (!seen.has(id)) {
          seen.set(id, { id, mtime: statSync(join(this.runsDir, entry)).mtime });
        }
      }
    }
    return [...seen.values()].sort((a, b) => b.mtime - a.mtime);
  }

  // -- Lifecycle --------------------------------------------------------------

  async start(params) {
    if (this.running) {
      throw new Error("A run is already in progress. Stop it first.");
    }

    const ctx = this.createRun(params);
    this.currentRunId = ctx.runId;
    this.aborted = false;
    this.running = true;
    this.error = null;

    this._loop(ctx.runId).catch((err) => {
      this.error = err.message;
      console.error("[runner] pipeline error:", err);
    }).finally(() => {
      this.running = false;
    });

    return ctx;
  }

  async stop() {
    this.aborted = true;
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
    const runId = this.currentRunId;
    this.currentRunId = null;
    this.running = false;
    this.error = null;
    return { stopped: true, runId };
  }

  status() {
    return {
      active: !!this.currentRunId,
      running: this.running,
      runId: this.currentRunId,
      context: this.currentRunId ? this.readRun(this.currentRunId) : null,
      error: this.error,
    };
  }

  // -- Pipeline loop ----------------------------------------------------------

  async _loop(runId) {
    await this._exec(this.python, [
      "run_browser_agent.py",
      "reproduce",
      "--run-id",
      runId,
    ]);
    if (this.aborted) return;

    let ctx = this.readRun(runId);
    if (!ctx?.reproduce?.reproduced) return;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      if (this.aborted) return;

      await this._exec(this.python, ["run_fix.py", "--run-id", runId]);
      if (this.aborted) return;

      await this._exec(this.python, [
        "run_browser_agent.py",
        "validate",
        "--run-id",
        runId,
      ]);
      if (this.aborted) return;

      ctx = this.readRun(runId);
      if (ctx.status === "fixed" || ctx.status === "failed") return;
    }
  }

  _exec(cmd, args) {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, {
        cwd: this.runnerDir,
        stdio: ["ignore", "inherit", "pipe"],
        env: { ...process.env },
      });
      this.process = proc;

      let stderr = "";
      proc.stderr.on("data", (d) => {
        stderr += d;
        process.stderr.write(d);
      });

      proc.on("close", (code) => {
        this.process = null;
        if (code !== 0 && !this.aborted) {
          reject(
            new Error(
              `${cmd} ${args.join(" ")} exited ${code}\n${stderr.slice(-1000)}`,
            ),
          );
        } else {
          resolve(code);
        }
      });

      proc.on("error", (err) => {
        this.process = null;
        reject(err);
      });
    });
  }
}
