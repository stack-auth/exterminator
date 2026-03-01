"""
Centralized run context for the Exterminator pipeline.

One JSON file per bug-fix run, stored in runner/runs/{run_id}.json.
Every agent reads from and writes to this file directly -- no stdout threading needed.

Schema mirrors the TypeScript RunContext interface in ai/agent/src/context.ts.

Typical lifecycle:
    ctx = PipelineContext.create(stack_trace=..., app_url=..., source_dir=...)
    # or resume:
    ctx = PipelineContext.load("some-run-id")

    # Reproduce agent writes:
    ctx.set_reproduce_result(reproduced=True, steps=[...], browser_logs=[...], ...)

    # Fix agent writes:
    ctx.start_attempt()
    ctx.set_fix_result(summary=..., changed_files=[...])

    # Validate agent writes:
    ctx.set_validate_result(fixed=False, verdict="error_persists", ...)

    # On failure, loop back to fix -- ctx.previous_attempts_text is auto-derived.
    # On success:
    ctx.mark_resolved()
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

RUNS_DIR = Path(__file__).parent / "runs"
RUNS_DIR.mkdir(exist_ok=True)

AgentName = Literal["reproduce", "fix", "validate"]
Phase = Literal["idle", "running", "done", "error"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Sub-schemas (mirror context.ts)
# ---------------------------------------------------------------------------


@dataclass
class LogEntry:
    ts: str
    agent: AgentName
    message: str
    step: int | None = None
    detail: str | None = None   # e.g. tool name, URL, element clicked


@dataclass
class Progress:
    current_agent: AgentName | None
    phase: Phase
    current_step: int | None
    current_goal: str | None       # what the agent is actively trying right now
    last_updated_at: str
    log: list[LogEntry] = field(default_factory=list)

@dataclass
class ReproduceResult:
    reproduced: bool
    error_message: str | None
    steps: list[dict]
    browser_logs: list[dict]
    notes: str


@dataclass
class FixResult:
    summary: str
    changed_files: list[str]


@dataclass
class ValidateResult:
    fixed: bool
    verdict: str                  # "resolved" | "error_persists" | "regression" | "partial_fix"
    verdict_reason: str
    original_error_seen: bool
    steps: list[dict]
    browser_logs: list[dict]
    new_errors: list[dict]
    notes: str


@dataclass
class Attempt:
    n: int
    fix: FixResult | None = None
    validate: ValidateResult | None = None


@dataclass
class RunInput:
    stack_trace: str
    app_url: str
    app_description: str
    source_dir: str


# ---------------------------------------------------------------------------
# Main context
# ---------------------------------------------------------------------------

@dataclass
class PipelineContext:
    run_id: str
    created_at: str
    status: str                   # "in_progress" | "fixed" | "failed"
    input: RunInput
    reproduce: ReproduceResult | None = None
    attempts: list[Attempt] = field(default_factory=list)
    resolved_at_attempt: int | None = None
    progress: Progress = field(
        default_factory=lambda: Progress(
            current_agent=None,
            phase="idle",
            current_step=None,
            current_goal=None,
            last_updated_at=_now(),
        )
    )

    # ------------------------------------------------------------------
    # Factories
    # ------------------------------------------------------------------

    @classmethod
    def create(
        cls,
        stack_trace: str,
        app_url: str,
        source_dir: str,
        app_description: str = "",
        run_id: str | None = None,
    ) -> "PipelineContext":
        ctx = cls(
            run_id=run_id or str(uuid.uuid4())[:8],
            created_at=datetime.now(timezone.utc).isoformat(),
            status="in_progress",
            input=RunInput(
                stack_trace=stack_trace,
                app_url=app_url,
                app_description=app_description,
                source_dir=source_dir,
            ),
        )
        ctx.save()
        return ctx

    @classmethod
    def load(cls, run_id: str) -> "PipelineContext":
        path = RUNS_DIR / f"{run_id}.json"
        if not path.exists():
            raise FileNotFoundError(f"No run found with id '{run_id}' at {path}")
        return cls._from_dict(json.loads(path.read_text()))

    @classmethod
    def load_latest(cls) -> "PipelineContext":
        files = sorted(RUNS_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        if not files:
            raise FileNotFoundError("No runs found in runs/")
        return cls._from_dict(json.loads(files[0].read_text()))

    # ------------------------------------------------------------------
    # Agent write methods
    # ------------------------------------------------------------------

    def set_reproduce_result(
        self,
        reproduced: bool,
        steps: list[dict],
        browser_logs: list[dict],
        error_message: str | None = None,
        notes: str = "",
    ) -> None:
        self.reproduce = ReproduceResult(
            reproduced=reproduced,
            error_message=error_message,
            steps=steps,
            browser_logs=browser_logs,
            notes=notes,
        )
        self.save()

    def start_attempt(self) -> Attempt:
        """Open a new fix+validate attempt and return it."""
        attempt = Attempt(n=len(self.attempts) + 1)
        self.attempts.append(attempt)
        self.save()
        return attempt

    def set_fix_result(self, summary: str, changed_files: list[str]) -> None:
        """Write fix result into the current (last) attempt."""
        if not self.attempts:
            self.start_attempt()
        self.attempts[-1].fix = FixResult(summary=summary, changed_files=changed_files)
        self.save()

    def set_validate_result(
        self,
        fixed: bool,
        verdict: str,
        verdict_reason: str,
        original_error_seen: bool,
        steps: list[dict],
        browser_logs: list[dict],
        new_errors: list[dict],
        notes: str = "",
    ) -> None:
        """Write validate result into the current (last) attempt."""
        if not self.attempts:
            raise RuntimeError("No attempt in progress -- call start_attempt() first")
        self.attempts[-1].validate = ValidateResult(
            fixed=fixed,
            verdict=verdict,
            verdict_reason=verdict_reason,
            original_error_seen=original_error_seen,
            steps=steps,
            browser_logs=browser_logs,
            new_errors=new_errors,
            notes=notes,
        )
        self.save()

    def mark_resolved(self) -> None:
        self.status = "fixed"
        self.resolved_at_attempt = len(self.attempts)
        self.save()

    def mark_failed(self) -> None:
        self.status = "failed"
        self.progress.phase = "error"
        self.progress.last_updated_at = _now()
        self.save()

    # ------------------------------------------------------------------
    # Progress / live timeline methods (called during agent execution)
    # ------------------------------------------------------------------

    def agent_start(self, agent: AgentName) -> None:
        """Call at the beginning of an agent run."""
        self.progress.current_agent = agent
        self.progress.phase = "running"
        self.progress.current_step = 0
        self.progress.current_goal = None
        self.progress.last_updated_at = _now()
        self.progress.log.append(LogEntry(
            ts=_now(), agent=agent, message=f"{agent} agent started",
        ))
        self.save()

    def agent_step(self, agent: AgentName, step: int, goal: str, detail: str | None = None) -> None:
        """Call on each step/action the agent takes."""
        self.progress.current_step = step
        self.progress.current_goal = goal
        self.progress.last_updated_at = _now()
        self.progress.log.append(LogEntry(
            ts=_now(), agent=agent, step=step, message=goal, detail=detail,
        ))
        self.save()

    def agent_done(self, agent: AgentName, summary: str | None = None) -> None:
        """Call when an agent finishes (success or not)."""
        self.progress.phase = "done"
        self.progress.current_goal = summary
        self.progress.last_updated_at = _now()
        self.progress.log.append(LogEntry(
            ts=_now(), agent=agent, message=f"{agent} agent finished",
            detail=summary,
        ))
        self.save()

    def agent_error(self, agent: AgentName, error: str) -> None:
        """Call if an agent hits an unrecoverable error."""
        self.progress.phase = "error"
        self.progress.current_goal = error
        self.progress.last_updated_at = _now()
        self.progress.log.append(LogEntry(
            ts=_now(), agent=agent, message=f"{agent} agent error", detail=error,
        ))
        self.save()

    # ------------------------------------------------------------------
    # Derived helpers for prompt building
    # ------------------------------------------------------------------

    @property
    def previous_attempts_text(self) -> str:
        """
        Returns a formatted string for the {{PREVIOUS_ATTEMPTS}} prompt variable.
        Empty string on the first attempt (no history yet).
        """
        completed = [a for a in self.attempts if a.fix and a.validate]
        if not completed:
            return ""

        lines = ["## Previous Fix Attempts (all failed -- do not repeat these)\n"]
        for a in completed:
            lines.append(f"### Attempt {a.n}")
            if a.fix:
                lines.append(f"**What was changed:** {a.fix.summary}")
                if a.fix.changed_files:
                    lines.append(f"**Files modified:** {', '.join(a.fix.changed_files)}")
            if a.validate:
                lines.append(f"**Validation verdict:** {a.validate.verdict}")
                lines.append(f"**Why it failed:** {a.validate.verdict_reason}")
                if a.validate.notes:
                    lines.append(f"**Agent notes:** {a.validate.notes}")
                if a.validate.new_errors:
                    new_err_msgs = [e.get("message", "") for e in a.validate.new_errors]
                    lines.append(f"**New errors introduced:** {'; '.join(new_err_msgs)}")
            lines.append("")

        return "\n".join(lines)

    @property
    def repro_steps_json(self) -> str:
        if not self.reproduce:
            return "[]"
        return json.dumps(self.reproduce.steps, indent=2)

    @property
    def browser_logs_text(self) -> str:
        if not self.reproduce:
            return ""
        return "\n".join(
            f"[{log.get('level', 'log')}] {log.get('message', '')}"
            for log in self.reproduce.browser_logs
        )

    @property
    def fix_description(self) -> str:
        """Latest fix summary, for the validate prompt."""
        if not self.attempts or not self.attempts[-1].fix:
            return ""
        return self.attempts[-1].fix.summary

    @property
    def current_attempt_number(self) -> int:
        return len(self.attempts)

    @property
    def path(self) -> Path:
        return RUNS_DIR / f"{self.run_id}.json"

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------

    def save(self) -> None:
        self.path.write_text(json.dumps(self._to_dict(), indent=2))

    def _to_dict(self) -> dict:
        p = self.progress
        return {
            "runId": self.run_id,
            "createdAt": self.created_at,
            "status": self.status,
            "input": asdict(self.input),
            "reproduce": asdict(self.reproduce) if self.reproduce else None,
            "attempts": [
                {
                    "n": a.n,
                    "fix": asdict(a.fix) if a.fix else None,
                    "validate": asdict(a.validate) if a.validate else None,
                }
                for a in self.attempts
            ],
            "resolvedAtAttempt": self.resolved_at_attempt,
            "progress": {
                "currentAgent": p.current_agent,
                "phase": p.phase,
                "currentStep": p.current_step,
                "currentGoal": p.current_goal,
                "lastUpdatedAt": p.last_updated_at,
                "log": [asdict(e) for e in p.log],
            },
        }

    @classmethod
    def _from_dict(cls, d: dict) -> "PipelineContext":
        inp = d["input"]
        reproduce = d.get("reproduce")
        attempts_raw = d.get("attempts", [])
        prog_raw = d.get("progress", {})

        attempts = []
        for a in attempts_raw:
            fix = FixResult(**a["fix"]) if a.get("fix") else None
            val = ValidateResult(**a["validate"]) if a.get("validate") else None
            attempts.append(Attempt(n=a["n"], fix=fix, validate=val))

        log = [LogEntry(**e) for e in prog_raw.get("log", [])]
        progress = Progress(
            current_agent=prog_raw.get("currentAgent"),
            phase=prog_raw.get("phase", "idle"),
            current_step=prog_raw.get("currentStep"),
            current_goal=prog_raw.get("currentGoal"),
            last_updated_at=prog_raw.get("lastUpdatedAt", _now()),
            log=log,
        )

        return cls(
            run_id=d["runId"],
            created_at=d["createdAt"],
            status=d["status"],
            input=RunInput(**inp),
            reproduce=ReproduceResult(**reproduce) if reproduce else None,
            attempts=attempts,
            resolved_at_attempt=d.get("resolvedAtAttempt"),
            progress=progress,
        )
