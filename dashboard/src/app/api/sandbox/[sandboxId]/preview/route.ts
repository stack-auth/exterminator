import { Daytona } from "@daytonaio/sdk";
import { NextRequest, NextResponse } from "next/server";

let _client: Daytona | null = null;
function getDaytonaClient(): Daytona {
  if (!_client) _client = new Daytona();
  return _client;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> },
) {
  const { sandboxId } = await params;
  const port = Number(req.nextUrl.searchParams.get("port") ?? "3000");

  try {
    const daytona = getDaytonaClient();
    const sandbox = await daytona.get(sandboxId);
    const signed = await sandbox.getSignedPreviewUrl(port, 3600);
    return NextResponse.json({ url: signed.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
