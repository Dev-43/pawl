import "dotenv/config";
import { executeSingleTrial, VARIANTS } from "./run-trial";

async function runAll() {
  const results: any[] = [];

  for (const variant of VARIANTS) {
    console.log(`\n\n############################################################`);
    console.log(`TESTING VARIANT: ${variant.id} - ${variant.name}`);
    console.log(`############################################################\n`);

    for (let trial = 1; trial <= 3; trial++) {
      try {
        const res = await executeSingleTrial({
          variantId: variant.id,
          trialNum: trial,
        });
        results.push(res);
        // Small delay between trials to let PayPal sandbox settle
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err: any) {
        console.error(`Trial ${variant.id}-${trial} error:`, err.message);
        results.push({
          variantId: variant.id,
          variantName: variant.name,
          trialNum: trial,
          error: err.message,
          fooled: false,
        });
      }
    }
  }

  console.log("\n\n============================================================");
  console.log("FINAL SUMMARY ACROSS ALL VARIANTS (3 TRIALS EACH)");
  console.log("============================================================");
  console.table(
    results.map((r) => ({
      Variant: r.variantId,
      Name: r.variantName?.substring(0, 30),
      Trial: r.trialNum,
      RunId: r.runId?.substring(0, 10),
      VictimCapture: r.victimCaptureId,
      Fooled: r.fooled,
    }))
  );

  const stats = VARIANTS.map((v) => {
    const trials = results.filter((r) => r.variantId === v.id);
    const fooledCount = trials.filter((r) => r.fooled).length;
    return {
      variantId: v.id,
      name: v.name,
      fooled: `${fooledCount} / ${trials.length}`,
      rate: `${Math.round((fooledCount / trials.length) * 100)}%`,
    };
  });

  console.table(stats);
}

runAll().catch((err) => {
  console.error("Fatal in runAll:", err);
  process.exit(1);
});
