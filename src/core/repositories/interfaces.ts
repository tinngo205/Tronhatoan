import {
  Profile,
  Group,
  GroupMember,
  GroupSettings,
  GroupInvitation,
  ShoppingLog,
  Attendance,
  SettlementPeriod,
  Payment,
  AppNotification,
  AuditLog,
} from "../entities";

export interface IProfileRepository {
  getById(id: string): Promise<Profile | null>;
  update(profile: Partial<Profile> & { id: string; version: number }): Promise<Profile>;
}

export interface IGroupRepository {
  getById(id: string): Promise<Group | null>;
  getUserGroups(userId: string): Promise<GroupMember[]>;
  create(name: string, settings?: GroupSettings): Promise<Group>;
  update(group: Partial<Group> & { id: string; version: number }): Promise<Group>;
}

export interface IMemberRepository {
  getGroupMembers(groupId: string): Promise<GroupMember[]>;
  getGroupMember(groupId: string, memberId: string): Promise<GroupMember | null>;
  addMember(groupId: string, memberId: string, role: "ADMIN" | "MEMBER"): Promise<GroupMember>;
  updateMemberStatus(
    id: string,
    status: "ACTIVE" | "LEFT",
    joinedAt: Date,
    leftAt: Date | null,
    version: number
  ): Promise<GroupMember>;
}

export interface IInvitationRepository {
  create(invitation: Omit<GroupInvitation, "id" | "createdAt" | "updatedAt">): Promise<GroupInvitation>;
  getById(id: string): Promise<GroupInvitation | null>;
  getByToken(token: string): Promise<GroupInvitation | null>;
  updateStatus(id: string, status: GroupInvitation["status"]): Promise<GroupInvitation>;
}

export interface IShoppingRepository {
  getGroupExpenses(
    groupId: string,
    filters?: { startDate?: string; endDate?: string; payerId?: string }
  ): Promise<ShoppingLog[]>;
  getById(id: string): Promise<ShoppingLog | null>;
  create(log: Omit<ShoppingLog, "id" | "createdAt" | "updatedAt" | "version">): Promise<ShoppingLog>;
  update(log: Partial<ShoppingLog> & { id: string; version: number }): Promise<ShoppingLog>;
}

export interface IAttendanceRepository {
  getGroupAttendance(groupId: string, startDate: string, endDate: string): Promise<Attendance[]>;
  saveAttendance(attendanceList: Omit<Attendance, "id" | "createdAt" | "updatedAt">[]): Promise<void>;
}

export interface ISettlementRepository {
  getActivePeriod(groupId: string): Promise<SettlementPeriod | null>;
  getPeriods(groupId: string): Promise<SettlementPeriod[]>;
  getPeriodById(id: string): Promise<SettlementPeriod | null>;
  createPeriod(period: Omit<SettlementPeriod, "id" | "createdAt" | "updatedAt" | "version">): Promise<SettlementPeriod>;
  updatePeriodStatus(id: string, status: "OPEN" | "LOCKED", version: number): Promise<SettlementPeriod>;
}

export interface IPaymentRepository {
  getPeriodPayments(groupId: string, periodId: string): Promise<Payment[]>;
  createPayment(payment: Omit<Payment, "id" | "createdAt" | "updatedAt" | "version">): Promise<Payment>;
  updatePaymentStatus(id: string, status: "PENDING" | "PAID", version: number): Promise<Payment>;
}

export interface INotificationRepository {
  getUserNotifications(userId: string): Promise<AppNotification[]>;
  markAsRead(id: string): Promise<void>;
  createNotification(notification: Omit<AppNotification, "id" | "isRead" | "createdAt">): Promise<AppNotification>;
}

export interface IAuditLogRepository {
  getGroupLogs(groupId: string): Promise<AuditLog[]>;
  log(log: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog>;
}
