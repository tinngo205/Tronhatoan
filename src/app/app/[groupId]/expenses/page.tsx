import { redirect } from "next/navigation";
import { createClient } from "@/infrastructure/supabase/server";
import {
  SupabaseShoppingRepository,
  SupabaseMemberRepository,
} from "@/infrastructure/repositories/supabase.repositories";
import { ExpensesClient } from "./expenses-client";

interface ExpensesPageProps {
  params: Promise<{ groupId: string }>;
}

export default async function ExpensesPage({ params }: ExpensesPageProps) {
  const { groupId } = await params;

  // 1. Setup Server Supabase client
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Fetch members và expenses song song
  const memberRepo = new SupabaseMemberRepository(supabase);
  const shoppingRepo = new SupabaseShoppingRepository(supabase);
  const [members, expenses] = await Promise.all([
    memberRepo.getGroupMembers(groupId),
    shoppingRepo.getGroupExpenses(groupId),
  ]);

  // 3. Find current user's membership
  const currentMember = members.find((m) => m.memberId === user.id);
  if (!currentMember || currentMember.status !== "ACTIVE") {
    redirect("/app");
  }

  return (
    <ExpensesClient
      groupId={groupId}
      initialExpenses={expenses}
      members={members.filter((m) => m.status === "ACTIVE")}
      currentUserId={user.id}
      currentUserRole={currentMember.role}
    />
  );
}
