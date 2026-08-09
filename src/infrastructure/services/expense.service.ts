import {
  IShoppingRepository,
  IMemberRepository,
  ISettlementRepository,
  IAuditLogRepository,
} from "../../core/repositories/interfaces";
import { ShoppingLog } from "../../core/entities";

export class ExpenseService {
  constructor(
    private shoppingRepo: IShoppingRepository,
    private memberRepo: IMemberRepository,
    private settlementRepo: ISettlementRepository,
    private auditLogRepo: IAuditLogRepository
  ) {}

  private async verifyIsNotLocked(groupId: string, dateStr: string): Promise<void> {
    const periods = await this.settlementRepo.getPeriods(groupId);
    const target = new Date(dateStr);
    
    // Clear time parts to compare dates strictly
    const targetTime = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();

    const isLocked = periods.some((p) => {
      if (p.status !== "LOCKED") return false;
      const start = new Date(p.startDate);
      const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
      const end = new Date(p.endDate);
      const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
      
      return targetTime >= startTime && targetTime <= endTime;
    });

    if (isLocked) {
      throw new Error("SETTLEMENT_PERIOD_LOCKED");
    }
  }

  async createExpense(
    log: Omit<ShoppingLog, "id" | "createdAt" | "updatedAt" | "version">,
    actorId: string
  ): Promise<ShoppingLog> {
    // 1. Authorization: Verify actor is active member
    const membership = await this.memberRepo.getGroupMember(log.groupId, actorId);
    if (!membership || membership.status !== "ACTIVE") {
      throw new Error("UNAUTHORIZED_NOT_MEMBER");
    }

    // 2. Lock check: Verify date is not locked
    await this.verifyIsNotLocked(log.groupId, log.shoppingDate);

    // 3. Create expense
    const expense = await this.shoppingRepo.create({
      ...log,
      createdBy: actorId,
    });

    // 4. Log audit trail (non-blocking)
    try {
      await this.auditLogRepo.log({
        groupId: log.groupId,
        actorId,
        action: "CREATE_EXPENSE",
        entityType: "shopping_logs",
        entityId: expense.id,
        metadata: { amount: log.amount, note: log.note, shoppingDate: log.shoppingDate, expenseType: log.expenseType },
      });
    } catch (auditErr) {
      console.warn("[ExpenseService] Audit log failed (non-critical):", auditErr);
    }

    return expense;
  }

  async updateExpense(
    log: Partial<ShoppingLog> & { id: string; version: number },
    actorId: string
  ): Promise<ShoppingLog> {
    // 1. Fetch original record
    const original = await this.shoppingRepo.getById(log.id);
    if (!original) throw new Error("EXPENSE_NOT_FOUND");

    const groupId = original.groupId;

    // 2. Authorization: Verify actor is active member AND (is ADMIN or the original payer)
    const membership = await this.memberRepo.getGroupMember(groupId, actorId);
    if (!membership || membership.status !== "ACTIVE") {
      throw new Error("UNAUTHORIZED_NOT_MEMBER");
    }

    if (membership.role !== "ADMIN" && original.payerId !== actorId) {
      throw new Error("UNAUTHORIZED_NOT_OWNER_OR_ADMIN");
    }

    // 3. Lock check: Verify original date is not locked
    await this.verifyIsNotLocked(groupId, original.shoppingDate);

    // 4. Lock check: If date is changed, verify the new date is also not locked
    if (log.shoppingDate && log.shoppingDate !== original.shoppingDate) {
      await this.verifyIsNotLocked(groupId, log.shoppingDate);
    }

    // 5. Update record (optimistic concurrency control inside repository)
    const updated = await this.shoppingRepo.update({
      id: log.id,
      payerId: log.payerId ?? original.payerId,
      amount: log.amount ?? original.amount,
      note: log.note ?? original.note,
      shoppingDate: log.shoppingDate ?? original.shoppingDate,
      expenseType: log.expenseType ?? original.expenseType,
      status: log.status ?? original.status,
      updatedBy: actorId,
      version: log.version,
    });

    // 6. Log audit trail (non-blocking)
    try {
      await this.auditLogRepo.log({
        groupId,
        actorId,
        action: "UPDATE_EXPENSE",
        entityType: "shopping_logs",
        entityId: log.id,
        metadata: { original, updated },
      });
    } catch (auditErr) {
      console.warn("[ExpenseService] Audit log failed (non-critical):", auditErr);
    }

    return updated;
  }

  async voidExpense(expenseId: string, actorId: string, version: number): Promise<ShoppingLog> {
    // 1. Fetch original record
    const original = await this.shoppingRepo.getById(expenseId);
    if (!original) throw new Error("EXPENSE_NOT_FOUND");

    const groupId = original.groupId;

    // 2. Authorization: Verify actor is active member AND (is ADMIN or the original payer)
    const membership = await this.memberRepo.getGroupMember(groupId, actorId);
    if (!membership || membership.status !== "ACTIVE") {
      throw new Error("UNAUTHORIZED_NOT_MEMBER");
    }

    if (membership.role !== "ADMIN" && original.payerId !== actorId) {
      throw new Error("UNAUTHORIZED_NOT_OWNER_OR_ADMIN");
    }

    // 3. Lock check: Verify original date is not locked
    await this.verifyIsNotLocked(groupId, original.shoppingDate);

    // 4. Perform soft-delete by updating status to VOID
    const updated = await this.shoppingRepo.update({
      id: expenseId,
      status: "VOID",
      updatedBy: actorId,
      version,
    });

    // 5. Log audit trail (non-blocking)
    try {
      await this.auditLogRepo.log({
        groupId,
        actorId,
        action: "VOID_EXPENSE",
        entityType: "shopping_logs",
        entityId: expenseId,
        metadata: { originalNote: original.note, amount: original.amount },
      });
    } catch (auditErr) {
      console.warn("[ExpenseService] Audit log failed (non-critical):", auditErr);
    }

    return updated;
  }
}
