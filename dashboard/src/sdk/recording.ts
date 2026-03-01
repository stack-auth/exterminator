"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useRecording(errorTimestamp: number) {
  return useQuery(api.recordings.getByErrorTimestamp, { errorTimestamp });
}
