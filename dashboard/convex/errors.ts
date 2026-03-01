import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("errors")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("errors") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const remove = mutation({
  args: { id: v.id("errors") },
  handler: async (ctx, args) => {
    const sandbox = await ctx.db
      .query("sandboxes")
      .withIndex("by_errorId", (q) => q.eq("errorId", args.id))
      .first();
    if (sandbox) {
      await ctx.db.delete(sandbox._id);
    }
    await ctx.db.delete(args.id);
  },
});

export const ingest = mutation({
  args: {
    events: v.array(
      v.object({
        type: v.union(v.literal("error"), v.literal("unhandledrejection")),
        message: v.string(),
        stack: v.optional(v.string()),
        filename: v.optional(v.string()),
        lineno: v.optional(v.number()),
        colno: v.optional(v.number()),
        timestamp: v.number(),
        pageUrl: v.string(),
        userAgent: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const event of args.events) {
      await ctx.db.insert("errors", event);
    }
  },
});
