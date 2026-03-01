"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useError, useDeleteError, type ErrorId } from "@/sdk/errors";

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

function Badge({
  label,
  color,
}: {
  label: string;
  color: "red" | "orange";
}) {
  const styles: Record<string, string> = {
    red: "bg-red-500/15 text-red-400 ring-red-500/20",
    orange: "bg-orange-500/15 text-orange-400 ring-orange-500/20",
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

export default function ErrorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const error = useError(id as ErrorId);
  const deleteError = useDeleteError();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

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
          <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/[0.06] backdrop-blur-xl">
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
        </nav>

        {/* Two-column layout */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Left column — main content */}
          <div className="flex flex-col gap-4">
            {/* Header card */}
            <div
              className="overflow-hidden rounded-2xl backdrop-blur-xl"
              style={{
                background: "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 4px 24px rgba(0,0,0,0.25), 0 0 50px rgba(96,165,250,0.03)",
              }}
            >
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

              {/* Inline meta — 2x2 grid */}
              <div className="grid grid-cols-2 gap-px" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="bg-[#0d1117] px-5 py-3">
                  <MetaItem label="Source" value={source} />
                </div>
                <div className="bg-[#0d1117] px-5 py-3">
                  <MetaItem label="Location" value={location} />
                </div>
              </div>
            </div>

            {/* Stack Trace */}
            <div
              className="overflow-hidden rounded-2xl backdrop-blur-xl"
              style={{
                background: "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 4px 24px rgba(0,0,0,0.25)",
              }}
            >
              <div
                className="flex items-center gap-3 px-5 py-2.5"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="h-2 w-2 rounded-full bg-[#8b949e]/40 shadow-[0_0_6px_rgba(139,148,158,0.2)]" />
                <p
                  className="text-xs font-semibold uppercase"
                  style={{
                    fontFamily: "var(--font-display), sans-serif",
                    letterSpacing: "0.1em",
                    color: "#8b949e",
                  }}
                >
                  Stack Trace
                </p>
              </div>
              <StackTrace stack={error.stack} />
            </div>
          </div>

          {/* Right column — sidebar info */}
          <div className="flex flex-col gap-4">
            {/* Page URL */}
            <div
              className="overflow-hidden rounded-2xl backdrop-blur-xl"
              style={{
                background: "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 4px 24px rgba(0,0,0,0.25)",
              }}
            >
              <div
                className="flex items-center gap-3 px-4 py-2.5"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="h-2 w-2 rounded-full bg-blue-400/40 shadow-[0_0_6px_rgba(96,165,250,0.2)]" />
                <p
                  className="text-xs font-semibold uppercase"
                  style={{
                    fontFamily: "var(--font-display), sans-serif",
                    letterSpacing: "0.1em",
                    color: "#8b949e",
                  }}
                >
                  Page
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="break-all font-mono text-xs leading-relaxed text-[#c9d1d9]">
                  {error.pageUrl}
                </p>
              </div>
            </div>

            {/* User Agent */}
            <div
              className="overflow-hidden rounded-2xl backdrop-blur-xl"
              style={{
                background: "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 4px 24px rgba(0,0,0,0.25)",
              }}
            >
              <div
                className="flex items-center gap-3 px-4 py-2.5"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="h-2 w-2 rounded-full bg-purple-400/40 shadow-[0_0_6px_rgba(167,139,250,0.2)]" />
                <p
                  className="text-xs font-semibold uppercase"
                  style={{
                    fontFamily: "var(--font-display), sans-serif",
                    letterSpacing: "0.1em",
                    color: "#8b949e",
                  }}
                >
                  Environment
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="break-all font-mono text-[11px] leading-relaxed text-[#8b949e]">
                  {error.userAgent}
                </p>
              </div>
            </div>

            {/* Error ID */}
            <div
              className="overflow-hidden rounded-2xl backdrop-blur-xl"
              style={{
                background: "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 4px 24px rgba(0,0,0,0.25)",
              }}
            >
              <div className="px-4 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#484f58]">
                  ID
                </span>
                <p className="mt-0.5 font-mono text-[11px] text-[#6e7681]">
                  {error._id}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
