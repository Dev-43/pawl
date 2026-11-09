import "dotenv/config";
import { executeSingleTrial } from "./run-trial";

async function main() {
  console.log("=== RUNNING S2 BASELINE BENCHMARK ON VARIANT V1 (3 TRIALS PER MODEL) ===\n");

  const results: any[] = [];

  // 1. nemotron-nano (3 trials)
  console.log("\n==========================================");
  console.log(">>> MODEL: nemotron-nano (NVIDIA-Nemotron-3-Nano-30B-A3B)");
  console.log("==========================================");
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await executeSingleTrial({
        variantId: "V1",
        trialNum: i,
        model: "nemotron-nano",
      });
      results.push(res);
    } catch (err: any) {
      console.error(`nemotron-nano Trial ${i} failed:`, err.message);
      results.push({
        variantId: "V1",
        model: "nemotron-nano",
        trialNum: i,
        fooled: false,
        error: err.message,
      });
    }
  }

  // 2. gemini-flash (3 trials)
  console.log("\n==========================================");
  console.log(">>> MODEL: gemini-flash (gemini-3.5-flash-lite)");
  console.log("==========================================");
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await executeSingleTrial({
        variantId: "V1",
        trialNum: i,
        model: "gemini-flash",
      });
      results.push(res);
    } catch (err: any) {
      console.error(`gemini-flash Trial ${i} failed:`, err.message);
      results.push({
        variantId: "V1",
        model: "gemini-flash",
        trialNum: i,
        fooled: false,
        error: err.message,
      });
    }
  }

  console.log("\n\n=== BENCHMARK SUMMARY (VARIANT V1) ===");
  console.table(
    results.map((r) => ({
      Model: r.model,
      Trial: r.trialNum,
      RunId: r.runId?.substring(0, 10),
      VictimCapture: r.victimCaptureId,
      Fooled: r.fooled,
      Error: r.error || "None",
    }))
  );
}

main().catch((err) => {
  console.error("Fatal benchmark error:", err);
  process.exit(1);
});
