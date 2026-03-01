import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

let cachedScript: string | null = null;

export async function GET() {
  if (!cachedScript) {
    try {
      const scriptPath = join(process.cwd(), "..", "browser-script", "dist", "index.global.js");
      cachedScript = readFileSync(scriptPath, "utf-8");
    } catch {
      return new NextResponse("// exterminator.js not built", {
        status: 404,
        headers: { "Content-Type": "application/javascript" },
      });
    }
  }

  return new NextResponse(cachedScript, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
