import { runAllocationTests } from "./allocation.test";
import { runSettlementTests } from "./settlement.test";

async function runAllTests() {
  console.log("=========================================");
  console.log("      RUNNING COBUY APP UNIT TESTS       ");
  console.log("=========================================\n");

  try {
    await runAllocationTests();
    await runSettlementTests();
    
    console.log("=========================================");
    console.log("  🎉 ALL UNIT TESTS PASSED SUCCESSFULLY  ");
    console.log("=========================================");
  } catch (error: any) {
    console.error("\n=========================================");
    console.error("  ❌ TEST RUNNER ENCOUNTERED A FAILURE  ");
    console.error("=========================================");
    console.error(error.stack || error);
    process.exit(1);
  }
}

runAllTests();
