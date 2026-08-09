import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/infrastructure/supabase/server";
import {
  SupabaseMemberRepository,
} from "@/infrastructure/repositories/supabase.repositories";
import { MembersClient } from "./members-client";

interface MembersPageProps {
  params: Promise<{ groupId: string }>;
}

export default async function MembersPage({ params }: MembersPageProps) {
  const { groupId } = await params;

  // 1. Setup Server Supabase client
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Fetch group members
  const memberRepo = new SupabaseMemberRepository(supabase);
  const members = await memberRepo.getGroupMembers(groupId);

  // 3. Find current user membership
  const currentMember = members.find((m) => m.memberId === user.id);
  if (!currentMember || currentMember.status !== "ACTIVE") {
    redirect("/app");
  }

  // 4. Fetch group invitations directly via Supabase query using admin client to bypass auth.users RLS restrictions
  const adminSupabase = createAdminClient();
  const { data: invitationsData, error } = await adminSupabase
    .from("group_invitations")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  const invitations = (invitationsData || []).map((row: any) => ({
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
  }));

  return (
    <MembersClient
      groupId={groupId}
      members={members}
      invitations={invitations}
      currentUserId={user.id}
      currentUserRole={currentMember.role}
    />
  );
}
