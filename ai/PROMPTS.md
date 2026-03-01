# Prompt Experiments

My job: figure out what prompts make the three agents work reliably.

## The pipeline

Someone's app throws an error. They give us the stack trace. We do three things:

**1. Reproduce** — a browser agent opens their locally running app and clicks around until it triggers the same error. It outputs the exact steps it took + all browser console logs.

**2. Fix** — an LLM reads the stack trace, the browser logs, and the source code, then produces a minimal code change.

**3. Validate** — the browser agent replays the same steps against the patched code to confirm the error is gone. If it's not fixed, it feeds everything back to Fix and they loop until it is.

## What I'm working on

The prompts live in `agent/src/prompts/`. There are three:

| File | What it drives | Key variables |
|---|---|---|
| `reproduce.md` | Browser agent -- find and trigger the error | `APP_URL`, `APP_DESCRIPTION`, `STACK_TRACE`, `SOURCE_CODE` |
| `fix.md` | Claude Agent SDK -- reads files itself, diagnoses root cause, patches code | `STACK_TRACE`, `BROWSER_LOGS`, `REPRO_STEPS`, `PROJECT_STRUCTURE`, `PREVIOUS_ATTEMPTS` |
| `validate.md` | Browser agent -- confirm the fix worked | `APP_URL`, `ORIGINAL_STACK_TRACE`, `REPRO_STEPS`, `FIX_DESCRIPTION` |

> **Note on `fix.md`:** The fix agent no longer takes `SOURCE_CODE` as input. Instead it uses the Claude Agent SDK with `Read`/`Grep`/`Glob` tools to find and read the relevant files itself, given the `cwd` of the project. This means it can handle multi-file bugs without us manually assembling the source code upfront.

## How to iterate

**Preview an assembled prompt** (no API key, instant):
```bash
node agent/src/test-prompt.js reproduce
node agent/src/test-prompt.js fix
node agent/src/test-prompt.js validate
```

**Run the full pipeline against a local app:**

All agents share a single `runs/{run_id}.json` context file. Each agent reads inputs from it and writes results back -- no manual output threading.

```bash
cd runner
cp .env.example .env   # add OPENAI_API_KEY or ANTHROPIC_API_KEY
source .venv/bin/activate

# 1. Create a run context (Python):
python -c "
from context import PipelineContext
ctx = PipelineContext.create(
    stack_trace='TypeError: ...',
    app_url='http://localhost:3000',
    source_dir='/path/to/source',
    app_description='...',
)
print('Run ID:', ctx.run_id)
"

# 2. Reproduce the error
python run_browser_agent.py reproduce --run-id <id>

# 3. Fix it
python run_fix.py --run-id <id>

# 4. Validate the fix
python run_browser_agent.py validate --run-id <id>

# 5. If not fixed, repeat steps 3-4 -- previous attempts are auto-included in the fix prompt
```

The TypeScript wrapper can also create and read run contexts directly:
```typescript
import { createRunContext, writeRunContext, readRunContext } from "./src/context";

const ctx = createRunContext({ stack_trace, app_url, source_dir });
writeRunContext(ctx);
// ... call Python agents as subprocesses ...
const updated = readRunContext(ctx.runId);
```

The app just needs to be running locally at `app_url`. No deployment needed.

## What good output looks like

- **Reproduce**: returns `reproduced: true` + a clean list of steps + browser logs
- **Fix**: returns a diagnosis + minimal code diff
- **Validate**: returns `fixed: true` with verdict `resolved`, OR tells Fix exactly what still went wrong

The Fix and Validate prompts currently live in `fix.md` / `validate.md` but haven't been tested end-to-end yet -- Reproduce comes first.
