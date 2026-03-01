"""
Browser-use agent runner for the Reproduce and Validate steps.

Reads all inputs from the pipeline context file (runs/{run_id}.json) and
writes results back to the same file -- no stdout threading needed.

Usage:
    # Start a new run (reproduce against a fresh bug):
    python run_browser_agent.py reproduce --run-id <id>

    # Validate after a fix has been applied:
    python run_browser_agent.py validate --run-id <id>

    # Omit --run-id to use the most recently created run.

The run context must already exist (created by context.py or the TS wrapper).
The app must be running locally at the URL stored in context.input.app_url.

LLM: set BROWSER_USE_API_KEY (preferred), ANTHROPIC_API_KEY, or OPENAI_API_KEY in .env.
"""

import asyncio
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field
from dotenv import load_dotenv
from build_prompt import build_prompt
from context import PipelineContext, RUNS_DIR

load_dotenv()


# ---------------------------------------------------------------------------
# Video post-processing
#
# browser-use starts recording the moment the BrowserSession is created, while
# the page is still on about:blank. The LLM takes 10-60 s to respond to its
# first prompt, so the video has a long blank/black intro before any navigation.
# We fix this two ways:
#   1. `initial_actions` on the Agent navigates to the app URL *before* the LLM
#      processes its first prompt, cutting the blank to < 2 s (browser launch time).
#   2. After the run, we auto-detect any remaining black section with ffmpeg's
#      `blackdetect` filter and trim it, then re-encode at 1.5x speed for a
#      snappy demo feel.
# ---------------------------------------------------------------------------

def trim_and_polish_video(input_path: str, output_path: str) -> None:
    """
    Auto-trim the blank/black intro at the START of the video, then re-encode
    at 1.5x speed for a snappy demo. Falls back to a plain copy if ffmpeg is
    not installed or if post-processing would result in a clip < 3 seconds.

    Root cause of blank intros: browser-use starts CDP screencasting when the
    BrowserSession is created (page is still on about:blank). Using
    `initial_actions` to pre-navigate reduces this to ~1s (browser launch time).
    This function trims that remaining 1-2s as well.
    """
    if not shutil.which("ffmpeg"):
        shutil.copy2(input_path, output_path)
        return

    # Get total duration first
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", input_path],
        capture_output=True, text=True,
    )
    try:
        total_duration = float(probe.stdout.strip())
    except ValueError:
        total_duration = 0.0

    # Step 1: detect the pure-black intro on about:blank.
    # We use a very low pixel threshold (pix_th=0.05) so that dark-themed UIs
    # (near-black backgrounds like zinc-950) are NOT treated as black. Only the
    # literal about:blank page (white or black chrome) and the brief blank
    # between browser launch and first paint are caught.
    # We only trim if a black section starts at t=0 AND the resulting clip would
    # still be at least 5 s — short clips should not be trimmed further.
    result = subprocess.run(
        ["ffmpeg", "-i", input_path,
         "-vf", "blackdetect=d=0.5:pix_th=0.05",
         "-an", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    starts = [float(x) for x in re.findall(r"black_start:([\d.]+)", result.stderr)]
    ends   = [float(x) for x in re.findall(r"black_end:([\d.]+)",   result.stderr)]
    trim_offset = 0.0
    for start, end in zip(starts, ends):
        if start < 0.5:  # only trim a black section at the very beginning
            trim_offset = end
            break

    remaining = total_duration - trim_offset
    if trim_offset < 1.0 or remaining < 5.0:
        trim_offset = 0.0

    if trim_offset > 0:
        print(f"  trimming {trim_offset:.1f}s blank intro (of {total_duration:.1f}s total)")

    # Step 2: trim + compress for web sharing. We do NOT speed up by default
    # because the agent session is already short — speeding it up makes it feel
    # rushed. We do re-encode to h264 with slight compression and scale to 1280px.
    vf_filter = "scale=1280:-2"
    cmd = ["ffmpeg", "-y"]
    if trim_offset > 0:
        cmd += ["-ss", str(trim_offset)]
    cmd += [
        "-i", input_path,
        "-vf", vf_filter,
        "-r", "30",
        "-c:v", "libx264", "-crf", "22", "-preset", "fast",
        "-an",  # no audio
        output_path,
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        print(f"  [warn] ffmpeg polish failed, using original: {e.stderr[-200:]}")
        shutil.copy2(input_path, output_path)


# ---------------------------------------------------------------------------
# Structured output schemas
#
# browser-use enforces these via output_model_schema: it auto-appends the JSON
# schema to the task and forces a typed `done` call. We then use
# Model.model_validate_json(result.final_result()) to deserialize -- no manual
# JSON parsing needed.
# ---------------------------------------------------------------------------

class ReproduceOutput(BaseModel):
    reproduced: bool = Field(description="Whether the exact error was triggered")
    errorMessage: Optional[str] = Field(
        None, description="Exact console error text, or null if not reproduced"
    )
    steps: list[str] = Field(
        default_factory=list,
        description="Every browser action taken, in plain English, in order",
    )
    browserLogs: list[str] = Field(
        default_factory=list,
        description="All console output captured during the session",
    )
    notes: str = Field(
        "", description="Context for the Fix agent: app state, root cause hypothesis"
    )


class ValidateOutput(BaseModel):
    fixed: bool = Field(description="True only if the original error no longer appears")
    verdict: str = Field(
        description="One of: fixed | error_persists | different_error | inconclusive"
    )
    verdictReason: str = Field(description="Why you reached this verdict")
    originalErrorSeen: bool = Field(
        description="Whether the original error message appeared at all"
    )
    steps: list[str] = Field(default_factory=list)
    browserLogs: list[str] = Field(default_factory=list)
    newErrors: list[str] = Field(
        default_factory=list,
        description="New errors that appeared that weren't in the original stack trace",
    )
    notes: str = Field("")


# ---------------------------------------------------------------------------
# LLM selection
# ---------------------------------------------------------------------------

def get_llm():
    if os.getenv("BROWSER_USE_API_KEY"):
        from browser_use import ChatBrowserUse
        print("  using ChatBrowserUse (bu-latest)")
        return ChatBrowserUse()
    elif os.getenv("ANTHROPIC_API_KEY"):
        from langchain_anthropic import ChatAnthropic
        print("  using Anthropic claude-3-5-sonnet-20241022")
        return ChatAnthropic(model="claude-3-5-sonnet-20241022", timeout=120, stop=None)
    elif os.getenv("OPENAI_API_KEY"):
        from langchain_openai import ChatOpenAI
        print("  using OpenAI gpt-4o")
        return ChatOpenAI(model="gpt-4o", timeout=120)
    else:
        print("Error: set BROWSER_USE_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY in .env")
        sys.exit(1)


# ---------------------------------------------------------------------------
# Source file discovery
# ---------------------------------------------------------------------------

SOURCE_EXTS = {".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".py", ".json", ".vue", ".svelte"}

def find_source_files(source_dir: str) -> list[str]:
    """Return absolute paths of source files browser-use can read via available_file_paths."""
    paths = []
    for root, dirs, files in os.walk(source_dir):
        # Skip build artifacts and dependency dirs
        dirs[:] = [d for d in dirs if d not in {"node_modules", ".git", "dist", "build", ".next", "__pycache__"}]
        for f in files:
            if os.path.splitext(f)[1] in SOURCE_EXTS:
                paths.append(os.path.join(root, f))
    return paths


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

async def main():
    args = sys.argv[1:]
    if not args or args[0] not in ("reproduce", "validate"):
        print("Usage: python run_browser_agent.py <reproduce|validate> [--run-id <id>]")
        sys.exit(1)

    agent_name = args[0]
    run_id = None
    if "--run-id" in args:
        idx = args.index("--run-id")
        run_id = args[idx + 1]

    ctx = PipelineContext.load(run_id) if run_id else PipelineContext.load_latest()
    print(f"\nRun: {ctx.run_id}  status: {ctx.status}")

    # Discover source files so the agent can call read_file on them if needed.
    # For reproduce: helps correlate stack trace symbols with actual code.
    # For validate: helps confirm the fix was applied in the right place.
    source_files: list[str] = []
    if ctx.input.source_dir and os.path.isdir(ctx.input.source_dir):
        source_files = find_source_files(ctx.input.source_dir)

    if agent_name == "reproduce":
        prompt_vars = {
            "APP_URL": ctx.input.app_url,
            "APP_DESCRIPTION": ctx.input.app_description,
            "STACK_TRACE": ctx.input.stack_trace,
        }
        output_schema = ReproduceOutput

    else:  # validate
        if not ctx.reproduce:
            print("Error: no reproduce result in context -- run reproduce first")
            sys.exit(1)
        prompt_vars = {
            "APP_URL": ctx.input.app_url,
            "ORIGINAL_STACK_TRACE": ctx.input.stack_trace,
            "REPRO_STEPS": ctx.repro_steps_json,
            "FIX_DESCRIPTION": ctx.fix_description,
        }
        output_schema = ValidateOutput

    task = build_prompt(agent_name, prompt_vars)
    llm = get_llm()

    print(f"Running {agent_name.upper()} agent")
    print(f"  app:    {ctx.input.app_url}")
    if source_files:
        print(f"  source: {len(source_files)} file(s) available for reading")
    print("─" * 60)

    ctx.agent_start(agent_name)

    async def on_step(browser_state, model_output, n_steps: int) -> None:
        # Build a human-readable label for the log / frontend status display.
        #
        # Priority order:
        #   1. next_goal       — agent's stated intention ("Click the Export CSV button")
        #   2. evaluation_previous_goal — outcome of last step ("Navigated successfully")
        #   3. memory (first sentence) — agent's running narrative; useful when the
        #      above are empty (common with the bu-latest model)
        #   4. Translated action description — human-readable version of the raw action

        def _first_sentence(text: str) -> str:
            for sep in (".", "\n"):
                idx = text.find(sep)
                if idx > 20:
                    return text[:idx].strip()
            return text[:120].strip()

        label = (getattr(model_output, "next_goal", None) or "").strip()

        if not label:
            eval_prev = (getattr(model_output, "evaluation_previous_goal", None) or "").strip()
            if eval_prev:
                label = eval_prev.split("\n")[0]
                for prefix in ("Success: ", "Failed: ", "Success:", "Failed:"):
                    if label.startswith(prefix):
                        label = label[len(prefix):].strip()
                        break

        if not label:
            memory = (getattr(model_output, "memory", None) or "").strip()
            if memory:
                label = _first_sentence(memory)

        # Translate the raw action into a readable sentence as a last resort.
        if not label:
            actions = getattr(model_output, "action", None) or []
            if not isinstance(actions, list):
                actions = [actions]
            if actions:
                data = actions[0].model_dump(exclude_none=True, mode="json")
                action_name = next(iter(data), "action")
                params = data.get(action_name, {}) if isinstance(data.get(action_name), dict) else {}
                # Map technical action names → readable verbs
                readable = {
                    "navigate":          lambda p: f"Navigated to {p.get('url', '')}",
                    "click":             lambda p: f"Clicked {'\"' + p.get('text','') + '\"' if p.get('text') else 'element'}",
                    "type":              lambda p: f"Typed \"{p.get('text','')[:60]}\"",
                    "read_file":         lambda p: f"Read source file {p.get('file_name','').split('/')[-1]}",
                    "read_long_content": lambda p: f"Read file: {p.get('goal', p.get('source',''))[:80]}",
                    "evaluate":          lambda p: "Ran browser script to inspect page state",
                    "scroll":            lambda p: f"Scrolled {'down' if (p.get('delta_y',0) or 0) > 0 else 'up'} on page",
                    "wait":              lambda p: f"Waited {p.get('seconds', '')}s for page to load",
                    "done":              lambda p: "Completed — reporting results",
                    "go_back":           lambda p: "Navigated back",
                    "open_tab":          lambda p: f"Opened new tab{': ' + p.get('url','') if p.get('url') else ''}",
                    "close_tab":         lambda p: "Closed tab",
                    "extract_content":   lambda p: f"Extracted page content: {p.get('goal','')[:60]}",
                }.get(action_name)
                label = readable(params) if readable else f"{action_name}"

        label = (label or f"Step {n_steps}").strip()
        url = getattr(browser_state, "url", None)
        title = getattr(browser_state, "title", None)
        detail = f"{url} | {title}" if title else url

        # Surface any browser-side JS errors as their own log entries
        for err in (getattr(browser_state, "browser_errors", None) or []):
            ctx.agent_step(agent_name, n_steps, f"Browser error: {err[:120]}", detail=url)
            print(f"  [step {n_steps}] ⚠ browser error: {err[:80]}")

        print(f"  [step {n_steps}] {label[:100]}")
        ctx.agent_step(agent_name, n_steps, label[:200], detail=detail)

    # Record directly into the run directory. browser-use saves a UUID-named
    # .mp4 there; we rename it to reproduce.mp4 / validate.mp4 after the run.
    run_dir = ctx.run_dir   # runs/<run_id>/  (created by the property)

    from browser_use import Agent, BrowserSession
    session = BrowserSession(
        record_video_dir=str(run_dir),
        headless=True,
    )
    agent = Agent(
        task=task,
        llm=llm,
        browser=session,
        max_failures=3,
        output_model_schema=output_schema,    # enforces typed JSON output
        available_file_paths=source_files or None,  # lets agent read source files
        register_new_step_callback=on_step,
        # Navigate to the app URL immediately at session start, BEFORE the LLM
        # processes its first prompt. This eliminates most of the blank intro in
        # the recorded video (recording starts on about:blank, and pre-navigation
        # means the blank window is only the ~1s browser launch time, not the
        # 30-60s the LLM takes to respond to the first prompt).
        # NOTE: `directly_open_url=True` (default) already does this, but gets
        # skipped when the task contains multiple URLs (e.g. stack trace URLs),
        # so we force it explicitly via initial_actions.
        initial_actions=[{"navigate": {"url": ctx.input.app_url, "new_tab": False}}],
    )
    history = await agent.run(max_steps=20)

    # Find the raw recorded video (UUID-named .mp4), post-process it, then save
    # Find the raw recorded video (UUID-named .mp4) in the run dir and rename
    # it to a stable path after post-processing.
    video_path: str | None = None
    mp4_files = sorted(
        [p for p in run_dir.glob("*.mp4") if p.stem != agent_name],
        key=lambda p: p.stat().st_mtime, reverse=True,
    )
    if mp4_files:
        raw_mp4 = mp4_files[0]
        dest = run_dir / f"{agent_name}.mp4"
        # Post-process: trim blank intro + 1.5x speed + compress
        trim_and_polish_video(str(raw_mp4), str(dest))
        raw_mp4.unlink(missing_ok=True)  # remove the raw recording
        video_path = str(dest)
        size_kb = dest.stat().st_size // 1024
        print(f"  video: {dest} ({size_kb} KB)")
    else:
        print("  video: not recorded (install browser-use[video] to enable)")

    raw = history.final_result()
    print("\n" + "─" * 60)
    print(f"RESULT ({agent_name.upper()})")
    print("─" * 60)
    print(raw)

    # Deserialize -- output_model_schema guarantees valid JSON matching the schema
    try:
        if agent_name == "reproduce":
            out = ReproduceOutput.model_validate_json(raw)
        else:
            out = ValidateOutput.model_validate_json(raw)
    except Exception as e:
        print(f"\n[WARN] Structured output parse failed: {e}")
        print("Saving raw text as notes and marking as not reproduced/fixed")
        if agent_name == "reproduce":
            out = ReproduceOutput(reproduced=False, notes=raw or "")
        else:
            out = ValidateOutput(
                fixed=False, verdict="inconclusive",
                verdictReason="parse error", notes=raw or "",
            )

    if agent_name == "reproduce":
        ctx.set_reproduce_result(
            reproduced=out.reproduced,
            error_message=out.errorMessage,
            steps=out.steps,
            browser_logs=out.browserLogs,
            notes=out.notes,
            video_path=video_path,
        )
        ctx.agent_done(agent_name, f"reproduced={out.reproduced}")
        print(f"\nReproduced: {out.reproduced}")
        print(f"Context saved → runs/{ctx.run_id}.json")

    else:
        ctx.set_validate_result(
            fixed=out.fixed,
            verdict=out.verdict,
            verdict_reason=out.verdictReason,
            original_error_seen=out.originalErrorSeen,
            steps=out.steps,
            browser_logs=out.browserLogs,
            new_errors=out.newErrors,
            notes=out.notes,
            video_path=video_path,
        )
        if out.fixed:
            ctx.mark_resolved()
            ctx.agent_done(agent_name, "fix validated -- error is gone")
            print(f"\nFixed! Run resolved at attempt {ctx.resolved_at_attempt}")
        else:
            ctx.agent_done(agent_name, f"not fixed: {out.verdict}")
            print(f"\nNot fixed. Verdict: {out.verdict}")
            print("→ Run run_fix.py to attempt another fix")
        print(f"Context saved → runs/{ctx.run_id}.json")


asyncio.run(main())
