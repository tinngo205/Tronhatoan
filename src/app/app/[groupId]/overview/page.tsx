import { redirect } from "next/navigation";
import Link from "next/link";
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
import { OverviewCharts } from "./overview-charts";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  ArrowRight,
  AlertCircle,
  Tag,
  CreditCard,
  Users,
} from "lucide-react";

interface OverviewPageProps {
  params: Promise<{ groupId: string }>;
}

export default async function OverviewPage({ params }: OverviewPageProps) {
  const { groupId } = await params;

  // 1. Setup Supabase Server client and verify login
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Instantiate repos & services
  const settlementRepo = new SupabaseSettlementRepository(supabase);
  const paymentRepo = new SupabasePaymentRepository(supabase);
  const memberRepo = new SupabaseMemberRepository(supabase);
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

  // 3. Determine date range dynamically
  // Check if there is an active open settlement period
  const activePeriod = await settlementRepo.getActivePeriod(groupId);
  
  let startDate = "";
  let endDate = "";
  let periodName = "";

  if (activePeriod) {
    startDate = activePeriod.startDate;
    endDate = activePeriod.endDate;
    periodName = activePeriod.name;
  } else {
    // Default to the current calendar month
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    startDate = `${y}-${m}-01`;
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    endDate = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
    periodName = `Tháng ${now.getMonth() + 1}/${y} (Lắp ghép tự động)`;
  }

  // 4. Calculate allocations and balances
  let settlementSummary;
  let calculationError = null;

  try {
    settlementSummary = await settlementService.calculateSettlement(groupId, startDate, endDate);
  } catch (err: any) {
    console.error("Lỗi tính toán quyết toán:", err);
    calculationError = err.message || "Lỗi tính toán chi phí.";
  }

  // 5. Get current user's balance
  const myBalance = settlementSummary?.balances.find((b) => b.memberId === user.id);

  // 6. Fetch recent expenses (limit to 5)
  const allExpenses = await shoppingRepo.getGroupExpenses(groupId, {
    startDate,
    endDate,
  });
  const recentExpenses = allExpenses.filter((e) => e.status === "ACTIVE").slice(0, 5);

  // Format date helper
  const formatDate = (dateStr: string) => {
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dateStr;
  };

  // Convert summaries to charts payload
  const memberChartData =
    settlementSummary?.balances.map((b) => ({
      name: b.fullName,
      "Đã trả": b.paid,
      "Phải chịu": b.eaten,
    })) || [];

  const dailyChartData =
    settlementSummary?.allocationResult.dailyBreakdowns.map((d) => ({
      date: d.date,
      "Chi tiêu": d.totalExpense,
    })) || [];

  return (
    <div className="space-y-6">
      {/* Welcome header & Period metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">
            Trang tổng quan
          </h1>
          <p className="text-sm text-neutral-500 font-medium mt-1">
            Kỳ quyết toán: <strong className="text-neutral-800">{periodName}</strong> ({formatDate(startDate)} → {formatDate(endDate)})
          </p>
        </div>
        {!activePeriod && (
          <div className="bg-sky-50 text-sky-700 text-xs font-bold px-3 py-1.5 rounded-full border border-sky-100/50 self-start">
            Chế độ tự động hóa tạm thời
          </div>
        )}
      </div>

      {calculationError && (
        <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-600 border border-red-100">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-bold">Lỗi đồng bộ dữ liệu quyết toán</p>
            <p className="text-xs mt-0.5">{calculationError}</p>
          </div>
        </div>
      )}

      {/* Main Net Balance Card */}
      {myBalance && (
        <Card className="border-neutral-100 shadow-lg shadow-neutral-100/50 rounded-3xl overflow-hidden bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  Số dư Net cá nhân của bạn
                </p>
                <h2
                  className={`text-3xl font-extrabold mt-1 tracking-tight ${
                    myBalance.net > 0
                      ? "text-emerald-600"
                      : myBalance.net < 0
                      ? "text-orange-500"
                      : "text-neutral-700"
                  }`}
                >
                  {myBalance.net > 0 ? "+" : ""}
                  {myBalance.net.toLocaleString("vi-VN")} ₫
                </h2>
                <p className="text-xs text-neutral-500 font-medium mt-2">
                  {myBalance.net > 0
                    ? "Bạn đã trả nhiều hơn phần ăn, bạn được nhận lại tiền này."
                    : myBalance.net < 0
                    ? "Phần ăn của bạn nhiều hơn tiền đã trả, bạn cần thanh toán số này."
                    : "Bạn đã trả đúng bằng phần ăn của mình. Đã cân bằng!"}
                </p>
              </div>
              <div
                className={`p-4 rounded-2xl ${
                  myBalance.net > 0
                    ? "bg-emerald-50 text-emerald-500"
                    : myBalance.net < 0
                    ? "bg-orange-50 text-orange-500"
                    : "bg-neutral-50 text-neutral-400"
                }`}
              >
                {myBalance.net > 0 ? (
                  <ArrowUpRight className="w-8 h-8" />
                ) : myBalance.net < 0 ? (
                  <ArrowDownLeft className="w-8 h-8" />
                ) : (
                  <TrendingUp className="w-8 h-8" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards Grid */}
      {settlementSummary && myBalance && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-neutral-100 shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Tổng chi tiêu nhóm
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-xl font-extrabold text-neutral-800">
                  {settlementSummary.totalExpense.toLocaleString("vi-VN")} ₫
                </span>
                <div className="bg-sky-50 p-2 rounded-xl text-sky-500">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-neutral-100 shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Bạn đã trả (Grocery Paid)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-xl font-extrabold text-neutral-800">
                  {myBalance.paid.toLocaleString("vi-VN")} ₫
                </span>
                <div className="bg-emerald-50 p-2 rounded-xl text-emerald-500">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-neutral-100 shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Bạn đã tiêu thụ (Eaten Cost)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-xl font-extrabold text-neutral-800">
                  {myBalance.eaten.toLocaleString("vi-VN")} ₫
                </span>
                <div className="bg-orange-50 p-2 rounded-xl text-orange-500">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Action Cards (especially for mobile quick tap navigation) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Link href={`/app/${groupId}/attendance`} className="flex items-center gap-3 bg-white border border-neutral-100 rounded-2xl p-4 shadow-sm hover:bg-neutral-50 transition-all">
          <div className="bg-amber-50 p-2.5 rounded-xl text-amber-500">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-sm text-neutral-800">Điểm danh</p>
            <p className="text-[10px] text-neutral-400 font-medium">Báo ăn hàng ngày</p>
          </div>
        </Link>

        <Link href={`/app/${groupId}/settlement`} className="flex items-center gap-3 bg-white border border-neutral-100 rounded-2xl p-4 shadow-sm hover:bg-neutral-50 transition-all">
          <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-500">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-sm text-neutral-800">Quyết toán</p>
            <p className="text-[10px] text-neutral-400 font-medium">Xem phân chia nợ</p>
          </div>
        </Link>

        <Link href={`/app/${groupId}/members`} className="hidden sm:flex items-center gap-3 bg-white border border-neutral-100 rounded-2xl p-4 shadow-sm hover:bg-neutral-50 transition-all">
          <div className="bg-rose-50 p-2.5 rounded-xl text-rose-500">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-sm text-neutral-800">Thành viên</p>
            <p className="text-[10px] text-neutral-400 font-medium">Mời và quản lý</p>
          </div>
        </Link>
      </div>

      {/* Charts Section */}
      <OverviewCharts memberData={memberChartData} dailyData={dailyChartData} />

      {/* Recent Activity List */}
      <Card className="border-neutral-100 shadow-sm rounded-3xl overflow-hidden bg-white">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Chi tiêu đi chợ gần đây
          </CardTitle>
          <Link
            href={`/app/${groupId}/expenses`}
            className="text-xs font-bold text-sky-500 hover:text-sky-600 flex items-center gap-0.5"
          >
            Tất cả chi tiêu
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="divide-y divide-neutral-100 p-0 px-6">
          {recentExpenses.length > 0 ? (
            recentExpenses.map((exp) => (
              <div key={exp.id} className="flex items-center justify-between py-3.5">
                <div className="flex items-center gap-3 truncate">
                  <div className="w-9 h-9 rounded-full bg-neutral-100 text-neutral-700 flex items-center justify-center font-bold text-xs shrink-0">
                    {exp.payer?.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-bold text-neutral-800 truncate">{exp.note}</p>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-0.5">
                      <span>{exp.payer?.fullName}</span>
                      <span>•</span>
                      <span>{formatDate(exp.shoppingDate)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <Tag className="w-3 h-3" />
                        {exp.expenseType === "MEAL" ? "Bữa ăn" : "Dùng chung"}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-neutral-800 shrink-0">
                  {exp.amount.toLocaleString("vi-VN")} ₫
                </span>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-sm text-neutral-400 font-medium">
              Chưa có khoản chi tiêu đi chợ nào được ghi nhận trong thời gian này.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
