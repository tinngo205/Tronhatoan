import {
  IShoppingRepository,
  IAttendanceRepository,
  IMemberRepository,
  IGroupRepository,
} from "../../core/repositories/interfaces";
import { GroupMember, ShoppingLog, Attendance, MealType } from "../../core/entities";

export interface DailyAllocationBreakdown {
  date: string;
  totalExpense: number;
  mealExpense: number;
  sharedExpense: number;
  allocations: Record<string, number>; // memberId -> allocated amount (VND)
}

export interface PeriodAllocationResult {
  totalGroupExpense: number;
  memberCosts: Record<string, number>; // memberId -> total cost (VND)
  dailyBreakdowns: DailyAllocationBreakdown[];
}

export class AllocationService {
  constructor(
    private shoppingRepo: IShoppingRepository,
    private attendanceRepo: IAttendanceRepository,
    private memberRepo: IMemberRepository,
    private groupRepo: IGroupRepository
  ) {}

  // Helper to generate a list of date strings (YYYY-MM-DD) between startDate and endDate
  private getDatesInRange(startDateStr: string, endDateStr: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());

    while (current <= end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, "0");
      const day = String(current.getDate()).padStart(2, "0");
      dates.push(`${year}-${month}-${day}`);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  // Helper to check if a membership was active on a specific date (YYYY-MM-DD)
  private isMemberActiveOnDate(member: GroupMember, dateStr: string): boolean {
    const joinedDateStr = member.joinedAt.toISOString().split("T")[0];
    const leftDateStr = member.leftAt ? member.leftAt.toISOString().split("T")[0] : null;

    if (joinedDateStr > dateStr) return false;
    if (leftDateStr !== null && leftDateStr < dateStr) return false;
    return member.status === "ACTIVE" || member.status === "LEFT"; // Include members who have left but were active historically
  }

  async calculateAllocation(
    groupId: string,
    startDateStr: string,
    endDateStr: string
  ): Promise<PeriodAllocationResult> {
    // 1. Fetch group settings to get default allocation mode (DAILY or MEAL)
    const group = await this.groupRepo.getById(groupId);
    if (!group) throw new Error("GROUP_NOT_FOUND");
    const allocationMode = group.settings.allocationMode || "DAILY";

    // 2. Fetch all members (including historic ones)
    const members = await this.memberRepo.getGroupMembers(groupId);

    // 3. Fetch active expenses (status = ACTIVE) in the range
    const expenses = await this.shoppingRepo.getGroupExpenses(groupId, {
      startDate: startDateStr,
      endDate: endDateStr,
    });
    const activeExpenses = expenses.filter((e) => e.status === "ACTIVE");

    // 4. Fetch attendance records in the range
    const attendances = await this.attendanceRepo.getGroupAttendance(
      groupId,
      startDateStr,
      endDateStr
    );

    // 5. Build lookup maps for fast access
    // Map of date -> ShoppingLog[]
    const expensesByDate: Record<string, ShoppingLog[]> = {};
    for (const exp of activeExpenses) {
      if (!expensesByDate[exp.shoppingDate]) {
        expensesByDate[exp.shoppingDate] = [];
      }
      expensesByDate[exp.shoppingDate].push(exp);
    }

    // Map of date -> memberId -> mealType -> "EATEN" | "NOT_EATEN"
    const attendanceMap: Record<string, Record<string, Record<string, string>>> = {};
    for (const att of attendances) {
      if (!attendanceMap[att.date]) {
        attendanceMap[att.date] = {};
      }
      if (!attendanceMap[att.date][att.memberId]) {
        attendanceMap[att.date][att.memberId] = {};
      }
      attendanceMap[att.date][att.memberId][att.mealType] = att.status;
    }

    const dateList = this.getDatesInRange(startDateStr, endDateStr);
    const dailyBreakdowns: DailyAllocationBreakdown[] = [];
    const memberCosts: Record<string, number> = {};

    // Initialize member costs
    for (const m of members) {
      memberCosts[m.memberId] = 0;
    }

    let totalGroupExpense = 0;

    // 6. Process day-by-day
    for (const dStr of dateList) {
      const dayExpenses = expensesByDate[dStr] || [];
      const activeMembersThisDay = members.filter((m) =>
        this.isMemberActiveOnDate(m, dStr)
      );

      const dayMealExpense = dayExpenses
        .filter((e) => e.expenseType === "MEAL")
        .reduce((sum, e) => sum + e.amount, 0);

      const daySharedExpense = dayExpenses
        .filter((e) => e.expenseType === "SHARED")
        .reduce((sum, e) => sum + e.amount, 0);

      const dayTotalExpense = dayMealExpense + daySharedExpense;
      totalGroupExpense += dayTotalExpense;

      const dayAllocations: Record<string, number> = {};
      for (const m of activeMembersThisDay) {
        dayAllocations[m.memberId] = 0;
      }

      // --- SECTION 6A: ALLOCATE SHARED EXPENSES (Split equally among all active members) ---
      if (daySharedExpense > 0 && activeMembersThisDay.length > 0) {
        const numMembers = activeMembersThisDay.length;
        const baseShared = Math.floor(daySharedExpense / numMembers);
        const remainderShared = daySharedExpense - baseShared * numMembers;

        // Distribute base amount
        for (const m of activeMembersThisDay) {
          dayAllocations[m.memberId] += baseShared;
        }

        // Distribute remainder deterministically: sort active members alphabetically by memberId (UUID)
        const sortedActive = [...activeMembersThisDay].sort((a, b) =>
          a.memberId.localeCompare(b.memberId)
        );
        for (let i = 0; i < remainderShared; i++) {
          dayAllocations[sortedActive[i].memberId] += 1;
        }
      }

      // --- SECTION 6B: ALLOCATE MEAL EXPENSES ---
      if (dayMealExpense > 0) {
        if (allocationMode === "DAILY") {
          // DAILY MODE: 1 member eating on day d = 1 share
          const eatingMembers = activeMembersThisDay.filter((m) => {
            const memberAtt = attendanceMap[dStr]?.[m.memberId];
            if (!memberAtt) return false;
            return (
              memberAtt.BREAKFAST === "EATEN" ||
              memberAtt.LUNCH === "EATEN" ||
              memberAtt.DINNER === "EATEN"
            );
          });

          if (eatingMembers.length > 0) {
            const numEating = eatingMembers.length;
            const baseMeal = Math.floor(dayMealExpense / numEating);
            const remainderMeal = dayMealExpense - baseMeal * numEating;

            for (const m of eatingMembers) {
              dayAllocations[m.memberId] += baseMeal;
            }

            // Distribute remainder deterministically
            const sortedEating = [...eatingMembers].sort((a, b) =>
              a.memberId.localeCompare(b.memberId)
            );
            for (let i = 0; i < remainderMeal; i++) {
              dayAllocations[sortedEating[i].memberId] += 1;
            }
          } else {
            // Fallback: split equally among all active members
            if (activeMembersThisDay.length > 0) {
              const numMembers = activeMembersThisDay.length;
              const baseMeal = Math.floor(dayMealExpense / numMembers);
              const remainderMeal = dayMealExpense - baseMeal * numMembers;

              for (const m of activeMembersThisDay) {
                dayAllocations[m.memberId] += baseMeal;
              }

              const sortedActive = [...activeMembersThisDay].sort((a, b) =>
                a.memberId.localeCompare(b.memberId)
              );
              for (let i = 0; i < remainderMeal; i++) {
                dayAllocations[sortedActive[i].memberId] += 1;
              }
            }
          }
        } else {
          // MEAL MODE: Each meal type check-in = 1 share (max 3 shares per person)
          // Compute shares for each active member
          const memberShares: Record<string, number> = {};
          let totalShares = 0;

          for (const m of activeMembersThisDay) {
            const memberAtt = attendanceMap[dStr]?.[m.memberId];
            let shares = 0;
            if (memberAtt) {
              if (memberAtt.BREAKFAST === "EATEN") shares += 1;
              if (memberAtt.LUNCH === "EATEN") shares += 1;
              if (memberAtt.DINNER === "EATEN") shares += 1;
            }
            memberShares[m.memberId] = shares;
            totalShares += shares;
          }

          if (totalShares > 0) {
            const baseMealShare = Math.floor(dayMealExpense / totalShares);
            const remainderMeal = dayMealExpense - baseMealShare * totalShares;

            // Distribute base amount
            for (const m of activeMembersThisDay) {
              dayAllocations[m.memberId] += memberShares[m.memberId] * baseMealShare;
            }

            // Distribute remainder deterministically:
            // Flatten shares into: { memberId, shareIndex }
            // Sort by memberId, then shareIndex to ensure determinism
            const flatShares: { memberId: string; shareIndex: number }[] = [];
            const sortedActive = [...activeMembersThisDay].sort((a, b) =>
              a.memberId.localeCompare(b.memberId)
            );
            
            for (const m of sortedActive) {
              const sharesCount = memberShares[m.memberId];
              for (let sIdx = 0; sIdx < sharesCount; sIdx++) {
                flatShares.push({ memberId: m.memberId, shareIndex: sIdx });
              }
            }

            // Distribute remainder 1 VND per flat share
            for (let i = 0; i < remainderMeal; i++) {
              dayAllocations[flatShares[i].memberId] += 1;
            }
          } else {
            // Fallback: split equally among all active members (1 share per active member)
            if (activeMembersThisDay.length > 0) {
              const numMembers = activeMembersThisDay.length;
              const baseMeal = Math.floor(dayMealExpense / numMembers);
              const remainderMeal = dayMealExpense - baseMeal * numMembers;

              for (const m of activeMembersThisDay) {
                dayAllocations[m.memberId] += baseMeal;
              }

              const sortedActive = [...activeMembersThisDay].sort((a, b) =>
                a.memberId.localeCompare(b.memberId)
              );
              for (let i = 0; i < remainderMeal; i++) {
                dayAllocations[sortedActive[i].memberId] += 1;
              }
            }
          }
        }
      }

      // Add to running totals
      for (const mId in dayAllocations) {
        if (!memberCosts[mId]) {
          memberCosts[mId] = 0;
        }
        memberCosts[mId] += dayAllocations[mId];
      }

      dailyBreakdowns.push({
        date: dStr,
        totalExpense: dayTotalExpense,
        mealExpense: dayMealExpense,
        sharedExpense: daySharedExpense,
        allocations: dayAllocations,
      });
    }

    return {
      totalGroupExpense,
      memberCosts,
      dailyBreakdowns,
    };
  }
}
