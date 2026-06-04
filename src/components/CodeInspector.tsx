import React, { useState, useEffect, useRef } from "react";
import { Student, CodeFile, LineAnnotation } from "../types";
import { 
  FileCode, 
  Terminal, 
  Sparkles, 
  User, 
  HelpCircle, 
  Download, 
  AlertTriangle,
  Lightbulb,
  FileText,
  MousePointerClick,
  GitCommit,
  History,
  ExternalLink,
  CheckCircle2
} from "lucide-react";

interface CodeInspectorProps {
  student: Student;
  onCodeAnalyze: (filename: string, content: string) => void;
  isAnalyzing: boolean;
  selectedFilePath: string;
  setSelectedFilePath: (path: string) => void;
  onSingleFileAnalyze?: (filePath: string) => Promise<void>;
  isAnalyzingSingleFile?: boolean;
}

export default function CodeInspector({
  student,
  onCodeAnalyze,
  isAnalyzing,
  selectedFilePath,
  setSelectedFilePath,
  onSingleFileAnalyze,
  isAnalyzingSingleFile = false,
}: CodeInspectorProps) {
  const [selectedAnnotation, setSelectedAnnotation] = useState<LineAnnotation | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<"clues" | "commits">("clues");
  
  // Custom paste code mode
  const [isPastingCode, setIsPastingCode] = useState(false);
  const [pastedCodeName, setPastedCodeName] = useState("index.js");
  const [pastedCodeContent, setPastedCodeContent] = useState("");
  const [fileFilter, setFileFilter] = useState("");

  const files = student.files || [];
  
  const filteredFiles = files.filter(f => 
    f.path.toLowerCase().includes(fileFilter.toLowerCase())
  );

  // Reset selected file when student changes
  useEffect(() => {
    if (files.length > 0) {
      if (!selectedFilePath) {
        setSelectedFilePath(files[0].path);
      }
      setIsPastingCode(false);
    } else {
      setSelectedFilePath("");
      setIsPastingCode(true); // Default to sandbox paste panel if no files exist yet
    }
    setSelectedAnnotation(null);
  }, [student.id, files.length]);

  const activeFile = files.find((f) => f.path === selectedFilePath);
  const codeText = activeFile ? activeFile.content : "";
  const annotations = activeFile?.report?.lineAnnotations || [];

  // Split lines
  const lines = codeText ? codeText.split("\n") : [];

  // Find annotations covering a given line number (1-indexed)
  const getAnnotationForLine = (lineNum: number): LineAnnotation | undefined => {
    return annotations.find(
      (ann) => lineNum >= ann.startLine && lineNum <= ann.endLine
    );
  };

  const handleLineClick = (lineNum: number) => {
    const ann = getAnnotationForLine(lineNum);
    if (ann) {
      setSelectedAnnotation(ann);
    }
  };

  const handleAnalyzePastedCode = () => {
    if (!pastedCodeContent.trim()) {
      alert("Please paste some source code to analyze first.");
      return;
    }
    onCodeAnalyze(pastedCodeName, pastedCodeContent);
  };

  return (
    <div id="code-inspector-container" className="bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-lg flex flex-col h-full min-h-[500px]">
      
      {/* 1. Header with workspace status */}
      <div className="p-4 border-b border-white/10 bg-zinc-950/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-sky-400" />
            <h2 className="font-display font-semibold text-white text-sm">Source Code Inspector</h2>
          </div>

          {/* Repo Code Drop Down Menu instead of Sidebar */}
          {!isPastingCode && files.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-500 font-sans uppercase tracking-wider font-bold shrink-0">Select File:</span>
              <select
                id="file-selector-dropdown"
                value={selectedFilePath}
                onChange={(e) => {
                  setSelectedFilePath(e.target.value);
                  setSelectedAnnotation(null);
                }}
                className="py-1 px-2 bg-zinc-950 border border-white/15 text-xs text-sky-400 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer max-w-[200px] sm:max-w-[320px] truncate"
              >
                {files.map((file) => {
                  const parts = file.path.split("/");
                  const name = parts.pop() || file.path;
                  return (
                    <option key={file.path} value={file.path}>
                      {name} ({file.path})
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        <button
          id="toggle-sandbox-btn"
          onClick={() => {
            setIsPastingCode(!isPastingCode);
            setSelectedAnnotation(null);
          }}
          className={`py-1 px-2.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
            isPastingCode
              ? "bg-sky-500 text-white border-sky-400"
              : "bg-zinc-950 hover:bg-zinc-900 text-zinc-300 border-white/10"
          }`}
        >
          {isPastingCode ? "Back to Student Files" : "Paste Code Sandbox"}
        </button>
      </div>

      {/* 2. Main Layout - Split file sidebar, editor and annotations */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        
        {/* Editor Screen occupies FULL remaining space */}
        <div className="flex-1 min-w-0 bg-zinc-950 text-zinc-100 font-mono text-xs overflow-auto relative p-2 min-h-[350px] lg:min-h-0">
          
          {isPastingCode ? (
            /* SANDBOX CUSTOM CODE PASTER */
            <div className="p-4 space-y-4 font-sans text-zinc-200">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 font-display">
                  <Terminal className="w-4 h-4 text-sky-400" />
                  <span>Manual Code Sandbox Analysis</span>
                </h3>
                <p className="text-zinc-500 text-[11px]">
                  Paste any student code file below to immediate trigger Gemini-powered AI/Human style detection, without needing an excel repository.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">FILENAME WITH EXTENSION</label>
                  <input
                    id="sandbox-filename-input"
                    type="text"
                    value={pastedCodeName}
                    onChange={(e) => setPastedCodeName(e.target.value)}
                    placeholder="e.g. App.tsx, script.py, main.cpp"
                    className="w-full max-w-sm px-3 py-1.5 bg-zinc-900 text-white rounded border border-white/10 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">PASTE STUDENT SOURCE CODE</label>
                  <textarea
                    id="sandbox-code-textarea"
                    rows={12}
                    value={pastedCodeContent}
                    onChange={(e) => setPastedCodeContent(e.target.value)}
                    placeholder="Paste student source code segments here..."
                    className="w-full p-3 bg-zinc-900 text-zinc-100 rounded-lg border border-white/10 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                  />
                </div>
              </div>

              <button
                id="sandbox-analyze-btn"
                onClick={handleAnalyzePastedCode}
                disabled={isAnalyzing}
                className="py-1.5 px-4 bg-sky-500 text-white rounded font-semibold text-xs hover:bg-sky-450 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing Syntax Style...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Run Style Probability Check</span>
                  </>
                )}
              </button>
            </div>
          ) : codeText ? (
            /* LINE-BY-LINE ACTIVE HIGHLIGHT CODE LIST */
            <div className="min-w-full inline-block py-2">
              <div className="text-[10px] text-zinc-450 bg-zinc-900/60 p-2.5 border border-white/5 rounded mb-3 flex items-center gap-1.5 font-sans">
                <MousePointerClick className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Hover and click highlighted lines with background indicators to see style notes.</span>
              </div>
              
              {lines.map((line, idx) => {
                const lineNum = idx + 1;
                const ann = getAnnotationForLine(lineNum);
                const isHighlighted = !!ann;
                const isSelected = selectedAnnotation === ann && isHighlighted;
 
                // Color schemes based on whether AI suspicion or Human Indicator
                let bgStyle = "";
                let indicatorDot = null;

                if (isHighlighted) {
                  if (ann?.isSuspicious) {
                    bgStyle = isSelected 
                      ? "bg-rose-500/20 border-l-4 border-rose-500" 
                      : "bg-rose-950/30 border-l-4 border-rose-605/50 hover:bg-rose-950/40";
                    indicatorDot = <Sparkles className="w-3 h-3 text-rose-400 shrink-0 self-center" title="AI Template Clue" />;
                  } else {
                    bgStyle = isSelected 
                      ? "bg-emerald-500/20 border-l-4 border-emerald-500" 
                      : "bg-emerald-950/30 border-l-4 border-emerald-605/50 hover:bg-emerald-950/40";
                    indicatorDot = <User className="w-3 h-3 text-emerald-400 shrink-0 self-center" title="Human Handwriting Marker" />;
                  }
                } else {
                  bgStyle = "border-l-4 border-transparent hover:bg-white/5";
                }

                return (
                  <div
                    key={idx}
                    onClick={() => isHighlighted && handleLineClick(lineNum)}
                    className={`flex items-stretch select-text ${bgStyle} ${isHighlighted ? "cursor-pointer" : "cursor-text"} py-0.5`}
                  >
                    {/* Line numbers column */}
                    <span className="w-9 text-right pr-3 select-none text-zinc-650 font-sans border-r border-white/5 shrink-0">
                      {lineNum}
                    </span>
                    
                    {/* Clue icon column */}
                    <span className="w-5 flex justify-center shrink-0">
                      {indicatorDot}
                    </span>

                    {/* Pre-formatted code segment */}
                    <pre className="pl-2 font-mono whitespace-pre flex-1 text-zinc-100 overflow-x-visible">
                      {line || " "}
                    </pre>
                  </div>
                );
              })}
            </div>
          ) : (
            /* NO FILES LOADED STATE */
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-zinc-500 font-sans">
              <FileText className="w-10 h-10 text-zinc-700 mb-2" />
              <p className="text-xs font-semibold text-zinc-400">No files scanned yet</p>
              <p className="text-[10px] mt-1 text-zinc-600 max-w-xs">
                Select a student from the left repo grid and retrieve public files, or use the Sandbox mode above to paste files directly.
              </p>
            </div>
          )}
        </div>

        {/* Selected Annotation Detail Slide-over Panel (Right Sidebar) */}
        {!isPastingCode && (
          <div className="w-full lg:w-72 bg-zinc-900 border-t lg:border-t-0 lg:border-l border-white/10 p-4 space-y-4 shrink-0 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              {/* Tab Selector */}
              <div className="flex border-b border-white/10">
                <button
                  id="tab-clues"
                  onClick={() => setRightPanelTab("clues")}
                  className={`flex-1 pb-2 text-xs font-display font-semibold border-b-2 text-center transition-all cursor-pointer ${
                    rightPanelTab === "clues"
                      ? "border-sky-500 text-sky-400 font-bold"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Line Clues
                </button>
                <button
                  id="tab-commits"
                  onClick={() => setRightPanelTab("commits")}
                  className={`flex-1 pb-2 text-xs font-display font-semibold border-b-2 text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    rightPanelTab === "commits"
                      ? "border-sky-500 text-sky-400 font-bold"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Commits ({student.commits?.length || 0})</span>
                </button>
              </div>

              {rightPanelTab === "clues" ? (
                <div className="space-y-4">
                  <div className="pb-1 border-b border-white/5">
                    <h3 className="font-display font-semibold text-white text-xs uppercase tracking-wider">Line Clues Panel</h3>
                    {annotations.length > 0 ? (
                      <p className="text-[10px] mt-0.5 text-zinc-500 leading-tight">
                        Spotted <strong className="text-sky-400 font-bold">{annotations.length}</strong> markers in this source file. Click highlighted blocks to inspect.
                      </p>
                    ) : (
                      <p className="text-[10px] mt-0.5 text-zinc-500">No active reports for this file yet.</p>
                    )}
                  </div>

                  {selectedAnnotation ? (
                    <div className="bg-zinc-950 border border-white/10 p-3 rounded-lg shadow-md space-y-3 text-xs animate-fadeIn">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          selectedAnnotation.isSuspicious
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/25"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                        }`}>
                          {selectedAnnotation.isSuspicious ? "AI Signature spotted" : "Human trait indicator"}
                        </span>
                        <span className="text-[9px] font-mono font-bold text-zinc-500">
                          Lines {selectedAnnotation.startLine}-{selectedAnnotation.endLine}
                        </span>
                      </div>

                      <p className="text-zinc-300 font-normal leading-relaxed">
                        {selectedAnnotation.commentary}
                      </p>

                      {selectedAnnotation.codeBlock && (
                        <div className="space-y-1">
                          <span className="text-[8px] font-bold text-zinc-500 uppercase">Clue segment:</span>
                          <pre className="bg-zinc-900 text-[10px] text-zinc-400 font-mono p-1.5 rounded overflow-x-auto border border-white/5">
                            {selectedAnnotation.codeBlock}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : annotations.length > 0 ? (
                    /* Prompt to select block */
                    <div className="border border-dashed border-sky-500/25 bg-sky-950/10 p-4 rounded-lg text-center text-xs text-sky-400 font-normal space-y-2">
                      <Lightbulb className="w-5 h-5 text-sky-400 mx-auto" />
                      <p>Click highlighted code regions in the editor to view inline Gemini analysis explanations.</p>
                    </div>
                  ) : (activeFile && !activeFile.report) ? (
                    /* Active file has no report (skipped or needs single file analysis) */
                    <div className="bg-zinc-950 border border-white/10 p-4 rounded-lg shadow-md text-center space-y-4">
                      <HelpCircle className="w-8 h-8 text-sky-400 mx-auto" />
                      <div className="space-y-1">
                        <p className="font-semibold text-white text-xs">No analysis report for this file.</p>
                        <p className="text-[10px] text-zinc-500 leading-normal">
                          This file was not included in the initial repository style audit (possibly due to size or limit rules).
                        </p>
                      </div>
                      
                      {onSingleFileAnalyze && (
                        <button
                          id="audit-single-file-btn"
                          onClick={() => activeFile && onSingleFileAnalyze(activeFile.path)}
                          disabled={isAnalyzingSingleFile}
                          className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          {isAnalyzingSingleFile ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Auditing File Style...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-sky-300" />
                              <span>Audit this File Now</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  ) : activeFile?.report ? (
                    /* Report exists, but has no annotations */
                    <div className="border border-dashed border-zinc-700 bg-zinc-950/20 p-4 rounded-lg text-center text-xs text-zinc-400 space-y-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto" />
                      <p className="font-semibold text-zinc-300">File analyzed successfully</p>
                      <p className="text-[10px] text-zinc-500 leading-normal">
                        No suspicious AI code patterns or human quirks were marked on specific lines. The file's style is clean.
                      </p>
                    </div>
                  ) : (
                    /* No analysis done yet */
                    <div className="p-4 text-center text-xs text-zinc-500 space-y-1">
                      <HelpCircle className="w-6 h-6 text-zinc-650 mx-auto" />
                      <p className="font-semibold text-zinc-400">No style analysis loaded.</p>
                      <p className="text-[10px] text-zinc-500">Select a student and click "Analyze" to flag template codes.</p>
                    </div>
                  )}

                  {/* List all indicators in a list summarized */}
                  {annotations.length > 0 && !selectedAnnotation && (
                    <div className="space-y-1.5 pt-3 border-t border-white/10">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase block mb-1">Index of Code Markers</span>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {annotations.map((ann, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedAnnotation(ann)}
                            className={`w-full text-left p-1.5 text-[10px] bg-zinc-950 border rounded hover:border-sky-500/50 transition-colors cursor-pointer flex items-center justify-between gap-1.5 text-zinc-400 font-medium ${
                              ann.isSuspicious ? "border-rose-950 hover:bg-rose-955/15" : "border-emerald-950 hover:bg-emerald-955/15"
                            }`}
                          >
                            <span className="truncate flex-1 font-normal text-zinc-400">
                              {ann.commentary}
                            </span>
                            <span className={`font-mono text-[8px] font-bold shrink-0 ${
                              ann.isSuspicious ? "text-rose-455" : "text-emerald-455"
                            }`}>
                              L{ann.startLine}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Commits tab content */
                <div className="space-y-3">
                  <div className="pb-1 border-b border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Repository Commits</span>
                      <p className="text-[9px] text-zinc-500 leading-tight mt-0.5">Chronological timeline of changes pulled from GitHub.</p>
                    </div>
                    {student.githubUrl && (
                      <a
                        href={student.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5 text-[9px] bg-zinc-950 hover:bg-zinc-850 text-zinc-300 hover:text-white border border-white/10 px-1.5 py-0.5 rounded transition-colors font-sans font-semibold cursor-pointer"
                        title="Open GitHub Repository in a new tab"
                      >
                        <ExternalLink className="w-2.5 h-2.5 text-sky-400" />
                        <span>Repo</span>
                      </a>
                    )}
                  </div>

                  {student.commits && student.commits.length > 0 ? (
                    <div className="relative border-l border-white/10 pl-4 ml-1.5 py-1 space-y-4 max-h-[380px] overflow-y-auto">
                      {student.commits.map((commit, idx) => {
                        const fallbackUrl = `https://github.com/${student.githubUrl.replace("https://github.com/", "").replace("git@github.com:", "")}/commit/${commit.sha}`;
                        const commitUrl = commit.htmlUrl || fallbackUrl;

                        return (
                          <div key={idx} className="relative group/commit">
                            {/* Node indicator */}
                            <span className="absolute -left-[21px] top-0.5 bg-zinc-950 p-0.5 border border-sky-400/50 group-hover/commit:border-sky-300 rounded-full flex items-center justify-center shrink-0 transition-colors">
                              <GitCommit className="w-2.5 h-2.5 text-sky-400" />
                            </span>

                            <div className="space-y-1">
                              <div className="text-xs space-y-0.5">
                                <div className="flex items-start gap-1 flex-wrap">
                                  <a
                                    href={commitUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-bold text-zinc-100 hover:text-sky-400 transition-colors cursor-pointer text-xs leading-normal flex items-center gap-1 group/link"
                                    title="Open commit in GitHub"
                                  >
                                    <span>{commit.message}</span>
                                    <ExternalLink className="w-2.5 h-2.5 text-zinc-600 group-hover/link:text-sky-400 shrink-0 opacity-40 group-hover/link:opacity-100 transition-all" />
                                  </a>
                                  <span className="font-mono text-[8px] bg-white/5 text-zinc-400 px-1 py-0.2 rounded border border-white/5 leading-none shrink-0" title={commit.sha}>
                                    {commit.sha}
                                  </span>
                                </div>

                                {/* Row for additions (green), deletions (red) and changes (yellow) */}
                                {(commit.additions !== undefined || commit.deletions !== undefined || commit.changedFiles !== undefined) && (
                                  <div className="flex items-center gap-1 font-mono text-[8px] select-none py-0.5">
                                    {commit.additions !== undefined && commit.additions > 0 && (
                                      <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/25 px-1 rounded" title={`${commit.additions} line additions`}>
                                        +{commit.additions}
                                      </span>
                                    )}
                                    {commit.deletions !== undefined && commit.deletions > 0 && (
                                      <span className="text-rose-400 font-bold bg-rose-500/10 border border-rose-500/25 px-1 rounded" title={`${commit.deletions} line deletions`}>
                                        -{commit.deletions}
                                      </span>
                                    )}
                                    {commit.changedFiles !== undefined && commit.changedFiles > 0 && (
                                      <span className="text-amber-400 font-bold bg-amber-500/10 border border-amber-500/25 px-1 rounded" title={`${commit.changedFiles} files changed`}>
                                        {commit.changedFiles} file{commit.changedFiles > 1 ? "s" : ""}
                                      </span>
                                    )}
                                  </div>
                                )}

                                <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] flex-wrap">
                                  <span className="flex items-center gap-1">
                                    {commit.authorAvatar ? (
                                      <img src={commit.authorAvatar} alt="" referrerPolicy="no-referrer" className="w-3.5 h-3.5 rounded-full" />
                                    ) : (
                                      <span className="w-3.5 h-3.5 rounded-full bg-zinc-800 flex items-center justify-center text-[7px]">👤</span>
                                    )}
                                    <span className="text-zinc-450 font-medium">{commit.authorName}</span>
                                  </span>
                                  <span>&bull;</span>
                                  <span>{commit.authorDate ? new Date(commit.authorDate).toLocaleDateString() : ""}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-xs text-zinc-500 space-y-1">
                      <History className="w-6 h-6 text-zinc-700 mx-auto" />
                      <p className="font-semibold text-zinc-400">No commits found.</p>
                      <p className="text-[10px] text-zinc-500 leading-normal">Retrieve files for this repository to fetch recent commits.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Minimal loading placeholder for TS compilation safety
function Loader2(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
