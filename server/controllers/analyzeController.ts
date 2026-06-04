import { Request, Response } from "express";
import { getGeminiClient, resolveModelName } from "../services/aiService.js";
import { rateLimitLlmCall } from "../utils/rateLimit.js";
import { getSystemPrompt, getResponseSchemaText, getActiveResponseSchema } from "../prompts/analysisPrompts.js";

export async function handleCodeAnalyze(req: Request, res: Response): Promise<void> {
  const { provider = "gemini", code, filename, files, rollNo, studentName, modelName } = req.body;
  const customApiKey = req.headers["x-gemini-api-key"] as string | undefined;
  const customGrokApiKey = req.headers["x-grok-api-key"] as string | undefined;
  const customOpenaiApiKey = req.headers["x-openai-api-key"] as string | undefined;

  const activeModel = resolveModelName(provider, modelName);

  console.log("[DIAGNOSTIC] customApiKey received:", customApiKey ? `${customApiKey.substring(0, 6)}... (len: ${customApiKey.length})` : "undefined/empty");
  console.log("[DIAGNOSTIC] customGrokApiKey received:", customGrokApiKey ? `${customGrokApiKey.substring(0, 6)}... (len: ${customGrokApiKey.length})` : "undefined/empty");

  const isMultiFile = Array.isArray(files) && files.length > 0;
  if (!code && !isMultiFile) {
    res.status(400).json({ error: "Missing code or files block for analysis" });
    return;
  }

  try {
    const systemPrompt = getSystemPrompt(isMultiFile);

    let userMessage = "";
    if (isMultiFile) {
      userMessage = `Please analyze the following repository files for student "${studentName || "Unknown"}" (Roll: ${rollNo || "No Roll"}):\n\n`;
      for (const file of files) {
        const numberedContent = (file.content || "")
          .split("\n")
          .map((line: string, idx: number) => `${idx + 1}: ${line}`)
          .join("\n");
        userMessage += `=== FILE: ${file.path} ===\n\`\`\`\n${numberedContent}\n\`\`\`\n\n`;
      }
    } else {
      const numberedCode = (code || "")
        .split("\n")
        .map((line: string, idx: number) => `${idx + 1}: ${line}`)
        .join("\n");
      userMessage = `Please analyze this file:
Filename: ${filename || "Code.ts"}
Student: ${studentName || "Unknown"} (${rollNo || "No Roll"})

CODE TO ANALYZE (WITH LINE NUMBERS):
\`\`\`
${numberedCode}
\`\`\``;
    }

    if (provider === "openai") {
      const openaiApiKey = (customOpenaiApiKey && customOpenaiApiKey.trim() !== "") 
        ? customOpenaiApiKey 
        : process.env.OPENAI_API_KEY;

      if (!openaiApiKey) {
        throw new Error("OpenAI API access key is not configured. Please set the OPENAI_API_KEY variable in your platform environment OR input your personal key via the 'Analysis & Rate Limit Config' panel in the UI.");
      }

      const responseSchemaText = getResponseSchemaText(isMultiFile);
      await rateLimitLlmCall();

      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: activeModel,
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 4096,
          messages: [
            {
              role: "system",
              content: systemPrompt + responseSchemaText
            },
            {
              role: "user",
              content: userMessage
            }
          ]
        })
      });

      if (!openaiResponse.ok) {
        const errBody = await openaiResponse.json().catch(() => ({}));
        const msg = errBody.error?.message || `OpenAI API request failed with status ${openaiResponse.status}`;
        throw new Error(msg);
      }

      const openaiData = await openaiResponse.json() as any;
      const jsonText = openaiData.choices?.[0]?.message?.content;
      if (!jsonText) {
        throw new Error("No response content returned from OpenAI API.");
      }

      const parsedResponse = JSON.parse(jsonText.trim());
      res.json(parsedResponse);
      return;
    }

    if (provider === "grok") {
      const grokApiKey = (customGrokApiKey && customGrokApiKey.trim() !== "") 
        ? customGrokApiKey 
        : process.env.GROK_API_KEY;

      if (!grokApiKey) {
        throw new Error("Grok API access key is not configured. Please set the GROK_API_KEY variable in your platform environment OR input your personal key via the 'Analysis & Rate Limit Config' panel in the UI.");
      }

      const responseSchemaText = getResponseSchemaText(isMultiFile);
      await rateLimitLlmCall();

      const grokResponse = await fetch("https://api.xai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${grokApiKey}`
        },
        body: JSON.stringify({
          model: activeModel,
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 4096,
          messages: [
            {
              role: "system",
              content: systemPrompt + responseSchemaText
            },
            {
              role: "user",
              content: userMessage
            }
          ]
        })
      });

      if (!grokResponse.ok) {
        const errBody = await grokResponse.json().catch(() => ({}));
        const msg = errBody.error?.message || `Grok API request failed with status ${grokResponse.status}`;
        throw new Error(msg);
      }

      const grokData = await grokResponse.json() as any;
      const jsonText = grokData.choices?.[0]?.message?.content;
      if (!jsonText) {
        throw new Error("No response content returned from Grok API.");
      }

      const parsedResponse = JSON.parse(jsonText.trim());
      res.json(parsedResponse);
      return;
    }

    // Default to Gemini
    const ai = getGeminiClient(customApiKey);
    const activeResponseSchema = getActiveResponseSchema(isMultiFile);

    await rateLimitLlmCall();
    const response = await ai.models.generateContent({
      model: activeModel,
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: activeResponseSchema,
        maxOutputTokens: 8192,
      },
    });

    const parsedResponse = JSON.parse(response.text?.trim() || "{}");
    res.json(parsedResponse);

  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    res.status(500).json({ error: error.message || "An error occurred during AI analysis." });
  }
}
