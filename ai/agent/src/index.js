import express from "express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { PipelineRunner } from "./runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNNER_DIR = process.env.RUNNER_DIR || join(__dirname, "../../runner");
const RUNS_DIR = join(RUNNER_DIR, "runs");
const PORT = Number(process.env.PORT) || 4000;

const runner = new PipelineRunner(RUNNER_DIR, RUNS_DIR);
const app = express();

app.use(express.json());

// -- UI -----------------------------------------------------------------------

app.get("/", (_req, res) => {
  const html = readFileSync(join(__dirname, "ui.html"), "utf-8");
  res.type("html").send(html);
});

// -- API ----------------------------------------------------------------------

app.get("/api/runs/current", (_req, res) => {
  res.json(runner.status());
});

app.post("/api/runs", async (req, res) => {
  const { stack_trace, app_url, source_dir, app_description } = req.body;

  if (!stack_trace || !app_url || !source_dir) {
    return res
      .status(400)
      .json({ error: "stack_trace, app_url, and source_dir are required" });
  }

  try {
    const ctx = await runner.start({
      stack_trace,
      app_url,
      source_dir,
      app_description,
    });
    res.status(201).json({ runId: ctx.runId, status: ctx.status });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

app.delete("/api/runs/current", async (_req, res) => {
  if (!runner.status().active) {
    return res.status(404).json({ error: "No active run" });
  }
  const result = await runner.stop();
  res.json(result);
});

app.get("/api/runs/:runId", (req, res) => {
  const ctx = runner.readRun(req.params.runId);
  if (!ctx) return res.status(404).json({ error: "Run not found" });
  res.json(ctx);
});

app.get("/api/runs", (_req, res) => {
  res.json(runner.listRuns());
});

// -- Start --------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Exterminator server listening on http://localhost:${PORT}`);
  console.log(`Runner dir: ${RUNNER_DIR}`);
});
