import { redirect } from "next/navigation";
import { createClient } from "@/infrastructure/supabase/server";
import {
  SupabaseSettlementRepository,
  SupabasePaymentRepository,
  SupabaseMemberRepository,
  SupabaseShoppingRepository,
  SupabaseProfileRepository,
  SupabaseAuditLogRepository,
  SupabaseAttendanceRepository,
  SupabaseGroupRepository,
} from "@/infrastructure/repositories/supabase.repositories";
import { AllocationService } from "@/infrastructure/services/allocation.service";
import { SettlementService } from "@/infrastructure/services/settlement.service";
import { SettlementClient } from "./settlement-client";

interface SettlementPageProps {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ period_id?: string }>;
}

export default async function SettlementPage({ params, searchParams }: SettlementPageProps) {
  const { groupId } = await params;
  const { period_id } = await searchParams;

  // 1. Setup Server Supabase client
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Fetch members và periods song song
  const memberRepo = new SupabaseMemberRepository(supabase);
  const settlementRepo = new SupabaseSettlementRepository(supabase);
  const [members, periods] = await Promise.all([
    memberRepo.getGroupMembers(groupId),
    settlementRepo.getPeriods(groupId),
  ]);

  const currentMember = members.find((m) => m.memberId === user.id);
  if (!currentMember || currentMember.status !== "ACTIVE") {
    redirect("/app");
  }

  // 3. Determine selected period ID
  let selectedPeriodId: string | null = null;
  if (period_id) {
    selectedPeriodId = period_id;
  } else if (periods.length > 0) {
    const openPeriod = periods.find((p) => p.status === "OPEN");
    selectedPeriodId = openPeriod ? openPeriod.id : periods[0].id;
  }

  // 4. Calculate settlement summary for selected period
  let summary = null;
  if (selectedPeriodId) {
    const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);
    if (selectedPeriod) {
      const paymentRepo = new SupabasePaymentRepository(supabase);
      const shoppingRepo = new SupabaseShoppingRepository(supabase);
      const profileRepo = new SupabaseProfileRepository(supabase);
      const auditRepo = new SupabaseAuditLogRepository(supabase);
      const attendanceRepo = new SupabaseAttendanceRepository(supabase);
      const groupRepo = new SupabaseGroupRepository(supabase);

      const allocationService = new AllocationService(
        shoppingRepo,
        attendanceRepo,
        memberRepo,
        groupRepo
      );
      
      const settlementService = new SettlementService(
        settlementRepo,
        paymentRepo,
        memberRepo,
        shoppingRepo,
        profileRepo,
        auditRepo,
        allocationService
      );

      try {
        summary = await settlementService.calculateSettlement(
          groupId,
          selectedPeriod.startDate,
          selectedPeriod.endDate
        );
      } catch (err) {
        console.error("Lỗi tính toán quyết toán:", err);
      }
    }
  }

  return (
    <SettlementClient
      groupId={groupId}
      periods={periods}
      selectedPeriodId={selectedPeriodId}
      summary={summary}
      currentUserId={user.id}
      currentUserRole={currentMember.role}
    />
  );
}
