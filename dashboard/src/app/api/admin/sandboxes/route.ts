import { Daytona } from "@daytonaio/sdk";
import { NextResponse } from "next/server";

let _client: Daytona | null = null;
function getDaytonaClient(): Daytona {
  if (!_client) _client = new Daytona();
  return _client;
}

export async function GET() {
  try {
    const daytona = getDaytonaClient();
    const sandboxes = await daytona.list();

    const items = sandboxes.items.map((s) => ({
      id: s.id,
      state: s.state ?? "unknown",
      cpu: s.cpu,
      memory: s.memory,
      disk: s.disk,
      snapshot: s.snapshot ?? "",
      createdAt: s.createdAt ?? "",
      updatedAt: s.updatedAt ?? "",
      autoStopInterval: s.autoStopInterval ?? null,
    }));

    return NextResponse.json({ sandboxes: items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { action, sandboxId } = await req.json() as {
      action: "delete" | "archive" | "delete-all" | "archive-all";
      sandboxId?: string;
    };

    const daytona = getDaytonaClient();

    if (action === "delete" && sandboxId) {
      const sandbox = await daytona.get(sandboxId);
      await sandbox.delete();
      return NextResponse.json({ ok: true });
    }

    if (action === "archive" && sandboxId) {
      const sandbox = await daytona.get(sandboxId);
      if (sandbox.state !== "stopped") await sandbox.stop();
      await sandbox.archive();
      return NextResponse.json({ ok: true });
    }

    if (action === "delete-all" || action === "archive-all") {
      const sandboxes = await daytona.list();
      const results: { id: string; ok: boolean; error?: string }[] = [];

      for (const s of sandboxes.items) {
        try {
          if (action === "delete-all") {
            await s.delete();
          } else {
            if (s.state !== "stopped" && s.state !== "archived") await s.stop();
            if (s.state !== "archived") await s.archive();
          }
          results.push({ id: s.id, ok: true });
        } catch (err) {
          results.push({ id: s.id, ok: false, error: err instanceof Error ? err.message : String(err) });
        }
      }

      return NextResponse.json({ ok: true, results });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
