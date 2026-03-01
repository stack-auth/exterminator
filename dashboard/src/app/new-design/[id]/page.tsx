"use client";

import { use, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useError, useDeleteError, type ErrorId } from "@/sdk/errors";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  useSandbox,
  startSandbox,
  pollSandboxStatus,
  type PollResponse,
  type LogEntry,
} from "@/sdk/sandbox";

const POLL_INTERVAL_MS = 3000;

function formatDate(ts: number): string {
  const d = new Date(ts);
  return (
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) +
    ", " +
    d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  );
}

function formatLogTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function Badge({
  label,
  color,
}: {
  label: string;
  color: "red" | "orange" | "green" | "blue" | "gray";
}) {
  const styles: Record<string, string> = {
    red: "bg-red-500/15 text-red-400 ring-red-500/20",
    orange: "bg-orange-500/15 text-orange-400 ring-orange-500/20",
    green: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/20",
    blue: "bg-blue-500/15 text-blue-400 ring-blue-500/20",
    gray: "bg-white/[0.06] text-[#8b949e] ring-white/[0.08]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${styles[color]}`}
    >
      {label}
    </span>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#8b949e]">
        {label}
      </span>
      <span className="break-all font-mono text-xs leading-relaxed text-[#c9d1d9]">
        {value}
      </span>
    </div>
  );
}

function StackTrace({ stack }: { stack?: string }) {
  if (!stack) {
    return (
      <p className="px-4 py-5 text-sm italic text-[#484f58]">
        No stack trace available
      </p>
    );
  }

  const lines = stack.split("\n");

  return (
    <pre className="overflow-x-auto px-4 py-4 font-mono text-[12px] leading-[1.8]">
      {lines.map((line, i) => {
        const isFrame = line.trimStart().startsWith("at ");
        return (
          <div
            key={i}
            className={
              isFrame
                ? "text-[#6e7681] transition-colors duration-150 hover:text-[#c9d1d9] hover:transition-none"
                : "font-medium text-red-400"
            }
          >
            {line}
          </div>
        );
      })}
    </pre>
  );
}

const agentColor: Record<string, string> = {
  reproduce: "blue",
  fix: "orange",
  validate: "green",
};

function AgentBadge({ agent }: { agent: string }) {
  const color = (agentColor[agent] ?? "gray") as "blue" | "orange" | "green" | "gray";
  return <Badge label={agent} color={color} />;
}

interface LogGroup {
  agent: string;
  entries: LogEntry[];
}

function groupLog(log: LogEntry[]): LogGroup[] {
  const groups: LogGroup[] = [];
  for (const entry of log) {
    const last = groups[groups.length - 1];
    if (last && last.agent === entry.agent) {
      last.entries.push(entry);
    } else {
      groups.push({ agent: entry.agent, entries: [entry] });
    }
  }
  return groups;
}

function LogSection({ group }: { group: LogGroup }) {
  const color = (agentColor[group.agent] ?? "gray") as "blue" | "orange" | "green" | "gray";
  const dotColor: Record<string, string> = {
    blue: "bg-blue-400/50",
    orange: "bg-orange-400/50",
    green: "bg-emerald-400/50",
    gray: "bg-[#8b949e]/40",
  };

  return (
    <div className="py-1.5">
      {/* Section header */}
      <div className="mb-1 flex items-center gap-2 px-0.5">
        <div className={`h-1.5 w-1.5 rounded-full ${dotColor[color]}`} />
        <AgentBadge agent={group.agent} />
        <span className="text-[10px] tabular-nums text-[#484f58]">
          {formatLogTime(group.entries[0].ts)}
        </span>
      </div>

      {/* Compact rows */}
      <div className="ml-3.5 border-l border-white/[0.06] pl-3">
        {group.entries.map((entry, i) => {
          const isStart = entry.message.endsWith("started");
          const isDone = entry.message.endsWith("finished");
          const isError = entry.message.includes("error");
          return (
            <div key={i} className="flex items-baseline gap-2 py-0.5">
              <span className="shrink-0 text-[10px] tabular-nums text-[#484f58]">
                {formatLogTime(entry.ts)}
              </span>
              <span
                className={`min-w-0 truncate text-[11px] ${
                  isError
                    ? "text-[#8b949e]"
                    : isDone
                      ? "text-emerald-400"
                      : isStart
                        ? "text-blue-400/70"
                        : "text-[#8b949e]"
                }`}
              >
                {entry.message}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VideoSlot({
  label,
  src,
  placeholder,
  height,
}: {
  label: string;
  src: string | null;
  placeholder?: string;
  height: string;
}) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="flex-1">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#8b949e]">
        {label}
      </p>
      {src && !hasError ? (
        <video
          src={src}
          controls
          playsInline
          className="w-full rounded-lg bg-black ring-1 ring-white/[0.06]"
          style={{ height, objectFit: "contain" }}
          onError={() => setHasError(true)}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-lg ring-1 ring-white/[0.06]"
          style={{ height, background: "rgba(255,255,255,0.02)" }}
        >
          <p className="text-xs text-[#484f58]">
            {hasError ? "Video not available" : placeholder ?? "—"}
          </p>
        </div>
      )}
    </div>
  );
}

type ErrorDoc = {
  _id: ErrorId;
  type: "error" | "unhandledrejection";
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
  pageUrl: string;
  userAgent: string;
};

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl px-3 py-2 text-[11px] leading-relaxed text-[#c9d1d9] backdrop-blur-xl"
          style={{
            background: "linear-gradient(145deg, rgba(30,35,45,0.95), rgba(20,25,33,0.95))",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}

const STATUS_TOOLTIPS: Record<string, string> = {
  creating: "Daytona VM is being provisioned. The sandbox image is being pulled and a fresh container is starting.",
  reproducing: "VM is ready. The reproduce agent is navigating the app in a headless browser to trigger the error.",
  fixing: "Error reproduced. The fix agent is analyzing the code and applying patches in the sandbox.",
  fixed: "Fix validated. The validate agent confirmed the error no longer occurs after the patch.",
  failed: "Pipeline failed. Either the error couldn't be reproduced, or all fix attempts were exhausted.",
};

function statusLabel(convexStatus: string, phase: string): { label: string; tooltip: string } {
  if (convexStatus === "fixed") return { label: "Fixed", tooltip: STATUS_TOOLTIPS.fixed };
  if (convexStatus === "failed") return { label: "Failed", tooltip: STATUS_TOOLTIPS.failed };
  if (convexStatus === "creating" || phase === "idle") return { label: "Starting", tooltip: STATUS_TOOLTIPS.creating };
  if (convexStatus === "reproducing") return { label: "Reproducing", tooltip: STATUS_TOOLTIPS.reproducing };
  if (convexStatus === "fixing") return { label: "Fixing", tooltip: STATUS_TOOLTIPS.fixing };
  return { label: "Running", tooltip: "Pipeline is active." };
}

function ActivityLogCard({ error, expanded, onToggleExpand }: { error: ErrorDoc; expanded: boolean; onToggleExpand: () => void }) {
  const sandbox = useSandbox(error._id);
  const removeSandbox = useMutation(api.sandboxes.remove);
  const [pollResult, setPollResult] = useState<PollResponse | null>(null);
  const [restarting, setRestarting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLogLen = useRef(0);
  const [autoStarted, setAutoStarted] = useState(false);

  const sandboxId = sandbox?.sandboxId ?? "";

  // Polling is a genuine side effect — timer lifecycle tied to sandboxId
  useEffect(() => {
    if (!sandboxId || restarting) return;

    let stopped = false;

    async function poll() {
      if (stopped) return;
      const result = await pollSandboxStatus(sandboxId);
      if (stopped) return;
      setPollResult(result);

      const logLen = result.data?.progress.log.length ?? 0;
      if (logLen > prevLogLen.current) {
        prevLogLen.current = logLen;
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
        });
      }

      if ((result.status === "completed" || result.status === "failed") && result.data !== null) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sandboxId, restarting]);

  const handleRestart = async () => {
    if (!sandbox) return;
    setRestarting(true);
    setAutoStarted(true);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPollResult(null);
    prevLogLen.current = 0;
    try {
      await removeSandbox({ id: sandbox._id });
    } catch {
      // Convex record may already be gone
    }
    try {
      await startSandbox(error._id, {
        type: error.type,
        message: error.message,
        stack: error.stack,
        filename: error.filename,
        lineno: error.lineno,
        colno: error.colno,
        timestamp: error.timestamp,
        pageUrl: error.pageUrl,
        userAgent: error.userAgent,
      });
    } catch {
      // Sandbox creation may fail
    }
    setRestarting(false);
  };

  if (sandbox === undefined) {
    return (
      <GlassCard>
        <CardHeader dot="gray" title="Autofix" />
        <div className="px-4 py-4">
          <p className="text-xs text-[#484f58]">Loading&hellip;</p>
        </div>
      </GlassCard>
    );
  }

  if (sandbox === null && !restarting && !autoStarted) {
    setAutoStarted(true);
    startSandbox(error._id, {
      type: error.type,
      message: error.message,
      stack: error.stack,
      filename: error.filename,
      lineno: error.lineno,
      colno: error.colno,
      timestamp: error.timestamp,
      pageUrl: error.pageUrl,
      userAgent: error.userAgent,
    });
  }

  if ((sandbox === null && !restarting) || restarting) {
    return (
      <GlassCard>
        <CardHeader dot="blue" title="Autofix" />
        <div className="px-4 py-5 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
            <p className="text-xs text-[#8b949e]">
              Starting autofix&hellip;
            </p>
          </div>
        </div>
      </GlassCard>
    );
  }

  const progress = pollResult?.data?.progress;
  const log = progress?.log ?? [];
  const pollStatus = pollResult?.status;
  const phase = progress?.phase ?? "idle";
  const currentAgent = progress?.currentAgent;
  const currentGoal = progress?.currentGoal;
  const reproduceResult = pollResult?.data?.reproduce;
  const isFixed = pollStatus === "completed";

  // Derive effective status: prefer poll result over stale Convex status
  const effectiveConvexStatus = pollStatus === "completed" ? "fixed"
    : pollStatus === "failed" ? "failed"
    : (sandbox?.status ?? "creating");
  const status = pollStatus ?? "in_progress";
  const { label: statusLabelText, tooltip: statusTooltip } = statusLabel(effectiveConvexStatus, phase);

  return (
    <GlassCard>
      <CardHeader dot={status === "completed" ? "green" : status === "failed" ? "red" : "blue"} title="Autofix">
        <div className="ml-auto flex items-center gap-2">
          {/* Restart button */}
          <button
            onClick={handleRestart}
            disabled={restarting}
            className="cursor-pointer rounded-lg p-1 text-[#484f58] transition-colors duration-150 hover:bg-white/[0.06] hover:text-[#8b949e] hover:transition-none disabled:cursor-not-allowed disabled:opacity-50"
            title="Restart analysis on a new VM"
          >
            <svg
              className={`h-3.5 w-3.5 ${restarting ? "animate-spin" : ""}`}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 8a7 7 0 0 1 12.45-4.35" />
              <path d="M15 8a7 7 0 0 1-12.45 4.35" />
              <path d="M13.45 3.65L13.45 1M13.45 3.65L16 3.65" />
              <path d="M2.55 12.35L2.55 15M2.55 12.35L0 12.35" />
            </svg>
          </button>

          {/* Expand/collapse button */}
          <button
            onClick={onToggleExpand}
            className="cursor-pointer rounded-lg p-1 text-[#484f58] transition-colors duration-150 hover:bg-white/[0.06] hover:text-[#8b949e] hover:transition-none"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 1H1v5M10 15h5v-5M1 1l5 5M15 15l-5-5" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 1h5v5M6 15H1v-5M15 1l-5 5M1 15l5-5" />
              </svg>
            )}
          </button>

          {status === "in_progress" && (
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
          )}
          <Tooltip text={statusTooltip}>
            <span className="cursor-help">
              <Badge
                label={statusLabelText}
                color={status === "completed" ? "green" : status === "failed" ? "red" : "blue"}
              />
            </span>
          </Tooltip>
        </div>
      </CardHeader>

      {/* Current action */}
      {currentAgent && currentGoal && status === "in_progress" && (
        <div
          className="flex items-center gap-2 px-4 py-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
        >
          <AgentBadge agent={currentAgent} />
          <p className="truncate text-xs text-[#8b949e]">{currentGoal}</p>
        </div>
      )}

      {/* Videos */}
      {(reproduceResult || isFixed) && sandboxId && (
        <div
          className="flex gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
        >
          <VideoSlot
            label="Before"
            src={reproduceResult ? `/api/sandbox/${encodeURIComponent(sandboxId)}/video/reproduce` : null}
            placeholder={reproduceResult ? undefined : "Recording…"}
            height={expanded ? "280px" : "200px"}
          />
          <VideoSlot
            label="After"
            src={isFixed ? `/api/sandbox/${encodeURIComponent(sandboxId)}/video/validate` : null}
            placeholder={isFixed ? undefined : status === "in_progress" ? "Pending fix…" : "—"}
            height={expanded ? "280px" : "200px"}
          />
        </div>
      )}

      {/* Log */}
      <div
        ref={scrollRef}
        className={`overflow-y-auto px-4 py-2 transition-[max-height] duration-300 ease-in-out ${expanded ? "max-h-[70vh]" : "max-h-72"}`}
        style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}
      >
        {log.length === 0 ? (
          <p className="py-4 text-center text-xs italic text-[#484f58]">
            {status === "in_progress" ? "Waiting for activity…" : "No activity recorded"}
          </p>
        ) : (
          groupLog(log).map((group, i) => <LogSection key={i} group={group} />)
        )}
      </div>

      {/* Footer with count */}
      {log.length > 0 && (
        <div
          className="px-4 py-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <p className="text-[10px] tabular-nums text-[#484f58]">
            {log.length} event{log.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </GlassCard>
  );
}

const glassStyle = {
  background: "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
  boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 4px 24px rgba(0,0,0,0.25)",
};

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl backdrop-blur-xl" style={glassStyle}>
      {children}
    </div>
  );
}

function CardHeader({
  dot,
  title,
  children,
}: {
  dot: "blue" | "green" | "red" | "purple" | "gray";
  title: string;
  children?: React.ReactNode;
}) {
  const dotStyles: Record<string, string> = {
    blue: "bg-blue-400/40 shadow-[0_0_6px_rgba(96,165,250,0.2)]",
    green: "bg-emerald-400/40 shadow-[0_0_6px_rgba(52,211,153,0.2)]",
    red: "bg-red-400/40 shadow-[0_0_6px_rgba(248,113,113,0.2)]",
    purple: "bg-purple-400/40 shadow-[0_0_6px_rgba(167,139,250,0.2)]",
    gray: "bg-[#8b949e]/40 shadow-[0_0_6px_rgba(139,148,158,0.2)]",
  };
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className={`h-2 w-2 rounded-full ${dotStyles[dot]}`} />
      <p
        className="text-xs font-semibold uppercase"
        style={{
          fontFamily: "var(--font-display), sans-serif",
          letterSpacing: "0.1em",
          color: "#8b949e",
        }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

export default function ErrorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const error = useError(id as ErrorId);
  const deleteError = useDeleteError();
  const sandbox = useSandbox(id as ErrorId);
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [autofixExpanded, setAutofixExpanded] = useState(false);
  const [previewDropdownOpen, setPreviewDropdownOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsContent, setLogsContent] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  if (error === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[#484f58]">Loading&hellip;</p>
      </div>
    );
  }

  if (error === null) {
    return (
      <div className="min-h-screen px-6 pb-16 pt-10">
        <div className="mx-auto max-w-3xl">
          <GlassCard>
            <div className="p-5">
              <h1 className="mb-1 text-sm font-semibold text-[#e6edf3]">
                Error not found
              </h1>
              <p className="mb-4 text-sm text-[#8b949e]">
                This error may have been deleted or the link is invalid.
              </p>
              <Link
                href="/new-design"
                className="text-sm font-medium text-blue-400 transition-colors duration-150 hover:text-blue-300 hover:transition-none"
              >
                &larr; Back to all errors
              </Link>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  const source = error.filename
    ? error.filename
    : (error.stack?.split("\n")[1]?.trim()?.match(/\((.*?)\)/)?.[1] ?? "—");

  const location =
    error.lineno != null
      ? `Line ${error.lineno}${error.colno != null ? `, Col ${error.colno}` : ""}`
      : "—";

  const isRejection = error.type === "unhandledrejection";

  return (
    <div className="min-h-screen px-6 pb-16 pt-8">
      <div className="mx-auto max-w-3xl">
        {/* Nav */}
        <nav className="mb-5 flex items-center justify-between">
          <Link
            href="/new-design"
            className="text-sm font-medium text-[#8b949e] transition-colors duration-150 hover:text-[#e6edf3] hover:transition-none"
          >
            &larr; All errors
          </Link>
          <div className="flex items-center gap-2">
            {/* Preview segment button */}
            {sandbox?.sandboxId && (
              <div className="relative flex">
                <button
                  onClick={async () => {
                    const res = await fetch(`/api/sandbox/${encodeURIComponent(sandbox.sandboxId)}/preview?port=3000`);
                    const data = await res.json();
                    if (data.url) window.open(data.url, "_blank");
                  }}
                  className="cursor-pointer rounded-l-xl bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 ring-1 ring-blue-500/20 transition-colors duration-150 hover:bg-blue-500/20 hover:transition-none"
                >
                  Preview
                </button>
                <button
                  onClick={() => setPreviewDropdownOpen((v) => !v)}
                  className="cursor-pointer rounded-r-xl border-l border-blue-500/20 bg-blue-500/10 px-1.5 py-1.5 text-blue-400 ring-1 ring-blue-500/20 transition-colors duration-150 hover:bg-blue-500/20 hover:transition-none"
                >
                  <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 5l3 3 3-3" />
                  </svg>
                </button>
                {previewDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setPreviewDropdownOpen(false)} />
                    <div
                      className="absolute right-0 top-full z-50 mt-1.5 w-36 overflow-hidden rounded-xl py-1 backdrop-blur-xl"
                      style={{
                        background: "linear-gradient(145deg, rgba(30,35,45,0.95), rgba(20,25,33,0.95))",
                        boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 8px 24px rgba(0,0,0,0.5)",
                      }}
                    >
                      <button
                        onClick={async () => {
                          setPreviewDropdownOpen(false);
                          const res = await fetch(`/api/sandbox/${encodeURIComponent(sandbox.sandboxId)}/preview?port=4000`);
                          const data = await res.json();
                          if (data.url) window.open(data.url, "_blank");
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-[#c9d1d9] transition-colors duration-150 hover:bg-white/[0.06] hover:transition-none"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-purple-400/50" />
                        Show Debug
                      </button>
                      <button
                        onClick={async () => {
                          setPreviewDropdownOpen(false);
                          setLogsLoading(true);
                          setLogsOpen(true);
                          const res = await fetch(`/api/sandbox/${encodeURIComponent(sandbox.sandboxId)}/logs`);
                          const data = await res.json();
                          setLogsContent(data.logs ?? data.error ?? "No logs available");
                          setLogsLoading(false);
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-[#c9d1d9] transition-colors duration-150 hover:bg-white/[0.06] hover:transition-none"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/50" />
                        Show Logs
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              onClick={async () => {
                setDeleting(true);
                await deleteError({ id: error._id });
                router.push("/new-design");
              }}
              disabled={deleting}
              className="cursor-pointer rounded-xl bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 ring-1 ring-red-500/20 transition-colors duration-150 hover:bg-red-500/20 hover:transition-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </nav>

        {/* Two-column layout */}
        <div className={`grid gap-4 transition-all duration-300 ease-in-out ${autofixExpanded ? "md:grid-cols-1" : "md:grid-cols-2"}`}>
          {/* Left column */}
          <div
            className={`flex flex-col gap-4 transition-all duration-300 ease-in-out ${autofixExpanded ? "pointer-events-none max-h-0 overflow-hidden opacity-0" : "opacity-100"}`}
          >
            {/* Header card */}
            <GlassCard>
              <div
                className="px-5 py-4"
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  background: isRejection
                    ? "linear-gradient(90deg, rgba(249,115,22,0.06) 0%, transparent 50%)"
                    : "linear-gradient(90deg, rgba(239,68,68,0.06) 0%, transparent 50%)",
                }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <Badge
                    label={isRejection ? "Rejection" : "Error"}
                    color={isRejection ? "orange" : "red"}
                  />
                  <span className="text-xs text-[#484f58]">
                    {formatDate(error.timestamp)}
                  </span>
                </div>
                <h1 className="text-lg font-semibold leading-snug tracking-tight text-[#e6edf3]">
                  {error.message}
                </h1>
              </div>

              <div className="grid grid-cols-2 gap-px" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="bg-[#0d1117] px-5 py-3">
                  <MetaItem label="Source" value={source} />
                </div>
                <div className="bg-[#0d1117] px-5 py-3">
                  <MetaItem label="Location" value={location} />
                </div>
              </div>
            </GlassCard>

            {/* Stack Trace */}
            <GlassCard>
              <CardHeader dot="gray" title="Stack Trace" />
              <StackTrace stack={error.stack} />
            </GlassCard>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            {/* Autofix */}
            <ActivityLogCard
              error={error}
              expanded={autofixExpanded}
              onToggleExpand={() => setAutofixExpanded((v) => !v)}
            />

            {/* Other cards — fade out when expanded */}
            <div
              className={`flex flex-col gap-4 transition-all duration-300 ease-in-out ${autofixExpanded ? "pointer-events-none max-h-0 overflow-hidden opacity-0" : "opacity-100"}`}
            >
              {/* Page URL */}
              <GlassCard>
                <CardHeader dot="blue" title="Page" />
                <div className="px-4 py-3">
                  <p className="break-all font-mono text-xs leading-relaxed text-[#c9d1d9]">
                    {error.pageUrl}
                  </p>
                </div>
              </GlassCard>

              {/* User Agent */}
              <GlassCard>
                <CardHeader dot="purple" title="Environment" />
                <div className="px-4 py-3">
                  <p className="break-all font-mono text-[11px] leading-relaxed text-[#8b949e]">
                    {error.userAgent}
                  </p>
                </div>
              </GlassCard>

              {/* Error ID */}
              <GlassCard>
                <div className="px-4 py-3">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[#484f58]">
                    ID
                  </span>
                  <p className="mt-0.5 font-mono text-[11px] text-[#6e7681]">
                    {error._id}
                  </p>
                </div>
              </GlassCard>
            </div>
          </div>
        </div>

        {/* Logs modal */}
        {logsOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setLogsOpen(false)}
            />
            <div
              className="fixed inset-x-6 top-16 bottom-16 z-50 mx-auto flex max-w-3xl flex-col overflow-hidden rounded-2xl backdrop-blur-xl"
              style={{
                background: "linear-gradient(145deg, rgba(20,25,33,0.97), rgba(13,17,23,0.97))",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 16px 48px rgba(0,0,0,0.6)",
              }}
            >
              <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-cyan-400/40 shadow-[0_0_6px_rgba(34,211,238,0.2)]" />
                  <p
                    className="text-xs font-semibold uppercase"
                    style={{ fontFamily: "var(--font-display), sans-serif", letterSpacing: "0.1em", color: "#8b949e" }}
                  >
                    Sandbox Logs
                  </p>
                </div>
                <button
                  onClick={() => setLogsOpen(false)}
                  className="cursor-pointer rounded-lg p-1 text-[#484f58] transition-colors duration-150 hover:bg-white/[0.06] hover:text-[#8b949e] hover:transition-none"
                >
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
                {logsLoading ? (
                  <p className="text-xs text-[#484f58]">Loading logs&hellip;</p>
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-[12px] leading-[1.7] text-[#8b949e]">
                    {logsContent}
                  </pre>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
