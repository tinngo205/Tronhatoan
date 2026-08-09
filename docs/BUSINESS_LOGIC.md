# CoBuy Core Business Logic Specifications

CoBuy implements two core business logic engines in TypeScript: the **Cost Allocation Engine** and the **Greedy Settlement Engine**.

---

## 1. Cost Allocation Engine (`AllocationService`)

The allocation engine splits daily shopping expenses among group members based on active membership intervals and meal logs. It processes two expense categories (`expense_type`):

### A. Expense Classifications
1. **`MEAL`**: CoBuy calculates cost per member based on attendance check-ins. If a member is not marked as eating, they are not charged.
2. **`SHARED`**: These are general household items (like washing liquid). The cost is split equally among all members who were active in the group on that day, regardless of their attendance.

### B. Group Settings: Allocation Modes
Admins can select one of two calculations modes:
- **`DAILY` (Daily Mode)**: Checks whether a member checked in for *any* meal during that day. If they did, they get exactly 1 share.
- **`MEAL` (Meal Mode)**: Assigns weight to each meal check-in. Eating Sáng (Breakfast) is 1 share, Trưa (Lunch) is 1 share, and Tối (Dinner) is 1 share. A member who ate all three meals gets 3 shares, whereas a member who only checked in for Dinner gets 1 share.

### C. Deterministic Remainder Distribution
When splitting a grocery bill, division can result in fractional parts of a Vietnamese Dong (VND), which is the smallest physical currency denomination. To prevent losing money (balance leak) and keep the division deterministic:
1. Each member's raw share is rounded down using `Math.floor`.
2. The sum of these rounded values is subtracted from the total invoice amount to compute the remainder $R$ (in VND).
3. The remaining $R$ Dong is distributed 1-by-1 to the first $R$ members in the active list.
4. To make this distribution completely fair and deterministic, the member list is sorted alphabetically by their UUID (`member_id`).

---

## 2. Greedy Settlement Engine (`SettlementService`)

The settlement engine groups daily allocations, sums up personal balances, and calculates optimized debt repayments.

### A. Net Balance Calculation
For a given period, the engine computes:
$$\text{Net Balance} = \text{Total Paid} - \text{Total Allocated Eaten Cost}$$
- **Creditor (Net > 0)**: Paid more than their share. Due to receive money.
- **Debtor (Net < 0)**: Paid less than their share. Needs to pay.
- **Balanced (Net = 0)**: Paid exactly their share.

### B. Greedy Settlement Algorithm
To minimize transaction complexity, the engine runs a Greedy matching algorithm:
1. Divide members into two lists: **Creditors** (sorted descending by positive balance) and **Debtors** (sorted ascending by negative balance).
2. Take the largest Debtor $D$ (most negative) and the largest Creditor $C$ (most positive).
3. Compute the transaction amount $T = \min(|D|, C)$.
4. Create a payment recommendation: $D \to C$ for amount $T$.
5. Update balances: $D \leftarrow D + T$ and $C \leftarrow C - T$.
6. Remove members with a 0 balance from the lists.
7. Repeat steps 2-6 until all balances are settled (sum of balances is mathematically guaranteed to be 0).
