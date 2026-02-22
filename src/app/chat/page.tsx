"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { UserButton } from "@clerk/nextjs";
import { Sidebar } from "@/components/Sidebar";
import { ChatPanel } from "@/components/ChatPanel";
import { useState, useEffect } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { usePresenceDetection } from "@/hooks/usePresenceDetection";

function ChatDashboard() {
    const [selectedConversationId, setSelectedConversationId] = useState<Id<"conversations"> | null>(null);
    const ensureUser = useMutation(api.users.ensureUser);

    // Hook handles accurate online/offline/inactivity status
    usePresenceDetection();

    useEffect(() => {
        ensureUser();
    }, [ensureUser]);

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-[#111] overflow-hidden text-black dark:text-white text-sm transition-colors duration-300">
            <Sidebar
                onSelectConversation={setSelectedConversationId}
                selectedId={selectedConversationId}
            />

            {/* Main Chat Area */}
            <main className={`flex-1 flex flex-col transition-all duration-300 ${selectedConversationId ? "flex animate-in slide-in-from-right-full md:slide-in-from-none" : "hidden md:flex"}`}>
                {selectedConversationId ? (
                    <ChatPanel conversationId={selectedConversationId} onBack={() => setSelectedConversationId(null)} />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-black/20">
                        <div className="text-center p-8 bg-white dark:bg-[#1a1a1a] border dark:border-gray-800 rounded-2xl shadow-sm">
                            <h2 className="text-xl font-semibold mb-2 dark:text-gray-100">Welcome to Tars Web Chat</h2>
                            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
                                Select a conversation from the sidebar or start a new one to begin messaging.
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function ChatPage() {
    return (
        <>
            <AuthLoading>
                <div className="flex h-screen w-screen items-center justify-center space-x-4 bg-gray-50">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-[250px]" />
                        <Skeleton className="h-4 w-[200px]" />
                    </div>
                </div>
            </AuthLoading>
            <Unauthenticated>
                <div className="flex h-screen w-screen items-center justify-center bg-gray-50 dark:bg-[#111] flex-col p-4 text-center">
                    <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Auth Sync Issue</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                        Clerk and Convex are not talking to each other. This is usually due to mismatched API keys or a missing JWT template.
                    </p>

                    <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-xl border dark:border-gray-800 shadow-sm mb-8 text-left w-full max-w-md space-y-4">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Clerk Issuer (from .env)</p>
                            <p className="text-sm font-mono break-all dark:text-gray-300">{process.env.NEXT_PUBLIC_CLERK_ISSUER_URL || "Not Set"}</p>
                        </div>
                        <div className="pt-2 border-t">
                            <p className="text-xs font-bold text-gray-400 uppercase">Troubleshooting Steps:</p>
                            <ul className="text-xs text-gray-600 list-disc ml-4 mt-1 space-y-1">
                                <li>Ensure <strong>JWT Template</strong> named "convex" exists in Clerk.</li>
                                <li>Verify <strong>Publishable Key</strong> and <strong>Issuer URL</strong> belong to the same project.</li>
                                <li>Run <code>npx convex env set CLERK_ISSUER_URL [url]</code> in terminal.</li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <Button onClick={() => window.location.href = '/'}>Back Home</Button>
                        <Button variant="outline" onClick={() => window.location.reload()}>Retry Sync</Button>
                    </div>
                </div>
            </Unauthenticated>
            <Authenticated>
                <ChatDashboard />
            </Authenticated>
        </>
    );
}
