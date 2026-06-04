import { Type } from "@google/genai";

export const getSystemPrompt = (isMultiFile: boolean): string => {
  return isMultiFile 
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
};

export const getResponseSchemaText = (isMultiFile: boolean): string => {
  return isMultiFile 
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
};

export const getActiveResponseSchema = (isMultiFile: boolean): any => {
  return isMultiFile ? {
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
};
