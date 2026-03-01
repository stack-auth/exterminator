import { spawn, execSync } from "child_process";
import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
} from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

// #region agent log
const DEBUG_LOG = join(import.meta.dirname, "../debug.log");
function dlog(msg, data) {
  try {
    appendFileSync(DEBUG_LOG, JSON.stringify({ timestamp: Date.now(), message: msg, data }) + "\n");
  } catch {}
}
// #endregion

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
    // #region agent log
    let pyVersion = "";
    try { pyVersion = execSync(`${this.python} --version 2>&1`).toString().trim(); } catch (e) { pyVersion = "error: " + e.message; }
    let pydanticCheck = "";
    try { pydanticCheck = execSync(`${this.python} -c "import pydantic; print(pydantic.__version__)" 2>&1`).toString().trim(); } catch (e) { pydanticCheck = "MISSING: " + e.message; }
    dlog("constructor", { python: this.python, runnerDir, pyVersion, pydanticCheck, venvExists: existsSync(join(runnerDir, ".venv", "bin", "python3")) });
    // #endregion
    console.log("[runner] python:", this.python, "| version:", pyVersion, "| pydantic:", pydanticCheck);
    this.currentRunId = null;
    this.process = null;
    this.aborted = false;
    this.running = false;
    this.error = null;
    mkdirSync(runsDir, { recursive: true });
  }

  // -- Run CRUD ---------------------------------------------------------------

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
    writeFileSync(
      join(this.runsDir, `${runId}.json`),
      JSON.stringify(ctx, null, 2),
    );
    return ctx;
  }

  readRun(runId) {
    const p = join(this.runsDir, `${runId}.json`);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf-8"));
  }

  listRuns() {
    if (!existsSync(this.runsDir)) return [];
    return readdirSync(this.runsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const id = f.replace(".json", "");
        const mtime = statSync(join(this.runsDir, f)).mtime;
        return { id, mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);
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
    // #region agent log
    dlog("_exec:spawn", { cmd, args, cwd: this.runnerDir });
    console.log("[runner] exec:", cmd, args.join(" "));
    // #endregion
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
        // #region agent log
        dlog("_exec:close", { cmd, args: args.join(" "), code, stderrTail: stderr.slice(-500) });
        console.log("[runner] exit:", code, cmd, args.join(" "));
        // #endregion
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
