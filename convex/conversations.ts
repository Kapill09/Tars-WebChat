import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const createConversation = mutation({
    args: {
        participantId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const currentUser = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!currentUser) throw new Error("User not found");

        if (currentUser._id === args.participantId) {
            throw new Error("Cannot converse with yourself");
        }

        const existingMemberships = await ctx.db
            .query("conversationMembers")
            .withIndex("by_userId", (q) => q.eq("userId", currentUser._id))
            .collect();

        for (const membership of existingMemberships) {
            const otherParticipant = await ctx.db
                .query("conversationMembers")
                .withIndex("by_conversationId_and_userId", (q) =>
                    q
                        .eq("conversationId", membership.conversationId)
                        .eq("userId", args.participantId)
                )
                .unique();

            if (otherParticipant) {
                return membership.conversationId;
            }
        }

        const conversationId = await ctx.db.insert("conversations", {
            isGroup: false,
            creatorId: currentUser._id,
        });

        await ctx.db.insert("conversationMembers", {
            conversationId,
            userId: currentUser._id,
            hasUnread: false,
            unreadCount: 0,
            lastRead: Date.now(),
        });

        await ctx.db.insert("conversationMembers", {
            conversationId,
            userId: args.participantId,
            hasUnread: false,
            unreadCount: 0,
            lastRead: Date.now(),
        });

        return conversationId;
    },
});

export const createGroup = mutation({
    args: {
        participantIds: v.array(v.id("users")),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const currentUser = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!currentUser) throw new Error("User not found");

        const conversationId = await ctx.db.insert("conversations", {
            isGroup: true,
            name: args.name,
            creatorId: currentUser._id,
        });

        const allParticipants = [...args.participantIds, currentUser._id];

        for (const userId of allParticipants) {
            await ctx.db.insert("conversationMembers", {
                conversationId,
                userId,
                hasUnread: false,
                unreadCount: 0,
                lastRead: Date.now(),
            });
        }

        return conversationId;
    },
});

export const listConversations = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        const currentUser = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!currentUser) return [];

        const memberships = await ctx.db
            .query("conversationMembers")
            .withIndex("by_userId", (q) => q.eq("userId", currentUser._id))
            .collect();

        const conversations = await Promise.all(
            memberships.map(async (membership) => {
                const conversation = await ctx.db.get(membership.conversationId);
                if (!conversation) return null;

                const otherMemberships = await ctx.db
                    .query("conversationMembers")
                    .withIndex("by_conversationId", (q) =>
                        q.eq("conversationId", conversation._id)
                    )
                    .collect();

                const otherMember = otherMemberships.find(
                    (m) => m.userId !== currentUser._id
                );

                if (!otherMember) return null;

                const otherUser = await ctx.db.get(otherMember.userId);

                let name = conversation.name || otherUser?.name || "Unknown Chat";
                let imageUrl = otherUser?.imageUrl;

                if (conversation.isGroup) {
                    // For groups, name is stored on conversation. 
                    // No single image, maybe first user or group icon later.
                    name = conversation.name || "Unnamed Group";
                    imageUrl = undefined;
                }

                let lastMessage: any = null;
                if (conversation.lastMessageId) {
                    lastMessage = await ctx.db.get(conversation.lastMessageId);
                }

                return {
                    id: conversation._id,
                    name,
                    imageUrl,
                    isOnline: conversation.isGroup ? false : otherUser?.isOnline,
                    isGroup: conversation.isGroup,
                    lastMessage: lastMessage?.content || "No messages yet",
                    lastMessageTime: lastMessage?._creationTime || conversation._creationTime,
                    hasUnread: membership.hasUnread,
                    unreadCount: membership.unreadCount || 0,
                    memberCount: otherMemberships.length,
                    isMuted: membership.isMuted || false,
                    lastClearedAt: membership.lastClearedAt || 0,
                    pinnedMessageIds: conversation.pinnedMessageIds || [],
                };
            })
        );

        return conversations
            .filter((c) => c !== null)
            .sort((a, b) => b!.lastMessageTime - a!.lastMessageTime);
    },
});

/**
 * Get all members of a conversation
 */
export const getMembers = query({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        const memberships = await ctx.db
            .query("conversationMembers")
            .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
            .collect();

        const conversation = await ctx.db.get(args.conversationId);

        const members = await Promise.all(
            memberships.map(async (m) => {
                const user = await ctx.db.get(m.userId);
                if (!user) return null;
                return {
                    ...user,
                    isAdmin: m.userId === conversation?.creatorId,
                };
            })
        );

        return members.filter((m): m is (NonNullable<typeof m>) => m !== null);
    },
});

/**
 * Add multiple members to a group
 */
export const addMembers = mutation({
    args: {
        conversationId: v.id("conversations"),
        userIds: v.array(v.id("users")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        for (const userId of args.userIds) {
            const existing = await ctx.db
                .query("conversationMembers")
                .withIndex("by_conversationId_and_userId", (q) =>
                    q.eq("conversationId", args.conversationId).eq("userId", userId)
                )
                .unique();

            if (!existing) {
                await ctx.db.insert("conversationMembers", {
                    conversationId: args.conversationId,
                    userId,
                    hasUnread: false,
                    unreadCount: 0,
                    lastRead: Date.now(),
                });
            }
        }
    },
});

/**
 * Add a member to a group
 */
export const addMember = mutation({
    args: {
        conversationId: v.id("conversations"),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const existing = await ctx.db
            .query("conversationMembers")
            .withIndex("by_conversationId_and_userId", (q) =>
                q.eq("conversationId", args.conversationId).eq("userId", args.userId)
            )
            .unique();

        if (existing) return;

        await ctx.db.insert("conversationMembers", {
            conversationId: args.conversationId,
            userId: args.userId,
            hasUnread: false,
            unreadCount: 0,
            lastRead: Date.now(),
        });
    },
});

/**
 * Remove a member from a group
 */
export const removeMember = mutation({
    args: {
        conversationId: v.id("conversations"),
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const membership = await ctx.db
            .query("conversationMembers")
            .withIndex("by_conversationId_and_userId", (q) =>
                q.eq("conversationId", args.conversationId).eq("userId", args.userId)
            )
            .unique();

        if (membership) {
            await ctx.db.delete(membership._id);
        }
    },
});

/**
 * Leave a group
 */
export const leaveGroup = mutation({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) throw new Error("User not found");

        const membership = await ctx.db
            .query("conversationMembers")
            .withIndex("by_conversationId_and_userId", (q) =>
                q.eq("conversationId", args.conversationId).eq("userId", user._id)
            )
            .unique();

        if (membership) {
            await ctx.db.delete(membership._id);
        }
    },
});

/**
 * Rename a group
 */
export const renameGroup = mutation({
    args: {
        conversationId: v.id("conversations"),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.conversationId, {
            name: args.name,
        });
    },
});

/**
 * Toggle mute notifications for a conversation
 */
export const toggleMute = mutation({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) throw new Error("User not found");

        const membership = await ctx.db
            .query("conversationMembers")
            .withIndex("by_conversationId_and_userId", (q) =>
                q.eq("conversationId", args.conversationId).eq("userId", user._id)
            )
            .unique();

        if (membership) {
            await ctx.db.patch(membership._id, {
                isMuted: !membership.isMuted,
            });
            return !membership.isMuted;
        }
        return false;
    },
});

/**
 * Clear chat messages for the current user
 */
export const clearChat = mutation({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) throw new Error("User not found");

        const membership = await ctx.db
            .query("conversationMembers")
            .withIndex("by_conversationId_and_userId", (q) =>
                q.eq("conversationId", args.conversationId).eq("userId", user._id)
            )
            .unique();

        if (membership) {
            await ctx.db.patch(membership._id, {
                lastClearedAt: Date.now(),
            });
        }
    },
});

/**
 * Report a user or group
 */
export const reportUser = mutation({
    args: {
        reportedUserId: v.id("users"),
        conversationId: v.id("conversations"),
        reason: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const reporter = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!reporter) throw new Error("User not found");

        await ctx.db.insert("reports", {
            reporterId: reporter._id,
            reportedUserId: args.reportedUserId,
            conversationId: args.conversationId,
            reason: args.reason,
            createdAt: Date.now(),
        });
    },
});

/**
 * Toggle message pinning
 */
export const togglePinMessage = mutation({
    args: {
        conversationId: v.id("conversations"),
        messageId: v.id("messages"),
    },
    handler: async (ctx, args) => {
        const conversation = await ctx.db.get(args.conversationId);
        if (!conversation) throw new Error("Conversation not found");

        const pins = conversation.pinnedMessageIds || [];
        const isPinned = pins.includes(args.messageId);

        if (isPinned) {
            await ctx.db.patch(args.conversationId, {
                pinnedMessageIds: pins.filter(id => id !== args.messageId),
            });
        } else {
            await ctx.db.patch(args.conversationId, {
                pinnedMessageIds: [...pins, args.messageId],
            });
        }
        return !isPinned;
    },
});

/**
 * Get pinned messages for a conversation
 */
export const getPinnedMessages = query({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        const conversation = await ctx.db.get(args.conversationId);
        if (!conversation || !conversation.pinnedMessageIds) return [];

        const messages = await Promise.all(
            conversation.pinnedMessageIds.map(id => ctx.db.get(id))
        );

        return messages.filter(m => m !== null && !m.isDeleted);
    },
});

/**
 * Get shared assets (media/files)
 */
export const getSharedAssets = query({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
            .collect();

        const assets = messages
            .filter(m => !m.isDeleted && m.fileUrl)
            .map(m => ({
                _id: m._id,
                _creationTime: m._creationTime,
                fileUrl: m.fileUrl,
                fileName: m.fileName,
                fileSize: m.fileSize,
                fileType: m.fileType,
            }));

        return {
            media: assets.filter(a => a.fileType === "image"),
            files: assets.filter(a => a.fileType === "file"),
        };
    },
});
