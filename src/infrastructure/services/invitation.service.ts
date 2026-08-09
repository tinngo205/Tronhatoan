import crypto from "crypto";
import {
  IInvitationRepository,
  IMemberRepository,
  IGroupRepository,
  IAuditLogRepository,
  IProfileRepository,
} from "../../core/repositories/interfaces";
import { GroupInvitation, GroupMember } from "../../core/entities";
import { sendEmail } from "../../lib/mail";

export class InvitationService {
  constructor(
    private invitationRepo: IInvitationRepository,
    private memberRepo: IMemberRepository,
    private groupRepo: IGroupRepository,
    private profileRepo: IProfileRepository,
    private auditLogRepo: IAuditLogRepository
  ) {}

  async inviteUser(
    groupId: string,
    email: string,
    role: "ADMIN" | "MEMBER",
    invitedById: string
  ): Promise<GroupInvitation> {
    // 1. Authorization: Verify the inviter is an active ADMIN of the group
    const inviterMembership = await this.memberRepo.getGroupMember(groupId, invitedById);
    if (!inviterMembership || inviterMembership.role !== "ADMIN" || inviterMembership.status !== "ACTIVE") {
      throw new Error("UNAUTHORIZED_NOT_ADMIN");
    }

    // 2. Fetch group and inviter details for the email content
    const group = await this.groupRepo.getById(groupId);
    if (!group) throw new Error("GROUP_NOT_FOUND");

    const inviterProfile = await this.profileRepo.getById(invitedById);
    const inviterName = inviterProfile?.fullName || "Một thành viên";

    // 3. Generate token and create database invitation record
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expiration: 7 days

    const invitation = await this.invitationRepo.create({
      groupId,
      email: email.toLowerCase().trim(),
      role,
      token,
      status: "PENDING",
      invitedBy: invitedById,
      expiresAt,
    });

    // 4. Send email using the custom SMTP configuration
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteLink = `${appUrl}/register?invite_token=${token}`;

    const emailSubject = `[CoBuy] Lời mời tham gia nhóm "${group.name}"`;
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
        <h2 style="color: #0ea5e9; margin-top: 0;">Chào bạn!</h2>
        <p><strong>${inviterName}</strong> đã mời bạn tham gia nhóm <strong>"${group.name}"</strong> trên ứng dụng quản lý chi tiêu nhóm <strong>CoBuy</strong> với vai trò là <strong>${role === "ADMIN" ? "Quản trị viên (Admin)" : "Thành viên (Member)"}</strong>.</p>
        <p>Để đồng ý và tham gia nhóm, vui lòng bấm vào nút liên kết dưới đây:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Chấp Nhận Lời Mời</a>
        </div>
        <p style="color: #71717a; font-size: 14px;">Đường dẫn này sẽ hết hạn vào ngày: ${expiresAt.toLocaleDateString("vi-VN")} ${expiresAt.toLocaleTimeString("vi-VN")}.</p>
        <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
        <p style="color: #a1a1aa; font-size: 12px; text-align: center;">Nếu bạn không yêu cầu lời mời này, vui lòng bỏ qua email.</p>
      </div>
    `;

    try {
      await sendEmail({
        to: email,
        subject: emailSubject,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error("Failed to send invitation email:", emailError);
      // We don't rollback the database record to allow admin to resend or copy invitation link from UI
    }

    // 5. Write security Audit Log
    await this.auditLogRepo.log({
      groupId,
      actorId: invitedById,
      action: "INVITE_MEMBER",
      entityType: "group_invitations",
      entityId: invitation.id,
      metadata: { email, role },
    });

    return invitation;
  }

  async acceptInvitation(token: string, userId: string): Promise<GroupMember> {
    // 1. Fetch invitation and validate
    const invitation = await this.invitationRepo.getByToken(token);
    if (!invitation) {
      throw new Error("INVITATION_NOT_FOUND");
    }

    if (invitation.status !== "PENDING") {
      throw new Error(`INVITATION_ALREADY_${invitation.status}`);
    }

    const now = new Date();
    if (new Date(invitation.expiresAt) < now) {
      await this.invitationRepo.updateStatus(invitation.id, "EXPIRED");
      throw new Error("INVITATION_EXPIRED");
    }

    // 2. Fetch user profile to ensure it matches or exists
    const profile = await this.profileRepo.getById(userId);
    if (!profile) throw new Error("PROFILE_NOT_FOUND");

    // 3. Mark invitation as ACCEPTED
    await this.invitationRepo.updateStatus(invitation.id, "ACCEPTED");

    // 4. Add/Reactivate member in the group
    const member = await this.memberRepo.addMember(invitation.groupId, userId, invitation.role);

    // 5. Write audit logs
    await this.auditLogRepo.log({
      groupId: invitation.groupId,
      actorId: userId,
      action: "ACCEPT_INVITATION",
      entityType: "group_members",
      entityId: member.id,
      metadata: { invitationId: invitation.id, role: invitation.role },
    });

    return member;
  }

  async revokeInvitation(invitationId: string, actorId: string): Promise<GroupInvitation> {
    const invitation = await this.invitationRepo.getById(invitationId);
    if (!invitation) throw new Error("INVITATION_NOT_FOUND");

    // Verify actor is an Admin of the group
    const membership = await this.memberRepo.getGroupMember(invitation.groupId, actorId);
    if (!membership || membership.role !== "ADMIN" || membership.status !== "ACTIVE") {
      throw new Error("UNAUTHORIZED_NOT_ADMIN");
    }

    if (invitation.status !== "PENDING") {
      throw new Error(`CANNOT_REVOKE_INVITATION_IN_STATUS_${invitation.status}`);
    }

    const updated = await this.invitationRepo.updateStatus(invitationId, "REVOKED");

    await this.auditLogRepo.log({
      groupId: invitation.groupId,
      actorId,
      action: "REVOKE_INVITATION",
      entityType: "group_invitations",
      entityId: invitationId,
      metadata: { email: invitation.email },
    });

    return updated;
  }
}
