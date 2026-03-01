"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export type ErrorId = Id<"errors">;

export function useErrors() {
  return useQuery(api.errors.list);
}

export function useError(id: ErrorId) {
  return useQuery(api.errors.get, { id });
}

export function useDeleteError() {
  return useMutation(api.errors.remove);
}
