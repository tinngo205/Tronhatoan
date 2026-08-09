"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  SettlementPeriod,
  Payment,
} from "@/core/entities";
import {
  createSettlementPeriodAction,
  lockSettlementPeriodAction,
  unlockSettlementPeriodAction,
  confirmPaymentAction,
  getPeriodPaymentsAction,
} from "@/app/actions/settlement.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  Loader2,
  Lock,
  Unlock,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Plus,
  Clock,
} from "lucide-react";

// Form schemas
const createPeriodSchema = z.object({
  name: z.string().min(2, "Tên kỳ quyết toán không được để trống"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ"),
});

type CreatePeriodFormValues = z.infer<typeof createPeriodSchema>;

interface SettlementClientProps {
  groupId: string;
  periods: SettlementPeriod[];
  selectedPeriodId: string | null;
  summary: any | null; // calculated summary
  currentUserId: string;
  currentUserRole: "ADMIN" | "MEMBER";
}

export function SettlementClient({
  groupId,
  periods,
  selectedPeriodId,
  summary,
  currentUserId,
  currentUserRole,
}: SettlementClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Selected period
  const [activePeriodId, setActivePeriodId] = useState<string>(selectedPeriodId || "NONE");

  // Payments generated for this period if locked
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [isUnlockOpen, setIsUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [generalError, setGeneralError] = useState<string | null>(null);

  const activePeriod = periods.find((p) => p.id === activePeriodId);
  const isAdmin = currentUserRole === "ADMIN";

  // React Hook Form for creation
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: createErrors },
  } = useForm<CreatePeriodFormValues>({
    resolver: zodResolver(createPeriodSchema),
    defaultValues: {
      name: "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
    },
  });

  // Fetch payments for this period if it's locked
  useEffect(() => {
    if (activePeriodId && activePeriodId !== "NONE" && activePeriod?.status === "LOCKED") {
      setLoadingPayments(true);
      getPeriodPaymentsAction(groupId, activePeriodId)
        .then((data) => {
          setPayments(data);
        })
        .catch((err) => console.error("Error loading payments:", err))
        .finally(() => setLoadingPayments(false));
    } else {
      setPayments([]);
    }
  }, [activePeriodId, activePeriod, groupId]);

  const handlePeriodChange = (id: string) => {
    setActivePeriodId(id);
    setGeneralError(null);
    if (id === "NONE") {
      router.push(`/app/${groupId}/settlement`);
    } else {
      router.push(`/app/${groupId}/settlement?period_id=${id}`);
    }
    router.refresh();
  };

  const handleCreateSubmit = (values: CreatePeriodFormValues) => {
    setCreateError(null);
    startTransition(async () => {
      const res = await createSettlementPeriodAction({
        groupId,
        ...values,
      });

      if (res.error) {
        setCreateError(res.error);
        return;
      }

      setIsCreateOpen(false);
      reset();
      if (res.period) {
        handlePeriodChange(res.period.id);
      }
    });
  };

  const handleLockPeriod = () => {
    if (!activePeriod) return;
    setGeneralError(null);
    
    startTransition(async () => {
      const res = await lockSettlementPeriodAction(activePeriod.id, activePeriod.version);
      if (res.error) {
        setGeneralError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const handleUnlockPeriod = () => {
    if (!activePeriod) return;
    setUnlockError(null);

    startTransition(async () => {
      const res = await unlockSettlementPeriodAction(activePeriod.id, unlockReason, activePeriod.version);
      if (res.error) {
        setUnlockError(res.error);
        return;
      }
      setIsUnlockOpen(false);
      setUnlockReason("");
      router.refresh();
    });
  };

  const handleConfirmPayment = (paymentId: string, version: number) => {
    setGeneralError(null);
    startTransition(async () => {
      const res = await confirmPaymentAction(paymentId, version);
      if (res.error) {
        setGeneralError(res.error);
        return;
      }
      
      // Refresh payments list locally
      if (activePeriodId) {
        const data = await getPeriodPaymentsAction(groupId, activePeriodId);
        setPayments(data);
      }
      router.refresh();
    });
  };

  const formatDate = (dateStr: string) => {
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">
            Quyết toán & Thanh toán
          </h1>
          <p className="text-sm text-neutral-500 font-medium">
            Quản lý các kỳ quyết toán và xác nhận các giao dịch chuyển tiền nội bộ
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="rounded-xl h-10 bg-neutral-900 hover:bg-neutral-800 text-white font-bold self-start flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Tạo kỳ quyết toán
          </Button>
        )}
      </div>

      {generalError && (
        <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-600 border border-red-100">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{generalError}</span>
        </div>
      )}

      {/* Period Selector Card */}
      <Card className="border-neutral-100 shadow-sm rounded-3xl bg-white">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full sm:w-72">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
              Chọn kỳ quyết toán
            </label>
            <Select value={activePeriodId} onValueChange={(val) => handlePeriodChange(val || "NONE")}>
              <SelectTrigger className="rounded-xl border-neutral-200 h-10 text-sm">
                <SelectValue placeholder="Chọn kỳ quyết toán">
                  {activePeriodId === "NONE" || !activePeriod
                    ? "-- Chọn kỳ quyết toán --"
                    : `${activePeriod.name} (${activePeriod.status === "LOCKED" ? "Đã khóa 🔒" : "Đang mở 🔓"})`}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="NONE">-- Chọn kỳ quyết toán --</SelectItem>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.status === "LOCKED" ? "Đã khóa 🔒" : "Đang mở 🔓"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {activePeriod && (
            <div className="text-xs text-neutral-500 font-medium self-end sm:pb-1">
              Thời gian: <strong>{formatDate(activePeriod.startDate)}</strong> → <strong>{formatDate(activePeriod.endDate)}</strong>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Settlement Content */}
      {activePeriodId !== "NONE" && summary ? (
        <div className="space-y-6">
          {/* Status Alert Card & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white border border-neutral-100 rounded-3xl p-5 shadow-sm gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-2xl ${
                  activePeriod?.status === "LOCKED"
                    ? "bg-red-50 text-red-500"
                    : "bg-emerald-50 text-emerald-500"
                }`}
              >
                {activePeriod?.status === "LOCKED" ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="font-bold text-sm text-neutral-800">
                  Trạng thái: {activePeriod?.status === "LOCKED" ? "Đã khóa sổ quyết toán" : "Đang mở cho chỉnh sửa"}
                </h4>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {activePeriod?.status === "LOCKED"
                    ? "Mọi thay đổi về chi tiêu/điểm danh trong khoảng thời gian này đã bị khóa."
                    : "Bạn vẫn có thể thêm/sửa/vô hiệu hóa chi tiêu và thay đổi điểm danh bữa ăn."}
                </p>
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2 self-start sm:self-center">
                {activePeriod?.status === "OPEN" ? (
                  <Button
                    onClick={handleLockPeriod}
                    disabled={isPending}
                    className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold h-9 text-xs px-4"
                  >
                    {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                    Khóa sổ & Chốt quyết toán
                  </Button>
                ) : (
                  <Button
                    onClick={() => setIsUnlockOpen(true)}
                    disabled={isPending}
                    variant="outline"
                    className="rounded-xl border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-bold h-9 text-xs px-4"
                  >
                    Mở khóa quyết toán
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Members Balances List */}
          <Card className="border-neutral-100 shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="pb-3 border-b border-neutral-100/50">
              <CardTitle className="text-sm font-bold text-neutral-500 uppercase tracking-wider">
                Bảng phân bổ chi phí thành viên
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-neutral-100 p-0 px-6">
              {summary.balances.map((bal: any) => {
                const isUser = bal.memberId === currentUserId;
                return (
                  <div key={bal.memberId} className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-9 h-9 rounded-full bg-neutral-100 text-neutral-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {bal.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <span className={`text-sm font-bold truncate ${isUser ? "text-neutral-900 font-extrabold" : "text-neutral-700"}`}>
                          {bal.fullName} {isUser && "(Bạn)"}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-semibold mt-0.5">
                          <span>Đã trả: {bal.paid.toLocaleString("vi-VN")} ₫</span>
                          <span>•</span>
                          <span>Phải chịu: {bal.eaten.toLocaleString("vi-VN")} ₫</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-sm font-extrabold ${
                          bal.net > 0
                            ? "text-emerald-600"
                            : bal.net < 0
                            ? "text-orange-500"
                            : "text-neutral-500"
                        }`}
                      >
                        {bal.net > 0 ? "Nhận: +" : bal.net < 0 ? "Trả: " : ""}
                        {bal.net.toLocaleString("vi-VN")} ₫
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Settlement Recommendations & Payments */}
          <Card className="border-neutral-100 shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="pb-3 border-b border-neutral-100/50">
              <CardTitle className="text-sm font-bold text-neutral-500 uppercase tracking-wider">
                {activePeriod?.status === "LOCKED" ? "Các giao dịch chuyển tiền cần duyệt" : "Đề xuất chuyển khoản tối ưu"}
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-neutral-100 p-0 px-6">
              {activePeriod?.status === "LOCKED" ? (
                /* RENDER GENERATED PAYMENT RECORDS (FREEZED IN DB) */
                loadingPayments ? (
                  <div className="py-12 flex justify-center text-neutral-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : payments.length > 0 ? (
                  payments.map((p) => {
                    const isPayer = p.payerId === currentUserId;
                    const isReceiver = p.receiverId === currentUserId;
                    const canConfirm = isReceiver || isAdmin; // Only receiver or admin can confirm receiving money

                    return (
                      <div key={p.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 gap-4">
                        {/* Transaction flow */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-sm text-neutral-800">{p.payer?.fullName}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
                            <span className="font-bold text-sm text-neutral-800">{p.receiver?.fullName}</span>
                          </div>
                          <span className="text-sm font-extrabold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded-lg">
                            {p.amount.toLocaleString("vi-VN")} ₫
                          </span>
                        </div>

                        {/* Confirm button / Status badge */}
                        <div className="self-start sm:self-center">
                          {p.status === "PAID" ? (
                            <div className="flex items-center gap-1 text-emerald-600 font-extrabold text-xs bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Đã thanh toán</span>
                            </div>
                          ) : canConfirm ? (
                            <Button
                              onClick={() => handleConfirmPayment(p.id, p.version)}
                              disabled={isPending}
                              className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold h-8 text-xs px-3 shadow-md shadow-sky-100"
                            >
                              {isPending && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                              Xác nhận đã nhận tiền
                            </Button>
                          ) : (
                            <div className="flex items-center gap-1 text-neutral-400 font-bold text-xs bg-neutral-50 px-3 py-1 rounded-full border border-neutral-100">
                              <Clock className="w-3.5 h-3.5 animate-pulse" />
                              <span>Chờ người nhận duyệt</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-sm text-neutral-400">
                    Kỳ quyết toán này không có đề xuất giao dịch nào (tất cả mọi người đều hòa vốn).
                  </div>
                )
              ) : (
                /* RENDER DRAFT RECOMMENDATIONS (OPEN MODE) */
                summary.recommendations.length > 0 ? (
                  <div>
                    {/* Payment Instructions Guide */}
                    <div className="py-4">
                      <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <HelpCircle className="w-4 h-4 text-sky-500 shrink-0" />
                          <span className="text-xs font-bold text-sky-700 uppercase tracking-wider">Hướng dẫn chuyển tiền</span>
                        </div>
                        <p className="text-xs text-sky-600 leading-relaxed">
                          Hệ thống đã tối ưu hóa xuống mức ít giao dịch nhất. Thực hiện đúng thứ tự sau là xong:
                        </p>
                        <ol className="space-y-2.5">
                          {summary.recommendations.map((rec: any, idx: number) => {
                            const isYouPaying = rec.payerId === currentUserId;
                            const isYouReceiving = rec.receiverId === currentUserId;
                            return (
                              <li key={idx} className="flex items-start gap-3">
                                <span className="w-5 h-5 rounded-full bg-sky-500 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                                  {idx + 1}
                                </span>
                                <span className={`text-xs leading-relaxed ${isYouPaying || isYouReceiving ? "font-bold text-neutral-800" : "text-neutral-600"}`}>
                                  <span className={`font-extrabold ${isYouPaying ? "text-orange-600" : "text-neutral-800"}`}>
                                    {isYouPaying ? "Bạn" : rec.payerName}
                                  </span>
                                  {" chuyển "}
                                  <span className="font-extrabold text-sky-600">{rec.amount.toLocaleString("vi-VN")} ₫</span>
                                  {" cho "}
                                  <span className={`font-extrabold ${isYouReceiving ? "text-emerald-600" : "text-neutral-800"}`}>
                                    {isYouReceiving ? "Bạn" : rec.receiverName}
                                  </span>
                                  {(isYouPaying || isYouReceiving) && (
                                    <span className="ml-1.5 inline-flex items-center bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                                      ← Liên quan đến bạn
                                    </span>
                                  )}
                                </span>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    </div>

                    {/* Transactions List */}
                    <div className="divide-y divide-neutral-100">
                      {summary.recommendations.map((rec: any, idx: number) => {
                        const isYouPaying = rec.payerId === currentUserId;
                        const isYouReceiving = rec.receiverId === currentUserId;
                        return (
                          <div key={idx} className="flex items-center justify-between py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isYouPaying ? "bg-orange-50 text-orange-600 border border-orange-100" : "bg-neutral-100 text-neutral-700"}`}>
                                {isYouPaying ? "Bạn" : rec.payerName}
                              </span>
                              <ArrowRight className="w-4 h-4 text-neutral-300" />
                              <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isYouReceiving ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-neutral-100 text-neutral-700"}`}>
                                {isYouReceiving ? "Bạn" : rec.receiverName}
                              </span>
                            </div>
                            <span className="text-sm font-extrabold text-sky-700 bg-sky-50 border border-sky-100 px-3 py-1 rounded-xl">
                              {rec.amount.toLocaleString("vi-VN")} ₫
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-sm text-neutral-400">
                    Kỳ quyết toán này không có đề xuất giao dịch nào (tất cả mọi người đều hòa vốn).
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="bg-white border border-neutral-100 rounded-3xl py-20 text-center text-sm text-neutral-400 font-medium shadow-sm flex flex-col items-center justify-center gap-2">
          <CreditCard className="w-8 h-8 text-neutral-300" />
          <span>Vui lòng chọn hoặc tạo mới một kỳ quyết toán để xem chi tiết dòng tiền.</span>
        </div>
      )}

      {/* Create Period Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Tạo kỳ quyết toán mới</DialogTitle>
            <DialogDescription className="text-xs">
              Thiết lập tên và khoảng thời gian để chốt thu chi
            </DialogDescription>
          </DialogHeader>

          {createError && (
            <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3.5 text-sm text-red-600 border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(handleCreateSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Tên kỳ quyết toán</label>
              <Input
                id="name"
                placeholder="Ví dụ: Quyết toán tháng 8/2026, Chuyến đi homestay..."
                disabled={isPending}
                className="rounded-2xl h-11 border-neutral-200 focus:border-sky-500"
                {...register("name")}
              />
              {createErrors.name && (
                <span className="text-xs text-red-500 font-semibold px-1">{createErrors.name.message}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Ngày bắt đầu</label>
                <Input
                  id="startDate"
                  type="date"
                  disabled={isPending}
                  className="rounded-2xl h-11 border-neutral-200 focus:border-sky-500"
                  {...register("startDate")}
                />
                {createErrors.startDate && (
                  <span className="text-xs text-red-500 font-semibold px-1">{createErrors.startDate.message}</span>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Ngày kết thúc</label>
                <Input
                  id="endDate"
                  type="date"
                  disabled={isPending}
                  className="rounded-2xl h-11 border-neutral-200 focus:border-sky-500"
                  {...register("endDate")}
                />
                {createErrors.endDate && (
                  <span className="text-xs text-red-500 font-semibold px-1">{createErrors.endDate.message}</span>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="submit"
                disabled={isPending}
                className="rounded-2xl h-11 bg-neutral-900 hover:bg-neutral-800 text-white font-bold flex items-center justify-center gap-2"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Tạo kỳ mới
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-2xl h-11 border-neutral-200"
              >
                Hủy bỏ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Unlock Period Dialog */}
      <Dialog open={isUnlockOpen} onOpenChange={setIsUnlockOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-neutral-800 flex items-center gap-2">
              <Unlock className="w-5 h-5 text-sky-500" />
              Mở khóa sổ quyết toán
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-500 mt-2">
              Mở khóa sẽ cho phép thành viên chỉnh sửa lại chi tiêu và điểm danh của kỳ này. Hãy ghi lại lý do.
            </DialogDescription>
          </DialogHeader>

          {unlockError && (
            <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3.5 text-sm text-red-600 border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{unlockError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Lý do mở khóa sổ</label>
              <Input
                placeholder="Nhập lý do: Sửa lỗi tính tiền, Thêm chi tiêu sót..."
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                disabled={isPending}
                className="rounded-2xl h-11 border-neutral-200 focus:border-sky-500"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              disabled={isPending}
              onClick={handleUnlockPeriod}
              className="rounded-2xl h-11 bg-neutral-900 hover:bg-neutral-800 text-white font-bold flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Xác nhận mở khóa
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setIsUnlockOpen(false)}
              className="rounded-2xl h-11 border-neutral-200"
            >
              Hủy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
