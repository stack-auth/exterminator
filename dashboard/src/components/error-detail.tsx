"use client";

import { useEffect, useRef, useState } from "react";
import type { Doc } from "../../../convex/_generated/dataModel";
import {
  useSandbox,
  pollSandboxStatus,
  type PollStatus,
  type PollResponse,
} from "@/sdk/sandbox";
import { useGitHubToken, connectGitHub } from "@/sdk/github-token";
import { createPr } from "@/sdk/pr";
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
        {status === "in_progress" && (
          <div className="flex items-center gap-2 text-sm text-[#8b949e]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
            AI agent is analyzing this error...
          </div>
        )}
        {status === "failed" && (
          <p className="text-sm text-red-400">
            The AI agent was unable to fix this error.
          </p>
        )}
        {status === "completed" && data && (
          <pre className="overflow-x-auto text-xs text-[#c9d1d9] font-mono whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
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

export function ErrorDetail({ error }: { error: ErrorDoc }) {
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
        <div className="flex items-center gap-2 mb-3">
          <Badge
            label={error.type === "error" ? "Error" : "Rejection"}
            color={error.type === "error" ? "red" : "amber"}
          />
          <span className="text-xs text-[#484f58]">
            {formatDate(error.timestamp)}
          </span>
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
