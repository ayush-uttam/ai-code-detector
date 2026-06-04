import { Student, Report, ExplanationSignal, CodeFile, CommitInfo } from "../types";

/**
 * Normalizes a string for name comparison (removes spaces, casing, special chars)
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Calculates comment density in code content.
 * Returns ratio of comment lines to total lines (0 to 1).
 */
function calculateCommentDensity(files: CodeFile[]): number {
  let totalLines = 0;
  let commentLines = 0;

  for (const file of files) {
    if (!file.content) continue;
    const lines = file.content.split("\n");
    totalLines += lines.length;

    let inBlockComment = false;
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (inBlockComment) {
        commentLines++;
        if (line.includes("*/") || line.includes('"""') || line.includes("'''")) {
          inBlockComment = false;
        }
        continue;
      }

      if (line.startsWith("/*") || line.startsWith('"""') || line.startsWith("'''")) {
        commentLines++;
        // Check if block comment ends on the same line
        const hasEnd = line.slice(3).includes("*/") || line.slice(3).includes('"""') || line.slice(3).includes("'''");
        if (!hasEnd) {
          inBlockComment = true;
        }
        continue;
      }

      if (line.startsWith("//") || line.startsWith("#") || line.startsWith("*")) {
        commentLines++;
      }
    }
  }

  return totalLines > 0 ? commentLines / totalLines : 0;
}

/**
 * Scans code files for mixed naming conventions (camelCase vs snake_case).
 * Returns naming details: camelCaseCount, snake_caseCount.
 */
function scanNamingConventions(files: CodeFile[]): { camel: number; snake: number } {
  let camel = 0;
  let snake = 0;

  // Simple regexes for variables declarations/assignments
  const camelRegex = /\b[a-z]+[A-Z][a-zA-Z0-9]*\b/g;
  const snakeRegex = /\b[a-z]+_[a-z0-9_]+\b/g;

  for (const file of files) {
    if (!file.content) continue;
    
    // Scan line by line to avoid massive memory issues
    const lines = file.content.split("\n");
    for (const line of lines) {
      // Look at let/const/var/def declarations
      if (line.includes("let ") || line.includes("const ") || line.includes("var ") || line.includes("def ") || line.includes("=")) {
        const camelMatches = line.match(camelRegex);
        if (camelMatches) camel += camelMatches.length;

        const snakeMatches = line.match(snakeRegex);
        if (snakeMatches) snake += snakeMatches.length;
      }
    }
  }

  return { camel, snake };
}

/**
 * Evaluates coding style consistency (mismatched tabs/spaces).
 * Returns true if mixed, false if 100% consistent.
 */
function detectMixedIndentation(files: CodeFile[]): boolean {
  let hasSpaces = false;
  let hasTabs = false;

  for (const file of files) {
    if (!file.content) continue;
    const lines = file.content.split("\n");
    for (const line of lines) {
      if (line.startsWith(" ")) hasSpaces = true;
      if (line.startsWith("\t")) hasTabs = true;
      if (hasSpaces && hasTabs) return true; // Mixed detected
    }
  }

  return false;
}

/**
 * Computes a multi-signal weighted AI probability score.
 */
export function computeComprehensiveScore(student: Student, llmReport: Report): Report {
  const files = student.files || [];
  const commits = student.commits || [];
  const llmScore = llmReport.llmProbabilityScore ?? llmReport.probabilityScore;

  const signals: ExplanationSignal[] = [];

  // 1. LLM Evaluation Signal (Weight: 40%)
  const llmWeight = 0.40;
  signals.push({
    name: "AI Code Forensic Model",
    weight: llmWeight,
    score: llmScore,
    evidence: `LLM deep style inspector concluded a code similarity score of ${llmScore}%.`,
    contribution: Math.round(llmScore * llmWeight),
  });

  // 2. Commit Count & Frequency Signal (Weight: 15%)
  const commitWeight = 0.15;
  let commitScore = 50;
  let commitEvidence = "";

  if (commits.length === 0) {
    commitScore = 85;
    commitEvidence = "No commit history found on GitHub. Submitting entire codebases in a single action is a major indicator of copy-pasted external generation.";
  } else {
    const numCommits = commits.length;
    const numFiles = files.length;
    
    // Check timing intervals
    let rapidCommits = 0;
    const sortedCommits = [...commits].sort((a, b) => 
      new Date(a.authorDate).getTime() - new Date(b.authorDate).getTime()
    );

    for (let i = 1; i < sortedCommits.length; i++) {
      const prevTime = new Date(sortedCommits[i-1].authorDate).getTime();
      const currTime = new Date(sortedCommits[i].authorDate).getTime();
      const diffSeconds = (currTime - prevTime) / 1000;
      if (diffSeconds > 0 && diffSeconds < 60) {
        rapidCommits++;
      }
    }

    if (numCommits <= 2 && numFiles >= 5) {
      commitScore = 75;
      commitEvidence = `Only ${numCommits} commits found for ${numFiles} files. Typical developer progression spans multiple incremental coding sessions.`;
    } else if (rapidCommits > 2) {
      commitScore = 80;
      commitEvidence = `${rapidCommits} commits made in rapid succession (<60s intervals). Suggests scripted updates or copy-pasting completed modules.`;
    } else {
      commitScore = 15;
      commitEvidence = `${numCommits} commits found, distributed normally over typical developer time intervals.`;
    }
  }

  signals.push({
    name: "Commit Frequency & Development Cycles",
    weight: commitWeight,
    score: commitScore,
    evidence: commitEvidence,
    contribution: Math.round(commitScore * commitWeight),
  });

  // 3. Author Consistency Signal (Weight: 10%)
  const authorWeight = 0.10;
  let authorScore = 50;
  let authorEvidence = "";

  if (commits.length === 0) {
    authorScore = 50;
    authorEvidence = "No commit metadata available to analyze author consistency.";
  } else {
    const studentNameNorm = normalizeName(student.name);
    const uniqueAuthors = Array.from(new Set(commits.map(c => c.authorName).filter(Boolean)));
    
    if (uniqueAuthors.length > 2) {
      authorScore = 85;
      authorEvidence = `Multiple distinct commit authors found (${uniqueAuthors.join(", ")}). Suggests code duplication or shared work repository.`;
    } else if (uniqueAuthors.length === 0) {
      authorScore = 50;
      authorEvidence = "No author names found in commit metadata.";
    } else {
      const author = uniqueAuthors[0];
      const authorNorm = normalizeName(author);
      const isMatch = authorNorm.includes(studentNameNorm) || studentNameNorm.includes(authorNorm) || 
                      (student.rollNo && authorNorm.includes(normalizeName(student.rollNo)));

      if (isMatch) {
        authorScore = 15;
        authorEvidence = `All commits consistently authored by matching developer profile '${author}'.`;
      } else {
        authorScore = 75;
        authorEvidence = `All commits authored by '${author}', which does not match candidate student name '${student.name}'.`;
      }
    }
  }

  signals.push({
    name: "Author Profile Alignment",
    weight: authorWeight,
    score: authorScore,
    evidence: authorEvidence,
    contribution: Math.round(authorScore * authorWeight),
  });

  // 4. Comment Density Signal (Weight: 10%)
  const commentWeight = 0.10;
  let commentScore = 50;
  let commentEvidence = "";

  if (files.length === 0) {
    commentScore = 50;
    commentEvidence = "No code files parsed for comment density metrics.";
  } else {
    const density = calculateCommentDensity(files);
    const percentage = (density * 100).toFixed(1);

    if (density > 0.35) {
      commentScore = 75;
      commentEvidence = `Unusually high comment density (${percentage}%). AI models default to verbose, textbook-perfect documentation explaining basic logic.`;
    } else if (density === 0) {
      commentScore = 50;
      commentEvidence = "Zero comments detected across files. Neutral signal indicating lack of documentation.";
    } else if (density >= 0.05 && density <= 0.25) {
      commentScore = 10;
      commentEvidence = `Typical healthy comment density of ${percentage}%. Indicates organic student annotations.`;
    } else {
      commentScore = 30;
      commentEvidence = `Comment density of ${percentage}% is slightly atypical but within human deviation.`;
    }
  }

  signals.push({
    name: "Comment Line Density Ratio",
    weight: commentWeight,
    score: commentScore,
    evidence: commentEvidence,
    contribution: Math.round(commentScore * commentWeight),
  });

  // 5. Coding Style Consistency Signal (Weight: 10%)
  const styleWeight = 0.10;
  let styleScore = 50;
  let styleEvidence = "";

  if (files.length === 0) {
    styleScore = 50;
    styleEvidence = "No files available to audit style consistency.";
  } else {
    const isMixed = detectMixedIndentation(files);
    if (isMixed) {
      styleScore = 10;
      styleEvidence = "Mixed spaces and tabs indentation detected. Mismatched indent styles strongly indicate organic, manual student coding.";
    } else {
      styleScore = 60;
      styleEvidence = "Indentation style is 100% uniform. Indicates machine-formatted or highly polished structure.";
    }
  }

  signals.push({
    name: "Formatting & Indentation Consistency",
    weight: styleWeight,
    score: styleScore,
    evidence: styleEvidence,
    contribution: Math.round(styleScore * styleWeight),
  });

  // 6. Naming Convention Consistency Signal (Weight: 10%)
  const namingWeight = 0.10;
  let namingScore = 50;
  let namingEvidence = "";

  if (files.length === 0) {
    namingScore = 50;
    namingEvidence = "No files available to audit naming convention styles.";
  } else {
    const { camel, snake } = scanNamingConventions(files);
    
    if (camel > 2 && snake > 2) {
      namingScore = 15;
      namingEvidence = `Mixed variable naming styles detected (${camel} camelCase, ${snake} snake_case). Variable mixing is a strong human fingerprint.`;
    } else if (camel > 0 || snake > 0) {
      namingScore = 65;
      namingEvidence = `Naming style is perfectly consistent (${camel > 0 ? "camelCase" : "snake_case"}). Highly typical of AI-generated templates.`;
    } else {
      namingScore = 50;
      namingEvidence = "Insufficient variable declarations detected to verify style consistency.";
    }
  }

  signals.push({
    name: "Variable Naming Style Consistency",
    weight: namingWeight,
    score: namingScore,
    evidence: namingEvidence,
    contribution: Math.round(namingScore * namingWeight),
  });

  // 7. Repository Growth Signal (Weight: 5%)
  const growthWeight = 0.05;
  let growthScore = 50;
  let growthEvidence = "";

  if (commits.length === 0) {
    growthScore = 50;
    growthEvidence = "No commit history metadata to analyze repository growth.";
  } else {
    const largeCommit = commits.find(c => c.additions && c.additions > 1200);
    if (largeCommit) {
      growthScore = 80;
      growthEvidence = `Commit '${largeCommit.sha}' introduced a massive addition of +${largeCommit.additions} lines in a single action (copy-paste signature).`;
    } else {
      growthScore = 15;
      growthEvidence = "Commit history shows gradual, progressive code growth without massive single-action additions.";
    }
  }

  signals.push({
    name: "Codebase Growth Progressive Analysis",
    weight: growthWeight,
    score: growthScore,
    evidence: growthEvidence,
    contribution: Math.round(growthScore * growthWeight),
  });

  // Calculate comprehensive weighted score
  const totalScore = signals.reduce((acc, sig) => acc + sig.contribution, 0);
  const finalProbabilityScore = Math.min(100, Math.max(0, totalScore));

  // Determine Confidence Level
  // High confidence if LLM and heuristics agree (both indicating high AI or both indicating low AI) and commits are present
  // Low confidence if data is extremely sparse (no files and no commits)
  let confidence: "Low" | "Medium" | "High" = "Medium";
  
  const isLlmHigh = llmScore >= 60;
  const isHeuristicHigh = (finalProbabilityScore - (llmScore * llmWeight)) / (1 - llmWeight) >= 60; // Heuristics average

  if (files.length === 0 && commits.length === 0) {
    confidence = "Low";
  } else if (commits.length > 0 && files.length > 0) {
    if (isLlmHigh === isHeuristicHigh) {
      confidence = "High";
    }
  }

  return {
    ...llmReport,
    probabilityScore: finalProbabilityScore,
    confidenceRating: confidence,
    llmProbabilityScore: llmScore,
    scoringSignals: signals,
  };
}
