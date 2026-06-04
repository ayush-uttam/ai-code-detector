export interface AnalyzeCodeParams {
  provider: "gemini" | "grok" | "openai";
  modelName: string;
  studentName?: string;
  rollNo?: string;
  files?: Array<{ path: string; content: string }>;
  code?: string;
  filename?: string;
}

export interface ApiKeys {
  geminiKey: string;
  grokKey: string;
  openaiKey: string;
}

export async function analyzeCode(params: AnalyzeCodeParams, keys: ApiKeys) {
  const analyzeRes = await fetch("/api/analyze/code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-gemini-api-key": keys.geminiKey,
      "x-grok-api-key": keys.grokKey,
      "x-openai-api-key": keys.openaiKey,
    },
    body: JSON.stringify(params),
  });

  if (!analyzeRes.ok) {
    const errBody = await analyzeRes.json().catch(() => ({}));
    throw new Error(errBody.error || `Analysis failed: ${analyzeRes.statusText}`);
  }

  return await analyzeRes.json();
}
