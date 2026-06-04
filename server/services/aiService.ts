import { GoogleGenAI } from "@google/genai";
import { isValidHttpHeaderValue } from "../utils/validationUtils.js";

export const getGeminiClient = (customApiKey?: string) => {
  const rawApiKey = (customApiKey && customApiKey.trim() !== "") ? customApiKey : process.env.GEMINI_API_KEY;
  const apiKey = typeof rawApiKey === "string" ? rawApiKey.trim() : "";

  if (!apiKey || !isValidHttpHeaderValue(apiKey)) {
    throw new Error("Gemini API access key is not configured or is malformed. Please set the GEMINI_API_KEY variable in your platform environment OR input your personal key via the 'Analysis & Rate Limit Config' panel in the UI (ensure it contains no spaces, newlines, bullets, or placeholder values).");
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

export function resolveModelName(provider: string, modelName?: string): string {
  let activeModel = modelName;
  if (provider === "grok") {
    if (!activeModel || !activeModel.startsWith("grok-")) {
      activeModel = "grok-beta";
    }
  } else if (provider === "openai") {
    if (!activeModel || !activeModel.startsWith("gpt-")) {
      activeModel = "gpt-4o-mini";
    }
  } else {
    if (!activeModel || activeModel.startsWith("grok-") || activeModel.startsWith("gpt-")) {
      activeModel = "gemini-3.5-flash";
    }
  }
  return activeModel || "gemini-3.5-flash";
}
