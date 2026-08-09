"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { db, OfflineMutation } from "../lib/db";
import {
  createExpenseAction,
  updateExpenseAction,
  voidExpenseAction,
} from "../app/actions/expense.actions";
import { saveAttendanceAction } from "../app/actions/attendance.actions";

// Generate a random UUID on the client side
function generateUUID(): string {
  return crypto.randomUUID();
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof window !== "undefined" ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const syncInProgressRef = useRef(false);

  // Sync worker to process the IndexedDB queue
  const runSyncWorker = useCallback(async () => {
    if (syncInProgressRef.current) return;
    syncInProgressRef.current = true;
    setIsSyncing(true);

    try {
      const pendingMutations = await db.mutations.orderBy("createdAt").toArray();
      if (pendingMutations.length === 0) {
        setIsSyncing(false);
        syncInProgressRef.current = false;
        return;
      }

      console.log(`Starting sync for ${pendingMutations.length} offline operations...`);

      for (const mut of pendingMutations) {
        let success = false;
        let errorMessage = "";

        try {
          if (mut.action === "CREATE_EXPENSE") {
            const res = await createExpenseAction({
              ...mut.payload,
              clientMutationId: mut.id, // Pass for database idempotency
            });
            if (res.success || (res.error && res.error.includes("duplicate key"))) {
              success = true;
            } else {
              errorMessage = res.error || "Lỗi không xác định";
            }
          } else if (mut.action === "UPDATE_EXPENSE") {
            const res = await updateExpenseAction(mut.payload);
            if (res.success) success = true;
            else errorMessage = res.error || "Lỗi không xác định";
          } else if (mut.action === "VOID_EXPENSE") {
            const res = await voidExpenseAction(mut.payload.expenseId, mut.payload.version);
            if (res.success) success = true;
            else errorMessage = res.error || "Lỗi không xác định";
          } else if (mut.action === "SAVE_ATTENDANCE") {
            const res = await saveAttendanceAction(mut.payload.groupId, mut.payload.attendanceList);
            if (res.success) success = true;
            else errorMessage = res.error || "Lỗi không xác định";
          }

          if (success) {
            // Delete from IndexedDB queue
            await db.mutations.delete(mut.id);
            console.log(`Successfully synced offline action: ${mut.action}`);
          } else {
            console.error(`Failed syncing offline action: ${mut.action}. Error: ${errorMessage}`);
            // If it's a validation error or permissions block, remove it to prevent deadlock,
            // otherwise keep it in queue to retry later
            if (
              errorMessage.includes("UNAUTHORIZED") ||
              errorMessage.includes("hợp lệ") ||
              errorMessage.includes("được để trống")
            ) {
              await db.mutations.delete(mut.id);
            } else {
              // Pause syncing queue if network/server is down
              break;
            }
          }
        } catch (err: any) {
          console.error(`Network error syncing ${mut.action}:`, err);
          break; // Stop loop and try again later
        }
      }
    } catch (dbErr) {
      console.error("Database error during offline sync:", dbErr);
    } finally {
      setIsSyncing(false);
      syncInProgressRef.current = false;
    }
  }, []);

  // Queue an action for offline processing
  const enqueueMutation = useCallback(
    async (
      action: OfflineMutation["action"],
      payload: any
    ): Promise<{ id: string; queued: boolean }> => {
      const id = generateUUID();
      const newMutation: OfflineMutation = {
        id,
        action,
        payload,
        createdAt: Date.now(),
      };

      try {
        await db.mutations.add(newMutation);

        if (navigator.onLine) {
          // Trigger sync immediately if online
          runSyncWorker();
          return { id, queued: false };
        } else {
          console.log(`Saved mutation ${action} to offline queue.`);
          return { id, queued: true };
        }
      } catch (err) {
        console.error("Failed to add to offline queue:", err);
        return { id, queued: false };
      }
    },
    [runSyncWorker]
  );

  // Monitor network connection status
  useEffect(() => {


    const handleOnline = () => {
      setIsOnline(true);
      runSyncWorker();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial sync check
    if (navigator.onLine) {
      setTimeout(() => {
        runSyncWorker();
      }, 0);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [runSyncWorker]);

  return {
    isOnline,
    isSyncing,
    enqueueMutation,
    syncNow: runSyncWorker,
  };
}
