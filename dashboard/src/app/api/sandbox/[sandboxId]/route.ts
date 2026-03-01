import { Daytona } from "@daytonaio/sdk";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Singleton Daytona client
let _daytona: Daytona | null = null;
function getDaytona(): Daytona {
  if (!_daytona) _daytona = new Daytona();
  return _daytona;
}

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

    // Read the full RunContext from the Daytona sandbox filesystem
    let data: Record<string, unknown> | null = null;
    try {
      const daytona = getDaytona();
      const handle = await daytona.get(sandboxId);
      let buf: Buffer;
      try {
        buf = await handle.fs.downloadFile(`/app/runner/runs/${sandbox.runId}/run.json`);
      } catch {
        // Fallback to flat file
        buf = await handle.fs.downloadFile(`/app/runner/runs/${sandbox.runId}.json`);
      }
      data = JSON.parse(buf.toString()) as Record<string, unknown>;
    } catch (e) {
      // Sandbox may be stopped/archived — fall back to status-only response
      console.warn(`[poll] Could not read RunContext from sandbox ${sandboxId}:`, e);
    }

    const response: PollResponse = { status, data };
    return Response.json(response);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
