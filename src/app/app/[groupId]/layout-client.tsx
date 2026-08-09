"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  LayoutDashboard,
  ShoppingBag,
  Calendar,
  CreditCard,
  Users,
  Settings,
  LogOut,
  Plus,
  ChevronDown,
  Building,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { GroupMember, ExpenseType } from "@/core/entities";
import { logoutAction } from "@/app/actions/auth.actions";
import { createExpenseAction } from "@/app/actions/expense.actions";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/common/MoneyInput";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

// Segmented control button styles
const expenseTypes = [
  { value: "MEAL", label: "Bữa ăn (Chia theo điểm danh)" },
  { value: "SHARED", label: "Dùng chung (Chia đều cả nhóm)" },
];

const expenseFormSchema = z.object({
  amount: z.number().int().min(1000, "Số tiền tối thiểu phải là 1.000 ₫"),
  note: z.string().min(1, "Vui lòng nhập nội dung chi tiêu"),
  shoppingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ"),
  expenseType: z.enum(["MEAL", "SHARED"]),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

interface AppLayoutClientProps {
  children: React.ReactNode;
  groupId: string;
  memberships: GroupMember[];
  userProfile: { id: string; fullName: string; avatarUrl: string | null };
  activeRole: "ADMIN" | "MEMBER";
}

export function AppLayoutClient({
  children,
  groupId,
  memberships,
  userProfile,
  activeRole,
}: AppLayoutClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { isOnline, enqueueMutation } = useOfflineSync();

  // Subscribe to realtime updates for this group
  useRealtimeRefresh(groupId, [
    "shopping_logs",
    "attendance",
    "payments",
    "group_members",
    "settlement_periods",
  ]);

  const activeMembership = memberships.find((m) => m.groupId === groupId);
  const groupName = activeMembership?.group?.name || "Nhóm";

  const navItems = [
    { href: `/app/${groupId}/overview`, label: "Tổng quan", icon: LayoutDashboard },
    { href: `/app/${groupId}/expenses`, label: "Chi tiêu", icon: ShoppingBag },
    { href: `/app/${groupId}/attendance`, label: "Điểm danh", icon: Calendar },
    { href: `/app/${groupId}/settlement`, label: "Quyết toán", icon: CreditCard },
  ];

  // React Hook Form for Quick Expense
  const todayStr = new Date().toISOString().split("T")[0];
  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      amount: 0,
      note: "",
      shoppingDate: todayStr,
      expenseType: "MEAL",
    },
  });

  const handleLogout = async () => {
    await logoutAction();
    router.push("/login");
    router.refresh();
  };

  const handleQuickAddExpense = (values: ExpenseFormValues) => {
    setError(null);
    startTransition(async () => {
      const payload = {
        groupId,
        payerId: userProfile.id,
        amount: values.amount,
        currency: "VND",
        note: values.note,
        shoppingDate: values.shoppingDate,
        expenseType: values.expenseType,
      };

      if (isOnline) {
        const res = await createExpenseAction(payload);
        if (res.error) {
          if (res.error.includes("khoá") || res.error.includes("LOCKED")) {
            setError("Không thể thêm chi tiêu: Kỳ quyết toán cho ngày này đã bị khóa.");
          } else {
            setError(res.error);
          }
          return;
        }
      } else {
        // Queue it offline
        await enqueueMutation("CREATE_EXPENSE", payload);
      }

      // Success
      setIsDrawerOpen(false);
      reset({
        amount: 0,
        note: "",
        shoppingDate: todayStr,
        expenseType: "MEAL",
      });
      router.refresh();
    });
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-neutral-50 text-neutral-900">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-neutral-200 bg-white p-4 justify-between shrink-0">
        <div className="space-y-6">
          {/* Logo & Group Switcher */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <div className="bg-sky-500 p-1.5 rounded-lg text-white">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-lg tracking-tight">
                Co<span className="text-sky-500">Buy</span>
              </span>
            </div>

            {/* Group Switcher Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full inline-flex items-center justify-between rounded-xl h-10 border border-neutral-200 shadow-sm px-3 text-neutral-800 bg-white hover:bg-neutral-50 cursor-pointer font-bold text-sm">
                <div className="flex items-center gap-2 truncate">
                  <Building className="w-4 h-4 text-neutral-500 shrink-0" />
                  <span className="truncate font-semibold">{groupName}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 rounded-xl shadow-lg border-neutral-100" align="start">
                <DropdownMenuLabel className="text-xs text-neutral-400 font-bold uppercase tracking-wider px-3 py-2">
                  Danh sách nhóm
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {memberships.map((m) => (
                  <DropdownMenuItem
                    key={m.groupId}
                    onClick={() => router.push(`/app/${m.groupId}/overview`)}
                    className={`rounded-lg px-3 py-2 cursor-pointer font-medium ${
                      m.groupId === groupId ? "bg-sky-50 text-sky-600 font-bold" : "hover:bg-neutral-50"
                    }`}
                  >
                    {m.group?.name || "Nhóm"}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push("/app/create-group")}
                  className="rounded-lg px-3 py-2 cursor-pointer text-sky-500 font-bold hover:bg-neutral-50"
                >
                  + Tạo nhóm mới
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Nav Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-neutral-900 text-white shadow-sm"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}

            {/* Admin Links */}
            <DropdownMenuSeparator />
            <Link
              href={`/app/${groupId}/members`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                pathname.startsWith(`/app/${groupId}/members`)
                  ? "bg-sky-50 text-sky-600 font-bold"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
              }`}
            >
              <Users className="w-4 h-4" />
              Thành viên
            </Link>

            {activeRole === "ADMIN" && (
              <Link
                href={`/app/${groupId}/settings`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  pathname.startsWith(`/app/${groupId}/settings`)
                    ? "bg-sky-50 text-sky-600 font-bold"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                }`}
              >
                <Settings className="w-4 h-4" />
                Cài đặt nhóm
              </Link>
            )}
          </nav>
        </div>

        {/* Profile Card & Logout */}
        <div className="border-t border-neutral-100 pt-4 space-y-3">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-sm">
              {userProfile.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="truncate">
              <p className="text-sm font-bold text-neutral-800 truncate">{userProfile.fullName}</p>
              <p className="text-xs text-neutral-400 font-medium capitalize">
                {activeRole === "ADMIN" ? "Quản trị viên" : "Thành viên"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 font-semibold px-2"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Đăng xuất
          </Button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Offline Status Bar */}
        {!isOnline && (
          <div className="bg-yellow-500 text-white text-xs font-bold py-1.5 px-4 text-center sticky top-0 z-50 shadow-sm flex items-center justify-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Bạn đang ngoại tuyến. Dữ liệu thay đổi sẽ tự động đồng bộ khi có mạng trở lại.</span>
          </div>
        )}

        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-neutral-200 sticky top-0 z-40">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 text-neutral-800 focus:outline-none cursor-pointer bg-transparent border-0 font-bold max-w-[150px] text-sm">
              <span className="truncate">{groupName}</span>
              <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 rounded-xl shadow-lg border-neutral-100" align="start">
              <DropdownMenuLabel className="text-xs text-neutral-400 font-bold uppercase tracking-wider px-3 py-2">
                Danh sách nhóm
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {memberships.map((m) => (
                <DropdownMenuItem
                  key={m.groupId}
                  onClick={() => router.push(`/app/${m.groupId}/overview`)}
                  className={`rounded-lg px-3 py-2 cursor-pointer font-medium ${
                    m.groupId === groupId ? "bg-sky-50 text-sky-600 font-bold" : "hover:bg-neutral-50"
                  }`}
                >
                  {m.group?.name || "Nhóm"}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/app/create-group")}
                className="rounded-lg px-3 py-2 cursor-pointer text-sky-500 font-bold hover:bg-neutral-50"
              >
                + Tạo nhóm mới
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-xs focus:outline-none cursor-pointer border-0">
              {userProfile.fullName.charAt(0).toUpperCase()}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 rounded-xl shadow-lg border-neutral-100" align="end">
              <DropdownMenuLabel className="truncate px-3 py-2">
                <div className="font-bold text-neutral-800 text-sm truncate">{userProfile.fullName}</div>
                <div className="text-xs text-neutral-400 capitalize">{activeRole === "ADMIN" ? "Quản trị viên" : "Thành viên"}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push(`/app/${groupId}/members`)}
                className="rounded-lg px-3 py-2 cursor-pointer hover:bg-neutral-50"
              >
                Thành viên
              </DropdownMenuItem>
              {activeRole === "ADMIN" && (
                <DropdownMenuItem
                  onClick={() => router.push(`/app/${groupId}/settings`)}
                  className="rounded-lg px-3 py-2 cursor-pointer hover:bg-neutral-50"
                >
                  Cài đặt nhóm
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="rounded-lg px-3 py-2 cursor-pointer text-red-500 hover:bg-red-50"
              >
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Content Area */}
        <main className="flex-1 pb-24 md:pb-6 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Mobile Floating Action Button (FAB) */}
      <button
        onClick={() => setIsDrawerOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-50 bg-neutral-900 hover:bg-neutral-800 text-white p-4 rounded-full shadow-lg shadow-neutral-400 transition-transform active:scale-95 flex items-center justify-center"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-neutral-200 bg-white flex items-center justify-around px-2 z-40">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 text-[10px] font-bold ${
                isActive ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-500"
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Quick Add Expense Drawer */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="rounded-t-3xl max-w-md mx-auto">
          <form onSubmit={handleSubmit(handleQuickAddExpense)}>
            <DrawerHeader className="pb-2">
              <DrawerTitle className="text-xl font-bold text-center">Thêm Chi Tiêu Nhanh</DrawerTitle>
              <DrawerDescription className="text-center text-xs text-neutral-400">
                Ghi nhận khoản tiền đi chợ vừa thanh toán
              </DrawerDescription>
            </DrawerHeader>

            <div className="p-4 space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3.5 text-sm text-red-600 border border-red-100">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Amount input formatted in VND */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Số tiền chi tiêu</label>
                <Controller
                  name="amount"
                  control={control}
                  render={({ field }) => (
                    <MoneyInput
                      value={field.value}
                      onChange={field.onChange}
                      className="rounded-2xl h-12 text-lg font-bold border-neutral-200 text-neutral-900 focus:border-sky-500 focus:ring-sky-500"
                      placeholder="0 ₫"
                      disabled={isPending}
                    />
                  )}
                />
                {errors.amount && (
                  <span className="text-xs text-red-500 font-semibold px-1">{errors.amount.message}</span>
                )}
              </div>

              {/* Note input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Nội dung chi tiêu</label>
                <Input
                  id="note"
                  placeholder="Ví dụ: Thịt heo + rau cải ngọt + trứng..."
                  disabled={isPending}
                  className="rounded-2xl h-11 border-neutral-200 focus:border-sky-500 focus:ring-sky-500"
                  {...register("note")}
                />
                {errors.note && (
                  <span className="text-xs text-red-500 font-semibold px-1">{errors.note.message}</span>
                )}
              </div>

              {/* Date Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Ngày mua hàng</label>
                <Input
                  id="shoppingDate"
                  type="date"
                  disabled={isPending}
                  className="rounded-2xl h-11 border-neutral-200 focus:border-sky-500 focus:ring-sky-500"
                  {...register("shoppingDate")}
                />
                {errors.shoppingDate && (
                  <span className="text-xs text-red-500 font-semibold px-1">{errors.shoppingDate.message}</span>
                )}
              </div>

              {/* Segmented Control for Expense Type */}
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
            </div>

            <DrawerFooter className="pt-2">
              <Button
                type="submit"
                disabled={isPending}
                className="w-full rounded-2xl h-11 bg-neutral-900 hover:bg-neutral-800 text-white font-bold transition-all shadow-md shadow-neutral-200 flex items-center justify-center gap-2"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Lưu chi tiêu
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDrawerOpen(false)}
                className="rounded-2xl h-11 border-neutral-200"
              >
                Hủy bỏ
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
