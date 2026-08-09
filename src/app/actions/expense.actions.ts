"use server";

import { createClient } from "@/infrastructure/supabase/server";
import {
  SupabaseShoppingRepository,
  SupabaseMemberRepository,
  SupabaseSettlementRepository,
  SupabaseAuditLogRepository,
} from "@/infrastructure/repositories/supabase.repositories";
import { ExpenseService } from "@/infrastructure/services/expense.service";
import { ExpenseType } from "@/core/entities";
import { z } from "zod";

const expenseSchema = z.object({
  groupId: z.string().uuid(),
  payerId: z.string().uuid(),
  amount: z.number().int().nonnegative("Số tiền không hợp lệ"),
  currency: z.string().default("VND"),
  note: z.string().min(1, "Nội dung chi tiêu không được để trống"),
  shoppingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ (định dạng YYYY-MM-DD)"),
  expenseType: z.enum(["MEAL", "SHARED"]),
});

export async function createExpenseAction(formData: z.infer<typeof expenseSchema>) {
  const validation = expenseSchema.safeParse(formData);
  if (!validation.success) return { error: validation.error.issues[0].message };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn chưa đăng nhập." };

  const shoppingRepo = new SupabaseShoppingRepository(supabase);
  const memberRepo = new SupabaseMemberRepository(supabase);
  const settlementRepo = new SupabaseSettlementRepository(supabase);
  const auditRepo = new SupabaseAuditLogRepository(supabase);

  const expenseService = new ExpenseService(
    shoppingRepo,
    memberRepo,
    settlementRepo,
    auditRepo
  );

  try {
    const expense = await expenseService.createExpense(
      {
        groupId: validation.data.groupId,
        payerId: validation.data.payerId,
        amount: validation.data.amount,
        currency: validation.data.currency,
        note: validation.data.note,
        shoppingDate: validation.data.shoppingDate,
        expenseType: validation.data.expenseType,
        status: "ACTIVE",
        clientMutationId: null,
        createdBy: user.id,
        updatedBy: null,
      },
      user.id
    );
    return { success: true, expense };
  } catch (error: any) {
    if (error.message === "SETTLEMENT_PERIOD_LOCKED") {
      return { error: "Không thể thêm chi tiêu: Kỳ quyết toán cho ngày này đã bị khóa." };
    }
    return { error: error.message || "Lỗi lưu chi tiêu." };
  }
}

export async function updateExpenseAction(
  log: {
    id: string;
    payerId: string;
    amount: number;
    note: string;
    shoppingDate: string;
    expenseType: ExpenseType;
    version: number;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn chưa đăng nhập." };

  const shoppingRepo = new SupabaseShoppingRepository(supabase);
  const memberRepo = new SupabaseMemberRepository(supabase);
  const settlementRepo = new SupabaseSettlementRepository(supabase);
  const auditRepo = new SupabaseAuditLogRepository(supabase);

  const expenseService = new ExpenseService(
    shoppingRepo,
    memberRepo,
    settlementRepo,
    auditRepo
  );

  try {
    const updated = await expenseService.updateExpense(
      {
        id: log.id,
        payerId: log.payerId,
        amount: log.amount,
        note: log.note,
        shoppingDate: log.shoppingDate,
        expenseType: log.expenseType,
        version: log.version,
      },
      user.id
    );
    return { success: true, expense: updated };
  } catch (error: any) {
    if (error.message === "CONFLICT_OR_NOT_FOUND") {
      return { error: "Dữ liệu chi tiêu đã được cập nhật bởi thành viên khác. Vui lòng tải lại trang." };
    }
    if (error.message === "SETTLEMENT_PERIOD_LOCKED") {
      return { error: "Không thể chỉnh sửa chi tiêu: Kỳ quyết toán cho ngày này đã bị khóa." };
    }
    return { error: error.message || "Lỗi cập nhật chi tiêu." };
  }
}

export async function voidExpenseAction(expenseId: string, version: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn chưa đăng nhập." };

  const shoppingRepo = new SupabaseShoppingRepository(supabase);
  const memberRepo = new SupabaseMemberRepository(supabase);
  const settlementRepo = new SupabaseSettlementRepository(supabase);
  const auditRepo = new SupabaseAuditLogRepository(supabase);

  const expenseService = new ExpenseService(
    shoppingRepo,
    memberRepo,
    settlementRepo,
    auditRepo
  );

  try {
    const updated = await expenseService.voidExpense(expenseId, user.id, version);
    return { success: true, expense: updated };
  } catch (error: any) {
    if (error.message === "CONFLICT_OR_NOT_FOUND") {
      return { error: "Dữ liệu chi tiêu đã thay đổi. Vui lòng tải lại trang." };
    }
    if (error.message === "SETTLEMENT_PERIOD_LOCKED") {
      return { error: "Không thể vô hiệu hóa chi tiêu: Kỳ quyết toán cho ngày này đã bị khóa." };
    }
    return { error: error.message || "Lỗi vô hiệu hóa chi tiêu." };
  }
}

export async function getGroupExpensesAction(
  groupId: string,
  filters?: { startDate?: string; endDate?: string; payerId?: string }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const shoppingRepo = new SupabaseShoppingRepository(supabase);
  return shoppingRepo.getGroupExpenses(groupId, filters);
}
