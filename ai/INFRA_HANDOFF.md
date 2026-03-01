# Exterminator – Infra Handoff

## What this layer does

Three Python scripts run in sequence to reproduce, fix, and validate a browser bug autonomously. Your job is to invoke them, poll the shared JSON file for status, and open a PR when done.

---

## The shared state file

Every run is one JSON file: `ai/runner/runs/{runId}.json`

You create it to start a run. The agents update it as they work. You poll it to know what's happening.

**See `ai/runner/runs/e61b75f0.json` for a real example** (reproduce step completed).

---

## Starting a run

**Python:**
```python
from context import PipelineContext

ctx = PipelineContext.create(
    stack_trace="TypeError: ...",      # from Sentry / browser SDK
    app_url="http://localhost:3000",   # the user's running app
    source_dir="/path/to/their/repo",
    app_description="optional",
)
print(ctx.run_id)  # e.g. "e61b75f0"
```

**TypeScript** (uses `ai/agent/src/context.ts`):
```typescript
import { createRunContext, writeRunContext } from "./context";

const ctx = createRunContext({ stack_trace, app_url, source_dir });
writeRunContext(ctx);   // writes to ai/runner/runs/{runId}.json
console.log(ctx.runId);
```

---

## Running the loop

```bash
cd ai/runner

# 1. Reproduce — browser agent confirms the bug exists
python run_browser_agent.py reproduce --run-id <id>

# 2. Fix — Claude reads source and patches the code
python run_fix.py --run-id <id>

# 3. Validate — browser agent checks the fix worked
python run_browser_agent.py validate --run-id <id>

# If validate → status="fixed":  open PR with changed_files
# If validate → status="in_progress":  loop back to step 2
```

**Loop termination:**
```
reproduce.reproduced == false  →  stop, alert (can't reproduce)
status == "fixed"              →  open PR
status == "failed"             →  stop, alert (too many attempts)
status == "in_progress"        →  run fix → validate again
```

---

## What to poll

| Field | Meaning |
|---|---|
| `status` | `in_progress` / `fixed` / `failed` |
| `progress.phase` | `idle` / `running` / `done` / `error` — updated mid-run |
| `progress.currentGoal` | What the agent is doing right now |
| `progress.log` | Full ordered timeline of every action (poll every ~500ms for live UI) |
| `reproduce.reproduced` | Whether the bug was confirmed |
| `attempts[n].validate.fixed` | Whether attempt N fixed it |
| `attempts[n].fix.changed_files` | Files to include in the PR |

---

## Dependencies

```bash
cd ai/runner
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

**`.env` (copy from `.env.example`):**
```
BROWSER_USE_API_KEY=...   # for reproduce + validate agents
ANTHROPIC_API_KEY=...     # for fix agent (needs claude CLI on PATH)
```

The fix agent also requires the [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated.
