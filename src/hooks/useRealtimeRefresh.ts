"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../infrastructure/supabase/client";

export function useRealtimeRefresh(groupId: string, tables: string[]) {
  const router = useRouter();

  useEffect(() => {
    if (!groupId) return;

    const supabase = createClient();
    const channels = tables.map((table) => {
      return supabase
        .channel(`public:${table}:${groupId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: table,
            filter: `group_id=eq.${groupId}`,
          },
          (payload) => {
            console.log(`Realtime change detected in ${table}:`, payload);
            // Re-fetch Server Component data without losing client state
            router.refresh();
          }
        )
        .subscribe();
    });

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [groupId, tables, router]);
}
