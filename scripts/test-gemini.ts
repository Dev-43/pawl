import "dotenv/config";

async function test() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Return JSON: {"reply": "hello"}' }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });
  const data = await res.json();
  console.log("FULL DATA:", JSON.stringify(data));
}

test().catch(console.error);
