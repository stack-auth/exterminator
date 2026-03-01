"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { ErrorEvent } from "@/lib/daytona";

export type SandboxId = Id<"sandboxes">;

export type PollStatus = "in_progress" | "completed" | "failed";

export interface PollResponse {
  status: PollStatus;
  data: Record<string, unknown> | null;
}

export function useSandbox(errorId: Id<"errors">) {
  return useQuery(api.sandboxes.getByErrorId, { errorId });
}

export async function startSandbox(
  errorId: string,
  error: ErrorEvent,
): Promise<{ sandboxId: string } | null> {
  try {
    const res = await fetch("/api/sandbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ errorId, error }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.sandboxId ? { sandboxId: data.sandboxId } : null;
  } catch {
    return null;
  }
}

export async function pollSandboxStatus(
  sandboxId: string,
): Promise<PollResponse> {
  const res = await fetch(`/api/sandbox/${encodeURIComponent(sandboxId)}`);
  if (!res.ok) {
    return { status: "failed", data: null };
  }
  return res.json();
}
