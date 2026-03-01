"use client";

import { useEffect, useRef, useState } from "react";
import type { Doc } from "../../../convex/_generated/dataModel";
import {
  useSandbox,
  pollSandboxStatus,
  type PollStatus,
  type PollResponse,
  type RunContext,
  type Progress,
  type ReproduceResult,
  type Attempt,
} from "@/sdk/sandbox";
import { useGitHubToken, connectGitHub } from "@/sdk/github-token";
import { createPr } from "@/sdk/pr";
import { useDeleteError } from "@/sdk/errors";
import type { GitHubConfig } from "@/lib/github";

const GITHUB_CONFIG: GitHubConfig = {
  owner: "stack-auth",
  repo: "exterminator-demo-repo",
  baseBranch: "main",
};

type ErrorDoc = Doc<"errors">;

const POLL_INTERVAL_MS = 3000;

function formatDate(ts: number): string {
  const d = new Date(ts);
  return (
    d.toLocaleDateString("en-US", {
      month: "numeric",
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

function Badge({
  label,
  color,
}: {
  label: string;
  color: "red" | "amber" | "green" | "blue" | "gray";
}) {
  const colors = {
    red: "bg-red-500/15 text-red-400 border-red-500/20",
    amber: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    blue: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    gray: "bg-[#1c2533] text-[#8b949e] border-[#2a3544]",
  };
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold uppercase border ${colors[color]}`}
    >
      {label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex border-b border-[#1e2a3a] last:border-0">
      <dt className="w-28 shrink-0 px-4 py-2.5 text-xs font-medium text-[#8b949e]">
        {label}
      </dt>
      <dd className="flex-1 px-4 py-2.5 font-mono text-xs text-[#c9d1d9] break-all">
        {value}
      </dd>
    </div>
  );
}

function StackTrace({ stack }: { stack?: string }) {
  if (!stack) {
    return (
      <p className="px-4 py-3 text-sm italic text-[#484f58]">
        No stack trace available
      </p>
    );
  }

  const lines = stack.split("\n");

  return (
    <pre className="overflow-x-auto rounded-lg bg-[#010409] p-4 text-[13px] leading-6 font-mono">
      {lines.map((line, i) => {
        const isFrame = line.trimStart().startsWith("at ");
        return (
          <div
            key={i}
            className={
              isFrame
                ? "text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
                : "font-semibold text-red-400"
            }
          >
            {line}
          </div>
        );
      })}
    </pre>
  );
}

function statusBadge(status: PollStatus) {
  switch (status) {
    case "in_progress":
      return <Badge label="In Progress" color="blue" />;
    case "completed":
      return <Badge label="Fixed" color="green" />;
    case "failed":
      return <Badge label="Failed" color="red" />;
  }
}

// ---------------------------------------------------------------------------
// Collapsible section wrapper
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#1e2a3a] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#8b949e] hover:bg-[#1c2533] transition-colors cursor-pointer"
      >
        {title}
        <span className="text-[#484f58]">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="border-t border-[#1e2a3a]">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress section (current agent / phase / goal + log)
// ---------------------------------------------------------------------------

function ProgressSection({ progress }: { progress: Progress }) {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [progress.log.length]);

  return (
    <div className="space-y-3">
      {/* Current status line */}
      <div className="flex flex-wrap items-center gap-2">
        {progress.currentAgent && (
          <Badge label={progress.currentAgent} color="blue" />
        )}
        <Badge
          label={progress.phase}
          color={
            progress.phase === "running"
              ? "blue"
              : progress.phase === "done"
                ? "green"
                : progress.phase === "error"
                  ? "red"
                  : "gray"
          }
        />
        {progress.currentGoal && (
          <span className="text-xs text-[#8b949e]">
            {progress.currentGoal}
          </span>
        )}
      </div>

      {/* Log entries */}
      {progress.log.length > 0 && (
        <div className="max-h-52 overflow-y-auto rounded-lg bg-[#010409] p-3 space-y-1">
          {progress.log.map((entry, i) => (
            <div key={i} className="flex gap-2 text-xs font-mono">
              <span className="shrink-0 text-[#484f58]">
                {new Date(entry.ts).toLocaleTimeString()}
              </span>
              <span className="shrink-0 text-blue-400">[{entry.agent}]</span>
              <span className="text-[#c9d1d9]">{entry.message}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reproduce section
// ---------------------------------------------------------------------------

function ReproduceSection({ reproduce }: { reproduce: ReproduceResult }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge
          label={reproduce.reproduced ? "Reproduced" : "Not reproduced"}
          color={reproduce.reproduced ? "green" : "red"}
        />
      </div>
      {reproduce.error_message && (
        <div className="rounded-lg bg-[#010409] p-3">
          <p className="text-xs font-mono text-red-400">
            {reproduce.error_message}
          </p>
        </div>
      )}
      {reproduce.notes && (
        <p className="text-xs text-[#8b949e]">{reproduce.notes}</p>
      )}
      {reproduce.steps.length > 0 && (
        <CollapsibleSection title="Reproduction Steps">
          <pre className="p-3 text-xs font-mono text-[#c9d1d9] whitespace-pre-wrap">
            {JSON.stringify(reproduce.steps, null, 2)}
          </pre>
        </CollapsibleSection>
      )}
      {reproduce.browser_logs.length > 0 && (
        <CollapsibleSection title="Browser Logs">
          <pre className="p-3 text-xs font-mono text-[#c9d1d9] whitespace-pre-wrap">
            {JSON.stringify(reproduce.browser_logs, null, 2)}
          </pre>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attempts section
// ---------------------------------------------------------------------------

function AttemptsSection({ attempts }: { attempts: Attempt[] }) {
  if (attempts.length === 0) {
    return (
      <p className="text-xs italic text-[#484f58]">No fix attempts yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {attempts.map((attempt) => (
        <div
          key={attempt.n}
          className="rounded-lg border border-[#1e2a3a] overflow-hidden"
        >
          <div className="px-4 py-2.5 bg-[#1c2533] flex items-center gap-2">
            <span className="text-xs font-semibold text-[#c9d1d9]">
              Attempt {attempt.n}
            </span>
            {attempt.validate && (
              <Badge
                label={attempt.validate.fixed ? "Fixed" : "Not fixed"}
                color={attempt.validate.fixed ? "green" : "red"}
              />
            )}
          </div>
          <div className="p-4 space-y-3">
            {/* Fix info */}
            {attempt.fix && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-[#8b949e]">Fix</h4>
                <p className="text-xs text-[#c9d1d9]">
                  {attempt.fix.summary}
                </p>
                {attempt.fix.changed_files.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {attempt.fix.changed_files.map((f) => (
                      <span
                        key={f}
                        className="inline-block rounded bg-[#1c2533] px-2 py-0.5 text-[11px] font-mono text-[#8b949e]"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Validate info */}
            {attempt.validate && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-[#8b949e]">
                  Validation
                </h4>
                <p className="text-xs text-[#c9d1d9]">
                  <span className="font-semibold">Verdict:</span>{" "}
                  {attempt.validate.verdict}
                </p>
                {attempt.validate.verdict_reason && (
                  <p className="text-xs text-[#8b949e]">
                    {attempt.validate.verdict_reason}
                  </p>
                )}
                {attempt.validate.original_error_seen && (
                  <Badge label="Original error seen" color="amber" />
                )}
                {attempt.validate.new_errors.length > 0 && (
                  <CollapsibleSection title="New Errors">
                    <pre className="p-3 text-xs font-mono text-red-400 whitespace-pre-wrap">
                      {JSON.stringify(attempt.validate.new_errors, null, 2)}
                    </pre>
                  </CollapsibleSection>
                )}
                {attempt.validate.notes && (
                  <p className="text-xs text-[#484f58]">
                    {attempt.validate.notes}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main RunContext display
// ---------------------------------------------------------------------------

function RunContextDetail({ data }: { data: RunContext }) {
  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-[#8b949e]">
        <span>
          Run <span className="font-mono text-[#c9d1d9]">{data.runId}</span>
        </span>
        <span>Created {new Date(data.createdAt).toLocaleString()}</span>
        {data.resolvedAtAttempt != null && (
          <Badge label={`Resolved at attempt ${data.resolvedAtAttempt}`} color="green" />
        )}
      </div>

      {/* Progress (always show when running) */}
      {data.progress.phase !== "idle" && (
        <CollapsibleSection title="Progress" defaultOpen={data.status === "in_progress"}>
          <div className="p-4">
            <ProgressSection progress={data.progress} />
          </div>
        </CollapsibleSection>
      )}

      {/* Reproduce */}
      {data.reproduce && (
        <CollapsibleSection title="Reproduction" defaultOpen>
          <div className="p-4">
            <ReproduceSection reproduce={data.reproduce} />
          </div>
        </CollapsibleSection>
      )}

      {/* Attempts */}
      {data.attempts.length > 0 && (
        <CollapsibleSection title="Fix Attempts" defaultOpen>
          <div className="p-4">
            <AttemptsSection attempts={data.attempts} />
          </div>
        </CollapsibleSection>
      )}

      {/* Raw JSON fallback */}
      <CollapsibleSection title="Raw JSON">
        <pre className="p-4 overflow-x-auto text-xs text-[#c9d1d9] font-mono whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      </CollapsibleSection>
    </div>
  );
}

function mapConvexStatus(convexStatus: string): PollStatus {
  if (convexStatus === "fixed") return "completed";
  if (convexStatus === "failed") return "failed";
  return "in_progress";
}

function FixedCodeSection({ error }: { error: ErrorDoc }) {
  const sandbox = useSandbox(error._id);
  const [pollResult, setPollResult] = useState<PollResponse | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const githubToken = useGitHubToken();
  const [prState, setPrState] = useState<{
    loading: boolean;
    prUrl: string | null;
    error: string | null;
  }>({ loading: false, prUrl: null, error: null });

  const sandboxId = sandbox?.sandboxId || "";

  useEffect(() => {
    if (!sandboxId) return;

    async function poll() {
      const result = await pollSandboxStatus(sandboxId);
      setPollResult(result);

      if (result.status === "completed" || result.status === "failed") {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sandboxId]);

  if (sandbox === undefined) {
    return (
      <div className="rounded-lg border border-[#1e2a3a] bg-[#161b22] p-4">
        <div className="flex items-center gap-3 text-sm text-[#484f58]">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#484f58]" />
          Loading...
        </div>
      </div>
    );
  }

  if (sandbox === null) {
    return (
      <div className="rounded-lg border border-[#1e2a3a] bg-[#161b22] p-4">
        <div className="flex items-center gap-3 text-sm text-[#484f58] italic">
          <span className="inline-block h-2 w-2 rounded-full bg-[#484f58]" />
          No sandbox created for this error
        </div>
      </div>
    );
  }

  // Use poll result if available, otherwise fall back to Convex status directly
  // (handles cases where sandboxId is empty, e.g. creation failed)
  const status = pollResult?.status ?? mapConvexStatus(sandbox.status);
  const data = pollResult?.data ?? null;

  return (
    <div className="rounded-lg border border-[#1e2a3a] bg-[#161b22] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2a3a]">
        <div className="flex items-center gap-3">
          {statusBadge(status)}
          {status === "in_progress" && (
            <span className="text-xs text-[#484f58]">
              Sandbox: {sandbox.sandboxId.slice(0, 8)}...
            </span>
          )}
        </div>
        {status === "completed" && !prState.prUrl && !githubToken && (
          <button
            onClick={() => connectGitHub()}
            className="rounded-md bg-[#24292f] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#32383f] transition-colors cursor-pointer"
          >
            Connect GitHub
          </button>
        )}
        {status === "completed" && !prState.prUrl && githubToken && (
          <button
            onClick={async () => {
              setPrState({ loading: true, prUrl: null, error: null });
              const shortId = error._id.slice(-8);
              const result = await createPr({
                token: githubToken,
                config: GITHUB_CONFIG,
                // TODO: files come from poll data once Daytona is wired up
                files: [],
                title: `fix: ${error.message}`,
                body: [
                  `## Error`,
                  `**${error.type}**: ${error.message}`,
                  "",
                  error.stack ? `\`\`\`\n${error.stack}\n\`\`\`` : "",
                  "",
                  `Page: ${error.pageUrl}`,
                ].join("\n"),
                branchName: `exterminator/fix-${shortId}`,
                commitMessage: `fix: ${error.message}`,
              });
              if (result.success && result.prUrl) {
                setPrState({ loading: false, prUrl: result.prUrl, error: null });
              } else {
                setPrState({ loading: false, prUrl: null, error: result.error ?? "Failed to create PR" });
              }
            }}
            disabled={prState.loading}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {prState.loading ? "Creating..." : "Create PR"}
          </button>
        )}
        {prState.prUrl && (
          <a
            href={prState.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-emerald-600/15 border border-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-600/25 transition-colors"
          >
            View PR &rarr;
          </a>
        )}
      </div>
      <div className="p-4">
        {status === "in_progress" && !data && (
          <div className="flex items-center gap-2 text-sm text-[#8b949e]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
            AI agent is analyzing this error...
          </div>
        )}
        {status === "in_progress" && data && (
          <RunContextDetail data={data} />
        )}
        {status === "failed" && !data && (
          <p className="text-sm text-red-400">
            The AI agent was unable to fix this error.
          </p>
        )}
        {status === "failed" && data && (
          <RunContextDetail data={data} />
        )}
        {status === "completed" && data && (
          <RunContextDetail data={data} />
        )}
        {status === "completed" && !data && (
          <p className="text-sm text-emerald-400">
            Fix complete. Result data will appear here once the Daytona
            integration is wired up.
          </p>
        )}
        {prState.error && (
          <p className="mt-2 text-xs text-red-400">{prState.error}</p>
        )}
      </div>
    </div>
  );
}

export function ErrorDetail({
  error,
  onDelete,
}: {
  error: ErrorDoc;
  onDelete?: () => void;
}) {
  const deleteError = useDeleteError();
  const source = error.filename
    ? `${error.filename}`
    : (error.stack?.split("\n")[1]?.trim()?.match(/\((.*?)\)/)?.[1] ?? "unknown");

  const location =
    error.lineno != null
      ? `Line ${error.lineno}${error.colno != null ? `, Col ${error.colno}` : ""}`
      : "—";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge
              label={error.type === "error" ? "Error" : "Rejection"}
              color={error.type === "error" ? "red" : "amber"}
            />
            <span className="text-xs text-[#484f58]">
              {formatDate(error.timestamp)}
            </span>
          </div>
          <button
            onClick={async () => {
              await deleteError({ id: error._id });
              onDelete?.();
            }}
            className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
          >
            Delete
          </button>
        </div>
        <h1 className="text-lg font-semibold text-[#e6edf3] leading-snug">
          {error.message}
        </h1>
      </div>

      {/* Fixed Code */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
          Fixed Code
        </h2>
        <FixedCodeSection error={error} />
      </section>

      {/* Error Info */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
          Error Info
        </h2>
        <dl className="rounded-lg border border-[#1e2a3a] bg-[#161b22] overflow-hidden">
          <InfoRow label="URL" value={error.pageUrl} />
          <InfoRow label="Source" value={source} />
          <InfoRow label="Location" value={location} />
          <InfoRow label="User Agent" value={error.userAgent} />
        </dl>
      </section>

      {/* Stack Trace */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
          Stack Trace
        </h2>
        <div className="rounded-lg border border-[#1e2a3a] overflow-hidden">
          <StackTrace stack={error.stack} />
        </div>
      </section>
    </div>
  );
}
