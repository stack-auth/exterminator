import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import {
  createSandboxForError,
  runPipeline,
  type ErrorEvent,
} from "@/lib/daytona";
import type { Id } from "../../../../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  const { errorId, error } = (await request.json()) as {
    errorId: string;
    error: ErrorEvent;
  };

  if (!errorId || !error) {
    return Response.json(
      { error: "errorId and error are required" },
      { status: 400 },
    );
  }

  const typedErrorId = errorId as Id<"errors">;

  try {
    const { sandbox, sandboxId, runId } = await createSandboxForError(error);

    const docId = await convex.mutation(api.sandboxes.create, {
      errorId: typedErrorId,
      sandboxId,
      runId,
      status: "creating",
    });

    runPipeline(sandbox, runId, (status) => {
      convex
        .mutation(api.sandboxes.updateStatus, { id: docId, status })
        .catch((err) => console.error(`[sandbox] Status update failed:`, err));
    }).catch((err) => {
      console.error(`[sandbox] Pipeline failed for run ${runId}:`, err);
      convex
        .mutation(api.sandboxes.updateStatus, { id: docId, status: "failed" })
        .catch(() => {});
    });

    return Response.json({ sandboxId });
  } catch (e) {
    console.error("[sandbox] Creation failed:", e);

    await convex.mutation(api.sandboxes.create, {
      errorId: typedErrorId,
      sandboxId: "",
      runId: "",
      status: "failed",
    }).catch(() => {});

    return Response.json({ sandboxId: null }, { status: 500 });
  }
}
