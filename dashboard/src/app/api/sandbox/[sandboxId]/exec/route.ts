import { Daytona } from "@daytonaio/sdk";
import { NextRequest, NextResponse } from "next/server";

let _client: Daytona | null = null;
function getDaytonaClient(): Daytona {
  if (!_client) _client = new Daytona();
  return _client;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> },
) {
  const { sandboxId } = await params;
  const { command, cwd } = await req.json() as { command: string; cwd?: string };

  try {
    const daytona = getDaytonaClient();
    const sandbox = await daytona.get(sandboxId);
    const result = await sandbox.process.executeCommand(
      command,
      cwd ?? "/app",
      {},
      30,
    );
    return NextResponse.json({
      exitCode: result.exitCode,
      output: result.result ?? "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
