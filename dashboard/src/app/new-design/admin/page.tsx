"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

interface SandboxInfo {
  id: string;
  state: string;
  cpu: number;
  memory: number;
  disk: number;
  snapshot: string;
  createdAt: string;
  updatedAt: string;
  autoStopInterval: number | null;
}

const stateColors: Record<string, string> = {
  started: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/20",
  stopped: "bg-white/[0.06] text-[#8b949e] ring-white/[0.08]",
  archived: "bg-purple-500/15 text-purple-400 ring-purple-500/20",
  error: "bg-red-500/15 text-red-400 ring-red-500/20",
  creating: "bg-blue-500/15 text-blue-400 ring-blue-500/20",
  starting: "bg-blue-500/15 text-blue-400 ring-blue-500/20",
  stopping: "bg-orange-500/15 text-orange-400 ring-orange-500/20",
  unknown: "bg-white/[0.06] text-[#484f58] ring-white/[0.06]",
};

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const glassStyle = {
  background: "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
  boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 4px 24px rgba(0,0,0,0.25)",
};

export default function AdminPage() {
  const [sandboxes, setSandboxes] = useState<SandboxInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSandboxes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sandboxes");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSandboxes(data.sandboxes);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const act = useCallback(async (action: string, sandboxId?: string) => {
    setActing(action + (sandboxId ?? ""));
    setError(null);
    try {
      const res = await fetch("/api/admin/sandboxes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, sandboxId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await fetchSandboxes();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActing(null);
    }
  }, [fetchSandboxes]);

  return (
    <div className="min-h-screen px-6 pb-16 pt-8">
      <div className="mx-auto max-w-3xl">
        {/* Nav */}
        <nav className="mb-5">
          <Link
            href="/new-design"
            className="text-sm font-medium text-[#8b949e] transition-colors duration-150 hover:text-[#e6edf3] hover:transition-none"
          >
            &larr; Back to dashboard
          </Link>
        </nav>

        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-[#e6edf3]">
            Daytona Sandboxes
          </h1>
          <button
            onClick={fetchSandboxes}
            disabled={loading}
            className="cursor-pointer rounded-xl bg-blue-500/15 px-3 py-1.5 text-xs font-medium text-blue-400 ring-1 ring-blue-500/20 transition-colors duration-150 hover:bg-blue-500/25 hover:transition-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Loading…" : sandboxes === null ? "Load sandboxes" : "Refresh"}
          </button>
        </header>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-xs text-red-400 ring-1 ring-red-500/20">
            {error}
          </div>
        )}

        {/* Content */}
        {sandboxes === null && !loading && (
          <div className="overflow-hidden rounded-2xl backdrop-blur-xl" style={glassStyle}>
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-[#484f58]">
                Click &quot;Load sandboxes&quot; to fetch all active Daytona instances
              </p>
            </div>
          </div>
        )}

        {sandboxes !== null && (
          <>
            {/* Bulk actions */}
            <div className="mb-4 flex items-center gap-3">
              <p className="text-xs text-[#8b949e]">
                {sandboxes.length} sandbox{sandboxes.length !== 1 ? "es" : ""}
              </p>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => act("archive-all")}
                  disabled={acting !== null || sandboxes.length === 0}
                  className="cursor-pointer rounded-xl bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-400 ring-1 ring-purple-500/20 transition-colors duration-150 hover:bg-purple-500/20 hover:transition-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {acting === "archive-all" ? "Archiving…" : "Archive all"}
                </button>
                <button
                  onClick={() => act("delete-all")}
                  disabled={acting !== null || sandboxes.length === 0}
                  className="cursor-pointer rounded-xl bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 ring-1 ring-red-500/20 transition-colors duration-150 hover:bg-red-500/20 hover:transition-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {acting === "delete-all" ? "Deleting…" : "Delete all"}
                </button>
              </div>
            </div>

            {/* List */}
            {sandboxes.length === 0 ? (
              <div className="overflow-hidden rounded-2xl backdrop-blur-xl" style={glassStyle}>
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-[#484f58]">No sandboxes found</p>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl backdrop-blur-xl" style={glassStyle}>
                {sandboxes.map((s, i) => (
                  <div
                    key={s.id}
                    className="px-4 py-3"
                    style={{
                      borderBottom: i < sandboxes.length - 1 ? "1px solid rgba(255,255,255,0.06)" : undefined,
                    }}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${stateColors[s.state] ?? stateColors.unknown}`}
                      >
                        {s.state}
                      </span>
                      <span className="font-mono text-xs text-[#c9d1d9]">
                        {s.id.slice(0, 12)}…
                      </span>
                      <span className="ml-auto text-[10px] text-[#484f58]">
                        {formatDate(s.createdAt)}
                      </span>
                    </div>
                    <div className="mb-2 flex items-center gap-4 text-[11px] text-[#8b949e]">
                      <span>{s.cpu} CPU</span>
                      <span>{s.memory} GiB RAM</span>
                      <span>{s.disk} GiB Disk</span>
                      {s.snapshot && (
                        <span className="font-mono text-[10px] text-[#484f58]">{s.snapshot}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => act("archive", s.id)}
                        disabled={acting !== null || s.state === "archived"}
                        className="cursor-pointer rounded-lg bg-purple-500/10 px-2.5 py-1 text-[11px] font-medium text-purple-400 ring-1 ring-purple-500/20 transition-colors duration-150 hover:bg-purple-500/20 hover:transition-none disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {acting === "archive" + s.id ? "…" : "Archive"}
                      </button>
                      <button
                        onClick={() => act("delete", s.id)}
                        disabled={acting !== null}
                        className="cursor-pointer rounded-lg bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-400 ring-1 ring-red-500/20 transition-colors duration-150 hover:bg-red-500/20 hover:transition-none disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {acting === "delete" + s.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
