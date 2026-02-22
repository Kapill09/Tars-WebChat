import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    users: defineTable({
        clerkId: v.string(),
        email: v.string(),
        name: v.string(),
        imageUrl: v.string(),
        isOnline: v.boolean(),
        lastSeen: v.number(),
    })
        .index("by_clerkId", ["clerkId"])
        .index("by_email", ["email"]),

    conversations: defineTable({
        isGroup: v.boolean(),
        name: v.optional(v.string()), // For group chats
        lastMessageId: v.optional(v.id("messages")),
        lastMessageTime: v.optional(v.number()),
        creatorId: v.optional(v.id("users")),
    }),

    conversationMembers: defineTable({
        conversationId: v.id("conversations"),
        userId: v.id("users"),
        hasUnread: v.boolean(),
        unreadCount: v.optional(v.number()),
        lastRead: v.number(),
    })
        .index("by_conversationId", ["conversationId"])
        .index("by_userId", ["userId"])
        .index("by_conversationId_and_userId", ["conversationId", "userId"]),

    messages: defineTable({
        conversationId: v.id("conversations"),
        senderId: v.id("users"),
        content: v.string(),
        isDeleted: v.boolean(),
        isEdited: v.optional(v.boolean()),
        replyTo: v.optional(v.id("messages")),
        fileUrl: v.optional(v.string()),
        fileStorageId: v.optional(v.id("_storage")),
        fileName: v.optional(v.string()),
        fileSize: v.optional(v.number()),
        fileType: v.optional(v.string()), // 'image', 'file', 'voice'
        voiceMimeType: v.optional(v.string()), // e.g. 'audio/webm' or 'audio/ogg'
        voiceDuration: v.optional(v.number()), // duration in seconds, captured at record time
        seenBy: v.optional(v.array(v.id("users"))),
        deliveredTo: v.optional(v.array(v.id("users"))),
        hiddenFor: v.optional(v.array(v.id("users"))),
    }).index("by_conversationId", ["conversationId"]),

    reactions: defineTable({
        messageId: v.id("messages"),
        userId: v.id("users"),
        emoji: v.string(),
    }).index("by_messageId", ["messageId"]),

    typingIndicators: defineTable({
        conversationId: v.id("conversations"),
        userId: v.id("users"),
        expiresAt: v.number(),
    }).index("by_conversationId", ["conversationId"])
        .index("by_conversationId_and_userId", ["conversationId", "userId"]),
});
