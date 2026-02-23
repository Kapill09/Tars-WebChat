"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Trash2, Smile, Reply, X, Users, MoreVertical, List, UserPlus, LogOut, Settings2, ShieldCheck, Clock, Paperclip, Mic, StopCircle, Play, Pause, FileIcon, Check, CheckCheck, Pencil, UserMinus, Globe, Search, User, Bell, Ban, Flag, BellOff, Download } from "lucide-react";
import { format, formatDistanceToNow, isToday } from "date-fns";
import { useAuth } from "@clerk/nextjs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { AddMemberDialog } from "./AddMemberDialog";
import EmojiPicker, { Theme as EmojiTheme } from "emoji-picker-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

interface ChatPanelProps {
    conversationId: Id<"conversations">;
    onBack: () => void;
}

export function ChatPanel({ conversationId, onBack }: ChatPanelProps) {
    const { userId } = useAuth();
    const messages = useQuery(api.messages.getMessages, { conversationId });
    const sendMessage = useMutation(api.messages.sendMessage);
    const deleteMessage = useMutation(api.messages.deleteMessage);
    const markAsRead = useMutation(api.messages.markAsRead);
    const toggleReaction = useMutation(api.messages.toggleReaction);
    const setTypingStatus = useMutation(api.messages.setTypingStatus);
    const typingUsers = useQuery(api.messages.getTypingStatus, { conversationId });
    const members = useQuery(api.conversations.getMembers, { conversationId });

    const renameGroup = useMutation(api.conversations.renameGroup);
    const leaveGroup = useMutation(api.conversations.leaveGroup);
    const removeMember = useMutation(api.conversations.removeMember);
    const editMessage = useMutation(api.messages.editMessage);
    const deleteForMe = useMutation(api.messages.deleteForMe);
    const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
    const markAsDelivered = useMutation(api.messages.markAsDelivered);
    const toggleMute = useMutation(api.conversations.toggleMute);
    const clearChat = useMutation(api.conversations.clearChat);
    const reportUser = useMutation(api.conversations.reportUser);
    const toggleBlockUser = useMutation(api.users.toggleBlockUser);
    const togglePinMessage = useMutation(api.conversations.togglePinMessage);

    const currentUser = useQuery(api.users.getCurrentUser);
    const blockedUsers = useQuery(api.users.getBlockedUsers);
    const pinnedMessages = useQuery(api.conversations.getPinnedMessages, { conversationId });
    const sharedAssets = useQuery(api.conversations.getSharedAssets, { conversationId });

    const conversations = useQuery(api.conversations.listConversations);
    const conversation = conversations?.find((c) => c.id === conversationId);

    const [newMessage, setNewMessage] = useState("");
    const [replyTo, setReplyTo] = useState<any>(null);
    const [editingMsg, setEditingMsg] = useState<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showAutoScroll, setShowAutoScroll] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const [playbackTime, setPlaybackTime] = useState(0); // current playback position in seconds
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const recordingStartRef = useRef<number | null>(null); // wall-clock ms when recording began

    const [searchQuery, setSearchQuery] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [infoTab, setInfoTab] = useState<'members' | 'media' | 'files'>('members');

    // Create the audio element imperatively so the browser never tries to load
    // a src-less <audio> tag (which causes NotSupportedError on mount).
    useEffect(() => {
        const audio = new Audio();
        audio.onended = () => { setPlayingAudioId(null); setPlaybackTime(0); };
        audio.onpause = () => setPlayingAudioId(null);
        audio.ontimeupdate = () => setPlaybackTime(audio.currentTime);
        audioRef.current = audio;
        return () => {
            audio.pause();
            audio.src = "";
            audioRef.current = null;
        };
    }, []);

    /** Format seconds → M:SS */
    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const handleToggleAudio = async (url: string, id: string) => {
        if (!audioRef.current) return;

        if (playingAudioId === id) {
            audioRef.current.pause();
            setPlayingAudioId(null);
        } else {
            if (!audioRef.current.paused) {
                audioRef.current.pause();
            }
            audioRef.current.src = url;
            try {
                await audioRef.current.play();
                setPlayingAudioId(id);
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error("Audio playback error:", err);
                }
            }
        }
    };
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const { theme } = useTheme();

    const otherMember = !conversation?.isGroup ? members?.find(m => m._id !== currentUser?._id) : null;
    const isBlocked = otherMember ? blockedUsers?.includes(otherMember._id) : false;

    const onlineMembers = members?.filter(m => m.isOnline) || [];
    const onlineCount = onlineMembers.length;

    const formatLastSeen = (timestamp: number) => {
        const date = new Date(timestamp);
        if (isToday(date)) return `Last seen today at ${format(date, "h:mm a")}`;
        return `Last seen ${formatDistanceToNow(date, { addSuffix: true })}`;
    };

    const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙌"];

    useEffect(() => {
        if (messages && messages.length > 0) {
            if (!showAutoScroll) {
                scrollRef.current?.scrollIntoView({ behavior: "smooth" });
            }
            markAsRead({ conversationId });
        }
    }, [messages, conversationId, markAsRead, showAutoScroll]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollTop + clientHeight < scrollHeight - 50) {
            setShowAutoScroll(true);
        } else {
            setShowAutoScroll(false);
        }
    };

    useEffect(() => {
        if (conversationId) {
            markAsDelivered({ conversationId });
        }
    }, [conversationId, markAsDelivered]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() && !audioBlob) return;

        const content = newMessage;
        const replyId = replyTo?._id;
        setNewMessage("");
        setReplyTo(null);
        setShowAutoScroll(false);

        try {
            if (editingMsg) {
                await editMessage({ messageId: editingMsg._id, content });
                setEditingMsg(null);
                toast.success("Message edited");
            } else {
                await sendMessage({ conversationId, content, replyTo: replyId });
                await setTypingStatus({ conversationId, isTyping: false });
            }
            scrollRef.current?.scrollIntoView({ behavior: "smooth" });
        } catch (error) {
            console.error("Failed to send", error);
            toast.error("Failed to send message");
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadProgress(10);

        try {
            const postUrl = await generateUploadUrl();
            setUploadProgress(40);

            const result = await fetch(postUrl, {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            });
            const { storageId } = await result.json();
            setUploadProgress(80);

            await sendMessage({
                conversationId,
                content: `Sent a ${file.type.startsWith("image/") ? "photo" : "file"}`,
                fileStorageId: storageId,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type.startsWith("image/") ? "image" : "file",
            });

            toast.success("File uploaded");
            setUploadProgress(100);
        } catch (error) {
            console.error("Upload failed", error);
            toast.error("Upload failed");
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const startRecording = async () => {
        try {
            // navigator.mediaDevices is only available in secure contexts (HTTPS or localhost).
            // Accessing via http:// on a mobile device (e.g., local dev IP) will make it undefined.
            if (!navigator.mediaDevices?.getUserMedia) {
                toast.error("Microphone access requires HTTPS. Please open the app at https:// or via localhost.");
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Detect the best supported MIME type for this browser
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : MediaRecorder.isTypeSupported("audio/webm")
                    ? "audio/webm"
                    : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
                        ? "audio/ogg;codecs=opus"
                        : "audio/ogg";

            const recorder = new MediaRecorder(stream, { mimeType });
            const chunks: BlobPart[] = [];

            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = async () => {
                // Calculate duration from wall clock — WebM container lacks this metadata
                const durationSecs = recordingStartRef.current
                    ? (Date.now() - recordingStartRef.current) / 1000
                    : 0;
                recordingStartRef.current = null;

                const blob = new Blob(chunks, { type: mimeType });
                setAudioBlob(blob);

                const baseType = mimeType.split(";")[0];
                const ext = baseType === "audio/ogg" ? "ogg" : "webm";

                try {
                    const postUrl = await generateUploadUrl();
                    const result = await fetch(postUrl, {
                        method: "POST",
                        headers: { "Content-Type": baseType },
                        body: blob,
                    });
                    const { storageId } = await result.json();

                    await sendMessage({
                        conversationId,
                        content: "Voice message",
                        fileStorageId: storageId,
                        fileName: `VoiceNote.${ext}`,
                        fileSize: blob.size,
                        fileType: "voice",
                        voiceMimeType: baseType,
                        voiceDuration: Math.round(durationSecs),
                    });
                } catch (uploadErr) {
                    console.error("Voice upload failed", uploadErr);
                    toast.error("Voice upload failed");
                }
                setAudioBlob(null);
            };

            recorder.start();
            recordingStartRef.current = Date.now(); // start the wall clock
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
        } catch (err) {
            console.error("Recording error", err);
            toast.error("Microphone access denied");
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewMessage(e.target.value);

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        setTypingStatus({ conversationId, isTyping: true });

        typingTimeoutRef.current = setTimeout(() => {
            setTypingStatus({ conversationId, isTyping: false });
        }, 2000);
    };

    if (!conversation) {
        return (
            <div className="flex-1 flex flex-col pt-4 items-center animate-pulse">
                <div className="w-full flex p-4 border-b">
                    <div className="h-10 w-10 bg-gray-200 rounded-full" />
                    <div className="ml-3 h-4 w-32 bg-gray-200 rounded mt-2" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-[#f8fafc] dark:bg-black relative transition-colors duration-300 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-50/20 to-transparent dark:from-blue-900/5 pointer-events-none" />

            <header className="px-6 py-4 bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-md border-b dark:border-gray-800 flex items-center justify-between shadow-sm z-20 sticky top-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden dark:text-gray-300 -ml-2">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="relative group/avatar">
                        <div className={`w-11 h-11 rounded-full overflow-hidden border-2 dark:border-gray-700 shadow-sm transition-transform group-hover/avatar:scale-105 ${conversation.isGroup ? "bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold" : ""}`}>
                            {conversation.isGroup ? (
                                <span>{conversation.name.substring(0, 1).toUpperCase()}</span>
                            ) : (
                                <img src={conversation.imageUrl || "https://github.com/shadcn.png"} alt="avatar" className="w-full h-full object-cover" />
                            )}
                        </div>
                        {!conversation.isGroup && conversation.isOnline && (
                            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-[#1a1a1a] rounded-full ring-2 ring-green-500/20" />
                        )}
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                            {conversation.name}
                        </h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {conversation.isGroup ? (
                                <button
                                    onClick={() => setShowInfo(true)}
                                    className="flex items-center gap-1.5 text-[11px] font-medium text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                >
                                    <Users className="w-3 h-3" />
                                    <span>{conversation.memberCount} members • {onlineCount} online</span>
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${conversation.isOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-gray-400"}`} />
                                    <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                        {conversation.isOnline ? "Online" : otherMember?.lastSeen ? formatLastSeen(otherMember.lastSeen) : "Offline"}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                                <MoreVertical className="w-5 h-5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-52 p-1 dark:bg-[#1a1a1a] dark:border-gray-800">
                            <Button variant="ghost" className="w-full justify-start text-xs h-9 gap-2" onClick={() => setShowInfo(true)}>
                                {conversation.isGroup ? <List className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                {conversation.isGroup ? "Group Info" : "View Contact"}
                            </Button>

                            <Button variant="ghost" className="w-full justify-start text-xs h-9 gap-2" onClick={() => setShowSearch(true)}>
                                <Search className="w-4 h-4" /> Search
                            </Button>

                            <Button
                                variant="ghost"
                                className={`w-full justify-start text-xs h-9 gap-2 ${conversation.isMuted ? "text-blue-500" : ""}`}
                                onClick={() => {
                                    toggleMute({ conversationId });
                                    toast.success(conversation.isMuted ? "Unmuted" : "Muted");
                                }}
                            >
                                {conversation.isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                                {conversation.isMuted ? "Unmute notifications" : "Mute notifications"}
                            </Button>

                            {!conversation.isGroup && (
                                <>
                                    <Button
                                        variant="ghost"
                                        className="w-full justify-start text-xs h-9 gap-2"
                                        onClick={async () => {
                                            if (confirm("Clear all messages for you? This cannot be undone.")) {
                                                await clearChat({ conversationId });
                                                toast.success("Chat cleared");
                                            }
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4" /> Clear chat
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className={`w-full justify-start text-xs h-9 gap-2 ${isBlocked ? "text-green-500" : "text-red-500"}`}
                                        onClick={async () => {
                                            if (otherMember) {
                                                await toggleBlockUser({ blockedUserId: otherMember._id });
                                                toast.success(isBlocked ? "User unblocked" : "User blocked");
                                            }
                                        }}
                                    >
                                        {isBlocked ? <ShieldCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                        {isBlocked ? "Unblock user" : "Block user"}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="w-full justify-start text-xs h-9 gap-2 text-amber-500"
                                        onClick={() => {
                                            const reason = prompt("Enter reason for report:");
                                            if (reason && otherMember) {
                                                reportUser({ reportedUserId: otherMember._id, conversationId, reason });
                                                toast.success("User reported");
                                            }
                                        }}
                                    >
                                        <Flag className="w-4 h-4" /> Report user
                                    </Button>
                                </>
                            )}

                            {conversation.isGroup && (
                                <>
                                    <Button variant="ghost" className="w-full justify-start text-xs h-9 gap-2 text-amber-500">
                                        <Flag className="w-4 h-4" /> Report group
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="w-full justify-start text-xs h-9 gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
                                        onClick={() => {
                                            if (confirm("Leave this group?")) {
                                                leaveGroup({ conversationId });
                                                onBack();
                                            }
                                        }}
                                    >
                                        <LogOut className="w-4 h-4" /> Leave Group
                                    </Button>
                                </>
                            )}
                        </PopoverContent>
                    </Popover>
                </div>
            </header>

            {pinnedMessages && pinnedMessages.length > 0 && (
                <div className="px-6 py-2 bg-white/50 dark:bg-black/50 border-b dark:border-gray-800 flex items-center gap-3 animate-in fade-in slide-in-from-top duration-300">
                    <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                    <div className="flex-1 overflow-x-auto scrollbar-hide flex gap-3 pb-1">
                        {pinnedMessages.map((msg: any) => (
                            <div
                                key={msg._id}
                                onClick={() => document.getElementById(msg._id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                className="flex items-center gap-2 bg-white dark:bg-gray-900 px-3 py-1 rounded-full border dark:border-gray-800 text-[11px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap shadow-sm group"
                            >
                                <span className="font-bold text-blue-500">Pin:</span>
                                <span className="text-gray-600 dark:text-gray-300 truncate max-w-[150px]">{msg.content}</span>
                                <X
                                    className="w-3 h-3 text-gray-400 hover:text-red-500 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => { e.stopPropagation(); togglePinMessage({ conversationId, messageId: msg._id }); }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showSearch && (
                <div className="px-6 py-2 bg-white/80 dark:bg-[#1a1a1a]/80 backdrop-blur-md border-b dark:border-gray-800 flex items-center gap-3 animate-in slide-in-from-top duration-300 z-10">
                    <div className="flex-1 flex items-center gap-2 bg-gray-100 dark:bg-gray-900 px-3 py-1.5 rounded-xl border dark:border-gray-800 focus-within:border-blue-500/50 transition-all">
                        <Search className="w-4 h-4 text-gray-400" />
                        <Input
                            ref={searchInputRef}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search in conversation..."
                            className="h-7 text-xs bg-transparent border-none focus-visible:ring-0 p-0 shadow-none dark:text-gray-100"
                            autoFocus
                        />
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                    >
                        Cancel
                    </Button>
                </div>
            )}

            <div className="flex-1 flex overflow-hidden relative">
                <div className={`flex-1 flex flex-col transition-all duration-300 ${showInfo ? "mr-0 md:mr-80" : "mr-0"}`}>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4" onScroll={handleScroll}>
                        {messages?.length === 0 ? (
                            <div className="flex-1 h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                                Send a message to start the conversation!
                            </div>
                        ) : (
                            messages?.filter(msg =>
                                !searchQuery || msg.content.toLowerCase().includes(searchQuery.toLowerCase())
                            ).map((msg) => {
                                const timeStr = format(new Date(msg._creationTime), "h:mm a");
                                const reactions = msg.reactions || [];
                                const groupedReactions = reactions.reduce((acc: any, r: any) => {
                                    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                    return acc;
                                }, {});

                                const otherMembers = members?.filter(m => m._id !== msg.senderId) || [];
                                const seenBy = msg.seenBy || [];
                                const deliveredTo = msg.deliveredTo || [];
                                const isReadByAll = otherMembers.length > 0 && otherMembers.every(m => seenBy.includes(m._id));
                                const isDeliveredByAll = otherMembers.length > 0 && otherMembers.every(m => deliveredTo.includes(m._id));

                                const renderContent = (content: string) => {
                                    if (!searchQuery) return content;
                                    const parts = content.split(new RegExp(`(${searchQuery})`, 'gi'));
                                    return (
                                        <>
                                            {parts.map((part, i) =>
                                                part.toLowerCase() === searchQuery.toLowerCase()
                                                    ? <mark key={i} className="bg-yellow-300 dark:bg-yellow-600 text-black px-0.5 rounded shadow-sm">{part}</mark>
                                                    : part
                                            )}
                                        </>
                                    );
                                };

                                return (
                                    <div
                                        key={msg._id}
                                        id={msg._id}
                                        className={`flex items-start gap-2 ${msg.isMine ? "flex-row-reverse" : "flex-row"} group animate-in fade-in slide-in-from-bottom-2 duration-300`}
                                    >
                                        {!msg.isMine && (
                                            <Avatar className="w-8 h-8 mt-1 shrink-0">
                                                <AvatarImage src={msg.senderDetails?.imageUrl} />
                                                <AvatarFallback>{msg.senderDetails?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                        )}

                                        <div className={`flex flex-col max-w-[75%] ${msg.isMine ? "items-end" : "items-start"}`}>
                                            {msg.replyDetails && (
                                                <div
                                                    onClick={() => msg.replyTo && document.getElementById(msg.replyTo.toString())?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                                    className={`mb-[-8px] pb-3 pt-2 px-3 rounded-t-2xl text-xs cursor-pointer border-x border-t transition-colors opacity-80 hover:opacity-100 ${msg.isMine
                                                        ? "bg-blue-700/50 border-blue-500 text-blue-50"
                                                        : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                                                        } max-w-sm truncate whitespace-nowrap`}>
                                                    <p className="font-bold mb-0.5">@{msg.replyDetails.senderName}</p>
                                                    <p className="truncate italic">"{msg.replyDetails.content}"</p>
                                                </div>
                                            )}

                                            <div className={`p-3.5 rounded-2xl relative transition-all duration-300 group-hover:shadow-lg chat-bubble-shadow ${msg.isDeleted
                                                ? "bg-gray-100 dark:bg-gray-800/50 italic text-gray-500 border border-gray-200 dark:border-gray-700/50"
                                                : msg.isMine
                                                    ? "bg-gradient-to-br from-blue-600 to-indigo-700 text-white hover:from-blue-500 hover:to-indigo-600 shadow-md shadow-blue-500/10"
                                                    : "bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-100 hover:border-blue-200 dark:hover:border-blue-900"
                                                } ${msg.isMine ? "rounded-br-sm" : "rounded-bl-sm"} ${msg.replyDetails ? "rounded-t-none" : ""}`}>

                                                {conversation?.pinnedMessageIds?.includes(msg._id) && (
                                                    <div className="absolute -top-2 -right-2 bg-blue-500 text-white p-1 rounded-full shadow-md z-10 scale-75 animate-in zoom-in duration-300">
                                                        <Clock className="w-3.5 h-3.5 fill-current" />
                                                    </div>
                                                )}

                                                {!msg.isMine && !msg.isDeleted && (
                                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">
                                                        {msg.senderDetails?.name}
                                                    </p>
                                                )}

                                                {!msg.isDeleted && msg.fileType === "image" && (
                                                    <div className="mb-2 rounded-lg overflow-hidden border dark:border-gray-800">
                                                        <img
                                                            src={msg.fileUrl}
                                                            alt={msg.fileName}
                                                            className="max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                                                            onClick={() => window.open(msg.fileUrl, "_blank")}
                                                        />
                                                    </div>
                                                )}

                                                {!msg.isDeleted && msg.fileType === "file" && (
                                                    <div className={`flex items-center gap-3 p-3 mb-2 rounded-xl border ${msg.isMine ? "bg-white/10 border-white/20" : "bg-gray-50 dark:bg-black/20 border-gray-200 dark:border-gray-800"}`}>
                                                        <div className={`p-2 rounded-lg ${msg.isMine ? "bg-blue-500" : "bg-blue-100 dark:bg-blue-900/40"}`}>
                                                            <FileIcon className={`w-5 h-5 ${msg.isMine ? "text-white" : "text-blue-600 dark:text-blue-400"}`} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className={`text-sm font-bold truncate ${msg.isMine ? "text-white" : "dark:text-white"}`}>{msg.fileName}</p>
                                                            <p className={`text-[10px] ${msg.isMine ? "text-blue-100/70" : "text-gray-500"}`}>
                                                                {((msg.fileSize || 0) / 1024).toFixed(1)} KB • <a href={msg.fileUrl} download className="underline hover:text-blue-500">Download</a>
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {!msg.isDeleted && msg.fileType === "voice" && (() => {
                                                    const isPlaying = playingAudioId === msg._id;
                                                    const totalSecs = (msg as any).voiceDuration || 0;
                                                    const elapsed = isPlaying ? playbackTime : 0;
                                                    const progressPct = totalSecs > 0 ? Math.min((elapsed / totalSecs) * 100, 100) : 0;

                                                    return (
                                                        <div className={`flex items-center gap-2.5 mb-2 min-w-[220px] px-1`}>
                                                            {/* Play / Pause button */}
                                                            <button
                                                                className={`shrink-0 p-2 rounded-full transition-colors ${msg.isMine
                                                                    ? "bg-white/25 hover:bg-white/40"
                                                                    : "bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200"
                                                                    }`}
                                                                onClick={() => handleToggleAudio(msg.fileUrl!, msg._id)}
                                                            >
                                                                {isPlaying
                                                                    ? <Pause className={`w-4 h-4 ${msg.isMine ? "text-white" : "text-blue-600"}`} />
                                                                    : <Play className={`w-4 h-4 ${msg.isMine ? "text-white" : "text-blue-600"}`} />}
                                                            </button>

                                                            {/* Progress track + time */}
                                                            <div className="flex-1 flex flex-col gap-1 min-w-0">
                                                                {/* Waveform / progress bar */}
                                                                <div
                                                                    className={`w-full h-1.5 rounded-full overflow-hidden ${msg.isMine ? "bg-white/25" : "bg-gray-300 dark:bg-gray-700"
                                                                        }`}
                                                                >
                                                                    <div
                                                                        className={`h-full rounded-full transition-all duration-200 ${msg.isMine ? "bg-white" : "bg-blue-500"
                                                                            }`}
                                                                        style={{ width: `${progressPct}%` }}
                                                                    />
                                                                </div>
                                                                {/* Time */}
                                                                <div className={`flex justify-between text-[10px] font-mono ${msg.isMine ? "text-blue-100/70" : "text-gray-500"
                                                                    }`}>
                                                                    <span>{formatTime(elapsed)}</span>
                                                                    <span>{totalSecs > 0 ? formatTime(totalSecs) : "--:--"}</span>
                                                                </div>
                                                            </div>

                                                            <Mic className={`shrink-0 w-3 h-3 ${msg.isMine ? "text-blue-200" : "text-gray-400"}`} />
                                                        </div>
                                                    );
                                                })()}

                                                <p className="break-words leading-relaxed" style={{ fontSize: "15px" }}>{renderContent(msg.content)}</p>

                                                <div className={`flex items-center gap-2 mt-1 ${msg.isMine ? "justify-end" : "justify-start"}`}>
                                                    {msg.isEdited && (
                                                        <span className={`text-[10px] italic ${msg.isMine ? "text-blue-100/60" : "text-gray-400"}`}>edited</span>
                                                    )}
                                                    <span className={`text-[10px] ${msg.isMine ? "text-blue-100/70" : "text-gray-400"}`}>
                                                        {timeStr}
                                                    </span>
                                                    {msg.isMine && !msg.isDeleted && (
                                                        <div className="flex -ml-1">
                                                            {isReadByAll ? (
                                                                <CheckCheck className="w-3.5 h-3.5 text-blue-300" />
                                                            ) : isDeliveredByAll ? (
                                                                <CheckCheck className="w-3.5 h-3.5 text-blue-100/50" />
                                                            ) : (
                                                                <Check className="w-3.5 h-3.5 text-blue-100/50" />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {!msg.isDeleted && (
                                                    <div className={`absolute top-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white dark:bg-[#222] rounded-full shadow-lg border border-gray-100 dark:border-gray-800 z-10 ${msg.isMine ? "right-full mr-2" : "left-full ml-2"}`}>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <button className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-full transition-colors">
                                                                    <Smile className="w-4 h-4" />
                                                                </button>
                                                            </PopoverTrigger>
                                                            <PopoverContent side="top" className="p-1 w-fit bg-white dark:bg-[#222] border dark:border-gray-800 shadow-xl rounded-full flex gap-1 animate-in zoom-in-95 duration-200">
                                                                {EMOJIS.map(emoji => (
                                                                    <button
                                                                        key={emoji}
                                                                        onClick={() => toggleReaction({ messageId: msg._id, emoji })}
                                                                        className="hover:scale-125 transition-transform p-1 rounded-md"
                                                                    >
                                                                        {emoji}
                                                                    </button>
                                                                ))}
                                                            </PopoverContent>
                                                        </Popover>

                                                        <button
                                                            onClick={() => setReplyTo(msg)}
                                                            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-full transition-colors"
                                                            title="Reply"
                                                        >
                                                            <Reply className="w-4 h-4" />
                                                        </button>

                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <button className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-full transition-colors">
                                                                    <MoreVertical className="w-4 h-4" />
                                                                </button>
                                                            </PopoverTrigger>
                                                            <PopoverContent side="top" className="w-40 p-1 dark:bg-[#1a1a1a] dark:border-gray-800">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="w-full justify-start text-[11px] h-8 gap-2"
                                                                    onClick={() => togglePinMessage({ conversationId, messageId: msg._id })}
                                                                >
                                                                    <Clock className="w-3.5 h-3.5" /> {conversation?.pinnedMessageIds?.includes(msg._id) ? "Unpin Message" : "Pin Message"}
                                                                </Button>
                                                                {msg.isMine && (
                                                                    <>
                                                                        <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-8 gap-2" onClick={() => {
                                                                            setEditingMsg(msg);
                                                                            setNewMessage(msg.content);
                                                                        }}>
                                                                            <Pencil className="w-3.5 h-3.5" /> Edit
                                                                        </Button>
                                                                        <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-8 gap-2 text-red-500" onClick={() => deleteMessage({ messageId: msg._id })}>
                                                                            <Globe className="w-3.5 h-3.5" /> Delete for Everyone
                                                                        </Button>
                                                                    </>
                                                                )}
                                                                <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-8 gap-2" onClick={() => deleteForMe({ messageId: msg._id })}>
                                                                    <Trash2 className="w-3.5 h-3.5" /> Delete for Me
                                                                </Button>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                )}
                                            </div>

                                            {Object.keys(groupedReactions).length > 0 && (
                                                <div className={`flex flex-wrap gap-1 mt-1 ${msg.isMine ? "justify-end" : "justify-start"}`}>
                                                    {Object.entries(groupedReactions).map(([emoji, count]: [string, any]) => (
                                                        <button
                                                            key={emoji}
                                                            onClick={() => toggleReaction({ messageId: msg._id, emoji })}
                                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium border transition-all ${reactions.some((r: any) => r.emoji === emoji && r.userId === userId)
                                                                ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400"
                                                                : "bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700"
                                                                }`}
                                                        >
                                                            <span>{emoji}</span>
                                                            <span className="text-[10px]">{count}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        {typingUsers && typingUsers.length > 0 && (
                            <div className="flex items-center gap-3 ml-2 px-3 py-1.5 bg-gray-100/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-2xl w-fit animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex gap-1">
                                    <span className="typing-dot" />
                                    <span className="typing-dot" />
                                    <span className="typing-dot" />
                                </div>
                                <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                                    {typingUsers.length === 1 ? `${typingUsers[0].name} is typing` : `${typingUsers.length} people are typing`}
                                </span>
                            </div>
                        )}
                        <div ref={scrollRef} className="h-1" />
                    </div>

                    {showAutoScroll && (
                        <button
                            onClick={() => {
                                setShowAutoScroll(false);
                                scrollRef.current?.scrollIntoView({ behavior: "smooth" });
                            }}
                            className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium z-10"
                        >
                            ↓ New messages
                        </button>
                    )}

                    <footer className="p-4 bg-white/70 dark:bg-[#1a1a1a]/70 backdrop-blur-md border-t dark:border-gray-800 space-y-4">
                        {isUploading && (
                            <div className="max-w-4xl mx-auto h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                            </div>
                        )}
                        {replyTo && (
                            <div className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-900/10 p-2.5 px-4 rounded-xl border border-blue-100/50 dark:border-blue-900/30 animate-in slide-in-from-bottom-3 duration-300 max-w-4xl mx-auto backdrop-blur-sm">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <Reply className="w-4 h-4 text-blue-500 shrink-0" />
                                    <div className="text-sm truncate">
                                        <span className="font-bold text-blue-700 dark:text-blue-300">Replying to {replyTo.senderDetails?.name}</span>
                                        <p className="text-gray-500 dark:text-gray-400 truncate italic">"{replyTo.content}"</p>
                                    </div>
                                </div>
                                <button onClick={() => setReplyTo(null)} className="p-1.5 hover:bg-white/50 dark:hover:bg-gray-800 rounded-full transition-all hover:scale-110">
                                    <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                </button>
                            </div>
                        )}
                        {editingMsg && (
                            <div className="flex items-center justify-between bg-amber-50/50 dark:bg-amber-900/10 p-2.5 px-4 rounded-xl border border-amber-100/50 dark:border-amber-900/30 animate-in slide-in-from-bottom-3 duration-300 max-w-4xl mx-auto backdrop-blur-sm">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <Pencil className="w-4 h-4 text-amber-500 shrink-0" />
                                    <div className="text-sm truncate">
                                        <span className="font-bold text-amber-700 dark:text-amber-300">Editing message</span>
                                        <p className="text-gray-500 dark:text-gray-400 truncate italic">"{editingMsg.content}"</p>
                                    </div>
                                </div>
                                <button onClick={() => { setEditingMsg(null); setNewMessage(""); }} className="p-1.5 hover:bg-white/50 dark:hover:bg-gray-800 rounded-full transition-all hover:scale-110">
                                    <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                </button>
                            </div>
                        )}

                        <div className="flex items-center gap-3 max-w-4xl mx-auto">
                            <div className="flex gap-1">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors">
                                            <Smile className="w-5 h-5" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent side="top" className="p-0 border-none bg-transparent shadow-none w-auto mb-2">
                                        <EmojiPicker
                                            theme={theme === "dark" ? EmojiTheme.DARK : EmojiTheme.LIGHT}
                                            onEmojiClick={(emojiData) => setNewMessage(p => p + emojiData.emoji)}
                                        />
                                    </PopoverContent>
                                </Popover>

                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors"
                                >
                                    <Paperclip className="w-5 h-5" />
                                </button>
                                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                            </div>

                            <form onSubmit={handleSend} className="flex-1 flex gap-3 items-center">
                                <div className="flex-1 relative group">
                                    <Input
                                        value={newMessage}
                                        onChange={handleInputChange}
                                        placeholder={isBlocked ? "You have blocked this user" : isRecording ? "Listening..." : "Type something amazing..."}
                                        className="flex-1 rounded-2xl bg-gray-100/50 dark:bg-gray-900/50 border-white/20 dark:border-gray-800 focus-visible:ring-blue-500/50 pb-3 pt-3 px-5 h-12 text-[15px] shadow-sm backdrop-blur-sm dark:text-gray-100 dark:placeholder:text-gray-600 transition-all group-focus-within:bg-white dark:group-focus-within:bg-black group-focus-within:shadow-md"
                                        disabled={isRecording || isBlocked}
                                    />
                                </div>

                                {newMessage.trim() || editingMsg ? (
                                    <Button
                                        type="submit"
                                        size="icon"
                                        className="rounded-2xl w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20 shrink-0"
                                    >
                                        <Send className="w-5 h-5 text-white" />
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        size="icon"
                                        onClick={isRecording ? stopRecording : startRecording}
                                        className={`rounded-2xl w-12 h-12 transition-all hover:scale-105 active:scale-95 shadow-lg shrink-0 ${isRecording
                                            ? "bg-red-500 hover:bg-red-600 shadow-red-500/20 animate-pulse"
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                            }`}
                                    >
                                        {isRecording ? <StopCircle className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5" />}
                                    </Button>
                                )}
                            </form>
                        </div>
                    </footer>
                </div>

                <div className={`absolute top-0 right-0 bottom-0 w-full md:w-80 bg-white dark:bg-[#111] border-l dark:border-gray-800 z-30 transition-transform duration-300 shadow-xl overflow-y-auto ${showInfo ? "translate-x-0" : "translate-x-full"}`}>
                    <div className="p-4 border-b dark:border-gray-800 bg-gray-50 dark:bg-[#1a1a1a] flex items-center justify-between sticky top-0 z-10">
                        <h3 className="font-bold dark:text-gray-100 flex items-center gap-2">
                            {conversation.isGroup ? <Settings2 className="w-4 h-4 text-gray-400" /> : <User className="w-4 h-4 text-gray-400" />}
                            {conversation.isGroup ? "Group Info" : "Contact Info"}
                        </h3>
                        <Button variant="ghost" size="icon" onClick={() => setShowInfo(false)} className="h-8 w-8 rounded-full">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="p-6 flex flex-col items-center border-b dark:border-gray-800 bg-gradient-to-b from-gray-50/50 to-transparent dark:from-white/5">
                        <div className={`w-28 h-28 rounded-3xl shadow-2xl border-4 border-white dark:border-gray-700 overflow-hidden mb-4 flex items-center justify-center text-white text-4xl font-black ${conversation.isGroup ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-gray-100"}`}>
                            {conversation.isGroup ? (
                                conversation.name.substring(0, 1).toUpperCase()
                            ) : (
                                <img src={conversation.imageUrl || "https://github.com/shadcn.png"} alt="avatar" className="w-full h-full object-cover" />
                            )}
                        </div>
                        <h2 className="text-xl font-black dark:text-white text-center flex items-center gap-2">
                            {conversation.name}
                            {conversation.isGroup && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-40 hover:opacity-100" onClick={() => {
                                    const newName = prompt("New group name:", conversation.name);
                                    if (newName) renameGroup({ conversationId, name: newName });
                                }}>
                                    <Settings2 className="w-3.5 h-3.5" />
                                </Button>
                            )}
                        </h2>
                        {conversation.isGroup ? (
                            <p className="text-xs text-blue-500 font-bold mt-1 uppercase tracking-widest">{conversation.memberCount} Members • {onlineCount} Online</p>
                        ) : (
                            <span className={`text-[11px] font-bold mt-1 uppercase tracking-widest ${conversation.isOnline ? "text-green-500" : "text-gray-400"}`}>
                                {conversation.isOnline ? "Active Now" : "Offline"}
                            </span>
                        )}
                    </div>


                    <div className="p-4 space-y-6">
                        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                            {['members', 'media', 'files'].map((tab) => (
                                (tab !== 'members' || conversation.isGroup) && (
                                    <button
                                        key={tab}
                                        onClick={() => setInfoTab(tab as any)}
                                        className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${infoTab === tab
                                            ? "bg-white dark:bg-gray-700 text-blue-600 shadow-sm"
                                            : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                            }`}
                                    >
                                        {tab}
                                    </button>
                                )
                            ))}
                        </div>

                        {infoTab === 'members' && conversation.isGroup && (
                            <div>
                                <div className="flex items-center justify-between mb-4 px-1">
                                    <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <Users className="w-3.5 h-3.5" />
                                        Members list
                                    </h4>
                                    <AddMemberDialog
                                        conversationId={conversationId}
                                        currentMemberIds={members?.map(m => m._id as Id<"users">) || []}
                                    />
                                </div>
                                <div className="space-y-1">
                                    {members?.map(m => (
                                        <div key={m._id} className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-all group/member">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="relative shrink-0">
                                                    <Avatar className="h-9 w-9 border dark:border-gray-800 shadow-sm">
                                                        <AvatarImage src={m.imageUrl} />
                                                        <AvatarFallback className="text-xs">{m.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    {m.isOnline && (
                                                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#111] rounded-full" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold dark:text-gray-100 truncate flex items-center gap-1.5">
                                                        {m.name}
                                                        {m.isAdmin && <ShieldCheck className="w-3 h-3 text-amber-500" />}
                                                    </p>
                                                    <div className="text-[10px] text-gray-500 flex items-center gap-1">
                                                        {m.isOnline ? (
                                                            <span className="text-green-500 font-bold">Online</span>
                                                        ) : (
                                                            <>
                                                                <Clock className="w-2.5 h-2.5" />
                                                                {m.lastSeen ? `Seen ${formatDistanceToNow(m.lastSeen)} ago` : 'Offline'}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {m.clerkId !== userId && members?.find(me => me.clerkId === userId)?.isAdmin && (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover/member:opacity-100 transition-opacity">
                                                            <MoreVertical className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-32 p-1 dark:bg-[#1a1a1a] dark:border-gray-800">
                                                        <Button variant="ghost" size="sm" className="w-full justify-start text-[11px] text-red-500 h-8 font-bold" onClick={() => {
                                                            if (confirm(`Remove ${m.name} from group?`)) {
                                                                removeMember({ conversationId, userId: m._id as Id<"users"> });
                                                            }
                                                        }}>
                                                            <UserMinus className="w-3.5 h-3.5 mr-2" /> Remove
                                                        </Button>
                                                    </PopoverContent>
                                                </Popover>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {infoTab === 'media' && (
                            <div className="grid grid-cols-3 gap-2">
                                {!sharedAssets ? (
                                    <div className="col-span-3 flex justify-center py-8">
                                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : sharedAssets.media.length === 0 ? (
                                    <p className="col-span-3 text-center text-xs text-gray-500 py-8">No shared media yet</p>
                                ) : (
                                    sharedAssets.media.map((asset: any) => (
                                        <div
                                            key={asset._id}
                                            className="aspect-square rounded-lg overflow-hidden border dark:border-gray-800 hover:opacity-80 cursor-pointer transition-opacity"
                                            onClick={() => window.open(asset.fileUrl, "_blank")}
                                        >
                                            <img src={asset.fileUrl} className="w-full h-full object-cover" loading="lazy" />
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {infoTab === 'files' && (
                            <div className="space-y-2">
                                {!sharedAssets ? (
                                    <div className="flex justify-center py-8">
                                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : sharedAssets.files.length === 0 ? (
                                    <p className="text-center text-xs text-gray-500 py-8">No shared files yet</p>
                                ) : (
                                    sharedAssets.files.map((asset: any) => (
                                        <div key={asset._id} className="flex items-center gap-3 p-3 rounded-xl border dark:border-gray-800 bg-gray-50 dark:bg-white/5 group hover:border-blue-500/50 transition-colors">
                                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                                                <FileIcon className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold truncate dark:text-gray-200">{asset.fileName}</p>
                                                <p className="text-[10px] text-gray-500">
                                                    {(asset.fileSize / 1024).toFixed(1)} KB • {format(asset._creationTime, "MMM d")}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const link = document.createElement('a');
                                                    link.href = asset.fileUrl;
                                                    link.download = asset.fileName;
                                                    link.target = "_blank";
                                                    link.click();
                                                }}
                                                className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full"
                                                title="Download"
                                            >
                                                <Download className="w-3.5 h-3.5 text-blue-500" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {conversation.isGroup && (
                            <div className="pt-4 border-t dark:border-gray-800">
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 font-bold text-sm h-12 rounded-xl"
                                    onClick={() => {
                                        if (confirm("Leave this group?")) {
                                            leaveGroup({ conversationId });
                                            onBack();
                                        }
                                    }}
                                >
                                    <LogOut className="w-5 h-5" /> Leave Group
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
                {/* Audio is created imperatively via useEffect — no JSX tag needed */}
            </div>
        </div>
    );
}
