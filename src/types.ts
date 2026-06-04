export interface EvidencePoint {
  type: string;
  explanation: string;
  severity: "High Alert" | "Medium Hint" | "Style Quirk" | "Human Indicator";
  snippet?: string;
}

export interface LineAnnotation {
  startLine: number;
  endLine: number;
  codeBlock?: string;
  isSuspicious: boolean;
  commentary: string;
}

export interface HumanComparison {
  aiCharacteristics: string;
  humanEquivalentStyle: string;
  styleQuirkNotes: string;
}

export interface Report {
  probabilityScore: number;
  confidenceRating: "Low" | "Medium" | "High";
  verdictSummary: string;
  evidencePoints: EvidencePoint[];
  lineAnnotations: LineAnnotation[];
  humanComparison: HumanComparison;
  analyzedAt: string;
}

export interface CodeFile {
  path: string;
  size?: number;
  content: string;
  report?: Report;
}

export interface CommitInfo {
  sha: string;
  message: string;
  authorName: string;
  authorDate: string;
  authorAvatar?: string;
  htmlUrl?: string;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
}

export interface Student {
  id: string; // unique ID
  name: string;
  rollNo: string;
  githubUrl: string;
  status: "pending" | "fetching" | "fetched" | "analyzing" | "analyzed" | "error";
  errorMsg?: string;
  files?: CodeFile[];
  commits?: CommitInfo[];
  activeReport?: Report;
  analyzedFilename?: string;
  modelUsed?: string;
}
