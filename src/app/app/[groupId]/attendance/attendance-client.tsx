"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Attendance, GroupMember, MealType, AttendanceStatus } from "@/core/entities";
import { saveAttendanceAction } from "@/app/actions/attendance.actions";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  HelpCircle,
  Check,
  X,
} from "lucide-react";

interface AttendanceClientProps {
  groupId: string;
  initialAttendance: Attendance[];
  members: GroupMember[];
  currentUserId: string;
  currentUserRole: "ADMIN" | "MEMBER";
}

type LocalAttendanceMap = Record<string, Record<string, Record<string, AttendanceStatus | "UNKNOWN">>>;

export function AttendanceClient({
  groupId,
  initialAttendance,
  members,
  currentUserId,
  currentUserRole,
}: AttendanceClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { isOnline, enqueueMutation } = useOfflineSync();

  // Current Calendar state (month/year)
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth()); // 0-11

  // Selected date for Drawer check-in
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  // Local state for attendance maps so edits are instant
  // Date -> MemberId -> MealType -> Status
  const [localAttendance, setLocalAttendance] = useState<LocalAttendanceMap>(() => {
    const map: LocalAttendanceMap = {};
    for (const att of initialAttendance) {
      if (!map[att.date]) map[att.date] = {};
      if (!map[att.date][att.memberId]) map[att.date][att.memberId] = {};
      map[att.date][att.memberId][att.mealType] = att.status;
    }
    return map;
  });

  // Re-sync local state whenever server sends fresh initialAttendance (after router.refresh())
  useEffect(() => {
    const map: LocalAttendanceMap = {};
    for (const att of initialAttendance) {
      if (!map[att.date]) map[att.date] = {};
      if (!map[att.date][att.memberId]) map[att.date][att.memberId] = {};
      map[att.date][att.memberId][att.mealType] = att.status;
    }
    setLocalAttendance(map);
  }, [initialAttendance]);

  // Dynamic date generation for monthly grid
  const daysInMonth = useMemo(() => {
    const start = new Date(currentYear, currentMonth, 1);
    const end = new Date(currentYear, currentMonth + 1, 0);
    const dayList: Date[] = [];
    
    // Fill days
    for (let d = 1; d <= end.getDate(); d++) {
      dayList.push(new Date(currentYear, currentMonth, d));
    }
    return dayList;
  }, [currentYear, currentMonth]);

  // Weekday alignment (starting Monday)
  const paddingDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const dayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon...
    const count = (dayOfWeek + 6) % 7; // Monday = 0 padding, Sunday = 6 padding
    
    const prevMonthEnd = new Date(currentYear, currentMonth, 0).getDate();
    const list: number[] = [];
    for (let i = count - 1; i >= 0; i--) {
      list.push(prevMonthEnd - i);
    }
    return list;
  }, [currentYear, currentMonth]);

  // Calendar navigation
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const setToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  // Convert Date to YYYY-MM-DD
  const getDateStr = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleDayClick = (date: Date) => {
    const dateStr = getDateStr(date);
    setSelectedDateStr(dateStr);
    setDrawerError(null);
    setIsDrawerOpen(true);
  };

  // Check if a member is active on a date
  const isMemberActiveOnDate = (member: GroupMember, dateStr: string): boolean => {
    const joinedStr = member.joinedAt.toISOString().split("T")[0];
    const leftStr = member.leftAt ? member.leftAt.toISOString().split("T")[0] : null;

    if (joinedStr > dateStr) return false;
    if (leftStr !== null && leftStr < dateStr) return false;
    return member.status === "ACTIVE" || member.status === "LEFT";
  };

  const activeMembersForSelectedDate = useMemo(() => {
    if (!selectedDateStr) return [];
    return members.filter((m) => isMemberActiveOnDate(m, selectedDateStr));
  }, [selectedDateStr, members]);

  // Get current meal status helper
  const getMealStatus = (memberId: string, mealType: MealType): AttendanceStatus | "UNKNOWN" => {
    if (!selectedDateStr) return "UNKNOWN";
    return localAttendance[selectedDateStr]?.[memberId]?.[mealType] ?? "UNKNOWN";
  };

  // Cycle meal status: UNKNOWN -> EATEN -> NOT_EATEN -> UNKNOWN
  const cycleMealStatus = (memberId: string, mealType: MealType) => {
    if (!selectedDateStr) return;

    // Authorization check: Members can only edit their own check-ins. Admins can edit everyone's.
    const isEditingSelf = memberId === currentUserId;
    const isAdmin = currentUserRole === "ADMIN";
    if (!isEditingSelf && !isAdmin) {
      setDrawerError("Bạn chỉ được phép tự điểm danh cho bản thân.");
      return;
    }

    setLocalAttendance((prev) => {
      const current = prev[selectedDateStr]?.[memberId]?.[mealType] ?? "UNKNOWN";
      let next: AttendanceStatus | "UNKNOWN";

      if (current === "UNKNOWN") next = "EATEN";
      else if (current === "EATEN") next = "NOT_EATEN";
      else next = "UNKNOWN";

      const updatedDateMap = {
        ...(prev[selectedDateStr] || {}),
        [memberId]: {
          ...(prev[selectedDateStr]?.[memberId] || {}),
          [mealType]: next,
        },
      };

      return {
        ...prev,
        [selectedDateStr]: updatedDateMap,
      };
    });
  };

  // Save changes to database
  const handleSaveAttendance = () => {
    if (!selectedDateStr) return;
    setDrawerError(null);

    // Build lists of EATEN / NOT_EATEN updates to push
    const attendanceUpdates: { memberId: string; date: string; mealType: MealType; status: AttendanceStatus }[] = [];
    const dateMap = localAttendance[selectedDateStr] || {};

    for (const mId in dateMap) {
      for (const meal in dateMap[mId]) {
        const status = dateMap[mId][meal];
        if (status !== "UNKNOWN") {
          attendanceUpdates.push({
            memberId: mId,
            date: selectedDateStr,
            mealType: meal as MealType,
            status: status as AttendanceStatus,
          });
        }
      }
    }

    startTransition(async () => {
      if (isOnline) {
        const res = await saveAttendanceAction(groupId, attendanceUpdates);
        if (res.error) {
          setDrawerError(res.error);
          return;
        }
      } else {
        await enqueueMutation("SAVE_ATTENDANCE", {
          groupId,
          attendanceList: attendanceUpdates,
        });
      }

      setIsDrawerOpen(false);
      router.refresh();
    });
  };

  // Render cell details (number of meals checked on this day)
  const getDayAttendanceCount = (dateStr: string): number => {
    const dayMap = localAttendance[dateStr];
    if (!dayMap) return 0;
    let count = 0;
    for (const mId in dayMap) {
      for (const meal in dayMap[mId]) {
        if (dayMap[mId][meal] === "EATEN") count++;
      }
    }
    return count;
  };

  const monthNames = [
    "Tháng 1",
    "Tháng 2",
    "Tháng 3",
    "Tháng 4",
    "Tháng 5",
    "Tháng 6",
    "Tháng 7",
    "Tháng 8",
    "Tháng 9",
    "Tháng 10",
    "Tháng 11",
    "Tháng 12",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">
          Điểm danh bữa ăn
        </h1>
        <p className="text-sm text-neutral-500 font-medium">
          Điểm danh ăn Sáng, Trưa, Tối hàng ngày để chia chi phí ăn uống công bằng
        </p>
      </div>

      {/* Calendar Card */}
      <Card className="border-neutral-100 shadow-sm rounded-3xl overflow-hidden bg-white">
        {/* Calendar Header Controls */}
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-neutral-100/50">
          <CardTitle className="text-base font-bold text-neutral-700">
            {monthNames[currentMonth]} {currentYear}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={setToday} className="rounded-xl h-8 text-xs font-bold border-neutral-200">
              Hôm nay
            </Button>
            <Button variant="outline" size="icon" onClick={prevMonth} className="rounded-xl w-8 h-8 border-neutral-200">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={nextMonth} className="rounded-xl w-8 h-8 border-neutral-200">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        
        {/* Calendar Grid */}
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2.5">
            <span>T2</span>
            <span>T3</span>
            <span>T4</span>
            <span>T5</span>
            <span>T6</span>
            <span>T7</span>
            <span className="text-red-500">CN</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {/* Render padding from previous month */}
            {paddingDays.map((day, idx) => (
              <div
                key={`padding-${idx}`}
                className="h-14 flex items-center justify-center text-xs text-neutral-300 select-none bg-neutral-50/50 rounded-xl"
              >
                {day}
              </div>
            ))}

            {/* Render current month days */}
            {daysInMonth.map((day) => {
              const dateStr = getDateStr(day);
              const count = getDayAttendanceCount(dateStr);
              const isToday =
                day.getDate() === today.getDate() &&
                day.getMonth() === today.getMonth() &&
                day.getFullYear() === today.getFullYear();

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(day)}
                  className={`h-14 flex flex-col items-center justify-between p-2 rounded-xl transition-all border relative active:scale-95 focus:outline-none ${
                    isToday
                      ? "border-sky-500 bg-sky-50/20 text-sky-600 font-extrabold"
                      : "border-neutral-100 bg-white hover:bg-neutral-50 text-neutral-800"
                  }`}
                >
                  <span className="text-xs font-bold">{day.getDate()}</span>
                  {count > 0 && (
                    <span className="text-[10px] bg-sky-500 text-white font-extrabold px-1.5 py-0.5 rounded-full shrink-0 min-w-[16px] h-[16px] flex items-center justify-center">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Checklist Legend info */}
      <div className="flex items-center justify-between bg-neutral-100 p-4 rounded-2xl text-xs text-neutral-500 font-medium">
        <div className="flex flex-wrap gap-4 justify-center mx-auto">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-[10px]">
              S
            </div>
            <span>✓ Đã ăn</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-[10px]">
              S
            </div>
            <span>✗ Không ăn</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-500 flex items-center justify-center font-bold text-[10px]">
              S
            </div>
            <span>? Chưa báo</span>
          </div>
        </div>
      </div>

      {/* Mobile-Friendly Bottom Sheet Drawer for Attendance check-in */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="rounded-t-3xl max-w-md mx-auto">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-xl font-bold text-center">
              Điểm danh: {selectedDateStr ? formatDateStr(selectedDateStr) : ""}
            </DrawerTitle>
            <DrawerDescription className="text-center text-xs text-neutral-400">
              Nhấp vào nút Sáng (S) - Trưa (T) - Tối (C) để cập nhật trạng thái
            </DrawerDescription>
          </DrawerHeader>

          {drawerError && (
            <div className="mx-4 flex items-center gap-2 rounded-2xl bg-red-50 p-3.5 text-sm text-red-600 border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{drawerError}</span>
            </div>
          )}

          <div className="p-4 overflow-y-auto max-h-80 space-y-4 divide-y divide-neutral-100">
            {activeMembersForSelectedDate.length > 0 ? (
              activeMembersForSelectedDate.map((member) => (
                <div key={member.memberId} className="flex items-center justify-between pt-3 first:pt-0">
                  {/* Member Name */}
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-9 h-9 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-sm shrink-0">
                      {member.profile?.fullName.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-sm text-neutral-800 truncate">
                      {member.profile?.fullName}
                    </span>
                  </div>

                  {/* 3 Buttons (S - T - C) with >= 44px touch targets */}
                  <div className="flex items-center gap-2 shrink-0">
                    {(["BREAKFAST", "LUNCH", "DINNER"] as MealType[]).map((mealType) => {
                      const status = getMealStatus(member.memberId, mealType);
                      const displayLabel = mealType === "BREAKFAST" ? "S" : mealType === "LUNCH" ? "T" : "C";

                      let bgClass = "bg-neutral-100 text-neutral-400 border-neutral-200";
                      let icon = null;

                      if (status === "EATEN") {
                        bgClass = "bg-emerald-50 text-emerald-600 border-emerald-200 font-extrabold";
                        icon = <Check className="w-2.5 h-2.5 absolute bottom-0.5 right-0.5" />;
                      } else if (status === "NOT_EATEN") {
                        bgClass = "bg-red-50 text-red-600 border-red-200 font-extrabold";
                        icon = <X className="w-2.5 h-2.5 absolute bottom-0.5 right-0.5" />;
                      }

                      return (
                        <button
                          key={mealType}
                          type="button"
                          onClick={() => cycleMealStatus(member.memberId, mealType)}
                          className={`w-11 h-11 rounded-full border flex items-center justify-center text-sm font-semibold relative active:scale-95 transition-all select-none ${bgClass}`}
                        >
                          {displayLabel}
                          {icon}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-sm text-neutral-400 font-medium">
                Không tìm thấy thành viên nào hoạt động trong ngày này.
              </div>
            )}
          </div>

          <DrawerFooter className="pt-2">
            <Button
              onClick={handleSaveAttendance}
              disabled={isPending}
              className="w-full rounded-2xl h-11 bg-neutral-900 hover:bg-neutral-800 text-white font-bold transition-all shadow-md shadow-neutral-200 flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Lưu điểm danh
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDrawerOpen(false)}
              className="rounded-2xl h-11 border-neutral-200"
            >
              Đóng
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

// Utility to format date strings for readability (e.g. 2026-08-15 -> Thứ Bảy, 15 tháng 08)
function formatDateStr(dateStr: string): string {
  const d = new Date(dateStr);
  const formatter = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return formatter.format(d);
}
