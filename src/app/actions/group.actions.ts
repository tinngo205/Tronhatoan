"use server";

import { createClient, createAdminClient } from "@/infrastructure/supabase/server";
import {
  SupabaseGroupRepository,
  SupabaseMemberRepository,
  SupabaseInvitationRepository,
  SupabaseProfileRepository,
  SupabaseAuditLogRepository,
} from "@/infrastructure/repositories/supabase.repositories";
import { GroupService } from "@/infrastructure/services/group.service";
import { InvitationService } from "@/infrastructure/services/invitation.service";
import { GroupSettings } from "@/core/entities";
import { z } from "zod";

// Zod validations
const createGroupSchema = z.object({
  name: z.string().min(2, "Tên nhóm phải chứa ít nhất 2 ký tự"),
});

const inviteSchema = z.object({
  groupId: z.string().uuid(),
  email: z.string().email("Email không hợp lệ"),
  role: z.enum(["ADMIN", "MEMBER"]),
});

export async function createGroupAction(formData: z.infer<typeof createGroupSchema>) {
  const validation = createGroupSchema.safeParse(formData);
  if (!validation.success) return { error: validation.error.issues[0].message };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập để tạo nhóm." };

  const adminSupabase = createAdminClient();
  const groupRepo = new SupabaseGroupRepository(adminSupabase);
  const memberRepo = new SupabaseMemberRepository(adminSupabase);
  const auditRepo = new SupabaseAuditLogRepository(adminSupabase);
  const groupService = new GroupService(groupRepo, memberRepo, auditRepo);

  try {
    const group = await groupService.createGroup(validation.data.name, user.id);
    return { success: true, group };
  } catch (error: any) {
    return { error: error.message || "Không thể tạo nhóm." };
  }
}

export async function updateGroupAction(
  groupId: string,
  name: string,
  settings: GroupSettings,
  version: number
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập." };

  const groupRepo = new SupabaseGroupRepository(supabase);
  const memberRepo = new SupabaseMemberRepository(supabase);
  const auditRepo = new SupabaseAuditLogRepository(supabase);
  const groupService = new GroupService(groupRepo, memberRepo, auditRepo);

  try {
    const group = await groupService.updateGroup(groupId, name, null, settings, user.id, version);
    return { success: true, group };
  } catch (error: any) {
    if (error.message === "CONFLICT_OR_NOT_FOUND") {
      return { error: "Dữ liệu nhóm đã thay đổi. Vui lòng tải lại trang." };
    }
    return { error: error.message || "Không thể cập nhật nhóm." };
  }
}

export async function inviteMemberAction(formData: z.infer<typeof inviteSchema>) {
  const validation = inviteSchema.safeParse(formData);
  if (!validation.success) return { error: validation.error.issues[0].message };

  const { groupId, email, role } = validation.data;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn chưa đăng nhập." };

  const adminSupabase = createAdminClient();
  const invitationRepo = new SupabaseInvitationRepository(adminSupabase);
  const memberRepo = new SupabaseMemberRepository(supabase);
  const groupRepo = new SupabaseGroupRepository(supabase);
  const profileRepo = new SupabaseProfileRepository(supabase);
  const auditRepo = new SupabaseAuditLogRepository(supabase);

  const invitationService = new InvitationService(
    invitationRepo,
    memberRepo,
    groupRepo,
    profileRepo,
    auditRepo
  );

  try {
    const invitation = await invitationService.inviteUser(groupId, email, role, user.id);
    return { success: true, invitation };
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_NOT_ADMIN") {
      return { error: "Chỉ quản trị viên mới được phép mời thành viên." };
    }
    return { error: error.message || "Không thể gửi lời mời." };
  }
}

export async function acceptInvitationAction(token: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập để tham gia nhóm." };

  // Use Admin client for invitation operations to safely verify token and read system records before RLS is established for the user
  const adminSupabase = createAdminClient();
  const invitationRepo = new SupabaseInvitationRepository(adminSupabase);
  const memberRepo = new SupabaseMemberRepository(adminSupabase);
  const groupRepo = new SupabaseGroupRepository(adminSupabase);
  const profileRepo = new SupabaseProfileRepository(adminSupabase);
  const auditRepo = new SupabaseAuditLogRepository(adminSupabase);

  const invitationService = new InvitationService(
    invitationRepo,
    memberRepo,
    groupRepo,
    profileRepo,
    auditRepo
  );

  try {
    const member = await invitationService.acceptInvitation(token, user.id);
    return { success: true, groupId: member.groupId };
  } catch (error: any) {
    if (error.message === "INVITATION_EXPIRED") {
      return { error: "Lời mời đã hết hạn." };
    }
    if (error.message.startsWith("INVITATION_ALREADY_")) {
      return { error: "Lời mời này đã được chấp nhận hoặc đã bị thu hồi." };
    }
    return { error: error.message || "Lỗi chấp nhận lời mời." };
  }
}

export async function removeMemberAction(groupId: string, memberId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn chưa đăng nhập." };

  const groupRepo = new SupabaseGroupRepository(supabase);
  const memberRepo = new SupabaseMemberRepository(supabase);
  const auditRepo = new SupabaseAuditLogRepository(supabase);
  const groupService = new GroupService(groupRepo, memberRepo, auditRepo);

  try {
    await groupService.removeMember(groupId, memberId, user.id);
    return { success: true };
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_NOT_ADMIN") {
      return { error: "Chỉ quản trị viên mới được xóa thành viên." };
    }
    if (error.message === "CANNOT_REMOVE_YOURSELF") {
      return { error: "Bạn không thể tự xóa chính mình. Hãy chọn rời nhóm." };
    }
    return { error: error.message || "Lỗi xóa thành viên." };
  }
}

export async function leaveGroupAction(groupId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn chưa đăng nhập." };

  const groupRepo = new SupabaseGroupRepository(supabase);
  const memberRepo = new SupabaseMemberRepository(supabase);
  const auditRepo = new SupabaseAuditLogRepository(supabase);
  const groupService = new GroupService(groupRepo, memberRepo, auditRepo);

  try {
    await groupService.leaveGroup(groupId, user.id);
    return { success: true };
  } catch (error: any) {
    if (error.message === "LAST_ADMIN_CANNOT_LEAVE") {
      return { error: "Bạn là quản trị viên cuối cùng. Bạn phải chỉ định một quản trị viên khác trước khi rời nhóm." };
    }
    return { error: error.message || "Lỗi rời nhóm." };
  }
}

export async function getUserGroupsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const groupRepo = new SupabaseGroupRepository(supabase);
  return groupRepo.getUserGroups(user.id);
}
