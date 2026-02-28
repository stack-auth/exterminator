import { createServer } from "node:http";

const PORT = 3001;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const payload = JSON.parse(body);
    const count = payload.events?.length ?? 0;

    console.log(`\n--- ${new Date().toLocaleTimeString()} · ${count} event(s) ---`);
    for (const evt of payload.events) {
      console.log(`  [${evt.type}] ${evt.message}`);
      if (evt.stack) {
        const frame = evt.stack.split("\n")[1]?.trim();
        if (frame) console.log(`    at ${frame}`);
      }
    }

    res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
    res.end(JSON.stringify({ received: count }));
  });
}).listen(PORT, () => {
  console.log(`Echo server listening on http://localhost:${PORT}`);
  console.log("Waiting for events…\n");
});
