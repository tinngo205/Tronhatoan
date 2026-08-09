"use server";

import { createClient } from "@/infrastructure/supabase/server";
import {
  SupabaseAttendanceRepository,
  SupabaseMemberRepository,
  SupabaseSettlementRepository,
  SupabaseAuditLogRepository,
} from "@/infrastructure/repositories/supabase.repositories";
import { AttendanceService } from "@/infrastructure/services/attendance.service";
import { MealType, AttendanceStatus } from "@/core/entities";

export async function getAttendanceAction(groupId: string, startDate: string, endDate: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const attendanceRepo = new SupabaseAttendanceRepository(supabase);
  const memberRepo = new SupabaseMemberRepository(supabase);
  const settlementRepo = new SupabaseSettlementRepository(supabase);
  const auditRepo = new SupabaseAuditLogRepository(supabase);

  const attendanceService = new AttendanceService(
    attendanceRepo,
    memberRepo,
    settlementRepo,
    auditRepo
  );

  try {
    return await attendanceService.getAttendance(groupId, startDate, endDate, user.id);
  } catch (error) {
    console.error("Lỗi lấy điểm danh:", error);
    return [];
  }
}

export async function saveAttendanceAction(
  groupId: string,
  attendanceList: {
    memberId: string;
    date: string;
    mealType: MealType;
    status: AttendanceStatus;
  }[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn chưa đăng nhập." };

  const attendanceRepo = new SupabaseAttendanceRepository(supabase);
  const memberRepo = new SupabaseMemberRepository(supabase);
  const settlementRepo = new SupabaseSettlementRepository(supabase);
  const auditRepo = new SupabaseAuditLogRepository(supabase);

  const attendanceService = new AttendanceService(
    attendanceRepo,
    memberRepo,
    settlementRepo,
    auditRepo
  );

  const payload = attendanceList.map((item) => ({
    groupId,
    memberId: item.memberId,
    date: item.date,
    mealType: item.mealType,
    status: item.status,
  }));

  try {
    await attendanceService.saveAttendance(groupId, payload, user.id);
    return { success: true };
  } catch (error: any) {
    if (error.message.startsWith("SETTLEMENT_PERIOD_LOCKED_FOR_")) {
      const lockedDate = error.message.replace("SETTLEMENT_PERIOD_LOCKED_FOR_", "");
      return { error: `Không thể điểm danh: Ngày ${lockedDate} đã bị khóa quyết toán.` };
    }
    if (error.message === "UNAUTHORIZED_EDIT_OTHER_MEMBER_ATTENDANCE") {
      return { error: "Bạn chỉ được phép tự điểm danh cho bản thân." };
    }
    return { error: error.message || "Lỗi lưu điểm danh." };
  }
}
