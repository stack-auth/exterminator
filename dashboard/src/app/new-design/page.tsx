"use client";

import Link from "next/link";
import { useErrors } from "@/sdk/errors";

function formatRelativeTime(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function extractSource(error: {
  filename?: string;
  stack?: string;
}): string {
  if (error.filename) return error.filename.split("/").pop() ?? error.filename;
  const match = error.stack?.split("\n")[1]?.trim()?.match(/\((.*?)\)/);
  return match?.[1]?.split("/").pop() ?? "";
}

function Badge({
  label,
  color,
}: {
  label: string;
  color: "red" | "orange" | "green" | "blue";
}) {
  const styles: Record<string, string> = {
    red: "bg-red-500/15 text-red-400 ring-red-500/20",
    orange: "bg-orange-500/15 text-orange-400 ring-orange-500/20",
    green: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/20",
    blue: "bg-blue-500/15 text-blue-400 ring-blue-500/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${styles[color]}`}
    >
      {label}
    </span>
  );
}

function SpaceDebris() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
      {/* Error badge - drifting top-left */}
      <div className="absolute left-[6%] top-[15%] rotate-[-12deg] rounded-md bg-red-500/10 px-2.5 py-1 ring-1 ring-red-500/15 shadow-[0_0_20px_rgba(239,68,68,0.08)]">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-red-400/50">Error</span>
      </div>

      {/* Console window - top right */}
      <div className="absolute right-[5%] top-[12%] hidden rotate-[10deg] rounded-xl bg-white/[0.025] p-3 ring-1 ring-white/[0.06] shadow-[0_0_30px_rgba(100,150,255,0.04)] md:block">
        <div className="mb-2 flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-red-500/30 ring-1 ring-red-500/20" />
          <div className="h-2 w-2 rounded-full bg-amber-500/25 ring-1 ring-amber-500/15" />
          <div className="h-2 w-2 rounded-full bg-emerald-500/25 ring-1 ring-emerald-500/15" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold text-red-400/40">✕</span>
            <div className="h-1 w-16 rounded-full bg-red-500/12" />
          </div>
          <div className="ml-3 h-1 w-12 rounded-full bg-white/[0.04]" />
          <div className="ml-3 h-1 w-10 rounded-full bg-white/[0.03]" />
        </div>
      </div>

      {/* Code bracket - top area */}
      <div className="absolute left-[22%] top-[7%] hidden rounded-md bg-white/[0.025] px-1.5 py-0.5 ring-1 ring-white/[0.04] opacity-50 md:block">
        <span className="font-mono text-[9px] text-[#484f58]/70">{"{ }"}</span>
      </div>

      {/* Stack frame - left */}
      <div className="absolute left-[3%] top-[35%] hidden rotate-[-6deg] rounded-xl bg-white/[0.02] p-2.5 ring-1 ring-white/[0.04] opacity-40 lg:block">
        <div className="space-y-1 font-mono text-[8px] text-[#8b949e]/40">
          <div>at render <span className="text-[#484f58]/50">(app.js:42)</span></div>
          <div>at update <span className="text-[#484f58]/50">(core.js:18)</span></div>
        </div>
      </div>

      {/* Rejection badge - right */}
      <div className="absolute right-[6%] top-[38%] hidden rotate-[6deg] rounded-md bg-orange-500/10 px-2.5 py-1 ring-1 ring-orange-500/15 shadow-[0_0_15px_rgba(249,115,22,0.06)] md:block">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-400/50">Rejection</span>
      </div>

      {/* Warning triangle - left */}
      <div className="absolute left-[5%] top-[55%] flex h-9 w-9 rotate-[10deg] items-center justify-center rounded-lg bg-amber-500/8 ring-1 ring-amber-500/12 opacity-40 md:h-10 md:w-10">
        <span className="text-sm text-amber-500/35">⚠</span>
      </div>

      {/* Bug icon - right */}
      <div className="absolute right-[4%] top-[52%] flex h-10 w-10 rotate-[-8deg] items-center justify-center rounded-full bg-white/[0.025] ring-1 ring-white/[0.05] opacity-40 md:h-11 md:w-11">
        <span className="text-base opacity-60">🪲</span>
      </div>

      {/* Mini terminal - lower left */}
      <div className="absolute bottom-[28%] left-[4%] hidden rotate-[-10deg] rounded-xl bg-white/[0.025] p-2 ring-1 ring-white/[0.05] opacity-35 md:block">
        <div className="mb-1 flex gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-white/[0.08]" />
          <div className="h-1.5 w-1.5 rounded-full bg-white/[0.08]" />
          <div className="h-1.5 w-1.5 rounded-full bg-white/[0.08]" />
        </div>
        <div className="space-y-1">
          <div className="h-1 w-14 rounded-full bg-white/[0.04]" />
          <div className="h-1 w-10 rounded-full bg-white/[0.03]" />
        </div>
      </div>

      {/* TypeError - lower right */}
      <div className="absolute bottom-[25%] right-[5%] hidden rotate-[-4deg] rounded-lg bg-white/[0.02] px-3 py-1.5 ring-1 ring-white/[0.04] opacity-35 lg:block">
        <span className="font-mono text-[9px] text-red-400/35">TypeError: undefined</span>
      </div>

      {/* Error badge - bottom */}
      <div className="absolute bottom-[10%] right-[15%] hidden rotate-[10deg] rounded-md bg-red-500/8 px-2 py-0.5 ring-1 ring-red-500/12 opacity-30 md:block">
        <span className="text-[9px] font-semibold uppercase tracking-wide text-red-400/35">Error</span>
      </div>

      {/* Code bracket - bottom left */}
      <div className="absolute bottom-[12%] left-[10%] hidden rotate-[-8deg] rounded-md bg-white/[0.02] px-1.5 py-0.5 ring-1 ring-white/[0.04] opacity-25 md:block">
        <span className="font-mono text-[9px] text-[#484f58]/50">{"try { }"}</span>
      </div>

      {/* Stack frame - bottom right */}
      <div className="absolute bottom-[18%] right-[12%] hidden rotate-[5deg] rounded-xl bg-white/[0.02] p-2 ring-1 ring-white/[0.04] opacity-25 lg:block">
        <div className="font-mono text-[8px] text-[#8b949e]/35">
          at onClick <span className="text-[#484f58]/40">(btn.tsx:7)</span>
        </div>
      </div>

      {/* Console - bottom area */}
      <div className="absolute bottom-[5%] left-[30%] hidden rotate-[-5deg] rounded-xl bg-white/[0.02] p-2.5 ring-1 ring-white/[0.04] opacity-20 lg:block">
        <div className="mb-1.5 flex gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-white/[0.08]" />
          <div className="h-1.5 w-1.5 rounded-full bg-white/[0.08]" />
          <div className="h-1.5 w-1.5 rounded-full bg-white/[0.08]" />
        </div>
        <div className="space-y-1">
          <div className="h-1 w-10 rounded-full bg-red-500/10" />
          <div className="ml-2 h-1 w-8 rounded-full bg-white/[0.03]" />
        </div>
      </div>

      {/* Bug - bottom */}
      <div className="absolute bottom-[7%] right-[40%] flex h-8 w-8 rotate-[15deg] items-center justify-center rounded-full bg-white/[0.02] ring-1 ring-white/[0.04] opacity-25">
        <span className="text-xs opacity-50">🪲</span>
      </div>

      {/* Warning - bottom right */}
      <div className="absolute bottom-[16%] right-[32%] hidden h-7 w-7 rotate-[-12deg] items-center justify-center rounded-md bg-amber-500/6 ring-1 ring-amber-500/10 opacity-25 lg:flex">
        <span className="text-[10px] text-amber-500/30">⚠</span>
      </div>
    </div>
  );
}

function GetStartedSection() {
  return (
    <div className="mt-8 flex min-h-[50vh] items-center justify-center">
      <div className="relative z-10 text-center">
        <h2 className="mb-2 text-xl font-semibold tracking-tight text-[#e6edf3] sm:text-2xl">
          No events yet
        </h2>
        <p className="mb-5 text-sm text-[#8b949e]">
          Add the Exterminator script to your site to start capturing errors
          automatically.
        </p>

        <pre className="mx-auto mb-4 max-w-md overflow-x-auto rounded-xl bg-white/[0.04] p-4 text-left text-[13px] leading-relaxed font-mono text-[#c9d1d9] ring-1 ring-white/[0.06]">
{`<script src="http://localhost:3002/exterminator.js"
  data-endpoint="http://localhost:3002/api/events">
</script>`}
        </pre>

        <p className="text-xs text-[#484f58]">
          Add to your <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[#8b949e]">&lt;head&gt;</code>
        </p>
      </div>
    </div>
  );
}

function ErrorRow({
  error,
}: {
  error: {
    _id: string;
    type: string;
    message: string;
    timestamp: number;
    pageUrl: string;
    filename?: string;
    stack?: string;
    lineno?: number;
    colno?: number;
  };
}) {
  const source = extractSource(error);
  const time = formatRelativeTime(error.timestamp);
  const isRejection = error.type === "unhandledrejection";

  return (
    <Link href={`/new-design/${error._id}`} className="group block">
      <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-4 py-3 transition-colors duration-150 hover:bg-white/[0.03] hover:transition-none">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <Badge
              label={isRejection ? "Rejection" : "Error"}
              color={isRejection ? "orange" : "red"}
            />
            {source && (
              <span className="truncate text-xs font-mono text-[#484f58]">
                {source}
                {error.lineno != null && `:${error.lineno}`}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-[#e6edf3] leading-snug">
            {error.message}
          </p>
          <p className="mt-1 truncate text-xs text-[#484f58]">
            {error.pageUrl}
          </p>
        </div>
        <span className="shrink-0 pt-1 text-xs tabular-nums text-[#484f58]">
          {time}
        </span>
      </div>
    </Link>
  );
}

export default function NewDesignHome() {
  const errors = useErrors();

  return (
    <div className="min-h-screen px-6 pb-16 pt-10">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <header className="mb-10 pt-6 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-[#e6edf3] sm:text-5xl">
            🪲{" "}
            <span
              className="uppercase"
              style={{
                fontFamily: "var(--font-display), sans-serif",
                fontWeight: 500,
                letterSpacing: "0.06em",
                textShadow: "0 0 40px rgba(96, 165, 250, 0.15), 0 0 80px rgba(96, 165, 250, 0.06)",
              }}
            >
              Exterminator
            </span>
          </h1>
          {errors && errors.length > 0 && (
            <p className="mt-3 text-sm text-[#8b949e]">
              {errors.length} error{errors.length !== 1 ? "s" : ""} captured
            </p>
          )}
        </header>

        <SpaceDebris />

        {/* Content */}
        {errors === undefined ? (
          <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/[0.06] backdrop-blur-xl">
            <p className="text-sm text-[#484f58]">Loading&hellip;</p>
          </div>
        ) : errors.length === 0 ? (
          <GetStartedSection />
        ) : (
          <div
            className="overflow-hidden rounded-2xl backdrop-blur-xl"
            style={{
              background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 4px 30px rgba(0,0,0,0.3), 0 0 60px rgba(96,165,250,0.03)",
            }}
          >
            <div
              className="flex items-center gap-3 px-5 py-3"
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "linear-gradient(90deg, rgba(96,165,250,0.06) 0%, transparent 60%)",
              }}
            >
              <div className="h-2 w-2 rounded-full bg-blue-400/50 shadow-[0_0_8px_rgba(96,165,250,0.4)]" />
              <p
                className="text-xs font-semibold uppercase"
                style={{
                  fontFamily: "var(--font-display), sans-serif",
                  letterSpacing: "0.1em",
                  color: "#8b949e",
                }}
              >
                Captured Errors
              </p>
              <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium tabular-nums text-[#8b949e] ring-1 ring-white/[0.06]">
                {errors.length}
              </span>
            </div>
            {errors.map((error) => (
              <ErrorRow key={error._id} error={error} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
