"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ShoppingLog, GroupMember, ExpenseType } from "@/core/entities";
import { updateExpenseAction, voidExpenseAction } from "@/app/actions/expense.actions";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { MoneyInput } from "@/components/common/MoneyInput";
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
  Edit2,
  Trash2,
  Filter,
  RefreshCw,
  Tag,
  AlertTriangle,
  User,
  Calendar,
  DollarSign,
  Loader2,
  AlertCircle,
} from "lucide-react";

// Segmented control button styles
const expenseTypes = [
  { value: "MEAL", label: "Bữa ăn (Chia theo điểm danh)" },
  { value: "SHARED", label: "Dùng chung (Chia đều cả nhóm)" },
];

// Form validation schema for edit
const editFormSchema = z.object({
  amount: z.number().int().min(1000, "Số tiền tối thiểu phải là 1.000 ₫"),
  note: z.string().min(1, "Vui lòng nhập nội dung chi tiêu"),
  shoppingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ"),
  expenseType: z.enum(["MEAL", "SHARED"]),
});

type EditFormValues = z.infer<typeof editFormSchema>;

interface ExpensesClientProps {
  groupId: string;
  initialExpenses: ShoppingLog[];
  members: GroupMember[];
  currentUserId: string;
  currentUserRole: "ADMIN" | "MEMBER";
}

export function ExpensesClient({
  groupId,
  initialExpenses,
  members,
  currentUserId,
  currentUserRole,
}: ExpensesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { isOnline, enqueueMutation } = useOfflineSync();

  // Filters state
  const [filterPayer, setFilterPayer] = useState<string>("ALL");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");

  // Edit modal state
  const [editingExpense, setEditingExpense] = useState<ShoppingLog | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Void modal state
  const [voidingExpense, setVoidingExpense] = useState<ShoppingLog | null>(null);
  const [isVoidOpen, setIsVoidOpen] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  // Form setup for edit
  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors: editErrors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
  });

  const openEditModal = (exp: ShoppingLog) => {
    setEditingExpense(exp);
    setEditError(null);
    reset({
      amount: exp.amount,
      note: exp.note,
      shoppingDate: exp.shoppingDate,
      expenseType: exp.expenseType,
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = (values: EditFormValues) => {
    if (!editingExpense) return;
    setEditError(null);

    startTransition(async () => {
      const payload = {
        id: editingExpense.id,
        payerId: editingExpense.payerId,
        amount: values.amount,
        note: values.note,
        shoppingDate: values.shoppingDate,
        expenseType: values.expenseType,
        version: editingExpense.version,
      };

      if (isOnline) {
        const res = await updateExpenseAction(payload);
        if (res.error) {
          setEditError(res.error);
          return;
        }
      } else {
        await enqueueMutation("UPDATE_EXPENSE", payload);
      }

      setIsEditOpen(false);
      router.refresh();
    });
  };

  const openVoidModal = (exp: ShoppingLog) => {
    setVoidingExpense(exp);
    setVoidError(null);
    setIsVoidOpen(true);
  };

  const handleVoidConfirm = () => {
    if (!voidingExpense) return;
    setVoidError(null);

    startTransition(async () => {
      if (isOnline) {
        const res = await voidExpenseAction(voidingExpense.id, voidingExpense.version);
        if (res.error) {
          setVoidError(res.error);
          return;
        }
      } else {
        await enqueueMutation("VOID_EXPENSE", {
          expenseId: voidingExpense.id,
          version: voidingExpense.version,
        });
      }

      setIsVoidOpen(false);
      router.refresh();
    });
  };

  // Filter logic on client-side for rapid response
  const filteredExpenses = initialExpenses.filter((exp) => {
    if (filterPayer !== "ALL" && exp.payerId !== filterPayer) return false;
    if (filterStartDate && exp.shoppingDate < filterStartDate) return false;
    if (filterEndDate && exp.shoppingDate > filterEndDate) return false;
    return true;
  });

  // Calculate totals for summary card
  const totalPaidSum = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Group by payer to get total paid per member
  const memberPaidTotals: Record<string, number> = {};
  for (const m of members) {
    memberPaidTotals[m.memberId] = 0;
  }
  for (const exp of filteredExpenses) {
    if (memberPaidTotals[exp.payerId] !== undefined) {
      memberPaidTotals[exp.payerId] += exp.amount;
    }
  }

  const formatShortDate = (dateStr: string) => {
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
    return dateStr;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Filters Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">
            Chi tiêu đi chợ
          </h1>
          <p className="text-sm text-neutral-500 font-medium">
            Danh sách tất cả các hóa đơn chi tiêu được ghi nhận trong nhóm
          </p>
        </div>
      </div>

      {/* 2. Filters Bar */}
      <Card className="border-neutral-100 shadow-sm rounded-3xl overflow-hidden bg-white">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            <span>Bộ lọc chi tiêu</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Payer Select */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase">Người trả tiền</label>
              <Select value={filterPayer} onValueChange={(val) => setFilterPayer(val || "ALL")}>
                <SelectTrigger className="rounded-xl border-neutral-200 text-xs h-9">
                  <SelectValue placeholder="Chọn người trả" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL">Tất cả thành viên</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.memberId} value={m.memberId}>
                      {m.profile?.fullName || "Thành viên"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase">Từ ngày</label>
              <Input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="rounded-xl border-neutral-200 text-xs h-9"
              />
            </div>

            {/* End Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase">Đến ngày</label>
              <Input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="rounded-xl border-neutral-200 text-xs h-9"
              />
            </div>
          </div>
          {(filterPayer !== "ALL" || filterStartDate || filterEndDate) && (
            <div className="flex justify-end pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterPayer("ALL");
                  setFilterStartDate("");
                  setFilterEndDate("");
                }}
                className="text-xs text-sky-500 font-bold hover:bg-sky-50 hover:text-sky-600 rounded-lg h-7"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Summary totals of filtered items */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-neutral-100 shadow-sm rounded-3xl overflow-hidden bg-white md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Tổng tiền đi chợ (Lọc)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-extrabold text-neutral-800">
              {totalPaidSum.toLocaleString("vi-VN")} ₫
            </span>
          </CardContent>
        </Card>

        <Card className="border-neutral-100 shadow-sm rounded-3xl overflow-hidden bg-white md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Chi tiết đã trả của từng thành viên
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-x-6 gap-y-2.5">
            {members.map((m) => {
              const paid = memberPaidTotals[m.memberId] || 0;
              return (
                <div key={m.memberId} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-[10px]">
                    {m.profile?.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-neutral-700">{m.profile?.fullName}:</span>{" "}
                    <span className="font-extrabold text-neutral-800">{paid.toLocaleString("vi-VN")} ₫</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* 4. Expenses List */}
      <div className="space-y-4">
        {filteredExpenses.length > 0 ? (
          filteredExpenses.map((exp) => {
            const isOwner = exp.payerId === currentUserId;
            const canManage = isOwner || currentUserRole === "ADMIN";
            return (
              <Card
                key={exp.id}
                className="border-neutral-100 shadow-sm rounded-3xl overflow-hidden bg-white hover:shadow-md hover:shadow-neutral-100/50 transition-all"
              >
                <CardContent className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3 truncate">
                    <div className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-700 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                      {exp.payer?.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <h3 className="font-bold text-neutral-800 truncate text-base">{exp.note}</h3>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400 mt-1">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {exp.payer?.fullName}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatShortDate(exp.shoppingDate)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-md font-bold text-[10px]">
                          <Tag className="w-2.5 h-2.5" />
                          {exp.expenseType === "MEAL" ? "Bữa ăn" : "Dùng chung"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-base font-extrabold text-neutral-800">
                      {exp.amount.toLocaleString("vi-VN")} ₫
                    </span>
                    {canManage && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditModal(exp)}
                          className="p-2 rounded-xl text-neutral-400 hover:text-sky-500 hover:bg-sky-50 transition-colors focus:outline-none"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openVoidModal(exp)}
                          className="p-2 rounded-xl text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors focus:outline-none"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="bg-white border border-neutral-100 rounded-3xl py-16 text-center text-sm text-neutral-400 font-medium shadow-sm">
            Không tìm thấy chi tiêu nào khớp với bộ lọc.
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Chỉnh sửa chi tiêu</DialogTitle>
            <DialogDescription className="text-xs">Cập nhật thông tin đi chợ của bạn</DialogDescription>
          </DialogHeader>

          {editError && (
            <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3.5 text-sm text-red-600 border border-red-100">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(handleEditSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Số tiền</label>
              <Controller
                name="amount"
                control={control}
                render={({ field }) => (
                  <MoneyInput
                    value={field.value}
                    onChange={field.onChange}
                    className="rounded-2xl h-11 border-neutral-200 focus:border-sky-500 focus:ring-sky-500 font-bold"
                    placeholder="0 ₫"
                    disabled={isPending}
                  />
                )}
              />
              {editErrors.amount && (
                <span className="text-xs text-red-500 font-semibold px-1">{editErrors.amount.message}</span>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Nội dung chi tiêu</label>
              <Input
                disabled={isPending}
                className="rounded-2xl h-11 border-neutral-200 focus:border-sky-500 focus:ring-sky-500"
                {...register("note")}
              />
              {editErrors.note && (
                <span className="text-xs text-red-500 font-semibold px-1">{editErrors.note.message}</span>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Ngày chi tiêu</label>
              <Input
                type="date"
                disabled={isPending}
                className="rounded-2xl h-11 border-neutral-200 focus:border-sky-500 focus:ring-sky-500"
                {...register("shoppingDate")}
              />
              {editErrors.shoppingDate && (
                <span className="text-xs text-red-500 font-semibold px-1">{editErrors.shoppingDate.message}</span>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Phân loại chi phí</label>
              <Controller
                name="expenseType"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-2 bg-neutral-100 p-1 rounded-2xl">
                    {expenseTypes.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => field.onChange(type.value)}
                        className={`py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                          field.value === type.value
                            ? "bg-white text-neutral-900 shadow-sm"
                            : "text-neutral-500 hover:text-neutral-700"
                        }`}
                      >
                        {type.value === "MEAL" ? "Bữa ăn" : "Dùng chung"}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="submit"
                disabled={isPending}
                className="rounded-2xl h-11 bg-neutral-900 hover:bg-neutral-800 text-white font-bold flex items-center justify-center gap-2"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Cập nhật
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="rounded-2xl h-11 border-neutral-200"
              >
                Hủy bỏ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Void Dialog */}
      <Dialog open={isVoidOpen} onOpenChange={setIsVoidOpen}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-neutral-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              Vô hiệu hóa chi tiêu
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-500 mt-2">
              Bạn có chắc chắn muốn vô hiệu hóa khoản chi tiêu <strong>"{voidingExpense?.note}"</strong> trị giá <strong>{voidingExpense?.amount.toLocaleString("vi-VN")} ₫</strong> không?
            </DialogDescription>
          </DialogHeader>

          {voidError && (
            <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-600 border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{voidError}</span>
            </div>
          )}

          <div className="text-xs font-semibold text-red-500 bg-red-50 p-3 rounded-2xl border border-red-100">
            Lưu ý: Hành động này sẽ loại bỏ khoản chi tiêu khỏi quyết toán nhưng vẫn giữ lịch sử audit. Không thể khôi phục lại sau khi xác nhận.
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              disabled={isPending}
              onClick={handleVoidConfirm}
              className="rounded-2xl h-11 bg-red-600 hover:bg-red-700 text-white font-bold flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Xác nhận xóa
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setIsVoidOpen(false)}
              className="rounded-2xl h-11 border-neutral-200"
            >
              Hủy bỏ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
