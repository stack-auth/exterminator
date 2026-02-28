export interface CapturedError {
  type: "error" | "unhandledrejection";
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
  pageUrl: string;
  userAgent: string;
}

/**
 * Fire-and-forget POST of captured errors to the configured endpoint.
 * `keepalive` ensures the request survives page navigations / tab close.
 */
export function dispatchEvents(
  events: CapturedError[],
  endpoint: string,
): void {
  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
    keepalive: true,
  }).catch(() => {
    // Never let the monitoring script throw
  });
}
