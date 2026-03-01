# Runner Setup & Quickstart

## Prerequisites

- Python 3.11+
- Node.js (for the Claude CLI)

---

## 1. Install the Claude CLI

The fix agent requires the Claude CLI on your PATH:

```bash
npm install -g @anthropic-ai/claude-code
```

---

## 2. Set up the Python environment

From `ai/runner/`:

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

---

## 3. Create your `.env`

Copy the example and fill in your keys:

```bash
cp .env.example .env
```

Edit `.env`:

```
# For the Reproduce + Validate agents (browser-use)
BROWSER_USE_API_KEY=bu_...         # get from cloud.browser-use.com

# For the Fix agent (Claude CLI)
ANTHROPIC_API_KEY=sk-ant-...       # get from console.anthropic.com
                                   # must have Claude Code credits

# Leave as-is unless your app runs on a different port
APP_URL=http://localhost:3000
```

> **Note:** `BROWSER_USE_API_KEY` drives the reproduce + validate steps.
> `ANTHROPIC_API_KEY` drives the fix step via the Claude CLI.
> You need both.

---

## 4. Start the test app

In a separate terminal, from the repo root:

```bash
cd test-app
python3 -m http.server 3000
```

Leave it running. The browser agent will open a real browser against it.

---

## 5. Run the loop

All commands run from `ai/runner/` with the venv active.

### Create a run

```bash
python3 -c "
from context import PipelineContext
ctx = PipelineContext.create(
    stack_trace='TypeError: Cannot read properties of null (reading \"name\")\n    at displayUserProfile (app.js:42)\n    at HTMLButtonElement.onclick (index.html:1)',
    app_url='http://localhost:3000',
    source_dir='/absolute/path/to/test-app',   # <-- update this
    app_description='Simple user profile viewer.',
)
print('Run ID:', ctx.run_id)
"
```

Copy the printed Run ID, then:

```bash
export RUN_ID=<paste id here>

python run_browser_agent.py reproduce --run-id $RUN_ID
python run_fix.py              --run-id $RUN_ID
python run_browser_agent.py validate --run-id $RUN_ID
```

If validate returns `fixed: false`, repeat the last two commands until it resolves.

### Check the run state any time

```bash
cat runs/$RUN_ID.json | python3 -m json.tool | grep -E '"status"|"verdict"|"reproduced"'
```

---

## What each script does

| Script | Agent | Model |
|---|---|---|
| `run_browser_agent.py reproduce` | Opens a real browser, triggers the bug, captures logs | `ChatBrowserUse` (BROWSER_USE_API_KEY) |
| `run_fix.py` | Reads source files, edits the buggy code | Claude CLI (ANTHROPIC_API_KEY) |
| `run_browser_agent.py validate` | Re-runs the reproduction steps, checks the bug is gone | `ChatBrowserUse` (BROWSER_USE_API_KEY) |

All state is written to `runs/{runId}.json` after every step. Poll that file for live progress (`progress.log` is updated during execution).

---

## Reference: example completed run

See `runs/e61b75f0.json` for a real run that went through the full loop and resolved.
