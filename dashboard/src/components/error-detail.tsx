"use client";

import type { Doc } from "../../../convex/_generated/dataModel";

type ErrorDoc = Doc<"errors">;

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  }) + ", " + d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
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

export function ErrorDetail({ error }: { error: ErrorDoc }) {
  const source = error.filename
    ? `${error.filename}`
    : error.stack?.split("\n")[1]?.trim()?.match(/\((.*?)\)/)?.[1] ?? "unknown";

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

      {/* Live Progress (dummy) */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
          Live Progress
        </h2>
        <div className="rounded-lg border border-[#1e2a3a] bg-[#161b22] p-4">
          <div className="flex items-center gap-3 text-sm text-[#484f58] italic">
            <span className="inline-block h-2 w-2 rounded-full bg-[#484f58]" />
            Awaiting AI analysis...
          </div>
        </div>
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
