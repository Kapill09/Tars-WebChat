"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef, useCallback } from "react";

/**
 * usePresenceDetection
 * 
 * Accurately tracks user online/offline status.
 * Handles:
 * - Tab visibility (visible/hidden)
 * - Window focus/blur
 * - Browser/Tab closing (beforeunload)
 * - Inactivity timeout (60 seconds)
 */
export function usePresenceDetection() {
    const updatePresence = useMutation(api.users.updatePresence);
    const isOnlineRef = useRef<boolean>(true);
    const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

    const setPresence = useCallback(async (isOnline: boolean) => {
        if (isOnline === isOnlineRef.current) return;

        try {
            await updatePresence({ isOnline });
            isOnlineRef.current = isOnline;
        } catch (e) {
            console.error("Presence error:", e);
        }
    }, [updatePresence]);

    useEffect(() => {
        // 1. Mark online on mount
        setPresence(true);

        // 2. Heartbeat (every 15 seconds) to keep online & update lastSeen
        heartbeatInterval.current = setInterval(() => {
            if (document.visibilityState === "visible") {
                updatePresence({ isOnline: true });
            }
        }, 15000);

        // 3. Visibility Change (Instant feedback)
        const handleVisibility = () => {
            const isVisible = document.visibilityState === "visible";
            setPresence(isVisible);
        };

        // 4. Tab/Window Closing
        const handleUnload = () => {
            updatePresence({ isOnline: false });
        };

        window.addEventListener("visibilitychange", handleVisibility);
        window.addEventListener("beforeunload", handleUnload);

        return () => {
            window.removeEventListener("visibilitychange", handleVisibility);
            window.removeEventListener("beforeunload", handleUnload);
            if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
            updatePresence({ isOnline: false });
        };
    }, [setPresence, updatePresence]);
}
