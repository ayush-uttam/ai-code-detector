import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up middleware
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

// 1. Helth check route
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", time: new Date() });
});

// Helper: Parse GitHub URL to get Owner and Repo
// Supports formats:
// - https://github.com/owner/repo
// - https://github.com/owner/repo.git
// - git@github.com:owner/repo.git
function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  if (!url) return null;
  const cleanUrl = url.trim().replace(/\/$/, "");
  
  try {
    // Regex matches common patterns
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
    // a. Fetch default branch of the repository
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

    // b. Fetch the recursive git tree
    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
      { headers }
    );

    if (!treeResponse.ok) {
      throw new Error(`Failed to fetch file tree: ${treeResponse.statusText}`);
    }

    const treeData = await treeResponse.json() as any;
    const items = treeData.tree || [];

    // Filter relevant files (exclude directories, lock files, node_modules, config files)
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

    // Limit to top 10 files to keep analysis fast and fit limits
    // Prioritize key components/files (e.g. src/ or main files)
    eligibleFiles.sort((a, b) => {
      const aLower = a.path.toLowerCase();
      const bLower = b.path.toLowerCase();
      
      // Score file significance
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

    // c. Fetch the commits list (per_page=45)
    let commits: any[] = [];
    try {
      const commitsResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=45`,
        { headers }
      );
      if (commitsResponse.ok) {
        const commitsData = await commitsResponse.json() as any[];
        
        // Fetch detailed stats only for the top 15 commits to preserve API limits
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

    // Fetch contents for each file (limit size)
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
          // Decode base64 content
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

// 3. Analyze Code File matching pattern to detect AI
app.post("/api/analyze/code", async (req: express.Request, res: express.Response) => {
  const { provider = "gemini", code, filename, rollNo, studentName, modelName } = req.body;
  const customApiKey = req.headers["x-gemini-api-key"] as string | undefined;
  const customOpenaiApiKey = req.headers["x-openai-api-key"] as string | undefined;

  console.log("[DIAGNOSTIC] customApiKey received:", customApiKey ? `${customApiKey.substring(0, 6)}... (len: ${customApiKey.length})` : "undefined/empty");
  console.log("[DIAGNOSTIC] customOpenaiApiKey received:", customOpenaiApiKey ? `${customOpenaiApiKey.substring(0, 6)}... (len: ${customOpenaiApiKey.length})` : "undefined/empty");

  if (!code) {
    res.status(400).json({ error: "Missing code block for analysis" });
    return;
  }

  try {
    const systemPrompt = `You are a world-class academic code integrity inspector and forensic software analyst specializing in distinguishing LLM-generated source code from human-crafted student solutions.

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
- Be incredibly strict and critical. Avoid intermediate/average scores (like 40% or 50%) unless the code is genuinely a hybrid mix.
- If there is zero clutter, zero typos, and textbook perfect comments, score the file between 80% and 98% AI Probability.
- Highlight specific suspicious lines in the lineAnnotations list so the instructor can see the exact evidence.`;

    const userMessage = `Please analyze this file:
Filename: ${filename || "Code.ts"}
Student: ${studentName || "Unknown"} (${rollNo || "No Roll"})

CODE TO ANALYZE:
\`\`\`
${code}
\`\`\``;

    if (provider === "openai") {
      const openAiKey = (customOpenaiApiKey && customOpenaiApiKey.trim() !== "") 
        ? customOpenaiApiKey 
        : process.env.OPENAI_API_KEY;

      if (!openAiKey) {
        throw new Error("OpenAI API access key is not configured. Please set the OPENAI_API_KEY variable in your platform environment OR input your personal key via the 'Analysis & Rate Limit Config' panel in the UI.");
      }

      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openAiKey}`
        },
        body: JSON.stringify({
          model: modelName || "gpt-4o-mini",
          response_format: { type: "json_object" },
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: systemPrompt + "\n\nYou MUST return the response strictly as a JSON object matching this schema:\n{\n  \"probabilityScore\": number,\n  \"confidenceRating\": \"Low\" | \"Medium\" | \"High\",\n  \"verdictSummary\": string,\n  \"evidencePoints\": [\n    { \"type\": string, \"explanation\": string, \"severity\": \"High Alert\" | \"Medium Hint\" | \"Style Quirk\" | \"Human Indicator\", \"snippet\": string }\n  ],\n  \"lineAnnotations\": [\n    { \"startLine\": number, \"endLine\": number, \"codeBlock\": string, \"isSuspicious\": boolean, \"commentary\": string }\n  ],\n  \"humanComparison\": {\n    \"aiCharacteristics\": string,\n    \"humanEquivalentStyle\": string,\n    \"styleQuirkNotes\": string\n  }\n}"
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

    // Default to Gemini
    const activeModelName = modelName || "gemini-3.5-flash";
    const ai = getGeminiClient(customApiKey);

    const response = await ai.models.generateContent({
      model: activeModelName,
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
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
        },
      },
    });

    const parsedResponse = JSON.parse(response.text?.trim() || "{}");
    res.json(parsedResponse);

  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    res.status(500).json({ error: error.message || "An error occurred during AI analysis." });
  }
});

// Configure Vite middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Vite dev mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Mounted Vite development middleware");
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static files from", distPath);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Code Detector Server running on http://localhost:${PORT}`);
  });
}

startServer();
