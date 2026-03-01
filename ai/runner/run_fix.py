"""
Fix agent -- uses the Claude Agent SDK to read source files and apply a minimal fix.

Reads all inputs from the pipeline context file (runs/{run_id}.json) and writes
results back to the same file. No stdout threading needed.

Usage:
    python run_fix.py [--run-id <id>]    # uses most recent run if no id given

Requires ANTHROPIC_API_KEY in .env.
The run context must already exist (created by context.py or the TS wrapper).
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from context import PipelineContext
from claude_agent_sdk import (
    query,
    ClaudeAgentOptions,
    HookMatcher,
    AssistantMessage,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
    PostToolUseHookInput,
    CLINotFoundError,
    CLIJSONDecodeError,
    ProcessError,
)
from build_prompt import build_prompt

load_dotenv()

# ---------------------------------------------------------------------------
# Project structure helper
# ---------------------------------------------------------------------------

SKIP_DIRS = {"node_modules", ".git", ".venv", "__pycache__", "dist", ".next", "build"}


def get_project_structure(cwd: str, max_depth: int = 3) -> str:
    """Return a compact file tree of the project, skipping common noise dirs."""
    root = Path(cwd)
    lines: list[str] = [root.name + "/"]

    def _walk(path: Path, prefix: str, depth: int) -> None:
        if depth > max_depth:
            return
        try:
            entries = sorted(path.iterdir(), key=lambda e: (e.is_file(), e.name))
        except PermissionError:
            return
        for i, entry in enumerate(entries):
            if entry.name in SKIP_DIRS or entry.name.startswith("."):
                continue
            connector = "└── " if i == len(entries) - 1 else "├── "
            lines.append(f"{prefix}{connector}{entry.name}{'/' if entry.is_dir() else ''}")
            if entry.is_dir():
                extension = "    " if i == len(entries) - 1 else "│   "
                _walk(entry, prefix + extension, depth + 1)

    _walk(root, "", 1)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Fix runner
# ---------------------------------------------------------------------------

async def run_fix(ctx: PipelineContext) -> dict:
    """
    Run the Claude Agent SDK fix agent using context from the pipeline run.

    Reads stack trace, browser logs, repro steps, and previous attempts
    directly from ctx. Writes fix result back to ctx when done.

    Returns:
        { "summary": str, "changed_files": list[str] }
    """
    source_dir = ctx.input.source_dir
    project_structure = get_project_structure(source_dir)

    # Open a new attempt slot in the context
    ctx.start_attempt()

    prompt = build_prompt("fix", {
        "STACK_TRACE": ctx.input.stack_trace,
        "BROWSER_LOGS": ctx.browser_logs_text,
        "REPRO_STEPS": ctx.repro_steps_json,
        "PROJECT_STRUCTURE": project_structure,
        "PREVIOUS_ATTEMPTS": ctx.previous_attempts_text,
    })

    changed_files: list[str] = []

    async def on_post_tool_use(hook_input: PostToolUseHookInput, tool_use_id: str | None, context) -> dict:
        """Capture file paths whenever Edit or Write tools are called."""
        if hook_input.tool_name in ("Edit", "Write"):
            file_path = hook_input.tool_input.get("file_path") or hook_input.tool_input.get("path", "")
            if file_path and file_path not in changed_files:
                changed_files.append(file_path)
        return {}

    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Edit", "Write", "Grep", "Glob"],
        permission_mode="acceptEdits",
        cwd=source_dir,
        hooks={
            "PostToolUse": [HookMatcher(hooks=[on_post_tool_use])],
        },
    )

    print(f"\nRun: {ctx.run_id}  attempt: {ctx.current_attempt_number}")
    print(f"Running FIX agent")
    print(f"  source: {source_dir}")
    print("─" * 60)

    ctx.agent_start("fix")
    summary_text = ""
    step = 0

    try:
        async for message in query(prompt=prompt, options=options):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock) and block.text.strip():
                        print(block.text)
                        summary_text = block.text
                        # Reasoning text counts as a step -- gives frontend something to show
                        step += 1
                        ctx.agent_step("fix", step, block.text[:120], detail="reasoning")

                    elif isinstance(block, ToolUseBlock):
                        path_hint = (
                            block.input.get("file_path")
                            or block.input.get("path")
                            or block.input.get("pattern", "")
                        )
                        label = f"{block.name}({path_hint})" if path_hint else block.name
                        print(f"  [tool] {label}")
                        step += 1
                        ctx.agent_step("fix", step, label, detail=block.name)

            elif isinstance(message, ResultMessage):
                if message.result:
                    summary_text = message.result

    except CLINotFoundError:
        msg = "claude CLI not found. Is it installed and on your PATH?"
        print(f"\n[ERROR] {msg}", file=sys.stderr)
        ctx.agent_error("fix", msg)
        ctx.set_fix_result(summary=f"Error: {msg}", changed_files=[])
        return {"summary": f"Error: {msg}", "changed_files": []}
    except ProcessError as exc:
        msg = f"Claude process failed (exit {exc.exit_code})"
        print(f"\n[ERROR] {msg}:\n{exc.stderr}", file=sys.stderr)
        ctx.agent_error("fix", msg)
        ctx.set_fix_result(summary=f"Error: {msg}", changed_files=changed_files)
        return {"summary": f"Error: {msg}", "changed_files": changed_files}
    except CLIJSONDecodeError as exc:
        msg = f"Failed to parse Claude response: {exc}"
        print(f"\n[ERROR] {msg}", file=sys.stderr)
        ctx.agent_error("fix", msg)
        ctx.set_fix_result(summary=f"Error: {msg}", changed_files=changed_files)
        return {"summary": f"Error: {msg}", "changed_files": changed_files}

    ctx.agent_done("fix", summary_text[:120] if summary_text else None)
    ctx.set_fix_result(summary=summary_text, changed_files=changed_files)
    print(f"\nContext saved → runs/{ctx.run_id}.json")

    return {"summary": summary_text, "changed_files": changed_files}


# ---------------------------------------------------------------------------
# CLI entrypoint
# ---------------------------------------------------------------------------

def main():
    args = sys.argv[1:]
    run_id = None
    if "--run-id" in args:
        idx = args.index("--run-id")
        run_id = args[idx + 1]

    ctx = PipelineContext.load(run_id) if run_id else PipelineContext.load_latest()
    print(f"Loaded run: {ctx.run_id}")

    if not ctx.reproduce or not ctx.reproduce.reproduced:
        print("Warning: reproduce step hasn't confirmed the error yet -- proceeding anyway")

    result = asyncio.run(run_fix(ctx))

    print("\n" + "─" * 60)
    print("RESULT (FIX)")
    print("─" * 60)
    print(result["summary"])

    if result["changed_files"]:
        print("\nChanged files:")
        for f in result["changed_files"]:
            print(f"  • {f}")
    else:
        print("\nNo files were changed.")

    print("\n→ Run: python run_browser_agent.py validate")


if __name__ == "__main__":
    main()
