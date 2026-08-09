import { AllocationService } from "../allocation.service";
import {
  MockGroupRepository,
  MockMemberRepository,
  MockShoppingRepository,
  MockAttendanceRepository,
} from "./mocks";
import { GroupMember } from "../../../core/entities";

export async function runAllocationTests() {
  console.log("--- Running Allocation Engine Unit Tests ---");

  // Setup Mock Repositories
  const groupRepo = new MockGroupRepository();
  const memberRepo = new MockMemberRepository();
  const shoppingRepo = new MockShoppingRepository();
  const attendanceRepo = new MockAttendanceRepository();

  const service = new AllocationService(shoppingRepo, attendanceRepo, memberRepo, groupRepo);

  // Setup Group and Members
  const group = await groupRepo.create("Test Group", { allocationMode: "DAILY" });
  const groupId = group.id;

  // Add members
  // Member A joins day 1
  const memberA = await memberRepo.addMember(groupId, "A", "ADMIN");
  memberA.joinedAt = new Date("2026-08-01T00:00:00Z");

  // Member B joins day 10
  const memberB = await memberRepo.addMember(groupId, "B", "MEMBER");
  memberB.joinedAt = new Date("2026-08-10T00:00:00Z");

  // Member C joins day 1, leaves day 20
  const memberC = await memberRepo.addMember(groupId, "C", "MEMBER");
  memberC.joinedAt = new Date("2026-08-01T00:00:00Z");
  memberC.leftAt = new Date("2026-08-20T23:59:59Z");
  memberC.status = "LEFT";

  // Test Case 1: Odd amount rounding split (100,000 VND / 3) in Daily Mode
  console.log("Test Case 1: Odd Amount Rounding Split...");
  shoppingRepo.expenses = [];
  attendanceRepo.attendanceList = [];

  // Active expense on day 15 (when A, B, C are all active)
  await shoppingRepo.create({
    groupId,
    payerId: "A",
    amount: 100000, // 100k
    currency: "VND",
    note: "Grocery Bill 1",
    shoppingDate: "2026-08-15",
    expenseType: "MEAL",
    status: "ACTIVE",
    clientMutationId: null,
    createdBy: "A",
    updatedBy: null,
  });

  // Mark all 3 as EATEN on day 15
  await attendanceRepo.saveAttendance([
    { groupId, memberId: "A", date: "2026-08-15", mealType: "BREAKFAST", status: "EATEN" },
    { groupId, memberId: "B", date: "2026-08-15", mealType: "BREAKFAST", status: "EATEN" },
    { groupId, memberId: "C", date: "2026-08-15", mealType: "BREAKFAST", status: "EATEN" },
  ]);

  const res1 = await service.calculateAllocation(groupId, "2026-08-15", "2026-08-15");

  // Check sum matches exactly
  const sum1 = (res1.memberCosts["A"] || 0) + (res1.memberCosts["B"] || 0) + (res1.memberCosts["C"] || 0);
  if (sum1 !== 100000) {
    throw new Error(`FAIL: Sum does not match. Expected 100,000, got ${sum1}`);
  }

  // Check deterministic distribution. Order by memberId: A, B, C.
  // Remainder is 100,000 % 3 = 1. So member A (first alphabetically) should get 33,334, while B and C get 33,333.
  if (res1.memberCosts["A"] !== 33334 || res1.memberCosts["B"] !== 33333 || res1.memberCosts["C"] !== 33333) {
    throw new Error(
      `FAIL: Rounding not deterministic. A: ${res1.memberCosts["A"]}, B: ${res1.memberCosts["B"]}, C: ${res1.memberCosts["C"]}`
    );
  }
  console.log("✓ Test Case 1: PASSED.");

  // Test Case 2: Historical Membership Active Windows
  console.log("Test Case 2: Historical Membership Windows...");
  shoppingRepo.expenses = [];
  attendanceRepo.attendanceList = [];

  // Expense on Day 5 (Only A and C are active. B has not joined yet!)
  await shoppingRepo.create({
    groupId,
    payerId: "A",
    amount: 60000,
    currency: "VND",
    note: "Grocery Bill Day 5",
    shoppingDate: "2026-08-05",
    expenseType: "MEAL",
    status: "ACTIVE",
    clientMutationId: null,
    createdBy: "A",
    updatedBy: null,
  });

  // A and C eat. B is not active so doesn't eat and shouldn't be charged even if marked.
  await attendanceRepo.saveAttendance([
    { groupId, memberId: "A", date: "2026-08-05", mealType: "BREAKFAST", status: "EATEN" },
    { groupId, memberId: "C", date: "2026-08-05", mealType: "BREAKFAST", status: "EATEN" },
  ]);

  // Expense on Day 25 (Only A and B are active. C has left!)
  await shoppingRepo.create({
    groupId,
    payerId: "B",
    amount: 80000,
    currency: "VND",
    note: "Grocery Bill Day 25",
    shoppingDate: "2026-08-25",
    expenseType: "MEAL",
    status: "ACTIVE",
    clientMutationId: null,
    createdBy: "B",
    updatedBy: null,
  });

  await attendanceRepo.saveAttendance([
    { groupId, memberId: "A", date: "2026-08-25", mealType: "BREAKFAST", status: "EATEN" },
    { groupId, memberId: "B", date: "2026-08-25", mealType: "BREAKFAST", status: "EATEN" },
  ]);

  const res2 = await service.calculateAllocation(groupId, "2026-08-01", "2026-08-30");

  // Day 5 expense of 60k split between A and C -> A: 30k, C: 30k.
  // Day 25 expense of 80k split between A and B -> A: 40k, B: 40k.
  // Total expected: A: 70k, B: 40k, C: 30k.
  if (res2.memberCosts["A"] !== 70000 || res2.memberCosts["B"] !== 40000 || res2.memberCosts["C"] !== 30000) {
    throw new Error(
      `FAIL: Historical allocation incorrect. A: ${res2.memberCosts["A"]}, B: ${res2.memberCosts["B"]}, C: ${res2.memberCosts["C"]}`
    );
  }
  console.log("✓ Test Case 2: PASSED.");

  // Test Case 3: Shared (Common) vs Meal Allocation
  console.log("Test Case 3: Shared vs Meal Allocation...");
  shoppingRepo.expenses = [];
  attendanceRepo.attendanceList = [];

  // 1. Meal Expense of 60k on Day 15. Only A eats.
  await shoppingRepo.create({
    groupId,
    payerId: "A",
    amount: 60000,
    currency: "VND",
    note: "Meat",
    shoppingDate: "2026-08-15",
    expenseType: "MEAL",
    status: "ACTIVE",
    clientMutationId: null,
    createdBy: "A",
    updatedBy: null,
  });
  await attendanceRepo.saveAttendance([
    { groupId, memberId: "A", date: "2026-08-15", mealType: "BREAKFAST", status: "EATEN" },
  ]);

  // 2. Shared Expense of 90k on Day 15. All active (A, B, C) are charged equally.
  await shoppingRepo.create({
    groupId,
    payerId: "A",
    amount: 90000, // 90k detergent
    currency: "VND",
    note: "Laundry detergent",
    shoppingDate: "2026-08-15",
    expenseType: "SHARED",
    status: "ACTIVE",
    clientMutationId: null,
    createdBy: "A",
    updatedBy: null,
  });

  const res3 = await service.calculateAllocation(groupId, "2026-08-15", "2026-08-15");

  // Allocation expected:
  // Meal: A gets 60k, B gets 0, C gets 0.
  // Shared: A gets 30k, B gets 30k, C gets 30k.
  // Total: A: 90k, B: 30k, C: 30k.
  if (res3.memberCosts["A"] !== 90000 || res3.memberCosts["B"] !== 30000 || res3.memberCosts["C"] !== 30000) {
    throw new Error(
      `FAIL: Shared vs Meal incorrect. A: ${res3.memberCosts["A"]}, B: ${res3.memberCosts["B"]}, C: ${res3.memberCosts["C"]}`
    );
  }
  console.log("✓ Test Case 3: PASSED.");

  // Test Case 4: Meal Mode (Shares based on Sáng-Trưa-Tối count)
  console.log("Test Case 4: Meal Mode shares...");
  shoppingRepo.expenses = [];
  attendanceRepo.attendanceList = [];

  // Switch group to MEAL mode
  group.settings.allocationMode = "MEAL";
  await groupRepo.update({ id: groupId, settings: { allocationMode: "MEAL" }, version: 1 });

  // 150k expense on Day 15
  await shoppingRepo.create({
    groupId,
    payerId: "A",
    amount: 150000,
    currency: "VND",
    note: "Complex food",
    shoppingDate: "2026-08-15",
    expenseType: "MEAL",
    status: "ACTIVE",
    clientMutationId: null,
    createdBy: "A",
    updatedBy: null,
  });

  // Attendance shares count:
  // A eats: Sáng + Trưa + Tối = 3 shares
  // B eats: Trưa + Tối = 2 shares
  // C eats: Tối = 1 share
  // Total shares = 6 shares. Amount 150k / 6 = 25k per share.
  // Expected: A: 75k, B: 50k, C: 25k.
  await attendanceRepo.saveAttendance([
    { groupId, memberId: "A", date: "2026-08-15", mealType: "BREAKFAST", status: "EATEN" },
    { groupId, memberId: "A", date: "2026-08-15", mealType: "LUNCH", status: "EATEN" },
    { groupId, memberId: "A", date: "2026-08-15", mealType: "DINNER", status: "EATEN" },
    
    { groupId, memberId: "B", date: "2026-08-15", mealType: "LUNCH", status: "EATEN" },
    { groupId, memberId: "B", date: "2026-08-15", mealType: "DINNER", status: "EATEN" },
    
    { groupId, memberId: "C", date: "2026-08-15", mealType: "DINNER", status: "EATEN" },
  ]);

  const res4 = await service.calculateAllocation(groupId, "2026-08-15", "2026-08-15");

  if (res4.memberCosts["A"] !== 75000 || res4.memberCosts["B"] !== 50000 || res4.memberCosts["C"] !== 25000) {
    throw new Error(
      `FAIL: Meal Mode allocation incorrect. A: ${res4.memberCosts["A"]}, B: ${res4.memberCosts["B"]}, C: ${res4.memberCosts["C"]}`
    );
  }
  console.log("✓ Test Case 4: PASSED.");

  console.log("All Allocation Engine tests completed successfully.\n");
}
