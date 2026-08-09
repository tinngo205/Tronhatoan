import {
  IGroupRepository,
  IMemberRepository,
  IShoppingRepository,
  IAttendanceRepository,
  ISettlementRepository,
  IPaymentRepository,
  IProfileRepository,
  INotificationRepository,
  IAuditLogRepository,
} from "../../../core/repositories/interfaces";
import {
  Group,
  GroupMember,
  ShoppingLog,
  Attendance,
  SettlementPeriod,
  Payment,
  Profile,
  AppNotification,
  AuditLog,
  GroupSettings,
} from "../../../core/entities";

export class MockGroupRepository implements IGroupRepository {
  public groups: Group[] = [];

  async getById(id: string): Promise<Group | null> {
    return this.groups.find((g) => g.id === id) || null;
  }
  async getUserGroups(userId: string): Promise<GroupMember[]> {
    return [];
  }
  async create(name: string, settings?: GroupSettings): Promise<Group> {
    const g: Group = {
      id: "group-1",
      name,
      settings: settings || { allocationMode: "DAILY" },
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };
    this.groups.push(g);
    return g;
  }
  async update(group: Partial<Group> & { id: string; version: number }): Promise<Group> {
    const idx = this.groups.findIndex((g) => g.id === group.id);
    if (idx === -1) throw new Error("NOT_FOUND");
    const updated = { ...this.groups[idx], ...group, version: group.version + 1 };
    this.groups[idx] = updated;
    return updated;
  }
}

export class MockMemberRepository implements IMemberRepository {
  public members: GroupMember[] = [];

  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    return this.members.filter((m) => m.groupId === groupId);
  }
  async getGroupMember(groupId: string, memberId: string): Promise<GroupMember | null> {
    return this.members.find((m) => m.groupId === groupId && m.memberId === memberId) || null;
  }
  async addMember(groupId: string, memberId: string, role: "ADMIN" | "MEMBER"): Promise<GroupMember> {
    const m: GroupMember = {
      id: `gm-${memberId}`,
      groupId,
      memberId,
      role,
      joinedAt: new Date(),
      leftAt: null,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };
    this.members.push(m);
    return m;
  }
  async updateMemberStatus(
    id: string,
    status: "ACTIVE" | "LEFT",
    joinedAt: Date,
    leftAt: Date | null,
    version: number
  ): Promise<GroupMember> {
    const idx = this.members.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error("NOT_FOUND");
    const updated = { ...this.members[idx], status, joinedAt, leftAt, version: version + 1 };
    this.members[idx] = updated;
    return updated;
  }
}

export class MockShoppingRepository implements IShoppingRepository {
  public expenses: ShoppingLog[] = [];

  async getGroupExpenses(
    groupId: string,
    filters?: { startDate?: string; endDate?: string; payerId?: string }
  ): Promise<ShoppingLog[]> {
    return this.expenses.filter((e) => {
      if (e.groupId !== groupId) return false;
      if (filters?.startDate && e.shoppingDate < filters.startDate) return false;
      if (filters?.endDate && e.shoppingDate > filters.endDate) return false;
      if (filters?.payerId && e.payerId !== filters.payerId) return false;
      return true;
    });
  }

  async getById(id: string): Promise<ShoppingLog | null> {
    return this.expenses.find((e) => e.id === id) || null;
  }

  async create(log: Omit<ShoppingLog, "id" | "createdAt" | "updatedAt" | "version">): Promise<ShoppingLog> {
    const exp: ShoppingLog = {
      ...log,
      id: `exp-${this.expenses.length + 1}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };
    this.expenses.push(exp);
    return exp;
  }

  async update(log: Partial<ShoppingLog> & { id: string; version: number }): Promise<ShoppingLog> {
    const idx = this.expenses.findIndex((e) => e.id === log.id);
    if (idx === -1) throw new Error("NOT_FOUND");
    const updated = { ...this.expenses[idx], ...log, version: log.version + 1 };
    this.expenses[idx] = updated;
    return updated;
  }
}

export class MockAttendanceRepository implements IAttendanceRepository {
  public attendanceList: Attendance[] = [];

  async getGroupAttendance(groupId: string, startDate: string, endDate: string): Promise<Attendance[]> {
    return this.attendanceList.filter(
      (a) => a.groupId === groupId && a.date >= startDate && a.date <= endDate
    );
  }

  async saveAttendance(list: Omit<Attendance, "id" | "createdAt" | "updatedAt">[]): Promise<void> {
    for (const item of list) {
      const idx = this.attendanceList.findIndex(
        (a) =>
          a.groupId === item.groupId &&
          a.memberId === item.memberId &&
          a.date === item.date &&
          a.mealType === item.mealType
      );
      if (idx > -1) {
        this.attendanceList[idx].status = item.status;
      } else {
        this.attendanceList.push({
          ...item,
          id: `att-${this.attendanceList.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }
}

export class MockProfileRepository implements IProfileRepository {
  public profiles: Profile[] = [];
  async getById(id: string): Promise<Profile | null> {
    return this.profiles.find((p) => p.id === id) || null;
  }
  async update(profile: Partial<Profile> & { id: string; version: number }): Promise<Profile> {
    throw new Error("Method not implemented.");
  }
}

export class MockSettlementRepository implements ISettlementRepository {
  public periods: SettlementPeriod[] = [];
  async getActivePeriod(groupId: string): Promise<SettlementPeriod | null> {
    return this.periods.find((p) => p.groupId === groupId && p.status === "OPEN") || null;
  }
  async getPeriods(groupId: string): Promise<SettlementPeriod[]> {
    return this.periods.filter((p) => p.groupId === groupId);
  }
  async getPeriodById(id: string): Promise<SettlementPeriod | null> {
    return this.periods.find((p) => p.id === id) || null;
  }
  async createPeriod(period: Omit<SettlementPeriod, "id" | "createdAt" | "updatedAt" | "version">): Promise<SettlementPeriod> {
    const p: SettlementPeriod = {
      ...period,
      id: `period-${this.periods.length + 1}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };
    this.periods.push(p);
    return p;
  }
  async updatePeriodStatus(id: string, status: "OPEN" | "LOCKED", version: number): Promise<SettlementPeriod> {
    const idx = this.periods.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("NOT_FOUND");
    const updated = { ...this.periods[idx], status, version: version + 1 };
    this.periods[idx] = updated;
    return updated;
  }
}

export class MockPaymentRepository implements IPaymentRepository {
  public payments: Payment[] = [];
  async getPeriodPayments(groupId: string, periodId: string): Promise<Payment[]> {
    return this.payments.filter((p) => p.groupId === groupId && p.settlementPeriodId === periodId);
  }
  async createPayment(payment: Omit<Payment, "id" | "createdAt" | "updatedAt" | "version">): Promise<Payment> {
    const p: Payment = {
      ...payment,
      id: `pay-${this.payments.length + 1}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };
    this.payments.push(p);
    return p;
  }
  async updatePaymentStatus(id: string, status: "PENDING" | "PAID", version: number): Promise<Payment> {
    const idx = this.payments.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("NOT_FOUND");
    const updated = { ...this.payments[idx], status, version: version + 1 };
    this.payments[idx] = updated;
    return updated;
  }
}

export class MockAuditLogRepository implements IAuditLogRepository {
  async getGroupLogs(groupId: string): Promise<AuditLog[]> {
    return [];
  }
  async log(log: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog> {
    return {
      ...log,
      id: "audit-1",
      createdAt: new Date(),
    };
  }
}
