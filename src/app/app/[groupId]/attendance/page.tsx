import { redirect } from "next/navigation";
import { createClient } from "@/infrastructure/supabase/server";
import {
  SupabaseAttendanceRepository,
  SupabaseMemberRepository,
} from "@/infrastructure/repositories/supabase.repositories";
import { AttendanceClient } from "./attendance-client";

interface AttendancePageProps {
  params: Promise<{ groupId: string }>;
}

export default async function AttendancePage({ params }: AttendancePageProps) {
  const { groupId } = await params;

  // 1. Setup Server Supabase client
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Tính date range trước, sau đó fetch members và attendance song song
  const now = new Date();
  const prevYear = now.getFullYear() - 1;
  const nextYear = now.getFullYear() + 1;
  const startDateStr = `${prevYear}-01-01`;
  const endDateStr = `${nextYear}-12-31`;

  const memberRepo = new SupabaseMemberRepository(supabase);
  const attendanceRepo = new SupabaseAttendanceRepository(supabase);
  const [members, attendance] = await Promise.all([
    memberRepo.getGroupMembers(groupId),
    attendanceRepo.getGroupAttendance(groupId, startDateStr, endDateStr),
  ]);

  // 3. Find current user's membership to pass their role (ADMIN/MEMBER)
  const currentMember = members.find((m) => m.memberId === user.id);
  if (!currentMember || currentMember.status !== "ACTIVE") {
    redirect("/app");
  }

  return (
    <AttendanceClient
      groupId={groupId}
      initialAttendance={attendance}
      members={members}
      currentUserId={user.id}
      currentUserRole={currentMember.role}
    />
  );
}
