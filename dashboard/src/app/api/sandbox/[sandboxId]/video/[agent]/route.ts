import { Daytona } from "@daytonaio/sdk";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../../convex/_generated/api";
import { NextRequest, NextResponse } from "next/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

let _client: Daytona | null = null;
function getDaytonaClient(): Daytona {
  if (!_client) _client = new Daytona();
  return _client;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sandboxId: string; agent: string }> },
) {
  const { sandboxId, agent } = await params;

  if (agent !== "reproduce" && agent !== "validate") {
    return NextResponse.json({ error: "agent must be reproduce or validate" }, { status: 400 });
  }

  try {
    const sbRecord = await convex.query(api.sandboxes.getBySandboxId, { sandboxId });
    if (!sbRecord) {
      return NextResponse.json({ error: "sandbox record not found" }, { status: 404 });
    }

    const daytona = getDaytonaClient();
    const sandbox = await daytona.get(sandboxId);
    const signed = await sandbox.getSignedPreviewUrl(4000, 3600);

    // Proxy from the agent's video API via the signed preview URL
    const videoUrl = `${signed.url}/api/runs/${sbRecord.runId}/videos/${agent}`;
    const resp = await fetch(videoUrl);

    if (!resp.ok) {
      return NextResponse.json({ error: "video not found" }, { status: 404 });
    }

    const videoBuffer = await resp.arrayBuffer();

    // Videos < 1KB are empty containers (Playwright recording failed)
    if (videoBuffer.byteLength < 1024) {
      return NextResponse.json({ error: "video recording is empty" }, { status: 404 });
    }

    return new NextResponse(videoBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": videoBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
