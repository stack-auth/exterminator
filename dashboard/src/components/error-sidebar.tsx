"use client";

import type { ErrorId } from "@/sdk/errors";
import type { Doc } from "../../../convex/_generated/dataModel";

type ErrorDoc = Doc<"errors">;

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function extractSource(err: ErrorDoc): string {
  if (err.filename) {
    try {
      const url = new URL(err.filename);
      return url.pathname;
    } catch {
      return err.filename;
    }
  }
  const frame = err.stack?.split("\n")[1];
  if (!frame) return "";
  const match = frame.match(/(?:at\s+)?(?:.*?\()?(https?:\/\/[^)]+)/);
  if (match) {
    try {
      const url = new URL(match[1]);
      return url.pathname;
    } catch {
      return match[1];
    }
  }
  return "";
}

function errorLabel(type: string): string {
  if (type === "unhandledrejection") return "Rejection";
  return "Error";
}

export function ErrorSidebar({
  errors,
  selectedId,
  onSelect,
}: {
  errors: ErrorDoc[] | undefined;
  selectedId: ErrorId | null;
  onSelect: (id: ErrorId) => void;
}) {
  if (errors === undefined) {
    return (
      <aside className="w-[360px] shrink-0 overflow-y-auto border-r border-[#1e2a3a] bg-[#0d1117]">
        <div className="flex items-center justify-center py-16 text-sm text-[#484f58]">
          Loading...
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[360px] shrink-0 overflow-y-auto bg-[#0d1117]">
      {errors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-sm text-[#484f58]">
          <p>No errors yet</p>
        </div>
      ) : (
        <ul>
          {errors.map((err) => {
            const isSelected = err._id === selectedId;
            return (
              <li key={err._id}>
                <button
                  onClick={() => onSelect(err._id)}
                  className={`w-full text-left px-4 py-3 border-b border-[#1e2a3a] transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#161b22]"
                      : "hover:bg-[#161b22]/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            err.type === "error"
                              ? "bg-red-500/15 text-red-400"
                              : "bg-amber-500/15 text-amber-400"
                          }`}
                        >
                          {errorLabel(err.type)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-[#e6edf3] truncate leading-snug">
                        {err.message}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-xs text-[#484f58]">
                        {extractSource(err)}
                      </p>
                    </div>
                    <span className="shrink-0 pt-1 text-[11px] text-[#484f58]">
                      {timeAgo(err.timestamp)}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
