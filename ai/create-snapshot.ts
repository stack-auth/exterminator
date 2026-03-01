import { Daytona, Image } from "@daytonaio/sdk";
import { readFileSync } from "fs";

// Load DAYTONA_API_KEY from repo-root .env if not already set
if (!process.env.DAYTONA_API_KEY) {
  for (const p of ["../.env", "../dashboard/.env.local"]) {
    try {
      for (const line of readFileSync(p, "utf-8").split("\n")) {
        const m = line.match(/^DAYTONA_API_KEY=(.+)/);
        if (m) process.env.DAYTONA_API_KEY = m[1].trim();
      }
    } catch {}
  }
}

const SNAPSHOT_NAME = process.env.DAYTONA_SNAPSHOT_NAME || "exterminator-ai";

async function main() {
  const daytona = new Daytona({ apiKey: process.env.DAYTONA_API_KEY });
  const image = Image.fromDockerfile("Dockerfile");

  // Delete existing snapshot if present
  try {
    const existing = await daytona.snapshot.get(SNAPSHOT_NAME);
    await daytona.snapshot.delete(existing);
  } catch {}

  await daytona.snapshot.create(
    { name: SNAPSHOT_NAME, image },
    { onLogs: (chunk) => process.stdout.write(chunk), timeout: 0 },
  );
}

main();
