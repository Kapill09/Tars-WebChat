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
import { Search, Users, X, Check } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface CreateGroupDialogProps {
    onSelect: (id: Id<"conversations">) => void;
}

export function CreateGroupDialog({ onSelect }: CreateGroupDialogProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [groupName, setGroupName] = useState("");
    const [selectedUsers, setSelectedUsers] = useState<Id<"users">[]>([]);

    const users = useQuery(api.users.getUsers);
    const createGroup = useMutation(api.conversations.createGroup);

    const filteredUsers = users?.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    const toggleUser = (userId: Id<"users">) => {
        setSelectedUsers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleCreate = async () => {
        if (!groupName.trim() || selectedUsers.length === 0) return;
        try {
            const convId = await createGroup({
                participantIds: selectedUsers,
                name: groupName.trim()
            });
            setOpen(false);
            setGroupName("");
            setSelectedUsers([]);
            onSelect(convId);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="hover:bg-gray-200 dark:hover:bg-gray-800" title="Create Group">
                    <Users className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-white dark:bg-[#1a1a1a] border dark:border-gray-800">
                <DialogHeader>
                    <DialogTitle className="dark:text-gray-100">Create Group Chat</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase">Group Name</label>
                        <Input
                            placeholder="Enter group name..."
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase">Add Members ({selectedUsers.length})</label>
                        <div className="flex items-center space-x-2 border dark:border-gray-700 rounded-md px-3 py-1.5 bg-gray-50 dark:bg-gray-900">
                            <Search className="w-4 h-4 text-gray-500" />
                            <Input
                                placeholder="Search users..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="border-0 h-8 focus-visible:ring-0 bg-transparent dark:text-gray-100"
                            />
                        </div>
                    </div>

                    <div className="max-h-[250px] overflow-y-auto space-y-1 relative pr-1">
                        {users === undefined ? (
                            <div className="text-center py-4 text-gray-500 animate-pulse">Loading...</div>
                        ) : filteredUsers?.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">No users found.</div>
                        ) : (
                            filteredUsers?.map((u) => (
                                <button
                                    key={u._id}
                                    onClick={() => toggleUser(u._id)}
                                    className={`w-full flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-left ${selectedUsers.includes(u._id) ? "bg-blue-50 dark:bg-blue-900/20" : ""
                                        }`}
                                >
                                    <Avatar className="h-9 w-9 border dark:border-gray-700">
                                        <AvatarImage src={u.imageUrl} />
                                        <AvatarFallback className="dark:bg-gray-700 dark:text-gray-200">{u.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm truncate dark:text-gray-100">{u.name}</div>
                                        <div className="text-xs text-gray-500 truncate">{u.email}</div>
                                    </div>
                                    {selectedUsers.includes(u._id) && (
                                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    <Button
                        onClick={handleCreate}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-full h-11"
                        disabled={!groupName.trim() || selectedUsers.length === 0}
                    >
                        Create Group
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
