"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MessageCirclePlus, X } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserListDialogProps {
    onSelect: (id: Id<"conversations">) => void;
}

export function UserListDialog({ onSelect }: UserListDialogProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const users = useQuery(api.users.getUsers);

    const filteredUsers = users?.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );
    const createConversation = useMutation(api.conversations.createConversation);

    const startChat = async (userId: Id<"users">) => {
        try {
            const convId = await createConversation({ participantId: userId });
            setOpen(false);
            onSelect(convId);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="hover:bg-gray-200">
                    <MessageCirclePlus className="w-6 h-6" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-white dark:bg-[#1a1a1a] border dark:border-gray-800">
                <DialogHeader>
                    <DialogTitle className="dark:text-gray-100">New Chat</DialogTitle>
                </DialogHeader>
                <div className="flex items-center space-x-2 border dark:border-gray-700 rounded-md px-3 py-2 mt-4 bg-gray-50 dark:bg-gray-900 focus-within:ring-2 disabled:opacity-50">
                    <Search className="w-5 h-5 text-gray-500" />
                    <Input
                        placeholder="Search users..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="border-0 focus-visible:ring-0 bg-transparent dark:text-gray-100 dark:placeholder:text-gray-500"
                    />
                    {search && (
                        <button onClick={() => setSearch("")}>
                            <X className="w-5 h-5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100" />
                        </button>
                    )}
                </div>
                <div className="mt-4 max-h-[300px] overflow-y-auto space-y-2 relative">
                    {users === undefined ? (
                        <div className="text-center py-4 text-gray-500 animate-pulse">Loading...</div>
                    ) : filteredUsers?.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">No users found.</div>
                    ) : (
                        filteredUsers?.map((u) => (
                            <button
                                key={u._id}
                                onClick={() => startChat(u._id)}
                                className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
                            >
                                <div className="relative shrink-0">
                                    <Avatar className="h-10 w-10 border dark:border-gray-700">
                                        <AvatarImage src={u.imageUrl} alt={u.name} />
                                        <AvatarFallback className="dark:bg-gray-700 dark:text-gray-200">{u.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    {u.isOnline && (
                                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#1a1a1a] rounded-full" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm truncate dark:text-gray-100">{u.name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
