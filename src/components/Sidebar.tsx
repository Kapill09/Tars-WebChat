"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { UserButton } from "@clerk/nextjs";
import { formatDistanceToNow, isToday, format } from "date-fns";
import { UserListDialog } from "./UserListDialog";
import { ProfileDialog } from "./ProfileDialog";
import { ThemeToggle } from "./ThemeToggle";
import { CreateGroupDialog } from "./CreateGroupDialog";
import { Id } from "../../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, Hash } from "lucide-react";
import { Button } from "./ui/button";

interface SidebarProps {
    onSelectConversation: (id: Id<"conversations">) => void;
    selectedId: Id<"conversations"> | null;
}

export function Sidebar({ onSelectConversation, selectedId }: SidebarProps) {
    const conversations = useQuery(api.conversations.listConversations);
    const currentUser = useQuery(api.users.getCurrentUser);

    const [isCollapsed, setIsCollapsed] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("sidebarCollapsed") === "true";
        }
        return false;
    });

    const toggleCollapse = () => {
        const next = !isCollapsed;
        setIsCollapsed(next);
        localStorage.setItem("sidebarCollapsed", String(next));
    };

    const formatMessageTime = (time: number) => {
        const d = new Date(time);
        if (isToday(d)) return format(d, "h:mm a");
        if (d.getFullYear() < new Date().getFullYear()) return format(d, "MMM d, yyyy");
        return format(d, "MMM d");
    };

    return (
        <aside className={`relative h-full flex flex-col border-r transition-all duration-300 ease-in-out bg-white/80 dark:bg-[#111]/80 backdrop-blur-xl dark:border-gray-800 ${selectedId ? "hidden md:flex" : "flex"
            } ${isCollapsed ? "w-20" : "w-full md:w-80 lg:w-96"}`}>

            <div className={`p-4 flex items-center border-b dark:border-gray-800 shrink-0 h-[72px] transition-all ${isCollapsed ? "justify-center" : "justify-between bg-gray-50/50 dark:bg-[#1a1a1a]/50"
                }`}>
                <div className={`flex items-center gap-2 overflow-hidden transition-all ${isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>
                    <UserButton />
                    {currentUser && (
                        <h1 className="font-bold text-lg max-w-[100px] truncate dark:text-white tracking-tight">{currentUser.name}</h1>
                    )}
                </div>

                <div className="flex gap-0.5 items-center">
                    {!isCollapsed && (
                        <>
                            <ThemeToggle />
                            <CreateGroupDialog onSelect={onSelectConversation} />
                            <ProfileDialog />
                            <UserListDialog onSelect={onSelectConversation} />
                        </>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleCollapse}
                        className={`h-8 w-8 text-gray-400 hover:text-gray-600 dark:hover:text-white ${isCollapsed ? "" : "hidden md:flex"}`}
                    >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {conversations === undefined ? (
                    <div className="p-4 space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex gap-3 animate-pulse">
                                <div className="w-12 h-12 bg-gray-200 rounded-full shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                        <p>No conversations yet.</p>
                        <p className="text-sm mt-1">Start a new chat to begin!</p>
                    </div>
                ) : (
                    conversations.map((c) => (
                        <button
                            key={c.id}
                            onClick={() => onSelectConversation(c.id)}
                            className={`w-full flex items-center gap-3 p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-all border-b dark:border-gray-800 last:border-0 relative ${selectedId === c.id ? "bg-blue-50/50 dark:bg-blue-900/20" : ""
                                } ${isCollapsed ? "justify-center" : ""}`}
                        >
                            {selectedId === c.id && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
                            )}
                            <div className="relative shrink-0">
                                <Avatar className={`border dark:border-gray-700 transition-all ${isCollapsed ? "h-11 w-11" : "h-12 w-12"}`}>
                                    {c.isGroup ? (
                                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 h-full w-full flex items-center justify-center text-white font-bold text-lg">
                                            {c.name.substring(0, 1).toUpperCase()}
                                        </div>
                                    ) : (
                                        <>
                                            <AvatarImage src={c.imageUrl} alt={c.name} />
                                            <AvatarFallback className="dark:bg-gray-700 dark:text-gray-200">{c.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </>
                                    )}
                                </Avatar>
                                {!c.isGroup && c.isOnline && (
                                    <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-[#111] rounded-full" />
                                )}
                                {c.isGroup && !isCollapsed && (
                                    <span className="absolute -top-1 -right-1 bg-gray-500 text-white text-[9px] px-1 rounded-full border border-white dark:border-gray-800">
                                        {c.memberCount}
                                    </span>
                                )}
                            </div>

                            <div className={`flex-1 min-w-0 text-left transition-all overflow-hidden ${isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <span className={`font-bold truncate pr-1 dark:text-white flex items-center gap-1`}>
                                        {c.isGroup && <Hash className="w-3.5 h-3.5 text-blue-500" />}
                                        {c.name}
                                    </span>
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 uppercase font-medium">
                                        {formatMessageTime(c.lastMessageTime)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className={`text-sm truncate pr-2 ${c.unreadCount > 0 ? "font-bold text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}>
                                        {c.lastMessage}
                                    </p>
                                    {c.unreadCount > 0 && (
                                        <span className="bg-blue-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 animate-in zoom-in duration-300">
                                            {c.unreadCount}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </aside>
    );
}
