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
import { Search, UserPlus, X, Check } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

interface AddMemberDialogProps {
    conversationId: Id<"conversations">;
    currentMemberIds: Id<"users">[];
}

export function AddMemberDialog({ conversationId, currentMemberIds }: AddMemberDialogProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<Id<"users">[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const users = useQuery(api.users.getUsers);
    const addMembers = useMutation(api.conversations.addMembers);

    const filteredUsers = users?.filter((u) => {
        const isAlreadyMember = currentMemberIds.includes(u._id);
        const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase());
        return !isAlreadyMember && matchesSearch;
    });

    const toggleUser = (userId: Id<"users">) => {
        setSelectedIds((prev) =>
            prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId]
        );
    };

    const handleAddMembers = async () => {
        if (selectedIds.length === 0) return;
        setIsSubmitting(true);
        try {
            await addMembers({
                conversationId,
                userIds: selectedIds,
            });
            toast.success("Members added");
            setOpen(false);
            setSelectedIds([]);
        } catch (error) {
            toast.error("Failed to add members");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                    <UserPlus className="w-4 h-4" />
                    Add Members
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] p-0 gap-0 overflow-hidden bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-xl border-gray-200 dark:border-gray-800">
                <DialogHeader className="p-4 border-b dark:border-gray-800">
                    <DialogTitle>Add Members</DialogTitle>
                </DialogHeader>
                <div className="p-4 bg-gray-50/50 dark:bg-black/20">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search users..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 bg-white dark:bg-[#111] border-gray-200 dark:border-gray-800 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {selectedIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 border-b dark:border-gray-800 bg-white dark:bg-[#1a1a1a] max-h-24 overflow-y-auto">
                        {selectedIds.map((id) => {
                            const user = users?.find(u => u._id === id);
                            return (
                                <div key={id} className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full text-xs animate-in zoom-in-95">
                                    <span className="truncate max-w-[100px]">{user?.name}</span>
                                    <button onClick={() => toggleUser(id)}><X className="w-3 h-3 hover:text-blue-900 dark:hover:text-blue-100" /></button>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                    {filteredUsers === undefined ? (
                        <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="p-8 text-center text-sm text-gray-500">No users found</div>
                    ) : (
                        filteredUsers.map((user) => (
                            <button
                                key={user._id}
                                onClick={() => toggleUser(user._id)}
                                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10 border dark:border-gray-800">
                                        <AvatarImage src={user.imageUrl} />
                                        <AvatarFallback>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="text-left">
                                        <p className="text-sm font-semibold dark:text-white">{user.name}</p>
                                        <p className="text-xs text-gray-500 truncate max-w-[180px]">{user.email}</p>
                                    </div>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedIds.includes(user._id)
                                        ? "bg-blue-500 border-blue-500"
                                        : "border-gray-300 dark:border-gray-700"
                                    }`}>
                                    {selectedIds.includes(user._id) && <Check className="w-3.5 h-3.5 text-white" />}
                                </div>
                            </button>
                        ))
                    )}
                </div>

                <div className="p-4 border-t dark:border-gray-800 bg-gray-50/50 dark:bg-black/20 flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button
                        disabled={selectedIds.length === 0 || isSubmitting}
                        onClick={handleAddMembers}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isSubmitting ? "Adding..." : `Add ${selectedIds.length > 0 ? `(${selectedIds.length})` : ""}`}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
