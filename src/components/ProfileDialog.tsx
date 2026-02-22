"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function ProfileDialog() {
    const [open, setOpen] = useState(false);
    const currentUser = useQuery(api.users.getCurrentUser);
    const updateProfile = useMutation(api.users.updateProfile);

    const [name, setName] = useState("");
    const [imageUrl, setImageUrl] = useState("");

    // Sync input states when user data loads or dialog opens
    useEffect(() => {
        if (currentUser) {
            setName(currentUser.name);
            setImageUrl(currentUser.imageUrl);
        }
    }, [currentUser, open]);

    const handleSave = async () => {
        if (!name.trim()) return;
        await updateProfile({
            name: name.trim(),
            imageUrl: imageUrl.trim() || undefined,
        });
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:bg-gray-200 dark:hover:bg-gray-800" title="Profile Settings">
                    <Settings className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-white dark:bg-[#1a1a1a] border dark:border-gray-800">
                <DialogHeader>
                    <DialogTitle className="dark:text-gray-100">Edit Profile</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                    <div className="flex justify-center">
                        <Avatar className="h-20 w-20 border-2 border-gray-100 dark:border-gray-800 shadow-sm">
                            <AvatarImage src={imageUrl || currentUser?.imageUrl} alt={name || "Avatar"} />
                            <AvatarFallback className="dark:bg-gray-700 dark:text-gray-200">{name?.substring(0, 2).toUpperCase() || "ME"}</AvatarFallback>
                        </Avatar>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Display Name</label>
                        <Input
                            placeholder="Your Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Profile Image URL</label>
                        <Input
                            placeholder="https://example.com/avatar.png"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            className="dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Leave blank to keep your current image. Updates instantly across the app.
                        </p>
                    </div>

                    <Button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-full mt-4 h-11 text-base">
                        Save Changes
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
