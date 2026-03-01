import type { eventWithTime } from "rrweb";

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

export function dispatchEvents(
  events: CapturedError[],
  endpoint: string,
): void {
  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
    keepalive: true,
  }).catch(() => {});
}

export function dispatchRecording(
  errorTimestamp: number,
  recording: eventWithTime[],
  endpoint: string,
): void {
  const recordingEndpoint = endpoint.replace(/\/events$/, "/recording");
  fetch(recordingEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ errorTimestamp, events: recording }),
  }).catch(() => {});
}
