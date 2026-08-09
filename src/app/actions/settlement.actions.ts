"use server";

import { createClient } from "@/infrastructure/supabase/server";
import {
  SupabaseSettlementRepository,
  SupabasePaymentRepository,
  SupabaseMemberRepository,
  SupabaseShoppingRepository,
  SupabaseProfileRepository,
  SupabaseAuditLogRepository,
  SupabaseAttendanceRepository,
  SupabaseGroupRepository,
} from "@/infrastructure/repositories/supabase.repositories";
import { AllocationService } from "@/infrastructure/services/allocation.service";
import { SettlementService } from "@/infrastructure/services/settlement.service";
import { z } from "zod";

const createPeriodSchema = z.object({
  groupId: z.string().uuid(),
  name: z.string().min(2, "Tên kỳ quyết toán không được để trống"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ"),
});

// Helper to construct the SettlementService
async function getSettlementService(supabase: any) {
  const settlementRepo = new SupabaseSettlementRepository(supabase);
  const paymentRepo = new SupabasePaymentRepository(supabase);
  const memberRepo = new SupabaseMemberRepository(supabase);
  const shoppingRepo = new SupabaseShoppingRepository(supabase);
  const profileRepo = new SupabaseProfileRepository(supabase);
  const auditRepo = new SupabaseAuditLogRepository(supabase);
  const attendanceRepo = new SupabaseAttendanceRepository(supabase);
  const groupRepo = new SupabaseGroupRepository(supabase);

  const allocationService = new AllocationService(
    shoppingRepo,
    attendanceRepo,
    memberRepo,
    groupRepo
  );

  return new SettlementService(
    settlementRepo,
    paymentRepo,
    memberRepo,
    shoppingRepo,
    profileRepo,
    auditRepo,
    allocationService
  );
}

export async function calculateSettlementAction(
  groupId: string,
  startDate: string,
  endDate: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn chưa đăng nhập." };

  try {
    const service = await getSettlementService(supabase);
    const summary = await service.calculateSettlement(groupId, startDate, endDate);
    return { success: true, summary };
  } catch (error: any) {
    return { error: error.message || "Lỗi tính toán quyết toán." };
  }
}

export async function createSettlementPeriodAction(formData: z.infer<typeof createPeriodSchema>) {
  const validation = createPeriodSchema.safeParse(formData);
  if (!validation.success) return { error: validation.error.issues[0].message };

  const { groupId, name, startDate, endDate } = validation.data;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn chưa đăng nhập." };

  try {
    const service = await getSettlementService(supabase);
    const period = await service.createSettlementPeriod(groupId, name, startDate, endDate, user.id);
    return { success: true, period };
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_NOT_ADMIN") {
      return { error: "Chỉ quản trị viên mới được tạo kỳ quyết toán." };
    }
    return { error: error.message || "Lỗi tạo kỳ quyết toán." };
  }
}

export async function lockSettlementPeriodAction(periodId: string, version: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn chưa đăng nhập." };

  try {
    const service = await getSettlementService(supabase);
    const period = await service.lockSettlementPeriod(periodId, user.id, version);
    return { success: true, period };
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_NOT_ADMIN") {
      return { error: "Chỉ quản trị viên mới được khóa kỳ quyết toán." };
    }
    if (error.message === "CONFLICT_OR_NOT_FOUND") {
      return { error: "Kỳ quyết toán đã thay đổi hoặc không tồn tại. Vui lòng tải lại trang." };
    }
    return { error: error.message || "Lỗi khóa quyết toán." };
  }
}

export async function unlockSettlementPeriodAction(
  periodId: string,
  reason: string,
  version: number
) {
  if (!reason.trim()) return { error: "Vui lòng nhập lý do mở khóa." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn chưa đăng nhập." };

  try {
    const service = await getSettlementService(supabase);
    const period = await service.unlockSettlementPeriod(periodId, user.id, reason, version);
    return { success: true, period };
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_NOT_ADMIN") {
      return { error: "Chỉ quản trị viên mới được mở khóa kỳ quyết toán." };
    }
    if (error.message === "CONFLICT_OR_NOT_FOUND") {
      return { error: "Kỳ quyết toán đã thay đổi. Vui lòng tải lại trang." };
    }
    return { error: error.message || "Lỗi mở khóa kỳ quyết toán." };
  }
}

export async function confirmPaymentAction(paymentId: string, version: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn chưa đăng nhập." };

  try {
    const service = await getSettlementService(supabase);
    const payment = await service.confirmPayment(paymentId, user.id, version);
    return { success: true, payment };
  } catch (error: any) {
    if (error.message === "CONFLICT_OR_NOT_FOUND") {
      return { error: "Giao dịch đã được cập nhật bởi thành viên khác hoặc không tồn tại." };
    }
    return { error: error.message || "Lỗi xác nhận thanh toán." };
  }
}

export async function getGroupPeriodsAction(groupId: string) {
  const supabase = await createClient();
  const repo = new SupabaseSettlementRepository(supabase);
  return repo.getPeriods(groupId);
}

export async function getPeriodPaymentsAction(groupId: string, periodId: string) {
  const supabase = await createClient();
  const repo = new SupabasePaymentRepository(supabase);
  return repo.getPeriodPayments(groupId, periodId);
}
