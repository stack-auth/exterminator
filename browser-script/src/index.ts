import { dispatchEvents, type CapturedError } from "./dispatch";

const FLUSH_INTERVAL_MS = 5_000;
const BATCH_SIZE = 10;

const buffer: CapturedError[] = [];
const seen = new Set<string>();

let endpoint = "";

function fingerprint(msg: string, stack?: string): string {
  return `${msg}\n${stack?.split("\n")[1] ?? ""}`;
}

function capture(
  partial: Omit<CapturedError, "timestamp" | "pageUrl" | "userAgent">,
): void {
  const fp = fingerprint(partial.message, partial.stack);
  if (seen.has(fp)) return;
  seen.add(fp);

  buffer.push({
    ...partial,
    timestamp: Date.now(),
    pageUrl: window.location.href,
    userAgent: navigator.userAgent,
  });

  if (buffer.length >= BATCH_SIZE) flush();
}

function flush(): void {
  if (buffer.length === 0 || !endpoint) return;
  dispatchEvents(buffer.splice(0), endpoint);
}

// --- listeners ---

window.addEventListener("error", (event) => {
  if (!event.error) return;
  capture({
    type: "error",
    message: event.message,
    stack: event.error?.stack,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  capture({
    type: "unhandledrejection",
    message: event.reason?.message ?? String(event.reason),
    stack: event.reason?.stack,
  });
});

setInterval(flush, FLUSH_INTERVAL_MS);
window.addEventListener("beforeunload", flush);

// --- init ---

const script = document.currentScript as HTMLScriptElement | null;
if (script) {
  endpoint = script.getAttribute("data-endpoint") ?? "";
}

export function init(config: { endpoint: string }): void {
  endpoint = config.endpoint;
}
