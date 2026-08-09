import {
  IGroupRepository,
  IMemberRepository,
  IAuditLogRepository,
} from "../../core/repositories/interfaces";
import { Group, GroupMember, GroupSettings } from "../../core/entities";

export class GroupService {
  constructor(
    private groupRepo: IGroupRepository,
    private memberRepo: IMemberRepository,
    private auditLogRepo: IAuditLogRepository
  ) {}

  async createGroup(name: string, creatorId: string, settings?: GroupSettings): Promise<Group> {
    // 1. Create group.
    const group = await this.groupRepo.create(name, settings);

    // 2. Explicitly add creator as ADMIN member (to bypass any database RLS/trigger issues)
    try {
      await this.memberRepo.addMember(group.id, creatorId, "ADMIN");
    } catch (memberError) {
      console.warn("Creator membership might already exist or failed to insert:", memberError);
    }

    // 3. Log audit event
    await this.auditLogRepo.log({
      groupId: group.id,
      actorId: creatorId,
      action: "CREATE_GROUP",
      entityType: "groups",
      entityId: group.id,
      metadata: { name, settings },
    });

    return group;
  }

  async updateGroup(
    groupId: string,
    name: string,
    avatarUrl: string | null,
    settings: GroupSettings,
    actorId: string,
    version: number
  ): Promise<Group> {
    // 1. Authorization: Verify actor is ADMIN
    const membership = await this.memberRepo.getGroupMember(groupId, actorId);
    if (!membership || membership.role !== "ADMIN" || membership.status !== "ACTIVE") {
      throw new Error("UNAUTHORIZED_NOT_ADMIN");
    }

    // 2. Perform update with version check (concurrency control)
    const updated = await this.groupRepo.update({
      id: groupId,
      name,
      avatarUrl,
      settings,
      version,
    });

    // 3. Log audit event
    await this.auditLogRepo.log({
      groupId,
      actorId,
      action: "UPDATE_GROUP",
      entityType: "groups",
      entityId: groupId,
      metadata: { name, settings, version },
    });

    return updated;
  }

  async removeMember(groupId: string, memberId: string, actorId: string): Promise<void> {
    // 1. Authorization: Verify actor is ADMIN
    const actorMembership = await this.memberRepo.getGroupMember(groupId, actorId);
    if (!actorMembership || actorMembership.role !== "ADMIN" || actorMembership.status !== "ACTIVE") {
      throw new Error("UNAUTHORIZED_NOT_ADMIN");
    }

    if (memberId === actorId) {
      throw new Error("CANNOT_REMOVE_YOURSELF");
    }

    // 2. Fetch target membership details
    const targetMembership = await this.memberRepo.getGroupMember(groupId, memberId);
    if (!targetMembership || targetMembership.status !== "ACTIVE") {
      throw new Error("MEMBER_NOT_FOUND_OR_INACTIVE");
    }

    // 3. Perform soft-delete (status = 'LEFT', left_at = now)
    await this.memberRepo.updateMemberStatus(
      targetMembership.id,
      "LEFT",
      targetMembership.joinedAt,
      new Date(),
      targetMembership.version
    );

    // 4. Log audit event
    await this.auditLogRepo.log({
      groupId,
      actorId,
      action: "REMOVE_MEMBER",
      entityType: "group_members",
      entityId: targetMembership.id,
      metadata: { memberId },
    });
  }

  async leaveGroup(groupId: string, memberId: string): Promise<void> {
    // 1. Fetch membership details
    const membership = await this.memberRepo.getGroupMember(groupId, memberId);
    if (!membership || membership.status !== "ACTIVE") {
      throw new Error("MEMBER_NOT_FOUND_OR_INACTIVE");
    }

    // Check if they are the last admin of the group. If so, they cannot leave without assigning another admin or deleting the group
    if (membership.role === "ADMIN") {
      const allMembers = await this.memberRepo.getGroupMembers(groupId);
      const activeAdmins = allMembers.filter((m) => m.role === "ADMIN" && m.status === "ACTIVE");
      if (activeAdmins.length === 1) {
        throw new Error("LAST_ADMIN_CANNOT_LEAVE");
      }
    }

    // 2. Perform soft-delete (status = 'LEFT', left_at = now)
    await this.memberRepo.updateMemberStatus(
      membership.id,
      "LEFT",
      membership.joinedAt,
      new Date(),
      membership.version
    );

    // 3. Log audit event
    await this.auditLogRepo.log({
      groupId,
      actorId: memberId,
      action: "LEAVE_GROUP",
      entityType: "group_members",
      entityId: membership.id,
      metadata: {},
    });
  }
}
