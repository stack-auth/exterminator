import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { startSandboxForError } from "@/lib/daytona";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const { events } = await request.json();

    if (!Array.isArray(events) || events.length === 0) {
      return Response.json(
        { error: "events must be a non-empty array" },
        { status: 400, headers: corsHeaders },
      );
    }

    await convex.mutation(api.errors.ingest, { events });

    // Fire-and-forget: launch a Daytona sandbox per error
    for (const event of events) {
      startSandboxForError(event).catch((err) => {
        console.error("Sandbox launch failed:", err);
      });
    }

    return Response.json(
      { received: events.length },
      { headers: corsHeaders },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json(
      { error: message },
      { status: 500, headers: corsHeaders },
    );
  }
}
