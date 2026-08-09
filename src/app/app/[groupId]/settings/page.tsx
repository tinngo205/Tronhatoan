import { redirect } from "next/navigation";
import { createClient } from "@/infrastructure/supabase/server";
import {
  SupabaseMemberRepository,
  SupabaseGroupRepository,
} from "@/infrastructure/repositories/supabase.repositories";
import { SettingsClient } from "./settings-client";

interface SettingsPageProps {
  params: Promise<{ groupId: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
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

  // 4. Authorization check: Only ADMIN role can access settings page
  if (currentMember.role !== "ADMIN") {
    redirect(`/app/${groupId}/overview`);
  }

  // 5. Fetch group details
  const groupRepo = new SupabaseGroupRepository(supabase);
  const group = await groupRepo.getById(groupId);
  if (!group) {
    redirect("/app");
  }

  return <SettingsClient groupId={groupId} group={group} />;
}
