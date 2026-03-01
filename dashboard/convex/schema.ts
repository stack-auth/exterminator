import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  errors: defineTable({
    type: v.union(v.literal("error"), v.literal("unhandledrejection")),
    message: v.string(),
    stack: v.optional(v.string()),
    filename: v.optional(v.string()),
    lineno: v.optional(v.number()),
    colno: v.optional(v.number()),
    timestamp: v.number(),
    pageUrl: v.string(),
    userAgent: v.string(),
  }).index("by_timestamp", ["timestamp"]),

  sandboxes: defineTable({
    errorId: v.id("errors"),
    sandboxId: v.string(),
    runId: v.string(),
    status: v.union(
      v.literal("creating"),
      v.literal("reproducing"),
      v.literal("fixing"),
      v.literal("fixed"),
      v.literal("failed"),
    ),
  }).index("by_errorId", ["errorId"]),
});
