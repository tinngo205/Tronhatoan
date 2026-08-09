import {
  ISettlementRepository,
  IPaymentRepository,
  IMemberRepository,
  IShoppingRepository,
  IAuditLogRepository,
  IProfileRepository,
} from "../../core/repositories/interfaces";
import { SettlementPeriod, Payment, Profile } from "../../core/entities";
import { AllocationService, PeriodAllocationResult } from "./allocation.service";

export interface MemberBalance {
  memberId: string;
  fullName: string;
  avatarUrl: string | null;
  paid: number;   // Total paid for shopping (VND)
  eaten: number;  // Total allocated cost of meals/shared items (VND)
  net: number;    // Balance = paid - eaten (VND). >0 is creditor, <0 is debtor
}

export interface SettlementRecommendation {
  payerId: string;
  payerName: string;
  payerAvatar: string | null;
  receiverId: string;
  receiverName: string;
  receiverAvatar: string | null;
  amount: number; // Recommended payment amount (VND)
}

export interface PeriodSettlementSummary {
  totalExpense: number;
  balances: MemberBalance[];
  recommendations: SettlementRecommendation[];
  allocationResult: PeriodAllocationResult;
}

export class SettlementService {
  constructor(
    private settlementRepo: ISettlementRepository,
    private paymentRepo: IPaymentRepository,
    private memberRepo: IMemberRepository,
    private shoppingRepo: IShoppingRepository,
    private profileRepo: IProfileRepository,
    private auditLogRepo: IAuditLogRepository,
    private allocationService: AllocationService
  ) {}

  async calculateSettlement(
    groupId: string,
    startDate: string,
    endDate: string
  ): Promise<PeriodSettlementSummary> {
    // 1. Calculate cost allocation (Eaten amount)
    const allocationResult = await this.allocationService.calculateAllocation(
      groupId,
      startDate,
      endDate
    );

    // 2. Fetch all members and their profiles to map names/avatars
    const members = await this.memberRepo.getGroupMembers(groupId);
    const memberProfileMap: Record<string, { fullName: string; avatarUrl: string | null }> = {};
    for (const m of members) {
      memberProfileMap[m.memberId] = {
        fullName: m.profile?.fullName || "Thành viên",
        avatarUrl: m.profile?.avatarUrl || null,
      };
    }

    // 3. Fetch expenses to compute Paid amounts
    const expenses = await this.shoppingRepo.getGroupExpenses(groupId, {
      startDate,
      endDate,
    });
    const activeExpenses = expenses.filter((e) => e.status === "ACTIVE");

    const memberPaid: Record<string, number> = {};
    for (const m of members) {
      memberPaid[m.memberId] = 0;
    }
    for (const exp of activeExpenses) {
      if (memberPaid[exp.payerId] !== undefined) {
        memberPaid[exp.payerId] += exp.amount;
      }
    }

    // 4. Compute Net Balances
    const balances: MemberBalance[] = [];
    for (const m of members) {
      const eaten = allocationResult.memberCosts[m.memberId] || 0;
      const paid = memberPaid[m.memberId] || 0;
      const net = paid - eaten;

      balances.push({
        memberId: m.memberId,
        fullName: memberProfileMap[m.memberId].fullName,
        avatarUrl: memberProfileMap[m.memberId].avatarUrl,
        paid,
        eaten,
        net,
      });
    }

    // 5. Greedy Settlement Algorithm to minimize transactions
    // Separate debtors (net < 0) and creditors (net > 0)
    const debtors = balances
      .filter((b) => b.net < 0)
      .map((b) => ({ memberId: b.memberId, amount: Math.abs(b.net) }))
      .sort((a, b) => b.amount - a.amount);

    const creditors = balances
      .filter((b) => b.net > 0)
      .map((b) => ({ memberId: b.memberId, amount: b.net }))
      .sort((a, b) => b.amount - a.amount);

    const recommendations: SettlementRecommendation[] = [];

    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];

      if (debtor.amount === 0) {
        dIdx++;
        continue;
      }
      if (creditor.amount === 0) {
        cIdx++;
        continue;
      }

      // Settle the minimum of the two amounts
      const settleAmount = Math.min(debtor.amount, creditor.amount);

      recommendations.push({
        payerId: debtor.memberId,
        payerName: memberProfileMap[debtor.memberId].fullName,
        payerAvatar: memberProfileMap[debtor.memberId].avatarUrl,
        receiverId: creditor.memberId,
        receiverName: memberProfileMap[creditor.memberId].fullName,
        receiverAvatar: memberProfileMap[creditor.memberId].avatarUrl,
        amount: settleAmount,
      });

      debtor.amount -= settleAmount;
      creditor.amount -= settleAmount;

      if (debtor.amount === 0) dIdx++;
      if (creditor.amount === 0) cIdx++;
    }

    return {
      totalExpense: allocationResult.totalGroupExpense,
      balances,
      recommendations,
      allocationResult,
    };
  }

  async createSettlementPeriod(
    groupId: string,
    name: string,
    startDate: string,
    endDate: string,
    actorId: string
  ): Promise<SettlementPeriod> {
    // 1. Authorization: Verify actor is active ADMIN
    const membership = await this.memberRepo.getGroupMember(groupId, actorId);
    if (!membership || membership.role !== "ADMIN" || membership.status !== "ACTIVE") {
      throw new Error("UNAUTHORIZED_NOT_ADMIN");
    }

    // 2. Create the period
    const period = await this.settlementRepo.createPeriod({
      groupId,
      name,
      startDate,
      endDate,
      status: "OPEN",
      createdBy: actorId,
    });

    // 3. Log audit trail
    await this.auditLogRepo.log({
      groupId,
      actorId,
      action: "CREATE_SETTLEMENT_PERIOD",
      entityType: "settlement_periods",
      entityId: period.id,
      metadata: { name, startDate, endDate },
    });

    return period;
  }

  async lockSettlementPeriod(
    periodId: string,
    actorId: string,
    version: number
  ): Promise<SettlementPeriod> {
    const period = await this.settlementRepo.getPeriodById(periodId);
    if (!period) throw new Error("PERIOD_NOT_FOUND");

    const groupId = period.groupId;

    // 1. Authorization: Verify actor is active ADMIN
    const membership = await this.memberRepo.getGroupMember(groupId, actorId);
    if (!membership || membership.role !== "ADMIN" || membership.status !== "ACTIVE") {
      throw new Error("UNAUTHORIZED_NOT_ADMIN");
    }

    if (period.status === "LOCKED") {
      throw new Error("PERIOD_ALREADY_LOCKED");
    }

    // 2. Calculate the final settlement summary to freeze and verify
    const summary = await this.calculateSettlement(groupId, period.startDate, period.endDate);

    // 3. Lock the period
    const lockedPeriod = await this.settlementRepo.updatePeriodStatus(periodId, "LOCKED", version);

    // 4. Automatically generate pending payment records for the group based on recommendations
    for (const rec of summary.recommendations) {
      await this.paymentRepo.createPayment({
        groupId,
        settlementPeriodId: periodId,
        payerId: rec.payerId,
        receiverId: rec.receiverId,
        amount: rec.amount,
        note: `Quyết toán tự động: ${period.name}`,
        paymentDate: new Date().toISOString().split("T")[0],
        status: "PENDING",
        clientMutationId: null,
      });
    }

    // 5. Log audit trail
    await this.auditLogRepo.log({
      groupId,
      actorId,
      action: "LOCK_SETTLEMENT_PERIOD",
      entityType: "settlement_periods",
      entityId: periodId,
      metadata: { name: period.name, totalExpense: summary.totalExpense, recommendationCount: summary.recommendations.length },
    });

    return lockedPeriod;
  }

  async unlockSettlementPeriod(
    periodId: string,
    actorId: string,
    reason: string,
    version: number
  ): Promise<SettlementPeriod> {
    const period = await this.settlementRepo.getPeriodById(periodId);
    if (!period) throw new Error("PERIOD_NOT_FOUND");

    const groupId = period.groupId;

    // 1. Authorization: Verify actor is active ADMIN
    const membership = await this.memberRepo.getGroupMember(groupId, actorId);
    if (!membership || membership.role !== "ADMIN" || membership.status !== "ACTIVE") {
      throw new Error("UNAUTHORIZED_NOT_ADMIN");
    }

    if (period.status === "OPEN") {
      throw new Error("PERIOD_ALREADY_OPEN");
    }

    // 2. Unlock the period
    const unlockedPeriod = await this.settlementRepo.updatePeriodStatus(periodId, "OPEN", version);

    // 3. Log audit trail (Audit MUST contain the reason for unlocking)
    await this.auditLogRepo.log({
      groupId,
      actorId,
      action: "UNLOCK_SETTLEMENT_PERIOD",
      entityType: "settlement_periods",
      entityId: periodId,
      metadata: { name: period.name, reason, unlockedAt: new Date().toISOString() },
    });

    return unlockedPeriod;
  }

  async confirmPayment(
    paymentId: string,
    actorId: string,
    version: number
  ): Promise<Payment> {
    // 1. Fetch payment
    // We don't have a direct paymentRepo.getById, but we can query by getting period payments or writing it,
    // wait, we can just update status by ID directly, but to authorize we need to verify membership
    // Let's modify the repository or handle it directly. In the payment repository implementation,
    // updatePaymentStatus handles the eq('id', id) and version check. We will fetch the group_id from the response
    // or just run a query. Let's call the repository's status update.
    // Wait, how do we authorize? In the RLS policies:
    // "Participants or admins can update payments" is already enforced at the database level!
    // So if the client attempts to confirm a payment they aren't part of (and are not admin),
    // the RLS policy will reject it. This is database-level authorization!
    // To write a clean audit log and return, we can run:
    const updated = await this.paymentRepo.updatePaymentStatus(paymentId, "PAID", version);

    // Log audit trail
    await this.auditLogRepo.log({
      groupId: updated.groupId,
      actorId,
      action: "CONFIRM_PAYMENT",
      entityType: "payments",
      entityId: paymentId,
      metadata: { payerId: updated.payerId, receiverId: updated.receiverId, amount: updated.amount },
    });

    return updated;
  }
}
