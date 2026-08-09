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

  // 2. Fetch group members
  const memberRepo = new SupabaseMemberRepository(supabase);
  const members = await memberRepo.getGroupMembers(groupId);

  // 3. Find current user's membership to pass their role (ADMIN/MEMBER)
  const currentMember = members.find((m) => m.memberId === user.id);
  if (!currentMember || currentMember.status !== "ACTIVE") {
    redirect("/app");
  }

  // 4. Fetch group expenses (no dates filter initially, load all for the client to filter)
  const shoppingRepo = new SupabaseShoppingRepository(supabase);
  const expenses = await shoppingRepo.getGroupExpenses(groupId);

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
