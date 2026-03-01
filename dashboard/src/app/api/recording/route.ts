import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

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
    const { errorTimestamp, events } = await request.json();

    if (!errorTimestamp || !Array.isArray(events)) {
      return Response.json(
        { error: "errorTimestamp and events are required" },
        { status: 400, headers: corsHeaders },
      );
    }

    await convex.mutation(api.recordings.store, {
      errorTimestamp,
      events: JSON.stringify(events),
    });

    return Response.json(
      { stored: events.length },
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
