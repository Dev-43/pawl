import "dotenv/config";

const modelsToTest = [
  "gemini-3.5-flash",
  "gemini-3.7-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash"
];

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  for (const m of modelsToTest) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Return valid JSON: {\"reply\": \"hello\"}" }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`MODEL ${m} SUCCESS:`, data.candidates?.[0]?.content?.parts?.[0]?.text);
      } else {
        console.log(`MODEL ${m} FAILED (${res.status}):`, data.error?.message);
      }
    } catch (e: any) {
      console.log(`MODEL ${m} ERR:`, e.message);
    }
  }
}

main().catch(console.error);
