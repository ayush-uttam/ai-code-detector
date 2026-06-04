import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(express.json({ limit: "15mb" }));

// Initialize GoogleGenAI client (safe lazy initialization checklist)
const getGeminiClient = (customApiKey?: string) => {
  const apiKey = (customApiKey && customApiKey.trim() !== "") ? customApiKey : process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API access key is not configured. Please set the GEMINI_API_KEY variable in your platform environment OR input your personal key via the 'Analysis & Rate Limit Config' panel in the UI.");
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

// Helper: Parse GitHub URL to get Owner and Repo
function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  if (!url) return null;
  const cleanUrl = url.trim().replace(/\/$/, "");
  
  try {
    const regex = /(?:https?:\/\/github\.com\/|git@github\.com:)([^\/]+)\/([^\/\.]+)(?:\.git)?/i;
    const match = cleanUrl.match(regex);
    if (match && match[1] && match[2]) {
      return { owner: match[1], repo: match[2] };
    }
  } catch (e) {
    console.error("Url parse error:", e);
  }
  return null;
}

// 1. Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", time: new Date() });
});

// 2. Fetch files list and contents from public GitHub repository
app.post("/api/github/fetch-files", async (req: express.Request, res: express.Response) => {
  const { repoUrl, token } = req.body;

  if (!repoUrl) {
    res.status(400).json({ error: "No repository URL provided" });
    return;
  }

  const repoDetails = parseGithubUrl(repoUrl);
  if (!repoDetails) {
    res.status(400).json({ error: "Invalid GitHub repository URL. Expected format: https://github.com/owner/repo" });
    return;
  }

  const { owner, repo } = repoDetails;
  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "AI-Code-Detector-App",
  };

  if (token) {
    headers["Authorization"] = `token ${token}`;
  }

  try {
    const repoInfoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    
    if (!repoInfoResponse.ok) {
      if (repoInfoResponse.status === 403) {
        throw new Error("GitHub API rate limit reached or resource forbidden. Try providing a GitHub Personal Access Token is settings.");
      }
      if (repoInfoResponse.status === 404) {
        throw new Error(`Repository not found: ${owner}/${repo}. Check if the repository is public.`);
      }
      throw new Error(`GitHub API error: ${repoInfoResponse.statusText}`);
    }

    const repoInfo = await repoInfoResponse.json() as any;
    const defaultBranch = repoInfo.default_branch || "main";

    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
      { headers }
    );

    if (!treeResponse.ok) {
      throw new Error(`Failed to fetch file tree: ${treeResponse.statusText}`);
    }

    const treeData = await treeResponse.json() as any;
    const items = treeData.tree || [];

    const activeExtensions = [
      ".js", ".jsx", ".ts", ".tsx", ".py", ".pyw", 
      ".java", ".cpp", ".cc", ".c", ".h", ".cs", 
      ".html", ".css", ".go", ".rb", ".php", ".rs", 
      ".swift", ".kt", ".kts", ".sql", ".sh"
    ];
    
    const ignoredPaths = [
      "node_modules/", "dist/", "build/", ".git/", ".github/", 
      "package-lock.json", "yarn.lock", "pnpm-lock.yaml", 
      "assets/", "vendor/", "env/", "venv/", ".next/", "out/"
    ];

    const eligibleFiles: any[] = items.filter((item: any) => {
      if (item.type !== "blob") return false;
      
      const itemPath = item.path.toLowerCase();
      const hasIgnoredSegment = ignoredPaths.some(ignored => itemPath.includes(ignored));
      if (hasIgnoredSegment) return false;

      const hasValidExtension = activeExtensions.some(ext => itemPath.endsWith(ext));
      return hasValidExtension;
    });

    eligibleFiles.sort((a, b) => {
      const score = (p: string) => {
        let sc = 0;
        if (p.includes("src/")) sc += 10;
        if (p.includes("main") || p.includes("app") || p.includes("index")) sc += 5;
        if (p.endsWith(".json") || p.endsWith(".md") || p.endsWith(".css")) sc -= 5;
        return sc;
      };
      return score(b.path) - score(a.path);
    });

    const fileLimit = 30;
    const selectedFiles = eligibleFiles.slice(0, fileLimit);

    let commits: any[] = [];
    try {
      const commitsResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=45`,
        { headers }
      );
      if (commitsResponse.ok) {
        const commitsData = await commitsResponse.json() as any[];
        
        commits = await Promise.all(
          commitsData.map(async (cmt: any, index: number) => {
            let additions = 0;
            let deletions = 0;
            let changedFiles = 0;

            if (index < 15) {
              try {
                const detailRes = await fetch(
                  `https://api.github.com/repos/${owner}/${repo}/commits/${cmt.sha}`,
                  { headers }
                );
                if (detailRes.ok) {
                  const detailData = await detailRes.json() as any;
                  additions = detailData.stats?.additions || 0;
                  deletions = detailData.stats?.deletions || 0;
                  changedFiles = detailData.files?.length || 0;
                }
              } catch (detailErr) {
                console.error(`Error fetching detail for commit ${cmt.sha}:`, detailErr);
              }
            }

            return {
              sha: cmt.sha ? cmt.sha.substring(0, 7) : "",
              message: cmt.commit?.message || "",
              authorName: cmt.commit?.author?.name || "",
              authorDate: cmt.commit?.author?.date || "",
              authorAvatar: cmt.author?.avatar_url || "",
              htmlUrl: cmt.html_url || "",
              additions: additions || undefined,
              deletions: deletions || undefined,
              changedFiles: changedFiles || undefined
            };
          })
        );
      }
    } catch (err) {
      console.error("Error fetching commits:", err);
    }

    if (selectedFiles.length === 0) {
      res.json({ 
        success: true, 
        owner, 
        repo, 
        branch: defaultBranch, 
        files: [], 
        commits: commits,
        message: "No code files matching typical language extensions were found in this repository." 
      });
      return;
    }

    const filesWithContent = await Promise.all(
      selectedFiles.map(async (file: any) => {
        try {
          const contentRes = await fetch(file.url, { headers });
          if (!contentRes.ok) {
            return {
              path: file.path,
              error: `Could not retrieve file data: ${contentRes.statusText}`
            };
          }
          const contentData = await contentRes.json() as any;
          const decoded = Buffer.from(contentData.content || "", "base64").toString("utf8");
          
          return {
            path: file.path,
            size: file.size,
            content: decoded.length > 50000 ? decoded.substring(0, 50000) + "\n\n// ... [File content truncated for size] ..." : decoded
          };
        } catch (err: any) {
          return {
            path: file.path,
            error: err.message
          };
        }
      })
    );

    res.json({
      success: true,
      owner,
      repo,
      branch: defaultBranch,
      files: filesWithContent.filter((f: any) => !f.error),
      commits: commits
    });

  } catch (error: any) {
    console.error("Fetch GitHub Error:", error);
    res.status(500).json({ error: error.message || "An error occurred while fetching from GitHub API" });
  }
});

let lastLlmCallTime = 0;

async function rateLimitLlmCall() {
  const minSpacing = 4250; // 4.25 seconds spacing to stay strictly under 15 RPM
  const now = Date.now();
  const elapsed = now - lastLlmCallTime;
  if (elapsed < minSpacing) {
    const delayMs = minSpacing - elapsed;
    console.log(`[RATE LIMIT] Delaying next LLM call by ${delayMs}ms to respect the 15 RPM limit.`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  lastLlmCallTime = Date.now();
}

// 3. Analyze Code File matching pattern to detect AI
app.post("/api/analyze/code", async (req: express.Request, res: express.Response) => {
  const { provider = "gemini", code, filename, files, rollNo, studentName, modelName } = req.body;
  const customApiKey = req.headers["x-gemini-api-key"] as string | undefined;
  const customGrokApiKey = req.headers["x-grok-api-key"] as string | undefined;
  const customOpenaiApiKey = req.headers["x-openai-api-key"] as string | undefined;

  // Resolve model name dynamically based on provider to prevent mismatches
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

  console.log("[DIAGNOSTIC] customApiKey received:", customApiKey ? `${customApiKey.substring(0, 6)}... (len: ${customApiKey.length})` : "undefined/empty");
  console.log("[DIAGNOSTIC] customGrokApiKey received:", customGrokApiKey ? `${customGrokApiKey.substring(0, 6)}... (len: ${customGrokApiKey.length})` : "undefined/empty");

  const isMultiFile = Array.isArray(files) && files.length > 0;
  if (!code && !isMultiFile) {
    res.status(400).json({ error: "Missing code or files block for analysis" });
    return;
  }



  try {
    const systemPrompt = isMultiFile 
      ? `You are a world-class academic code integrity inspector and forensic software analyst specializing in distinguishing LLM-generated source code from human-crafted student solutions.

Your objective is to thoroughly verify the submitted repository files and generate a precision detection report. Student code is frequently generated using ChatGPT, Gemini, or Claude. You must be highly sensitive to typical AI code generation traits and perform a critical, rigorous analysis of EVERY file. 

For each individual file in 'fileBreakdowns', assign a score (0 to 100) and highlight AI vs human traits. You must evaluate each file completely independently based on its own contents. Do not let the presence of AI templates or patterns in one file bias the scores of other files in the repository. Each file's score must be derived solely from its own stylistic cues and characteristics.
Use these balanced grading guidelines for each file breakdown:
- Strict Rigorous Grading: Be highly critical. If the code exhibits a textbook-perfect structure, uses standard tutorial templates, or contains detailed inline documentation describing obvious logic, default to a high AI probability score (>=60%). Students heavily rely on AI for assignments; a complete lack of human programming errors, spelling typos in comments, or formatting discrepancies is in itself an indicator of AI assistance.
- Hybrid Mix & Copied Templates: If the code displays a mixture of human quirks (sloppy spacing, slang comments) and machine-like algorithmic blocks (such as Brian Kernighan's bit count, optimized sorting, or perfect helper routines), evaluate this strictly as an AI-assisted hybrid (50% to 80% AI Probability).
- Moderate Baseline for Doubt: If the code is clean, has reasonable comments, and lacks explicit AI placeholders, but its algorithmic density is unusually perfect for an academic student, assign a moderate-to-high score (40% to 60% AI Probability). Only score as low risk (0-25%) if you find clear, active human fingerprints throughout the entire codebase.

Also compute an overall repository AI usage probability score and a global verdict summary. The overall repository score should reflect the aggregate probability across all files proportionately (e.g. if only a small/insignificant file is AI-generated and the rest is human, the repository score should not be artificially inflated to a high overall value).

CRITICAL DUAL-CORE FINGERPRINT REQUIREMENT (HYBRID MIX DETECTION):
Many student repositories are hybrid files - meaning a mixture of both human modifications and machine-generated template boilerplates. You MUST examine the source code for BOTH categories of characteristics and output BOTH in the same report. For example:
- If a portion has polished AI formatting but another has sloppy spacing, tab irregularities, spelling typos, or slang comments, tag BOTH.
- You must NOT provide a one-sided commentary. If BOTH human and AI styles coexist, you MUST list lineAnnotations for BOTH: provide isSuspicious = true annotations for AI templates, AND isSuspicious = false annotations for the human traits. This gives the educator a highly precise side-by-side diagnostic walkthrough of where style boundaries shift.

CRITICAL SEARCH MARKERS:

1. THE "OVER-EXPLAINED COMMENTS" SIGNATURE (High Indicator of AI - 80%+ probability value):
   - AI writes polite, grammatically perfect, and detailed inline comments. It explains obvious operations (e.g., "// Loop through the list", "// Initialize database", "// Check if response is empty").
   - AI structures textbook-perfect docstrings (e.g., JSDoc, JavaDoc, Sphinx) with exhaustive lists of types, @param, and @returns declarations.
   - Student comments are typically sparse, slang-heavy, incomplete, poorly formatted, or entirely absent.

2. ACADEMIC AND STRUCTURAL PERFECTION (High Indicator of AI - 85%+ probability value):
   - Flawless, highly optimized algorithmic designs (e.g., complex binary trees, recursion, array maps/reducers) written on the first try with absolutely zero typos and optimal performance characteristics.
   - Exhaustive, perfect try-catch-finally wrapping with high-fidelity logging (e.g., complete logging sentences as opposed to a simple "catch (e) { console.log(e); }").
   - Students rarely write full enterprise-ready error wrapping, data validations, and modular exception catchers for basic assignments.

3. "CLEAN-ROOM" DESIGN AND ALIGNMENT (Medium-High Indicator of AI):
   - Uniform variable formatting, micro-aligned indentation spacing, and perfectly ordered imports (sometimes alphabetical).
   - Perfect spacing blocks separating logical operations (such as initial checks, computations, and exact return statements).
   - Real student code is usually messier, has mixed tabs/spaces, slightly inconsistent formatting, or left-over dead variables.

4. LLM-SPECIFIC VARIABLE NAMING AND TUTORIAL BOILERPLATES:
   - Descriptive variable naming schemes (e.g., "processedStudentRegistrationList" vs a student's "students" or "list").
   - Presence of polite placeholders or formatted "TODO" marks capitalized like a title (e.g., "// TODO: Implement proper exception mapping").

IMPORTANT RESPONSE COMPLETENESS & COMPACTNESS RULES:
1. You MUST include exactly one entry in the 'fileBreakdowns' array for EVERY SINGLE file provided in the prompt. Do not skip or omit any files.
2. To keep the response under the token generation limits and ensure no files are left out:
   - For every file (regardless of probability score), you MUST provide 1 to 3 key annotations in 'lineAnnotations' (highlighting either the key human handwriting markers or suspected AI template clues). Do not leave 'lineAnnotations' empty for any file.
   - For files with low AI probability (probabilityScore < 30%), provide a brief 1-sentence 'verdictSummary' and list 1 to 3 human handwriting markers/quirks in 'lineAnnotations'. Keep 'evidencePoints' relatively short (1-2 points).
   - For suspicious files (probabilityScore >= 30%), provide the full detailed breakdown including 2 to 4 'lineAnnotations', 'evidencePoints', and 'humanComparison'.

CRITICAL LINE NUMBERING INSTRUCTION:
Each line in the source code files is prefixed with its 1-based line number (e.g. "12: const value = 42;"). When generating "lineAnnotations", you MUST use these exact line numbers for "startLine" and "endLine".
- Do NOT point annotations to completely blank lines or lines containing only closing braces/parentheses/whitespace. Ensure that the selected startLine and endLine correspond to actual, meaningful code blocks or inline comments.
- In the "codeBlock" property of the annotation, return the clean code content WITHOUT the line number prefixes.`
      : `You are a world-class academic code integrity inspector and forensic software analyst specializing in distinguishing LLM-generated source code from human-crafted student solutions.

Your objective is to thoroughly verify the submitted source code and generate a precision detection report. Student code is frequently generated using ChatGPT, Gemini, or Claude. You must be highly sensitive to typical AI code generation traits and perform a critical, rigorous analysis. If the code exhibits high-probability AI hallmarks, assign a matching high score (e.g., 75% to 98%). Do not artificially lower the score unless you find distinct, genuine human indicators (like minor logical messiness, uneven indentations, unfinished features, slang-heavy/sparse comments, or non-algorithmic logic).

CRITICAL DUAL-CORE FINGERPRINT REQUIREMENT (HYBRID MIX DETECTION):
Many student repositories are hybrid files - meaning a mixture of both human modifications and machine-generated template boilerplates. You MUST examine the source code for BOTH categories of characteristics and output BOTH in the same report. For example:
- If a portion has polished AI formatting but another has sloppy spacing, tab irregularities, spelling typos, or slang comments, tag BOTH.
- You must NOT provide a one-sided commentary. If BOTH human and AI styles coexist, you MUST list lineAnnotations for BOTH: provide isSuspicious = true annotations for AI templates, AND isSuspicious = false annotations for the human traits. This gives the educator a highly precise side-by-side diagnostic walkthrough of where style boundaries shift.

CRITICAL SEARCH MARKERS:

1. THE "OVER-EXPLAINED COMMENTS" SIGNATURE (High Indicator of AI - 80%+ probability value):
   - AI writes polite, grammatically perfect, and detailed inline comments. It explains obvious operations (e.g., "// Loop through the list", "// Initialize database", "// Check if response is empty").
   - AI structures textbook-perfect docstrings (e.g., JSDoc, JavaDoc, Sphinx) with exhaustive lists of types, @param, and @returns declarations.
   - Student comments are typically sparse, slang-heavy, incomplete, poorly formatted, or entirely absent.

2. ACADEMIC AND STRUCTURAL PERFECTION (High Indicator of AI - 85%+ probability value):
   - Flawless, highly optimized algorithmic designs (e.g., complex binary trees, recursion, array maps/reducers) written on the first try with absolutely zero typos and optimal performance characteristics.
   - Exhaustive, perfect try-catch-finally wrapping with high-fidelity logging (e.g., complete logging sentences as opposed to a simple "catch (e) { console.log(e); }").
   - Students rarely write full enterprise-ready error wrapping, data validations, and modular exception catchers for basic assignments.

3. "CLEAN-ROOM" DESIGN AND ALIGNMENT (Medium-High Indicator of AI):
   - Uniform variable formatting, micro-aligned indentation spacing, and perfectly ordered imports (sometimes alphabetical).
   - Perfect spacing blocks separating logical operations (such as initial checks, computations, and exact return statements).
   - Real student code is usually messier, has mixed tabs/spaces, slightly inconsistent formatting, or left-over dead variables.

4. LLM-SPECIFIC VARIABLE NAMING AND TUTORIAL BOILERPLATES:
   - Descriptive variable naming schemes (e.g., "processedStudentRegistrationList" vs a student's "students" or "list").
   - Presence of polite placeholders or formatted "TODO" marks capitalized like a title (e.g., "// TODO: Implement proper exception mapping").

GRADING METRIC INSTRUCTIONS:
- Strict Rigorous Grading: Be highly critical. If the code exhibits a textbook-perfect structure, uses standard tutorial templates, or contains detailed inline documentation describing obvious logic, default to a high AI probability score (>=60%). Students heavily rely on AI for assignments; a complete lack of human programming errors, spelling typos in comments, or formatting discrepancies is in itself an indicator of AI assistance.
- Hybrid Mix & Copied Templates: If the code displays a mixture of human quirks (sloppy spacing, slang comments) and machine-like algorithmic blocks (such as Brian Kernighan's bit count, optimized sorting, or perfect helper routines), evaluate this strictly as an AI-assisted hybrid (50% to 80% AI Probability).
- Moderate Baseline for Doubt: If the code is clean, has reasonable comments, and lacks explicit AI placeholders, but its algorithmic density is unusually perfect for an academic student, assign a moderate-to-high score (40% to 60% AI Probability). Only score as low risk (0-25%) if you find clear, active human fingerprints throughout the entire codebase.
- Highlight specific suspicious lines in the lineAnnotations list so the instructor can see the exact evidence.

CRITICAL LINE NUMBERING INSTRUCTION:
Each line in the source code files is prefixed with its 1-based line number (e.g. "12: const value = 42;"). When generating "lineAnnotations", you MUST use these exact line numbers for "startLine" and "endLine".
- Do NOT point annotations to completely blank lines or lines containing only closing braces/parentheses/whitespace. Ensure that the selected startLine and endLine correspond to actual, meaningful code blocks or inline comments.
- In the "codeBlock" property of the annotation, return the clean code content WITHOUT the line number prefixes.`;

    let userMessage = "";
    if (isMultiFile) {
      userMessage = `Please analyze the following repository files for student "${studentName || "Unknown"}" (Roll: ${rollNo || "No Roll"}):

`;
      for (const file of files) {
        const numberedContent = (file.content || "")
          .split("\n")
          .map((line, idx) => `${idx + 1}: ${line}`)
          .join("\n");
        userMessage += `=== FILE: ${file.path} ===\n\`\`\`\n${numberedContent}\n\`\`\`\n\n`;
      }
    } else {
      const numberedCode = (code || "")
        .split("\n")
        .map((line, idx) => `${idx + 1}: ${line}`)
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

      const responseSchemaText = isMultiFile 
        ? `\n\nYou MUST return the response strictly as a JSON object matching this schema:
{
  "probabilityScore": number,
  "confidenceRating": "Low" | "Medium" | "High",
  "verdictSummary": string,
  "evidencePoints": [
    { "type": string, "explanation": string, "severity": "High Alert" | "Medium Hint" | "Style Quirk" | "Human Indicator", "snippet": string, "filePath": string }
  ],
  "humanComparison": {
    "aiCharacteristics": string,
    "humanEquivalentStyle": string,
    "styleQuirkNotes": string
  },
  "fileBreakdowns": [
    {
      "filePath": string,
      "probabilityScore": number,
      "confidenceRating": "Low" | "Medium" | "High",
      "verdictSummary": string,
      "evidencePoints": [
        { "type": string, "explanation": string, "severity": "High Alert" | "Medium Hint" | "Style Quirk" | "Human Indicator", "snippet": string }
      ],
      "lineAnnotations": [
        { "startLine": number, "endLine": number, "codeBlock": string, "isSuspicious": boolean, "commentary": string }
      ],
      "humanComparison": {
        "aiCharacteristics": string,
        "humanEquivalentStyle": string,
        "styleQuirkNotes": string
      }
    }
  ]
}`
        : `\n\nYou MUST return the response strictly as a JSON object matching this schema:
{
  "probabilityScore": number,
  "confidenceRating": "Low" | "Medium" | "High",
  "verdictSummary": string,
  "evidencePoints": [
    { "type": string, "explanation": string, "severity": "High Alert" | "Medium Hint" | "Style Quirk" | "Human Indicator", "snippet": string }
  ],
  "lineAnnotations": [
    { "startLine": number, "endLine": number, "codeBlock": string, "isSuspicious": boolean, "commentary": string }
  ],
  "humanComparison": {
    "aiCharacteristics": string,
    "humanEquivalentStyle": string,
    "styleQuirkNotes": string
  }
}`;

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

      const responseSchemaText = isMultiFile 
        ? `\n\nYou MUST return the response strictly as a JSON object matching this schema:
{
  "probabilityScore": number,
  "confidenceRating": "Low" | "Medium" | "High",
  "verdictSummary": string,
  "evidencePoints": [
    { "type": string, "explanation": string, "severity": "High Alert" | "Medium Hint" | "Style Quirk" | "Human Indicator", "snippet": string, "filePath": string }
  ],
  "humanComparison": {
    "aiCharacteristics": string,
    "humanEquivalentStyle": string,
    "styleQuirkNotes": string
  },
  "fileBreakdowns": [
    {
      "filePath": string,
      "probabilityScore": number,
      "confidenceRating": "Low" | "Medium" | "High",
      "verdictSummary": string,
      "evidencePoints": [
        { "type": string, "explanation": string, "severity": "High Alert" | "Medium Hint" | "Style Quirk" | "Human Indicator", "snippet": string }
      ],
      "lineAnnotations": [
        { "startLine": number, "endLine": number, "codeBlock": string, "isSuspicious": boolean, "commentary": string }
      ],
      "humanComparison": {
        "aiCharacteristics": string,
        "humanEquivalentStyle": string,
        "styleQuirkNotes": string
      }
    }
  ]
}`
        : `\n\nYou MUST return the response strictly as a JSON object matching this schema:
{
  "probabilityScore": number,
  "confidenceRating": "Low" | "Medium" | "High",
  "verdictSummary": string,
  "evidencePoints": [
    { "type": string, "explanation": string, "severity": "High Alert" | "Medium Hint" | "Style Quirk" | "Human Indicator", "snippet": string }
  ],
  "lineAnnotations": [
    { "startLine": number, "endLine": number, "codeBlock": string, "isSuspicious": boolean, "commentary": string }
  ],
  "humanComparison": {
    "aiCharacteristics": string,
    "humanEquivalentStyle": string,
    "styleQuirkNotes": string
  }
}`;

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

    const activeModelName = activeModel;
    const ai = getGeminiClient(customApiKey);

    const activeResponseSchema = isMultiFile ? {
      type: Type.OBJECT,
      properties: {
        probabilityScore: {
          type: Type.INTEGER,
          description: "AI usage probability score for the overall repository from 0 to 100"
        },
        confidenceRating: {
          type: Type.STRING,
          description: "Overall confidence rating: Low, Medium, or High"
        },
        verdictSummary: {
          type: Type.STRING,
          description: "A solid overall verdict explaining the repository status (2-3 sentences)."
        },
        evidencePoints: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              explanation: { type: Type.STRING },
              severity: { type: Type.STRING },
              snippet: { type: Type.STRING },
              filePath: { type: Type.STRING, description: "The path of the file this evidence relates to" }
            },
            required: ["type", "explanation", "severity", "filePath"]
          }
        },
        humanComparison: {
          type: Type.OBJECT,
          properties: {
            aiCharacteristics: { type: Type.STRING },
            humanEquivalentStyle: { type: Type.STRING },
            styleQuirkNotes: { type: Type.STRING }
          },
          required: ["aiCharacteristics", "humanEquivalentStyle", "styleQuirkNotes"]
        },
        fileBreakdowns: {
          type: Type.ARRAY,
          description: "Detailed analysis for each code file in the repository.",
          items: {
            type: Type.OBJECT,
            properties: {
              filePath: { type: Type.STRING, description: "The exact path of the file" },
              probabilityScore: { type: Type.INTEGER },
              confidenceRating: { type: Type.STRING },
              verdictSummary: { type: Type.STRING },
              evidencePoints: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                    severity: { type: Type.STRING },
                    snippet: { type: Type.STRING }
                  },
                  required: ["type", "explanation", "severity"]
                }
              },
              lineAnnotations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    startLine: { type: Type.INTEGER },
                    endLine: { type: Type.INTEGER },
                    codeBlock: { type: Type.STRING },
                    isSuspicious: { type: Type.BOOLEAN },
                    commentary: { type: Type.STRING }
                  },
                  required: ["startLine", "endLine", "isSuspicious", "commentary"]
                }
              },
              humanComparison: {
                type: Type.OBJECT,
                properties: {
                  aiCharacteristics: { type: Type.STRING },
                  humanEquivalentStyle: { type: Type.STRING },
                  styleQuirkNotes: { type: Type.STRING }
                },
                required: ["aiCharacteristics", "humanEquivalentStyle", "styleQuirkNotes"]
              }
            },
            required: [
              "filePath",
              "probabilityScore",
              "confidenceRating",
              "verdictSummary",
              "evidencePoints",
              "lineAnnotations",
              "humanComparison"
            ]
          }
        }
      },
      required: [
        "probabilityScore",
        "confidenceRating",
        "verdictSummary",
        "evidencePoints",
        "humanComparison",
        "fileBreakdowns"
      ]
    } : {
      type: Type.OBJECT,
      properties: {
        probabilityScore: {
          type: Type.INTEGER,
          description: "AI usage probability score from 0 (100% human) to 100 (100% AI)"
        },
        confidenceRating: {
          type: Type.STRING,
          description: "Low, Medium, or High"
        },
        verdictSummary: {
          type: Type.STRING,
          description: "A solid summary explaining the verdict clearly (2-3 sentences)."
        },
        evidencePoints: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                description: "Category of evidence (e.g., 'Stylistic Clues', 'Comment Patterns', 'Template Identifiers', 'Perfect Logic', 'Over-complication', 'Human Quirks')"
              },
              explanation: {
                type: Type.STRING,
                description: "Detailed breakdown of why this segment points to human or AI."
              },
              severity: {
                type: Type.STRING,
                description: "Assessment impact, e.g., 'High Alert', 'Medium Hint', 'Style Quirk', 'Human Indicator'"
              },
              snippet: {
                type: Type.STRING,
                description: "The specific line or snippet of code demonstrating this."
              }
            },
            required: ["type", "explanation", "severity"]
          }
        },
        lineAnnotations: {
          type: Type.ARRAY,
          description: "Segments of code demonstrating clear AI or human styling traits.",
          items: {
            type: Type.OBJECT,
            properties: {
              startLine: { type: Type.INTEGER },
              endLine: { type: Type.INTEGER },
              codeBlock: { type: Type.STRING },
              isSuspicious: { type: Type.BOOLEAN },
              commentary: { type: Type.STRING }
            },
            required: ["startLine", "endLine", "isSuspicious", "commentary"]
          }
        },
        humanComparison: {
          type: Type.OBJECT,
          properties: {
            aiCharacteristics: { type: Type.STRING },
            humanEquivalentStyle: { type: Type.STRING },
            styleQuirkNotes: { type: Type.STRING }
          },
          required: ["aiCharacteristics", "humanEquivalentStyle", "styleQuirkNotes"]
        }
      },
      required: [
        "probabilityScore", 
        "confidenceRating", 
        "verdictSummary", 
        "evidencePoints", 
        "lineAnnotations", 
        "humanComparison"
      ]
    };

    await rateLimitLlmCall();
    const response = await ai.models.generateContent({
      model: activeModelName,
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
});

export default app;
