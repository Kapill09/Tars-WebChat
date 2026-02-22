import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const getMessages = query({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        const currentUser = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!currentUser) return [];

        const membership = await ctx.db
            .query("conversationMembers")
            .withIndex("by_conversationId_and_userId", (q) =>
                q.eq("conversationId", args.conversationId).eq("userId", currentUser._id)
            )
            .unique();

        if (!membership) return [];

        const messages = await ctx.db
            .query("messages")
            .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
            .collect();

        const filteredMessages = messages.filter(m => !(m.hiddenFor || []).includes(currentUser._id));

        return Promise.all(
            filteredMessages.map(async (message) => {
                const reactions = await ctx.db
                    .query("reactions")
                    .withIndex("by_messageId", (q) => q.eq("messageId", message._id))
                    .collect();

                const sender = await ctx.db.get(message.senderId);

                let replyDetails: any = null;
                if (message.replyTo) {
                    const repliedMsg = await ctx.db.get(message.replyTo);
                    if (repliedMsg) {
                        const repliedSender = await ctx.db.get(repliedMsg.senderId);
                        replyDetails = {
                            content: repliedMsg.isDeleted ? "This message was deleted" : repliedMsg.content,
                            senderName: repliedSender?.name || "Unknown",
                            isDeleted: repliedMsg.isDeleted
                        };
                    }
                }

                // Resolve storage ID → serving URL so media (voice, image, file) can load
                let fileUrl: string | null = message.fileUrl || null;
                if (!fileUrl && message.fileStorageId) {
                    fileUrl = await ctx.storage.getUrl(message.fileStorageId);
                }

                return {
                    ...message,
                    fileUrl: fileUrl ?? undefined,
                    isMine: message.senderId === currentUser._id,
                    reactions,
                    senderDetails: {
                        name: sender?.name || "Unknown",
                        imageUrl: sender?.imageUrl
                    },
                    replyDetails,
                    seenBy: message.seenBy || [],
                    deliveredTo: message.deliveredTo || [],
                };
            })
        );
    },
});

export const sendMessage = mutation({
    args: {
        conversationId: v.id("conversations"),
        content: v.string(),
        replyTo: v.optional(v.id("messages")),
        fileUrl: v.optional(v.string()),
        fileStorageId: v.optional(v.id("_storage")),
        fileName: v.optional(v.string()),
        fileSize: v.optional(v.number()),
        fileType: v.optional(v.string()),
        voiceMimeType: v.optional(v.string()),
        voiceDuration: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const sender = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!sender) throw new Error("User not found");

        const messageId = await ctx.db.insert("messages", {
            conversationId: args.conversationId,
            senderId: sender._id,
            content: args.content,
            isDeleted: false,
            replyTo: args.replyTo,
            fileUrl: args.fileUrl,
            fileStorageId: args.fileStorageId,
            fileName: args.fileName,
            fileSize: args.fileSize,
            fileType: args.fileType,
            voiceMimeType: args.voiceMimeType,
            voiceDuration: args.voiceDuration,
            seenBy: [sender._id],
            deliveredTo: [sender._id],
            hiddenFor: [],
        });

        await ctx.db.patch(args.conversationId, {
            lastMessageId: messageId,
            lastMessageTime: Date.now(),
        });

        const memberships = await ctx.db
            .query("conversationMembers")
            .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
            .collect();

        for (const membership of memberships) {
            if (membership.userId !== sender._id) {
                await ctx.db.patch(membership._id, {
                    hasUnread: true,
                    unreadCount: (membership.unreadCount || 0) + 1,
                });
            } else {
                await ctx.db.patch(membership._id, {
                    lastRead: Date.now(),
                });
            }
        }

        return messageId;
    },
});

export const deleteMessage = mutation({
    args: { messageId: v.id("messages") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const currentUser = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!currentUser) throw new Error("User not found");

        const message = await ctx.db.get(args.messageId);
        if (!message || message.senderId !== currentUser._id) {
            throw new Error("Unauthorized");
        }

        await ctx.db.patch(args.messageId, {
            content: "This message was deleted",
            isDeleted: true,
        });
    },
});

export const markAsRead = mutation({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return;

        const currentUser = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!currentUser) return;

        // 1. Update membership lastRead
        const membership = await ctx.db
            .query("conversationMembers")
            .withIndex("by_conversationId_and_userId", (q) =>
                q.eq("conversationId", args.conversationId).eq("userId", currentUser._id)
            )
            .unique();

        if (membership && (membership.hasUnread || (membership.unreadCount || 0) > 0)) {
            await ctx.db.patch(membership._id, {
                hasUnread: false,
                unreadCount: 0,
                lastRead: Date.now(),
            });
        }

        // 2. Mark all messages in this conversation as seen by this user
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
            .collect();

        for (const msg of messages) {
            const seenBy = msg.seenBy || [];
            const deliveredTo = msg.deliveredTo || [];

            if (!seenBy.includes(currentUser._id)) {
                await ctx.db.patch(msg._id, {
                    seenBy: [...seenBy, currentUser._id],
                });
            }
            if (!deliveredTo.includes(currentUser._id)) {
                await ctx.db.patch(msg._id, {
                    deliveredTo: [...deliveredTo, currentUser._id],
                });
            }
        }
    },
});

export const markAsDelivered = mutation({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return;

        const currentUser = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();
        if (!currentUser) return;

        const messages = await ctx.db
            .query("messages")
            .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
            .collect();

        for (const msg of messages) {
            const deliveredTo = msg.deliveredTo || [];
            if (!deliveredTo.includes(currentUser._id)) {
                await ctx.db.patch(msg._id, {
                    deliveredTo: [...deliveredTo, currentUser._id],
                });
            }
        }
    }
});

export const editMessage = mutation({
    args: { messageId: v.id("messages"), content: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const currentUser = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();
        if (!currentUser) throw new Error("User not found");

        const message = await ctx.db.get(args.messageId);
        if (!message || message.senderId !== currentUser._id) {
            throw new Error("Unauthorized");
        }

        await ctx.db.patch(args.messageId, {
            content: args.content,
            isEdited: true,
        });
    }
});

export const deleteForMe = mutation({
    args: { messageId: v.id("messages") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const currentUser = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();
        if (!currentUser) throw new Error("User not found");

        const message = await ctx.db.get(args.messageId);
        if (!message) return;

        const hiddenFor = message.hiddenFor || [];
        if (!hiddenFor.includes(currentUser._id)) {
            await ctx.db.patch(args.messageId, {
                hiddenFor: [...hiddenFor, currentUser._id],
            });
        }
    }
});

export const generateUploadUrl = mutation(async (ctx) => {
    return await ctx.storage.generateUploadUrl();
});

export const toggleReaction = mutation({
    args: {
        messageId: v.id("messages"),
        emoji: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) throw new Error("User not found");

        const existingReaction = await ctx.db
            .query("reactions")
            .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
            .filter((q) => q.eq(q.field("userId"), user._id))
            .filter((q) => q.eq(q.field("emoji"), args.emoji))
            .first();

        if (existingReaction) {
            await ctx.db.delete(existingReaction._id);
            return { removed: true };
        } else {
            await ctx.db.insert("reactions", {
                messageId: args.messageId,
                userId: user._id,
                emoji: args.emoji,
            });
            return { added: true };
        }
    }
});

/**
 * Set typing status for a user in a conversation
 */
export const setTypingStatus = mutation({
    args: {
        conversationId: v.id("conversations"),
        isTyping: v.boolean(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) throw new Error("User not found");

        const existingIndicator = await ctx.db
            .query("typingIndicators")
            .withIndex("by_conversationId_and_userId", (q) =>
                q.eq("conversationId", args.conversationId).eq("userId", user._id)
            )
            .unique();

        if (args.isTyping) {
            const expiresAt = Date.now() + 3000; // Expire in 3 seconds
            if (existingIndicator) {
                await ctx.db.patch(existingIndicator._id, { expiresAt });
            } else {
                await ctx.db.insert("typingIndicators", {
                    conversationId: args.conversationId,
                    userId: user._id,
                    expiresAt,
                });
            }
        } else {
            if (existingIndicator) {
                await ctx.db.delete(existingIndicator._id);
            }
        }
    },
});

/**
 * Get users who are currently typing in a conversation
 */
export const getTypingStatus = query({
    args: { conversationId: v.id("conversations") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        const currentUser = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!currentUser) return [];

        const indicators = await ctx.db
            .query("typingIndicators")
            .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
            .collect();

        const activeTyping: { name: string; userId: Id<"users"> }[] = [];
        const now = Date.now();

        for (const indicator of indicators) {
            if (indicator.expiresAt > now && indicator.userId !== currentUser._id) {
                const user = await ctx.db.get(indicator.userId);
                if (user) {
                    activeTyping.push({
                        name: user.name,
                        userId: user._id,
                    });
                }
            }
        }

        return activeTyping;
    },
});
