import "dotenv/config";
import { executeSingleTrial } from "./run-trial";

async function rerunAborted() {
  console.log("=== RE-RUNNING ABORTED TRIALS (V2-2, V2-3, V3-1, V3-2) WITH DIRECT_URL AND RETRY ===");
  const results: any[] = [];

  // V2 Trial 2 & 3
  for (const trialNum of [2, 3]) {
    try {
      const res = await executeSingleTrial({ variantId: "V2", trialNum, model: "nemotron-super" });
      results.push(res);
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err: any) {
      console.error(`V2-${trialNum} failed again:`, err.message);
      results.push({ variantId: "V2", trialNum, error: err.message, fooled: false });
    }
  }

  // V3 Trial 1 & 2
  for (const trialNum of [1, 2]) {
    try {
      const res = await executeSingleTrial({ variantId: "V3", trialNum, model: "nemotron-super" });
      results.push(res);
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err: any) {
      console.error(`V3-${trialNum} failed again:`, err.message);
      results.push({ variantId: "V3", trialNum, error: err.message, fooled: false });
    }
  }

  console.log("\n=== RE-RUN RESULTS ===");
  console.table(results.map(r => ({
    Variant: r.variantId,
    Trial: r.trialNum,
    RunId: r.runId?.slice(0, 10),
    VictimCapture: r.victimCaptureId,
    Fooled: r.fooled,
    Error: r.error || "None"
  })));
}

rerunAborted().catch(console.error);
