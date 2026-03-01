import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export type PollStatus = "in_progress" | "completed" | "failed";

export interface PollResponse {
  status: PollStatus;
  data: Record<string, unknown> | null;
}

function mapStatus(
  convexStatus: string,
): PollStatus {
  switch (convexStatus) {
    case "fixed":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "in_progress";
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sandboxId: string }> },
) {
  const { sandboxId } = await params;

  if (!sandboxId) {
    return Response.json(
      { error: "sandboxId is required" },
      { status: 400 },
    );
  }

  try {
    const sandbox = await convex.query(api.sandboxes.getBySandboxId, {
      sandboxId,
    });

    if (!sandbox) {
      return Response.json(
        { error: "sandbox not found" },
        { status: 404 },
      );
    }

    const status = mapStatus(sandbox.status);

    // TODO (Daytona integration):
    //
    // Right now we only read the coarse status from Convex. Once the Daytona
    // snapshot is ready, this route should talk to the agent API *inside* the
    // sandbox to get the full RunContext:
    //
    //   1. Use the Daytona SDK to get a handle on the sandbox by `sandboxId`.
    //   2. Call the agent's HTTP API:
    //        GET http://<sandbox>:4000/api/runs/{sandbox.runId}
    //      (see ai/API_DOCS.md for the full RunContext schema)
    //   3. Map the RunContext.status → PollStatus:
    //        "in_progress" → "in_progress"
    //        "fixed"       → "completed"
    //        "failed"      → "failed"
    //   4. Return the full RunContext as `data` (especially when completed):
    //        - data.attempts[resolvedAtAttempt-1].fix.summary  → fix description
    //        - data.attempts[resolvedAtAttempt-1].fix.changed_files → files for PR
    //        - data.progress.log → timeline for the UI
    //
    // The `sandbox.runId` is already stored in Convex from when the sandbox
    // was created (see /api/sandbox/route.ts → sandboxes.create).
    const data: Record<string, unknown> | null = null;

    const response: PollResponse = { status, data };
    return Response.json(response);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
