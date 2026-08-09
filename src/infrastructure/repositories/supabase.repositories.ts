import { SupabaseClient } from "@supabase/supabase-js";
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
} from "../../core/entities";
import {
  IProfileRepository,
  IGroupRepository,
  IMemberRepository,
  IInvitationRepository,
  IShoppingRepository,
  IAttendanceRepository,
  ISettlementRepository,
  IPaymentRepository,
  INotificationRepository,
  IAuditLogRepository,
} from "../../core/repositories/interfaces";

// --------------------------------------------------
// MAPPERS: Snake Case (PostgreSQL) to Camel Case (TypeScript)
// --------------------------------------------------

function mapProfile(row: any): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    version: Number(row.version),
  };
}

function mapGroup(row: any): Group {
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url,
    settings: row.settings,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    version: Number(row.version),
  };
}

function mapGroupMember(row: any): GroupMember {
  return {
    id: row.id,
    groupId: row.group_id,
    memberId: row.member_id,
    role: row.role,
    joinedAt: new Date(row.joined_at),
    leftAt: row.left_at ? new Date(row.left_at) : null,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    version: Number(row.version),
    profile: row.profiles ? mapProfile(row.profiles) : undefined,
    group: row.groups ? mapGroup(row.groups) : undefined,
  };
}

function mapInvitation(row: any): GroupInvitation {
  return {
    id: row.id,
    groupId: row.group_id,
    email: row.email,
    role: row.role,
    token: row.token,
    status: row.status,
    invitedBy: row.invited_by,
    expiresAt: new Date(row.expires_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapShoppingLog(row: any): ShoppingLog {
  return {
    id: row.id,
    groupId: row.group_id,
    payerId: row.payer_id,
    amount: Number(row.amount),
    currency: row.currency,
    note: row.note,
    shoppingDate: row.shopping_date,
    expenseType: row.expense_type,
    status: row.status,
    clientMutationId: row.client_mutation_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    version: Number(row.version),
    payer: row.payer ? mapProfile(row.payer) : undefined,
  };
}

function mapAttendance(row: any): Attendance {
  return {
    id: row.id,
    groupId: row.group_id,
    memberId: row.member_id,
    date: row.date,
    mealType: row.meal_type,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapSettlementPeriod(row: any): SettlementPeriod {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    version: Number(row.version),
  };
}

function mapPayment(row: any): Payment {
  return {
    id: row.id,
    groupId: row.group_id,
    settlementPeriodId: row.settlement_period_id,
    payerId: row.payer_id,
    receiverId: row.receiver_id,
    amount: Number(row.amount),
    note: row.note,
    paymentDate: row.payment_date,
    status: row.status,
    clientMutationId: row.client_mutation_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    version: Number(row.version),
    payer: row.payer_profile ? mapProfile(row.payer_profile) : undefined,
    receiver: row.receiver_profile ? mapProfile(row.receiver_profile) : undefined,
  };
}

function mapNotification(row: any): AppNotification {
  return {
    id: row.id,
    groupId: row.group_id,
    receiverId: row.receiver_id,
    title: row.title,
    content: row.content,
    type: row.type,
    link: row.link,
    isRead: row.is_read,
    createdAt: new Date(row.created_at),
  };
}

function mapAuditLog(row: any): AuditLog {
  return {
    id: row.id,
    groupId: row.group_id,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    actor: row.profiles ? mapProfile(row.profiles) : undefined,
  };
}

// --------------------------------------------------
// REPOSITORY IMPLEMENTATIONS
// --------------------------------------------------

export class SupabaseProfileRepository implements IProfileRepository {
  constructor(private supabase: SupabaseClient) {}

  async getById(id: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return mapProfile(data);
  }

  async update(profile: Partial<Profile> & { id: string; version: number }): Promise<Profile> {
    const { data, error } = await this.supabase
      .from("profiles")
      .update({
        full_name: profile.fullName,
        avatar_url: profile.avatarUrl,
        version: profile.version + 1,
      })
      .eq("id", profile.id)
      .eq("version", profile.version)
      .select()
      .single();

    if (error || !data) {
      throw new Error("CONFLICT_OR_NOT_FOUND");
    }
    return mapProfile(data);
  }
}

export class SupabaseGroupRepository implements IGroupRepository {
  constructor(private supabase: SupabaseClient) {}

  async getById(id: string): Promise<Group | null> {
    const { data, error } = await this.supabase
      .from("groups")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return mapGroup(data);
  }

  async getUserGroups(userId: string): Promise<GroupMember[]> {
    const { data, error } = await this.supabase
      .from("group_members")
      .select("*, groups(*), profiles(*)")
      .eq("member_id", userId)
      .eq("status", "ACTIVE");

    if (error || !data) return [];
    return data.map(mapGroupMember);
  }

  async create(name: string, settings?: GroupSettings): Promise<Group> {
    const { data, error } = await this.supabase
      .from("groups")
      .insert({
        name,
        settings: settings || { allocationMode: "DAILY" },
      })
      .select()
      .single();

    if (error || !data) throw error;
    return mapGroup(data);
  }

  async update(group: Partial<Group> & { id: string; version: number }): Promise<Group> {
    const { data, error } = await this.supabase
      .from("groups")
      .update({
        name: group.name,
        avatar_url: group.avatarUrl,
        settings: group.settings,
        version: group.version + 1,
      })
      .eq("id", group.id)
      .eq("version", group.version)
      .select()
      .single();

    if (error || !data) throw new Error("CONFLICT_OR_NOT_FOUND");
    return mapGroup(data);
  }
}

export class SupabaseMemberRepository implements IMemberRepository {
  constructor(private supabase: SupabaseClient) {}

  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const { data, error } = await this.supabase
      .from("group_members")
      .select("*, profiles(*)")
      .eq("group_id", groupId);

    if (error || !data) return [];
    return data.map(mapGroupMember);
  }

  async getGroupMember(groupId: string, memberId: string): Promise<GroupMember | null> {
    const { data, error } = await this.supabase
      .from("group_members")
      .select("*, profiles(*)")
      .eq("group_id", groupId)
      .eq("member_id", memberId)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (error || !data) return null;
    return mapGroupMember(data);
  }

  async addMember(groupId: string, memberId: string, role: "ADMIN" | "MEMBER"): Promise<GroupMember> {
    // Check if member already has a LEFT/PENDING record to reactivate, else insert
    const { data: existing } = await this.supabase
      .from("group_members")
      .select("*")
      .eq("group_id", groupId)
      .eq("member_id", memberId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await this.supabase
        .from("group_members")
        .update({
          status: "ACTIVE",
          role,
          joined_at: new Date().toISOString(),
          left_at: null,
          version: existing.version + 1,
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error || !data) throw error;
      return mapGroupMember(data);
    } else {
      const { data, error } = await this.supabase
        .from("group_members")
        .insert({
          group_id: groupId,
          member_id: memberId,
          role,
          status: "ACTIVE",
        })
        .select()
        .single();
      if (error || !data) throw error;
      return mapGroupMember(data);
    }
  }

  async updateMemberStatus(
    id: string,
    status: "ACTIVE" | "LEFT",
    joinedAt: Date,
    leftAt: Date | null,
    version: number
  ): Promise<GroupMember> {
    const { data, error } = await this.supabase
      .from("group_members")
      .update({
        status,
        joined_at: joinedAt.toISOString(),
        left_at: leftAt ? leftAt.toISOString() : null,
        version: version + 1,
      })
      .eq("id", id)
      .eq("version", version)
      .select()
      .single();

    if (error || !data) throw new Error("CONFLICT_OR_NOT_FOUND");
    return mapGroupMember(data);
  }
}

export class SupabaseInvitationRepository implements IInvitationRepository {
  constructor(private supabase: SupabaseClient) {}

  async create(invitation: Omit<GroupInvitation, "id" | "createdAt" | "updatedAt">): Promise<GroupInvitation> {
    const { data, error } = await this.supabase
      .from("group_invitations")
      .insert({
        group_id: invitation.groupId,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        status: invitation.status,
        invited_by: invitation.invitedBy,
        expires_at: invitation.expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error || !data) throw error;
    return mapInvitation(data);
  }

  async getById(id: string): Promise<GroupInvitation | null> {
    const { data, error } = await this.supabase
      .from("group_invitations")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return mapInvitation(data);
  }

  async getByToken(token: string): Promise<GroupInvitation | null> {
    const { data, error } = await this.supabase
      .from("group_invitations")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (error || !data) return null;
    return mapInvitation(data);
  }

  async updateStatus(id: string, status: GroupInvitation["status"]): Promise<GroupInvitation> {
    const { data, error } = await this.supabase
      .from("group_invitations")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) throw error;
    return mapInvitation(data);
  }
}

export class SupabaseShoppingRepository implements IShoppingRepository {
  constructor(private supabase: SupabaseClient) {}

  async getGroupExpenses(
    groupId: string,
    filters?: { startDate?: string; endDate?: string; payerId?: string }
  ): Promise<ShoppingLog[]> {
    let query = this.supabase
      .from("shopping_logs")
      .select("*, payer:profiles!payer_id(*)")
      .eq("group_id", groupId)
      .neq("status", "VOID");

    if (filters?.startDate) {
      query = query.gte("shopping_date", filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte("shopping_date", filters.endDate);
    }
    if (filters?.payerId) {
      query = query.eq("payer_id", filters.payerId);
    }

    // Sort by shopping date descending, then created_at descending
    query = query.order("shopping_date", { ascending: false }).order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(mapShoppingLog);
  }

  async getById(id: string): Promise<ShoppingLog | null> {
    const { data, error } = await this.supabase
      .from("shopping_logs")
      .select("*, payer:profiles!payer_id(*)")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return mapShoppingLog(data);
  }

  async create(log: Omit<ShoppingLog, "id" | "createdAt" | "updatedAt" | "version">): Promise<ShoppingLog> {
    const { data, error } = await this.supabase
      .from("shopping_logs")
      .insert({
        group_id: log.groupId,
        payer_id: log.payerId,
        amount: log.amount,
        currency: log.currency,
        note: log.note,
        shopping_date: log.shoppingDate,
        expense_type: log.expenseType,
        status: log.status,
        client_mutation_id: log.clientMutationId,
        created_by: log.createdBy,
      })
      .select("*, payer:profiles!payer_id(*)")
      .single();

    if (error || !data) throw error;
    return mapShoppingLog(data);
  }

  async update(log: Partial<ShoppingLog> & { id: string; version: number }): Promise<ShoppingLog> {
    const { data, error } = await this.supabase
      .from("shopping_logs")
      .update({
        payer_id: log.payerId,
        amount: log.amount,
        note: log.note,
        shopping_date: log.shoppingDate,
        expense_type: log.expenseType,
        status: log.status,
        updated_by: log.updatedBy,
        version: log.version + 1,
      })
      .eq("id", log.id)
      .eq("version", log.version)
      .select()
      .single();

    if (error || !data) throw new Error("CONFLICT_OR_NOT_FOUND");
    return mapShoppingLog(data);
  }
}

export class SupabaseAttendanceRepository implements IAttendanceRepository {
  constructor(private supabase: SupabaseClient) {}

  async getGroupAttendance(groupId: string, startDate: string, endDate: string): Promise<Attendance[]> {
    const { data, error } = await this.supabase
      .from("attendance")
      .select("*")
      .eq("group_id", groupId)
      .gte("date", startDate)
      .lte("date", endDate);

    if (error || !data) return [];
    return data.map(mapAttendance);
  }

  async saveAttendance(attendanceList: Omit<Attendance, "id" | "createdAt" | "updatedAt">[]): Promise<void> {
    if (attendanceList.length === 0) return;

    // Use upsert to update status if exists, or insert new
    const payload = attendanceList.map((item) => ({
      group_id: item.groupId,
      member_id: item.memberId,
      date: item.date,
      meal_type: item.mealType,
      status: item.status,
    }));

    const { error } = await this.supabase
      .from("attendance")
      .upsert(payload, {
        onConflict: "group_id,member_id,date,meal_type",
      });

    if (error) throw error;
  }
}

export class SupabaseSettlementRepository implements ISettlementRepository {
  constructor(private supabase: SupabaseClient) {}

  async getActivePeriod(groupId: string): Promise<SettlementPeriod | null> {
    const { data, error } = await this.supabase
      .from("settlement_periods")
      .select("*")
      .eq("group_id", groupId)
      .eq("status", "OPEN")
      .maybeSingle();

    if (error || !data) return null;
    return mapSettlementPeriod(data);
  }

  async getPeriods(groupId: string): Promise<SettlementPeriod[]> {
    const { data, error } = await this.supabase
      .from("settlement_periods")
      .select("*")
      .eq("group_id", groupId)
      .order("start_date", { ascending: false });

    if (error || !data) return [];
    return data.map(mapSettlementPeriod);
  }

  async getPeriodById(id: string): Promise<SettlementPeriod | null> {
    const { data, error } = await this.supabase
      .from("settlement_periods")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return mapSettlementPeriod(data);
  }

  async createPeriod(period: Omit<SettlementPeriod, "id" | "createdAt" | "updatedAt" | "version">): Promise<SettlementPeriod> {
    const { data, error } = await this.supabase
      .from("settlement_periods")
      .insert({
        group_id: period.groupId,
        name: period.name,
        start_date: period.startDate,
        end_date: period.endDate,
        status: period.status,
        created_by: period.createdBy,
      })
      .select()
      .single();

    if (error || !data) throw error;
    return mapSettlementPeriod(data);
  }

  async updatePeriodStatus(id: string, status: "OPEN" | "LOCKED", version: number): Promise<SettlementPeriod> {
    const { data, error } = await this.supabase
      .from("settlement_periods")
      .update({
        status,
        version: version + 1,
      })
      .eq("id", id)
      .eq("version", version)
      .select()
      .single();

    if (error || !data) throw new Error("CONFLICT_OR_NOT_FOUND");
    return mapSettlementPeriod(data);
  }
}

export class SupabasePaymentRepository implements IPaymentRepository {
  constructor(private supabase: SupabaseClient) {}

  async getPeriodPayments(groupId: string, periodId: string): Promise<Payment[]> {
    const { data, error } = await this.supabase
      .from("payments")
      .select("*, payer_profile:profiles!payments_payer_id_fkey(*), receiver_profile:profiles!payments_receiver_id_fkey(*)")
      .eq("group_id", groupId)
      .eq("settlement_period_id", periodId);

    if (error || !data) return [];
    return data.map(mapPayment);
  }

  async createPayment(payment: Omit<Payment, "id" | "createdAt" | "updatedAt" | "version">): Promise<Payment> {
    const { data, error } = await this.supabase
      .from("payments")
      .insert({
        group_id: payment.groupId,
        settlement_period_id: payment.settlementPeriodId,
        payer_id: payment.payerId,
        receiver_id: payment.receiverId,
        amount: payment.amount,
        note: payment.note,
        payment_date: payment.paymentDate,
        status: payment.status,
        client_mutation_id: payment.clientMutationId,
      })
      .select()
      .single();

    if (error || !data) throw error;
    return mapPayment(data);
  }

  async updatePaymentStatus(id: string, status: "PENDING" | "PAID", version: number): Promise<Payment> {
    const { data, error } = await this.supabase
      .from("payments")
      .update({
        status,
        version: version + 1,
      })
      .eq("id", id)
      .eq("version", version)
      .select()
      .single();

    if (error || !data) throw new Error("CONFLICT_OR_NOT_FOUND");
    return mapPayment(data);
  }
}

export class SupabaseNotificationRepository implements INotificationRepository {
  constructor(private supabase: SupabaseClient) {}

  async getUserNotifications(userId: string): Promise<AppNotification[]> {
    const { data, error } = await this.supabase
      .from("notifications")
      .select("*")
      .eq("receiver_id", userId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data.map(mapNotification);
  }

  async markAsRead(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (error) throw error;
  }

  async createNotification(notification: Omit<AppNotification, "id" | "isRead" | "createdAt">): Promise<AppNotification> {
    const { data, error } = await this.supabase
      .from("notifications")
      .insert({
        group_id: notification.groupId,
        receiver_id: notification.receiverId,
        title: notification.title,
        content: notification.content,
        type: notification.type,
        link: notification.link,
      })
      .select()
      .single();

    if (error || !data) throw error;
    return mapNotification(data);
  }
}

export class SupabaseAuditLogRepository implements IAuditLogRepository {
  constructor(private supabase: SupabaseClient) {}

  async getGroupLogs(groupId: string): Promise<AuditLog[]> {
    const { data, error } = await this.supabase
      .from("audit_logs")
      .select("*, profiles(*)")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data.map(mapAuditLog);
  }

  async log(log: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog> {
    const { data, error } = await this.supabase
      .from("audit_logs")
      .insert({
        group_id: log.groupId,
        actor_id: log.actorId,
        action: log.action,
        entity_type: log.entityType,
        entity_id: log.entityId,
        metadata: log.metadata,
      })
      .select()
      .single();

    if (error || !data) throw error;
    return mapAuditLog(data);
  }
}
