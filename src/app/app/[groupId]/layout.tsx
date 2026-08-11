import { redirect } from "next/navigation";
import { getUserGroupsAction } from "@/app/actions/group.actions";
import { AppLayoutClient } from "./layout-client";
import { createClient } from "@/infrastructure/supabase/server";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ groupId: string }>;
}

export default async function GroupLayout({ children, params }: LayoutProps) {
  const { groupId } = await params;

  // 1. Lấy Supabase client và user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Fetch memberships và profile song song (Promise.all) — nhanh hơn tuần tự
  const [memberships, profileResult] = await Promise.all([
    getUserGroupsAction(),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
  ]);

  // 3. Security Check: Redirect to /app if user is not an active member of this group
  const activeMembership = memberships.find((m) => m.groupId === groupId);
  if (!activeMembership) {
    redirect("/app");
  }

  const profile = profileResult.data;
  const userProfile = profile
    ? { id: profile.id, fullName: profile.full_name, avatarUrl: profile.avatar_url }
    : { id: user.id, fullName: user.email || "Thành viên", avatarUrl: null };

  return (
    <AppLayoutClient
      groupId={groupId}
      memberships={memberships}
      userProfile={userProfile}
      activeRole={activeMembership.role}
    >
      {children}
    </AppLayoutClient>
  );
}
