import {
  IAttendanceRepository,
  IMemberRepository,
  ISettlementRepository,
  IAuditLogRepository,
} from "../../core/repositories/interfaces";
import { Attendance } from "../../core/entities";

export class AttendanceService {
  constructor(
    private attendanceRepo: IAttendanceRepository,
    private memberRepo: IMemberRepository,
    private settlementRepo: ISettlementRepository,
    private auditLogRepo: IAuditLogRepository
  ) {}

  private async verifyDatesNotLocked(groupId: string, dates: string[]): Promise<void> {
    const periods = await this.settlementRepo.getPeriods(groupId);
    
    const uniqueDates = Array.from(new Set(dates));
    const lockedTimes = periods
      .filter((p) => p.status === "LOCKED")
      .map((p) => {
        const start = new Date(p.startDate);
        const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
        const end = new Date(p.endDate);
        const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
        return { start: startTime, end: endTime };
      });

    for (const dStr of uniqueDates) {
      const d = new Date(dStr);
      const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

      const isLocked = lockedTimes.some(({ start, end }) => targetTime >= start && targetTime <= end);
      if (isLocked) {
        throw new Error(`SETTLEMENT_PERIOD_LOCKED_FOR_${dStr}`);
      }
    }
  }

  async getAttendance(
    groupId: string,
    startDate: string,
    endDate: string,
    actorId: string
  ): Promise<Attendance[]> {
    const membership = await this.memberRepo.getGroupMember(groupId, actorId);
    if (!membership || membership.status !== "ACTIVE") {
      throw new Error("UNAUTHORIZED_NOT_MEMBER");
    }

    return this.attendanceRepo.getGroupAttendance(groupId, startDate, endDate);
  }

  async saveAttendance(
    groupId: string,
    attendanceList: Omit<Attendance, "id" | "createdAt" | "updatedAt">[],
    actorId: string
  ): Promise<void> {
    // 1. Authorization: Verify actor is active member
    const actorMembership = await this.memberRepo.getGroupMember(groupId, actorId);
    if (!actorMembership || actorMembership.status !== "ACTIVE") {
      throw new Error("UNAUTHORIZED_NOT_MEMBER");
    }

    // 2. Authorization: Members can only edit their own attendance. Admins can edit everyone's.
    if (actorMembership.role !== "ADMIN") {
      const tryingToEditOthers = attendanceList.some((item) => item.memberId !== actorId);
      if (tryingToEditOthers) {
        throw new Error("UNAUTHORIZED_EDIT_OTHER_MEMBER_ATTENDANCE");
      }
    }

    // 3. Verify all items belong to this group
    const belongsToGroup = attendanceList.every((item) => item.groupId === groupId);
    if (!belongsToGroup) {
      throw new Error("INVALID_GROUP_MUTATION");
    }

    // 4. Lock check: Verify all target dates are not locked
    const dates = attendanceList.map((item) => item.date);
    await this.verifyDatesNotLocked(groupId, dates);

    // 5. Save attendance records (bulk upsert)
    await this.attendanceRepo.saveAttendance(attendanceList);

    // 6. Log audit trail (non-blocking — don't let audit failure break the save)
    try {
      await this.auditLogRepo.log({
        groupId,
        actorId,
        action: "SAVE_ATTENDANCE",
        entityType: "attendance",
        entityId: groupId,
        metadata: { count: attendanceList.length, dates: Array.from(new Set(dates)) },
      });
    } catch (auditErr) {
      console.warn("[AttendanceService] Audit log failed (non-critical):", auditErr);
    }
  }
}
