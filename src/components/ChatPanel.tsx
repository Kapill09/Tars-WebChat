"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Trash2, Smile, Reply, X, Users, MoreVertical, List, UserPlus, LogOut, Settings2, ShieldCheck, Clock, Paperclip, Mic, StopCircle, Play, Pause, FileIcon, Check, CheckCheck, Pencil, UserMinus, Globe } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
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
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Create the audio element imperatively so the browser never tries to load
    // a src-less <audio> tag (which causes NotSupportedError on mount).
    useEffect(() => {
        const audio = new Audio();
        audio.onended = () => setPlayingAudioId(null);
        audio.onpause = () => setPlayingAudioId(null);
        audioRef.current = audio;
        return () => {
            audio.pause();
            audio.src = "";
            audioRef.current = null;
        };
    }, []);

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

    const onlineMembers = members?.filter(m => m.isOnline) || [];
    const onlineCount = onlineMembers.length;

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
                const blob = new Blob(chunks, { type: mimeType });
                setAudioBlob(blob);

                // Derive a clean base type (strip codec params) for the Content-Type header
                const baseType = mimeType.split(";")[0]; // e.g. "audio/webm"
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
                        // Store the exact MIME type so the player can set <source type>
                        voiceMimeType: baseType,
                    });
                } catch (uploadErr) {
                    console.error("Voice upload failed", uploadErr);
                    toast.error("Voice upload failed");
                }
                setAudioBlob(null);
            };

            recorder.start();
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
                                <span className={`text-[11px] font-semibold px-2 rounded-full ${conversation.isOnline
                                    ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
                                    : "text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800"
                                    }`}>
                                    {conversation.isOnline ? "Active Now" : "Currently Offline"}
                                </span>
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
                        <PopoverContent align="end" className="w-48 p-1 dark:bg-[#1a1a1a] dark:border-gray-800">
                            <Button variant="ghost" className="w-full justify-start text-xs h-9 gap-2" onClick={() => setShowInfo(true)}>
                                <List className="w-4 h-4" /> Group Info
                            </Button>
                            {conversation.isGroup && (
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
                            )}
                        </PopoverContent>
                    </Popover>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                <div className={`flex-1 flex flex-col transition-all duration-300 ${showInfo ? "mr-0 md:mr-80" : "mr-0"}`}>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4" onScroll={handleScroll}>
                        {messages?.length === 0 ? (
                            <div className="flex-1 h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                                Send a message to start the conversation!
                            </div>
                        ) : (
                            messages?.map((msg) => {
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

                                            <div className={`p-3.5 rounded-2xl relative transition-all duration-300 group-hover:shadow-md ${msg.isDeleted
                                                ? "bg-gray-100 dark:bg-gray-800/50 italic text-gray-500 border border-gray-200 dark:border-gray-700/50 shadow-sm"
                                                : msg.isMine
                                                    ? "bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md hover:shadow-blue-500/20"
                                                    : "bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-100 shadow-sm hover:border-blue-200 dark:hover:border-blue-900/30"
                                                } ${msg.isMine ? "rounded-br-sm" : "rounded-bl-sm"} ${msg.replyDetails ? "rounded-t-none" : ""}`}>

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

                                                {!msg.isDeleted && msg.fileType === "voice" && (
                                                    <div className={`flex flex-col gap-1 mb-2 min-w-[220px]`}>
                                                        <audio
                                                            controls
                                                            controlsList="nodownload"
                                                            className={`w-full h-9 rounded-lg ${msg.isMine
                                                                    ? "[&::-webkit-media-controls-panel]:bg-blue-700 [&::-webkit-media-controls-current-time-display]:text-white [&::-webkit-media-controls-time-remaining-display]:text-white"
                                                                    : ""
                                                                }`}
                                                        >
                                                            <source
                                                                src={msg.fileUrl!}
                                                                type={(msg as any).voiceMimeType || "audio/webm"}
                                                            />
                                                            Your browser does not support audio playback.
                                                        </audio>
                                                    </div>
                                                )}

                                                <p className="break-words leading-relaxed" style={{ fontSize: "15px" }}>{msg.content}</p>

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
                            <div className="flex items-center gap-2 p-2 bg-white/50 dark:bg-black/20 rounded-lg w-fit animate-pulse">
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                                </div>
                                <span className="text-xs text-gray-500 font-medium italic">
                                    {typingUsers.length === 1 ? `${typingUsers[0].name} is typing...` : `${typingUsers.length} users are typing...`}
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
                                        placeholder={isRecording ? "Listening..." : "Type something amazing..."}
                                        className="flex-1 rounded-2xl bg-gray-100/50 dark:bg-gray-900/50 border-white/20 dark:border-gray-800 focus-visible:ring-blue-500/50 pb-3 pt-3 px-5 h-12 text-[15px] shadow-sm backdrop-blur-sm dark:text-gray-100 dark:placeholder:text-gray-600 transition-all group-focus-within:bg-white dark:group-focus-within:bg-black group-focus-within:shadow-md"
                                        disabled={isRecording}
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

                {/* Group Info Sidebar */}
                <div className={`absolute top-0 right-0 bottom-0 w-full md:w-80 bg-white dark:bg-[#111] border-l dark:border-gray-800 z-30 transition-transform duration-300 shadow-xl overflow-y-auto ${showInfo ? "translate-x-0" : "translate-x-full"}`}>
                    <div className="p-4 border-b dark:border-gray-800 bg-gray-50 dark:bg-[#1a1a1a] flex items-center justify-between sticky top-0 z-10">
                        <h3 className="font-bold dark:text-gray-100 flex items-center gap-2">
                            <Settings2 className="w-4 h-4 text-gray-400" />
                            Group Info
                        </h3>
                        <Button variant="ghost" size="icon" onClick={() => setShowInfo(false)} className="h-8 w-8 rounded-full">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="p-6 flex flex-col items-center border-b dark:border-gray-800 bg-gradient-to-b from-gray-50/50 to-transparent dark:from-white/5">
                        <div className={`w-28 h-28 rounded-3xl shadow-2xl border-4 border-white dark:border-gray-700 overflow-hidden mb-4 flex items-center justify-center text-white text-4xl font-black ${conversation.isGroup ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-gray-200"}`}>
                            {conversation.isGroup ? conversation.name.substring(0, 1).toUpperCase() : "?"}
                        </div>
                        <h2 className="text-xl font-black dark:text-white text-center flex items-center gap-2">
                            {conversation.name}
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-40 hover:opacity-100" onClick={() => {
                                const newName = prompt("New group name:", conversation.name);
                                if (newName) renameGroup({ conversationId, name: newName });
                            }}>
                                <Settings2 className="w-3.5 h-3.5" />
                            </Button>
                        </h2>
                        <p className="text-xs text-blue-500 font-bold mt-1 uppercase tracking-widest">{conversation.memberCount} Members • {onlineCount} Online</p>
                    </div>

                    <div className="p-4 space-y-6">
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
                    </div>
                </div>
            </div>
            {/* Audio is created imperatively via useEffect — no JSX tag needed */}
        </div>
    );
}
