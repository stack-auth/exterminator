"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { ErrorEvent } from "@/lib/daytona";

export type SandboxId = Id<"sandboxes">;

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
