import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const store = mutation({
  args: {
    errorTimestamp: v.number(),
    events: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("recordings", args);
  },
});

export const getByErrorTimestamp = query({
  args: { errorTimestamp: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("recordings")
      .withIndex("by_errorTimestamp", (q) => q.eq("errorTimestamp", args.errorTimestamp))
      .first();
  },
});
