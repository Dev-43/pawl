/**
 * Gemini Flash Target Agent Client (plain HTTPS fetch, zero new packages)
 * Per BUILD.md & Task 4.3
 */

import { z } from "zod";
import { extractJson } from "./json";

export async function chatGeminiJson<T>(params: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  temperature?: number;
}): Promise<{ data: T; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: params.user }],
      },
    ],
    systemInstruction: {
      parts: [{ text: params.system }],
    },
    generationConfig: {
      temperature: params.temperature ?? 0,
      responseMimeType: "application/json",
    },
  };

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const responseText = await res.text();

      if (!res.ok) {
        if (res.status === 503 || res.status === 429) {
          throw new Error(`Gemini API HTTP ${res.status} (transient): ${responseText}`);
        }
        throw new Error(`Gemini API HTTP ${res.status}: ${responseText}`);
      }

      const json = JSON.parse(responseText);
      const rawContent = json.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawContent) {
        throw new Error(`Empty content returned from Gemini: ${responseText}`);
      }

      const extracted = extractJson<unknown>(rawContent);
      const validated = params.schema.parse(extracted);

      return {
        data: validated,
        model,
      };
    } catch (err: any) {
      lastError = err;
      if (attempt < 3 && (err.message?.includes("transient") || err.message?.includes("fetch failed"))) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Failed to call Gemini API");
}
