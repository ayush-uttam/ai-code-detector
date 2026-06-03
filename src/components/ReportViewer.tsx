import React from "react";
import { Report, Student } from "../types";
import { 
  ShieldAlert, 
  HelpCircle, 
  AlertCircle, 
  CheckCircle2, 
  Flag, 
  Code, 
  Sliders, 
  ClipboardCheck, 
  Clock, 
  FileCheck,
  GitCommit,
  History,
  ExternalLink,
  FileSpreadsheet,
  Printer
} from "lucide-react";
import { exportStudentToXLSX } from "../utils/exportUtils";

interface ReportViewerProps {
  student: Student;
  report: Report;
  onPrint?: () => void;
}

export default function ReportViewer({ student, report, onPrint }: ReportViewerProps) {
  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-rose-600 bg-rose-50 border-rose-200 fill-rose-600";
    if (score >= 30) return "text-amber-600 bg-amber-50 border-amber-200 fill-amber-600";
    return "text-emerald-600 bg-emerald-50 border-emerald-200 fill-emerald-600";
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return "bg-rose-600";
    if (score >= 30) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "High Alert":
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/25 font-bold">High Alert</span>;
      case "Medium Hint":
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/25 font-bold">Medium Hint</span>;
      case "Style Quirk":
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/25 font-semibold">Style Quirk</span>;
      case "Human Indicator":
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-bold">Human Proof</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300 border border-zinc-700">Info</span>;
    }
  };

  return (
    <div id="report-viewer" className="space-y-5 animate-fadeIn">
      
      {/* 1. Header with Stats & Verdict Banner */}
      <div className="bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/40">
          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Analysis Result</span>
            <h1 className="font-display font-bold text-white text-lg leading-tight flex items-center gap-1.5">
              <span>Code Audit for {student.name}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => exportStudentToXLSX(student)}
              className="py-1 px-2.5 text-[10px] font-semibold border border-white/10 hover:bg-white/5 text-zinc-300 bg-zinc-950 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              title="Export Detailed Report to Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-450" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={onPrint}
              className="py-1 px-2.5 text-[10px] font-semibold border border-white/10 hover:bg-white/5 text-zinc-300 bg-zinc-950 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              title="Print or Save Report to PDF"
            >
              <Printer className="w-3.5 h-3.5 text-sky-400" />
              <span>Print/PDF</span>
            </button>

            <div className="text-[10px] font-mono text-zinc-400 bg-zinc-950 border border-white/10 py-1 px-2.5 rounded-lg flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span>{report.analyzedAt ? new Date(report.analyzedAt).toLocaleTimeString() : new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 flex flex-col md:flex-row items-center gap-5 sm:gap-6">
          {/* Big Score Radial/Circular Gauge */}
          <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
            {/* SVG Progress Circle */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="56"
                cy="56"
                r="48"
                className="stroke-zinc-800"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="56"
                cy="56"
                r="48"
                className="transition-all duration-1000 ease-out"
                strokeWidth="10"
                stroke={report.probabilityScore >= 70 ? "#f43f5e" : report.probabilityScore >= 30 ? "#fbbf24" : "#10b981"}
                strokeDasharray={`${2 * Math.PI * 48}`}
                strokeDashoffset={`${2 * Math.PI * 48 * (1 - report.probabilityScore / 100)}`}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white tracking-tight leading-none">{report.probabilityScore}%</span>
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mt-1">AI Probability</span>
            </div>
          </div>

          {/* Quick analysis summary list */}
          <div className="flex-1 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-400">Confidence Match:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[10px] border ${
                report.confidenceRating === "High" 
                  ? "bg-emerald-950/40 text-emerald-350 border-emerald-900/30" 
                  : report.confidenceRating === "Medium"
                  ? "bg-amber-955/20 text-amber-350 border-amber-900/30"
                  : "bg-zinc-805/30 text-zinc-350 border-white/5"
              }`}>
                {report.confidenceRating}
              </span>
            </div>
            
            <p className="text-zinc-250 leading-relaxed text-sm bg-zinc-950 p-3 rounded-lg border border-white/10 font-medium">
              <span className="font-bold text-white">Verdict: </span>
              {report.verdictSummary}
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {student.analyzedFilename && (
                <span className="text-[10px] font-semibold text-zinc-450 bg-zinc-950 border border-white/10 py-1 px-2.5 rounded inline-flex items-center gap-1 font-mono">
                  <Code className="w-3 h-3 text-sky-400" />
                  <span>File: {student.analyzedFilename}</span>
                </span>
              )}
              {student.modelUsed && (
                <span className="text-[10px] font-semibold text-sky-305 bg-sky-955/20 border border-sky-905/35 py-1 px-2.5 rounded inline-flex items-center gap-1 font-mono">
                  <span>Model: {student.modelUsed}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Structured Findings & Clues */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Evidence Points */}
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 shadow-lg space-y-3.5">
          <div className="flex items-center gap-2 pb-2.5 border-b border-white/10">
            <Flag className="w-4 h-4 text-sky-450" />
            <h3 className="font-display font-semibold text-white text-sm">Key Stylistic Indicators ({report.evidencePoints.length})</h3>
          </div>
          
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {report.evidencePoints.map((pt, idx) => (
              <div key={idx} className="bg-zinc-950/60 hover:bg-zinc-950 border border-white/5 rounded-lg p-2.5 transition-all text-xs">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold text-white tracking-tight">{pt.type}</span>
                  {getSeverityBadge(pt.severity)}
                </div>
                <p className="text-zinc-400 leading-relaxed mb-2.5 font-normal">
                  {pt.explanation}
                </p>
                {pt.snippet && (
                  <div className="bg-zinc-900 p-2 rounded text-[10px] font-mono text-zinc-400 border border-white/5 overflow-x-auto select-all max-h-16">
                    {pt.snippet}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* AI Character comparison */}
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 shadow-lg space-y-3.5">
          <div className="flex items-center gap-2 pb-2.5 border-b border-white/10">
            <Sliders className="w-4 h-4 text-sky-450" />
            <h3 className="font-display font-semibold text-white text-sm">Code Signature Comparison</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <span className="block font-semibold text-rose-350 bg-rose-955/20 py-1 px-2 rounded mb-1.5 border border-rose-500/10 font-sans tracking-wide">
                AI Coding Signatures Spotted
              </span>
              <p className="text-zinc-400 px-1 leading-relaxed font-normal">
                {report.humanComparison.aiCharacteristics}
              </p>
            </div>

            <div>
              <span className="block font-semibold text-emerald-350 bg-emerald-955/20 py-1 px-2 rounded mb-1.5 border border-emerald-555/10 font-sans tracking-wide">
                Expected Human Student Equivalency
              </span>
              <p className="text-zinc-400 px-1 leading-relaxed font-normal">
                {report.humanComparison.humanEquivalentStyle}
              </p>
            </div>

            <div>
              <span className="block font-semibold text-zinc-300 bg-zinc-950 py-1 px-2 rounded mb-1.5 border border-white/10 font-sans tracking-wide">
                Syntactic, Spacing & Comment Quirk Notes
              </span>
              <p className="text-zinc-400 px-1 leading-relaxed italic font-normal">
                {report.humanComparison.styleQuirkNotes}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* 3. Pedagogical Guidance Card */}
      <div className="bg-zinc-900 border border-white/15 rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex items-start gap-3.5">
          <ClipboardCheck className="w-5 h-5 text-sky-400 mt-0.5 shrink-0" />
          <div className="text-xs space-y-1.5">
            <h3 className="font-display font-semibold text-white text-sm">Evaluating Academic Integrity</h3>
            <p className="text-zinc-400 leading-relaxed font-normal">
              This detection is probabilistic and serves as a tool for educators, rather than absolute proof. AI probability scores of <strong>&ge; 70%</strong> indicate typical templating layouts, over-explained inline documentation, and complete mathematical precision that strongly matches modern assistants. 
            </p>
            <div className="pt-2 flex flex-wrap gap-2">
              <span className="px-2.5 py-1 bg-zinc-950 border border-white/10 rounded text-[10px] text-zinc-400 font-semibold shadow-sm hover:text-white transition-colors">
                Check comments for conversational notes
              </span>
              <span className="px-2.5 py-1 bg-zinc-950 border border-white/10 rounded text-[10px] text-zinc-400 font-semibold shadow-sm hover:text-white transition-colors">
                Discuss complex segments in-person
              </span>
              <span className="px-2.5 py-1 bg-zinc-950 border border-white/10 rounded text-[10px] text-zinc-400 font-semibold shadow-sm hover:text-white transition-colors">
                Track formatting alignments
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Git Commit History Timeline */}
      {student.commits && student.commits.length > 0 && (
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 sm:p-5 shadow-lg space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-white/10 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-sky-400" />
              <h3 className="font-display font-semibold text-white text-sm">GitHub Repository Commit History</h3>
              <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono font-bold px-1.5 py-0.5 rounded">
                {student.commits.length} Commits
              </span>
            </div>
            {student.githubUrl && (
              <a
                href={student.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] bg-zinc-950 hover:bg-zinc-850 text-zinc-300 hover:text-white border border-white/10 px-2.5 py-1 rounded-lg transition-all font-sans font-medium hover:scale-102 cursor-pointer"
                title="Open main repository page in GitHub"
              >
                <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                <span>Open Repo</span>
              </a>
            )}
          </div>
          
          <div className="relative border-l border-white/10 pl-5 ml-2.5 py-1 space-y-5 max-h-96 overflow-y-auto">
            {student.commits.map((commit, idx) => {
              const fallbackUrl = `https://github.com/${student.githubUrl.replace("https://github.com/", "").replace("git@github.com:", "")}/commit/${commit.sha}`;
              const commitUrl = commit.htmlUrl || fallbackUrl;

              return (
                <div key={idx} className="relative group/commit">
                  {/* Node indicator */}
                  <span className="absolute -left-[27px] top-1 bg-zinc-950 p-0.5 border border-sky-500/40 group-hover/commit:border-sky-400/80 rounded-full flex items-center justify-center shrink-0 transition-colors">
                    <GitCommit className="w-3.5 h-3.5 text-sky-400" />
                  </span>
                  
                  <div className="space-y-1">
                    <div className="flex items-start gap-2 flex-wrap text-sm">
                      <a
                        href={commitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-white hover:text-sky-400 transition-colors cursor-pointer flex items-center gap-1.5 leading-snug group/link"
                        title="Open this commit in GitHub"
                      >
                        <span>{commit.message}</span>
                        <ExternalLink className="w-3 h-3 text-zinc-650 group-hover/link:text-sky-400 inline-block shrink-0 opacity-40 group-hover/link:opacity-100 transition-all" />
                      </a>
                      <span className="font-mono text-[10px] bg-white/5 text-zinc-400 px-1 py-0.5 rounded border border-white/5 font-semibold">
                        {commit.sha}
                      </span>
                    </div>

                    {/* Commit additions, deletions, modifications in file */}
                    {(commit.additions !== undefined || commit.deletions !== undefined || commit.changedFiles !== undefined) && (
                      <div className="flex items-center gap-1.5 font-mono text-[10px] select-none flex-wrap pt-0.5">
                        {commit.additions !== undefined && commit.additions > 0 && (
                          <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-md" title={`${commit.additions} line additions`}>
                            +{commit.additions} add
                          </span>
                        )}
                        {commit.deletions !== undefined && commit.deletions > 0 && (
                          <span className="text-rose-400 font-bold bg-rose-500/10 border border-rose-500/25 px-1.5 py-0.5 rounded-md" title={`${commit.deletions} line deletions`}>
                            -{commit.deletions} delete
                          </span>
                        )}
                        {commit.changedFiles !== undefined && commit.changedFiles > 0 && (
                          <span className="text-amber-400 font-bold bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded-md" title={`${commit.changedFiles} files modified`}>
                            {commit.changedFiles} file{commit.changedFiles > 1 ? "s" : ""} change
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3 text-zinc-500 text-[11px]">
                      <span className="flex items-center gap-1.5">
                        {commit.authorAvatar ? (
                          <img src={commit.authorAvatar} alt="" referrerPolicy="no-referrer" className="w-4 h-4 rounded-full border border-white/5" />
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center text-[8px] text-zinc-400">👤</span>
                        )}
                        <span className="text-zinc-400 font-medium">{commit.authorName}</span>
                      </span>
                      <span>&bull;</span>
                      <span>{commit.authorDate ? new Date(commit.authorDate).toLocaleDateString() : ""} {commit.authorDate ? new Date(commit.authorDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
