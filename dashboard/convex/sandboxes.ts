import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const sandboxStatus = v.union(
  v.literal("creating"),
  v.literal("reproducing"),
  v.literal("fixing"),
  v.literal("fixed"),
  v.literal("failed"),
);

export const create = mutation({
  args: {
    errorId: v.id("errors"),
    sandboxId: v.string(),
    runId: v.string(),
    status: sandboxStatus,
  },
  handler: async (ctx, args) => {
    // Remove any existing sandbox records for this error
    const existing = await ctx.db
      .query("sandboxes")
      .withIndex("by_errorId", (q) => q.eq("errorId", args.errorId))
      .collect();
    for (const doc of existing) {
      await ctx.db.delete(doc._id);
    }
    return await ctx.db.insert("sandboxes", args);
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("sandboxes"),
    status: sandboxStatus,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const remove = mutation({
  args: { id: v.id("sandboxes") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const getByErrorId = query({
  args: { errorId: v.id("errors") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sandboxes")
      .withIndex("by_errorId", (q) => q.eq("errorId", args.errorId))
      .order("desc")
      .first();
  },
});

export const getBySandboxId = query({
  args: { sandboxId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sandboxes")
      .withIndex("by_sandboxId", (q) => q.eq("sandboxId", args.sandboxId))
      .first();
  },
});
