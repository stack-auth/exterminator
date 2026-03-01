import { record, type eventWithTime } from "rrweb";

const MAX_EVENTS = 500;
const events: eventWithTime[] = [];
let stopFn: (() => void) | null = null;

export function startRecording(): void {
  if (stopFn) return;
  stopFn = record({
    emit(event) {
      events.push(event);
      if (events.length > MAX_EVENTS) {
        events.splice(0, events.length - MAX_EVENTS);
      }
    },
    recordCrossOriginIframes: false,
    recordCanvas: false,
    sampling: {
      mousemove: true,
      mouseInteraction: true,
      scroll: 150,
      input: "last",
    },
  }) ?? null;
}

export function getEvents(): eventWithTime[] {
  return events.slice();
}
