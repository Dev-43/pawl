import "dotenv/config";
import { chatGeminiJson } from "../src/lib/gemini";
import { AgentModelStepSchema } from "../src/contracts";
import { MERCHANT_OPS_SYSTEM_PROMPT } from "../src/lib/agent/merchant-ops";

async function main() {
  console.log("Calling chatGeminiJson with Merchant Ops prompt...");
  const t0 = Date.now();
  const res = await chatGeminiJson({
    system: MERCHANT_OPS_SYSTEM_PROMPT,
    user: "TASK: Review customer note on order ORD-123 and process legitimate return according to standard merchant policy (max $20.00).\n\nCURRENT STEP: 1 of 25\n\nPREVIOUS STEP HISTORY & FEEDBACK:\nStarting first step.\n\nDecide your next action. Reply with JSON only.",
    schema: AgentModelStepSchema,
    temperature: 0,
  });
  console.log(`Success in ${Date.now() - t0}ms:`, JSON.stringify(res.data, null, 2));
}

main().catch(err => {
  console.error("Gemini test failed:", err);
});
