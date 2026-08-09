export interface Profile {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface GroupSettings {
  allocationMode: "DAILY" | "MEAL";
}

export interface Group {
  id: string;
  name: string;
  avatarUrl: string | null;
  settings: GroupSettings;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface GroupMember {
  id: string;
  groupId: string;
  memberId: string;
  role: "ADMIN" | "MEMBER";
  joinedAt: Date;
  leftAt: Date | null;
  status: "ACTIVE" | "LEFT" | "PENDING";
  createdAt: Date;
  updatedAt: Date;
  version: number;
  profile?: Profile; // Populated from join query
  group?: Group;     // Populated from join query
}

export interface GroupInvitation {
  id: string;
  groupId: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  token: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  invitedBy: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ExpenseType = "MEAL" | "SHARED";

export interface ShoppingLog {
  id: string;
  groupId: string;
  payerId: string;
  amount: number; // Integer (1 = 1 VND)
  currency: string;
  note: string;
  shoppingDate: string; // YYYY-MM-DD
  expenseType: ExpenseType;
  status: "ACTIVE" | "VOID";
  clientMutationId: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  payer?: Profile; // Populated from join query
}

export type MealType = "BREAKFAST" | "LUNCH" | "DINNER";
export type AttendanceStatus = "EATEN" | "NOT_EATEN";

export interface Attendance {
  id: string;
  groupId: string;
  memberId: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  status: AttendanceStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettlementPeriod {
  id: string;
  groupId: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: "OPEN" | "LOCKED";
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface Payment {
  id: string;
  groupId: string;
  settlementPeriodId: string;
  payerId: string;
  receiverId: string;
  amount: number; // Integer (1 = 1 VND)
  note: string | null;
  paymentDate: string; // YYYY-MM-DD
  status: "PENDING" | "PAID";
  clientMutationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  payer?: Profile; // Populated from join query
  receiver?: Profile; // Populated from join query
}

export interface AppNotification {
  id: string;
  groupId: string;
  receiverId: string;
  title: string;
  content: string;
  type: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  groupId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, any>;
  createdAt: Date;
  actor?: Profile; // Populated from join query
}
