import { SettlementService } from "../settlement.service";
import { AllocationService } from "../allocation.service";
import {
  MockSettlementRepository,
  MockPaymentRepository,
  MockMemberRepository,
  MockShoppingRepository,
  MockProfileRepository,
  MockAuditLogRepository,
  MockAttendanceRepository,
  MockGroupRepository,
} from "./mocks";

export async function runSettlementTests() {
  console.log("--- Running Settlement Engine Unit Tests ---");

  // Setup Mock Repositories
  const settlementRepo = new MockSettlementRepository();
  const paymentRepo = new MockPaymentRepository();
  const memberRepo = new MockMemberRepository();
  const shoppingRepo = new MockShoppingRepository();
  const profileRepo = new MockProfileRepository();
  const auditRepo = new MockAuditLogRepository();
  const attendanceRepo = new MockAttendanceRepository();
  const groupRepo = new MockGroupRepository();

  const allocationService = new AllocationService(
    shoppingRepo,
    attendanceRepo,
    memberRepo,
    groupRepo
  );

  const service = new SettlementService(
    settlementRepo,
    paymentRepo,
    memberRepo,
    shoppingRepo,
    profileRepo,
    auditRepo,
    allocationService
  );

  const groupId = "group-1";
  await groupRepo.create("Settlement Group", { allocationMode: "DAILY" });

  // Setup members & profiles
  profileRepo.profiles = [
    { id: "A", fullName: "Nguyễn Văn A", createdAt: new Date(), updatedAt: new Date(), version: 1, avatarUrl: null },
    { id: "B", fullName: "Trần Thị B", createdAt: new Date(), updatedAt: new Date(), version: 1, avatarUrl: null },
    { id: "C", fullName: "Lê Văn C", createdAt: new Date(), updatedAt: new Date(), version: 1, avatarUrl: null },
  ];

  const mA = await memberRepo.addMember(groupId, "A", "ADMIN");
  mA.profile = { id: "A", fullName: "Nguyễn Văn A", createdAt: new Date(), updatedAt: new Date(), version: 1, avatarUrl: null };
  
  const mB = await memberRepo.addMember(groupId, "B", "MEMBER");
  mB.profile = { id: "B", fullName: "Trần Thị B", createdAt: new Date(), updatedAt: new Date(), version: 1, avatarUrl: null };

  const mC = await memberRepo.addMember(groupId, "C", "MEMBER");
  mC.profile = { id: "C", fullName: "Lê Văn C", createdAt: new Date(), updatedAt: new Date(), version: 1, avatarUrl: null };

  // Test Case 1: Simple Greedy Settlement for A (+60k), B (-40k), C (-20k)
  console.log("Test Case 1: Simple Greedy Balance Clears...");
  shoppingRepo.expenses = [];
  attendanceRepo.attendanceList = [];

  // A pays 120,000 VND
  await shoppingRepo.create({
    groupId,
    payerId: "A",
    amount: 120000,
    currency: "VND",
    note: "Meal",
    shoppingDate: "2026-08-15",
    expenseType: "MEAL",
    status: "ACTIVE",
    clientMutationId: null,
    createdBy: "A",
    updatedBy: null,
  });

  // Split equally. All eat.
  // Costs: A=40k, B=40k, C=40k.
  // Paid: A=120k, B=0, C=0.
  // Net Balances: A = +80k, B = -40k, C = -40k.
  // Expected recommendations:
  // - B -> A: 40k
  // - C -> A: 40k
  await attendanceRepo.saveAttendance([
    { groupId, memberId: "A", date: "2026-08-15", mealType: "BREAKFAST", status: "EATEN" },
    { groupId, memberId: "B", date: "2026-08-15", mealType: "BREAKFAST", status: "EATEN" },
    { groupId, memberId: "C", date: "2026-08-15", mealType: "BREAKFAST", status: "EATEN" },
  ]);

  const res1 = await service.calculateSettlement(groupId, "2026-08-15", "2026-08-15");

  if (res1.recommendations.length !== 2) {
    throw new Error(`FAIL: Expected 2 transactions, got ${res1.recommendations.length}`);
  }

  const recB = res1.recommendations.find((r) => r.payerId === "B");
  const recC = res1.recommendations.find((r) => r.payerId === "C");

  if (!recB || recB.receiverId !== "A" || recB.amount !== 40000) {
    throw new Error(`FAIL: Recommendation for B incorrect: ${JSON.stringify(recB)}`);
  }
  if (!recC || recC.receiverId !== "A" || recC.amount !== 40000) {
    throw new Error(`FAIL: Recommendation for C incorrect: ${JSON.stringify(recC)}`);
  }
  console.log("✓ Test Case 1: PASSED.");

  // Test Case 2: Complex 3-Way Greedy Settlement
  console.log("Test Case 2: Complex 3-Way Clears...");
  shoppingRepo.expenses = [];
  attendanceRepo.attendanceList = [];

  // A pays 90k
  await shoppingRepo.create({
    groupId,
    payerId: "A",
    amount: 90000,
    currency: "VND",
    note: "Veggie",
    shoppingDate: "2026-08-15",
    expenseType: "MEAL",
    status: "ACTIVE",
    clientMutationId: null,
    createdBy: "A",
    updatedBy: null,
  });

  // B pays 60k
  await shoppingRepo.create({
    groupId,
    payerId: "B",
    amount: 60000,
    currency: "VND",
    note: "Spices",
    shoppingDate: "2026-08-15",
    expenseType: "MEAL",
    status: "ACTIVE",
    clientMutationId: null,
    createdBy: "B",
    updatedBy: null,
  });

  // All eat on day 15. Total expense = 150k. Split is 50k each.
  // Balances check:
  // A paid 90k, ate 50k -> Net = +40k
  // B paid 60k, ate 50k -> Net = +10k
  // C paid 0k, ate 50k -> Net = -50k
  // Expected Greedy transfers:
  // - C -> A: 40k
  // - C -> B: 10k
  await attendanceRepo.saveAttendance([
    { groupId, memberId: "A", date: "2026-08-15", mealType: "BREAKFAST", status: "EATEN" },
    { groupId, memberId: "B", date: "2026-08-15", mealType: "BREAKFAST", status: "EATEN" },
    { groupId, memberId: "C", date: "2026-08-15", mealType: "BREAKFAST", status: "EATEN" },
  ]);

  const res2 = await service.calculateSettlement(groupId, "2026-08-15", "2026-08-15");

  if (res2.recommendations.length !== 2) {
    throw new Error(`FAIL: Expected 2 recommendations, got ${res2.recommendations.length}`);
  }

  const recCtoA = res2.recommendations.find((r) => r.payerId === "C" && r.receiverId === "A");
  const recCtoB = res2.recommendations.find((r) => r.payerId === "C" && r.receiverId === "B");

  if (!recCtoA || recCtoA.amount !== 40000) {
    throw new Error(`FAIL: C->A transfer incorrect: ${JSON.stringify(recCtoA)}`);
  }
  if (!recCtoB || recCtoB.amount !== 10000) {
    throw new Error(`FAIL: C->B transfer incorrect: ${JSON.stringify(recCtoB)}`);
  }
  console.log("✓ Test Case 2: PASSED.");

  console.log("All Settlement Engine tests completed successfully.\n");
}
