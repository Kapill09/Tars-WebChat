import { v } from "convex/values";
import { internalMutation, query, mutation } from "./_generated/server";

/**
 * INTERNAL: Used by server to create/update users
 */
export const createUser = internalMutation({
    args: {
        clerkId: v.string(),
        email: v.string(),
        name: v.string(),
        imageUrl: v.string(),
    },
    handler: async (ctx, args) => {
        const existingUser = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
            .unique();

        if (existingUser) {
            await ctx.db.patch(existingUser._id, {
                name: args.name,
                imageUrl: args.imageUrl,
                email: args.email,
            });
            return existingUser._id;
        }

        return await ctx.db.insert("users", {
            clerkId: args.clerkId,
            email: args.email,
            name: args.name,
            imageUrl: args.imageUrl,
            isOnline: true,
            lastSeen: Date.now(),
        });
    },
});

/**
 * 🔥 PUBLIC mutation to ensure current user exists in DB
 */
export const ensureUser = mutation({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return;

        const existing = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!existing) {
            await ctx.db.insert("users", {
                clerkId: identity.subject,
                email: identity.email ?? "",
                name: identity.name ?? "User",
                imageUrl: identity.pictureUrl ?? "",
                isOnline: true,
                lastSeen: Date.now(),
            });
        }
    },
});

/**
 * update online presence
 */
export const updatePresence = mutation({
    args: { isOnline: v.boolean() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return;

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) return;

        await ctx.db.patch(user._id, {
            isOnline: args.isOnline,
            lastSeen: Date.now(),
        });
    },
});

/**
 * get other users
 */
export const getUsers = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        const users = await ctx.db.query("users").collect();

        return users.filter((u) => u.clerkId !== identity.subject);
    },
});

/**
 * Update user profile
 */
export const updateProfile = mutation({
    args: {
        name: v.string(),
        imageUrl: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) throw new Error("User not found");

        await ctx.db.patch(user._id, {
            name: args.name,
            ...(args.imageUrl !== undefined ? { imageUrl: args.imageUrl } : {})
        });
    }
});

/**
 * Toggle block user
 */
export const toggleBlockUser = mutation({
    args: { blockedUserId: v.id("users") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const blocker = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!blocker) throw new Error("User not found");

        const existingBlock = await ctx.db
            .query("blockedUsers")
            .withIndex("by_blockerId_and_blockedId", (q) =>
                q.eq("blockerId", blocker._id).eq("blockedId", args.blockedUserId)
            )
            .unique();

        if (existingBlock) {
            await ctx.db.delete(existingBlock._id);
            return false; // Unblocked
        } else {
            await ctx.db.insert("blockedUsers", {
                blockerId: blocker._id,
                blockedId: args.blockedUserId,
            });
            return true; // Blocked
        }
    },
});

/**
 * Get list of blocked user IDs
 */
export const getBlockedUsers = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) return [];

        const blocks = await ctx.db
            .query("blockedUsers")
            .withIndex("by_blockerId", (q) => q.eq("blockerId", user._id))
            .collect();

        return blocks.map(b => b.blockedId);
    },
});

/**
 * Get current user
 */
export const getCurrentUser = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        return await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();
    }
});