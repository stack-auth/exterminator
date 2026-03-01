"use client";

import { useState } from "react";
import { useErrors, type ErrorId } from "@/sdk/errors";
import { ErrorSidebar } from "@/components/error-sidebar";
import { ErrorDetail } from "@/components/error-detail";

export default function Home() {
  const errors = useErrors();
  const [selectedId, setSelectedId] = useState<ErrorId | null>(null);

  const selectedError = errors?.find((e) => e._id === selectedId) ?? null;

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-[#1e2a3a] bg-[#0d1117] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a73e8] text-sm font-bold text-white">
            E
          </span>
          <span className="text-base font-semibold text-[#e6edf3]">
            Exterminator
          </span>
        </div>
        {errors && (
          <span className="rounded-full bg-[#1c2533] px-2.5 py-0.5 text-xs font-medium text-[#8b949e]">
            {errors.length} error{errors.length !== 1 ? "s" : ""}
          </span>
        )}
      </header>

      {/* Split panel */}
      <div className="flex min-h-0 flex-1">
        <ErrorSidebar
          errors={errors}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <main className="flex-1 overflow-y-auto border-l border-[#1e2a3a] bg-[#0d1117]">
          {selectedError ? (
            <ErrorDetail
              error={selectedError}
              onDelete={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[#484f58]">
              {errors?.length
                ? "Select an error to view details"
                : "No errors captured yet"}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
