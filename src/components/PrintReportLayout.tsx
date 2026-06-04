import React from "react";
import { Student, CodeFile, LineAnnotation } from "../types";

interface PrintReportLayoutProps {
  students: Student[];
  target: { type: "single" | "all"; studentId?: string };
}

export function PrintReportLayout({ students, target }: PrintReportLayoutProps) {
  const studentsToPrint = target.type === "single"
    ? students.filter(s => s.id === target.studentId)
    : students.filter(s => s.status === "analyzed");

  const total = students.length;
  const audited = students.filter(s => s.status === "analyzed");
  const averageProbability = audited.length > 0
    ? Math.round(audited.reduce((acc, s) => acc + (s.activeReport?.probabilityScore || 0), 0) / audited.length)
    : 0;
  const highRisk = audited.filter(s => s.activeReport && s.activeReport.probabilityScore >= 70).length;
  const mediumRisk = audited.filter(s => s.activeReport && s.activeReport.probabilityScore >= 30 && s.activeReport.probabilityScore < 70).length;
  const lowRisk = audited.filter(s => s.activeReport && s.activeReport.probabilityScore < 30).length;

  const getAnnotationForLineInFile = (lineNum: number, file: CodeFile): LineAnnotation | undefined => {
    const annotations = file.report?.lineAnnotations || [];
    return annotations.find(
      (ann) => lineNum >= ann.startLine && lineNum <= ann.endLine
    );
  };

  return (
    <div className="w-full text-black bg-white">
      {/* 1. Cover Sheet (Only for bulk master print) */}
      {target.type === "all" && (
        <div className="pb-8 mb-8 border-b-2 border-zinc-350 print-page">
          <div className="flex justify-between items-center border-b-2 border-zinc-800 pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Academic Integrity Class Audit</h1>
              <p className="text-xs text-zinc-500 font-mono mt-1">Sentinel AI Academic Suite &bull; Master Summary Report</p>
            </div>
            <div className="text-right text-xs text-zinc-500">
              <p>Generated: {new Date().toLocaleDateString()}</p>
              <p>{new Date().toLocaleTimeString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-8 text-center text-xs">
            <div className="border border-zinc-350 p-3 rounded-lg bg-zinc-50">
              <span className="block text-[10px] text-zinc-500 font-semibold uppercase">Total Students</span>
              <span className="text-lg font-bold text-zinc-800">{total}</span>
            </div>
            <div className="border border-zinc-350 p-3 rounded-lg bg-zinc-50">
              <span className="block text-[10px] text-zinc-500 font-semibold uppercase">Audited Repos</span>
              <span className="text-lg font-bold text-sky-600">{audited.length}</span>
            </div>
            <div className="border border-zinc-350 p-3 rounded-lg bg-zinc-50">
              <span className="block text-[10px] text-zinc-500 font-semibold uppercase">Average AI Risk</span>
              <span className="text-lg font-bold text-zinc-800">{averageProbability}%</span>
            </div>
            <div className="border border-zinc-350 p-3 rounded-lg bg-zinc-50">
              <span className="block text-[10px] text-zinc-500 font-semibold uppercase">High Risk Alerts</span>
              <span className="text-lg font-bold text-red-655">{highRisk}</span>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xs font-bold text-zinc-800 mb-3 uppercase tracking-wider">Classroom Risk Distribution</h2>
            <div className="flex h-3.5 rounded-full overflow-hidden bg-zinc-100 mb-2 border border-zinc-300">
              <div style={{ width: `${total ? (highRisk/total)*100 : 0}%` }} className="bg-red-500"></div>
              <div style={{ width: `${total ? (mediumRisk/total)*100 : 0}%` }} className="bg-amber-500"></div>
              <div style={{ width: `${total ? (lowRisk/total)*100 : 0}%` }} className="bg-emerald-500"></div>
              <div style={{ width: `${total ? ((total - audited.length)/total)*100 : 0}%` }} className="bg-zinc-300"></div>
            </div>
            <div className="flex gap-4 text-[10px] text-zinc-600 justify-center">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-500 rounded-full inline-block"></span> High Risk ({highRisk})</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-500 rounded-full inline-block"></span> Medium Risk ({mediumRisk})</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block"></span> Low Risk ({lowRisk})</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-zinc-300 rounded-full inline-block"></span> Unaudited ({total - audited.length})</span>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold text-zinc-800 mb-3 uppercase tracking-wider">Student Registry Grid</h2>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-zinc-300 text-zinc-700 font-bold bg-zinc-100 text-[11px]">
                  <th className="py-2 px-2 border border-zinc-250">No.</th>
                  <th className="py-2 px-2 border border-zinc-250">Student Name</th>
                  <th className="py-2 px-2 border border-zinc-250">Roll No</th>
                  <th className="py-2 px-2 border border-zinc-250">GitHub Repository</th>
                  <th className="py-2 px-2 border border-zinc-250 text-center">AI Risk %</th>
                  <th className="py-2 px-2 border border-zinc-250">Confidence / Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 border-b border-zinc-300 text-[11px]">
                {students.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-zinc-50">
                    <td className="py-2 px-2 border border-zinc-200 font-mono text-[10px]">{idx + 1}</td>
                    <td className="py-2 px-2 border border-zinc-200 font-bold text-zinc-900">{s.name}</td>
                    <td className="py-2 px-2 border border-zinc-200 font-mono text-[10px]">{s.rollNo}</td>
                    <td className="py-2 px-2 border border-zinc-200 font-mono text-[10px] truncate max-w-xs">{s.githubUrl}</td>
                    <td className="py-2 px-2 border border-zinc-200 font-bold text-center">
                      {s.status === "analyzed" && s.activeReport ? (
                        <span className={s.activeReport.probabilityScore >= 70 ? "text-red-600" : s.activeReport.probabilityScore >= 30 ? "text-amber-600" : "text-emerald-600"}>
                          {s.activeReport.probabilityScore}%
                        </span>
                      ) : (
                        <span className="text-zinc-450">N/A</span>
                      )}
                    </td>
                    <td className="py-2 px-2 border border-zinc-200 font-mono text-[10px]">
                      {s.status === "analyzed" && s.activeReport ? s.activeReport.confidenceRating : s.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Detailed Report Pages */}
      {studentsToPrint.map((student) => {
        const report = student.activeReport;
        if (!report) {
          return (
            <div key={student.id} className="p-6 text-center border-2 border-dashed border-zinc-300 rounded-xl mb-6 print-page">
              <h2 className="text-lg font-bold text-zinc-800">Academic Integrity Report: {student.name}</h2>
              <p className="text-xs text-zinc-500 font-mono mt-1">Roll No: {student.rollNo} &bull; Repository: {student.githubUrl}</p>
              <p className="text-sm text-zinc-650 mt-12 mb-4">No audit results completed for this repository yet.</p>
            </div>
          );
        }

        return (
          <div key={student.id} className="pb-8 print-page">
            {/* Header */}
            <div className="flex justify-between items-center border-b-2 border-zinc-800 pb-3 mb-5">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-zinc-900">Academic Integrity Audit Report</h1>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">Sentinel AI Academic Suite &bull; Code Analysis Forensic</p>
              </div>
              <div className="text-right text-xs text-zinc-500">
                <p>Audited: {report.analyzedAt ? new Date(report.analyzedAt).toLocaleDateString() : new Date().toLocaleDateString()}</p>
                <p>Status: Completed</p>
              </div>
            </div>

            {/* Profile Grid */}
            <div className="grid grid-cols-3 border border-zinc-300 rounded-lg overflow-hidden text-xs mb-5 bg-zinc-50">
              <div className="p-2 border-r border-zinc-300">
                <span className="block text-[9px] text-zinc-500 font-semibold uppercase">Student Candidate</span>
                <span className="font-bold text-zinc-900 text-sm">{student.name}</span>
              </div>
              <div className="p-2 border-r border-zinc-300">
                <span className="block text-[9px] text-zinc-500 font-semibold uppercase">Roll / Register No</span>
                <span className="font-mono text-zinc-800 text-sm">{student.rollNo}</span>
              </div>
              <div className="p-2">
                <span className="block text-[9px] text-zinc-500 font-semibold uppercase">GitHub Repository URL</span>
                <span className="font-mono text-zinc-800 truncate block">{student.githubUrl.replace("https://github.com/", "")}</span>
              </div>
            </div>

            {/* Verdict Panel */}
            <div className="border border-zinc-300 rounded-lg p-4 mb-6 flex items-center gap-6 bg-zinc-50">
              <div className="w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center shrink-0 bg-white"
                   style={{ borderColor: report.probabilityScore >= 70 ? "#ef4444" : report.probabilityScore >= 30 ? "#f59e0b" : "#10b981" }}>
                <span className="text-xl font-black text-zinc-900 leading-none">{report.probabilityScore}%</span>
                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5 text-center">AI Prob</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex gap-4">
                  <span><strong>Confidence Match:</strong> <span className="px-1.5 py-0.5 bg-zinc-200 rounded text-[10px] font-bold">{report.confidenceRating}</span></span>
                  <span><strong>Audit Model Used:</strong> <span className="font-mono text-[10px] text-zinc-700">{student.modelUsed || "Gemini AI"}</span></span>
                </div>
                <p className="text-zinc-800 text-sm leading-relaxed pt-1 font-sans">
                  <strong>Verdict: </strong> {report.verdictSummary}
                </p>
                {student.analyzedFilename && (
                  <p className="text-[10px] text-zinc-500 font-mono">Analyzed Primary Source: {student.analyzedFilename}</p>
                )}
              </div>
            </div>

            {/* Academic Integrity Audit Signals */}
            {report.scoringSignals && report.scoringSignals.length > 0 && (
              <div className="border border-zinc-300 rounded-lg p-4 mb-6 bg-white">
                <h3 className="font-bold text-zinc-850 border-b pb-1.5 mb-3 uppercase tracking-wider text-[10px]">Academic Integrity Audit Signals Breakdown</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  {report.scoringSignals.map((sig, idx) => {
                    const score = sig.score;
                    const contribution = sig.contribution;
                    const weightPercent = Math.round(sig.weight * 100);
                    
                    return (
                      <div key={idx} className="border border-zinc-250 rounded p-2.5 bg-zinc-50/50">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-zinc-900">{sig.name}</span>
                          <span className="font-mono text-[10px] font-bold text-zinc-700">
                            {score}% (Contrib: +{contribution}%)
                          </span>
                        </div>
                        <div className="w-full bg-zinc-200 rounded-full h-1 mb-1.5 overflow-hidden">
                          <div 
                            className="bg-zinc-700 h-full" 
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <p className="text-zinc-550 text-[10px] leading-relaxed font-sans">{sig.evidence}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Findings Columns */}
            <div className="grid grid-cols-2 gap-5 text-xs mb-6">
              {/* Evidence Points */}
              <div className="border border-zinc-300 rounded-lg p-3.5 space-y-3 bg-white">
                <h3 className="font-bold text-zinc-850 border-b pb-1.5 uppercase tracking-wider text-[10px]">Stylistic Indicators ({report.evidencePoints.length})</h3>
                <div className="space-y-3">
                  {report.evidencePoints.map((pt, idx) => (
                    <div key={idx} className="border-b border-zinc-150 pb-2 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-zinc-900">{pt.type}</span>
                        <span className={`text-[8px] font-bold px-1 rounded border uppercase ${
                          pt.severity === "High Alert" ? "bg-red-50 text-red-700 border-red-200" :
                          pt.severity === "Medium Hint" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          pt.severity === "Style Quirk" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}>{pt.severity}</span>
                      </div>
                      <p className="text-zinc-655 text-[11px] leading-relaxed">{pt.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Code comparison */}
              <div className="border border-zinc-300 rounded-lg p-3.5 space-y-3 bg-white">
                <h3 className="font-bold text-zinc-850 border-b pb-1.5 uppercase tracking-wider text-[10px]">Code Signature Comparison</h3>
                <div className="space-y-3 text-[11px] leading-relaxed">
                  <div>
                    <span className="block font-bold text-red-700 uppercase text-[9px] tracking-wider">AI Coding Signatures Spotted</span>
                    <p className="text-zinc-650">{report.humanComparison.aiCharacteristics}</p>
                  </div>
                  <div>
                    <span className="block font-bold text-emerald-700 uppercase text-[9px] tracking-wider">Expected Human Student Equivalency</span>
                    <p className="text-zinc-650">{report.humanComparison.humanEquivalentStyle}</p>
                  </div>
                  <div>
                    <span className="block font-bold text-zinc-700 uppercase text-[9px] tracking-wider">Syntactic comment & Spacing Quirks</span>
                    <p className="text-zinc-655 italic">{report.humanComparison.styleQuirkNotes}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Commits Timeline */}
            {student.commits && student.commits.length > 0 && (
              <div className="border border-zinc-300 rounded-lg p-3.5 bg-white text-xs">
                <h3 className="font-bold text-zinc-850 border-b pb-1.5 mb-3 uppercase tracking-wider text-[10px]">GitHub timeline & Commit History</h3>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-250 text-zinc-655 font-bold bg-zinc-50 text-[10px]">
                      <th className="py-1 px-1.5">SHA</th>
                      <th className="py-1 px-1.5">Author</th>
                      <th className="py-1 px-1.5">Date</th>
                      <th className="py-1 px-1.5">Commit Message</th>
                      <th className="py-1 px-1.5 text-center">Lines Changed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-150 text-[10px]">
                    {student.commits.slice(0, 8).map((c, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50">
                        <td className="py-1.5 px-1.5 font-mono text-[9px] text-zinc-500">{c.sha.substring(0, 7)}</td>
                        <td className="py-1.5 px-1.5 font-medium text-zinc-800">{c.authorName}</td>
                        <td className="py-1.5 px-1.5 text-zinc-500">{c.authorDate ? new Date(c.authorDate).toLocaleDateString() : ""}</td>
                        <td className="py-1.5 px-1.5 text-zinc-750 font-semibold">{c.message}</td>
                        <td className="py-1.5 px-1.5 text-center font-mono">
                          {c.additions !== undefined && <span className="text-emerald-600">+{c.additions}</span>} / {c.deletions !== undefined && <span className="text-red-650 font-bold">-{c.deletions}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {student.commits.length > 8 && (
                  <p className="text-[9px] text-zinc-455 italic mt-2 text-right">Showing first 8 of {student.commits.length} commits.</p>
                )}
              </div>
            )}

            {/* Source Code Walkthrough Pages */}
            {student.files && student.files.length > 0 && (
              <div className="mt-6 border-t-2 border-zinc-800 pt-6 page-break">
                <h3 className="font-bold text-zinc-850 mb-4 uppercase tracking-wider text-[11px]">Source Code Walkthrough & Line Clues</h3>
                <div className="space-y-6">
                  {student.files.map((file, fIdx) => {
                    const lines = file.content ? file.content.split("\n") : [];
                    const isAnalyzed = file.path === student.analyzedFilename;

                    return (
                      <div key={file.path} className={`border border-zinc-350 rounded-lg overflow-hidden bg-zinc-50 p-2.5 mb-6 ${fIdx > 0 ? "page-break" : ""}`}>
                        <div className="flex justify-between items-center border-b border-zinc-200 pb-2 mb-3 px-1.5 bg-zinc-100/60">
                          <span className="font-mono text-xs font-bold text-zinc-900 truncate max-w-lg">File: {file.path}</span>
                          <span className="text-[9px] font-sans font-bold uppercase tracking-wider">
                            {isAnalyzed ? (
                              <span className="text-sky-600">Main Analyzed File</span>
                            ) : (
                              <span className="text-zinc-550">Source File</span>
                            )}
                          </span>
                        </div>

                        <div className="divide-y divide-zinc-150 bg-white border border-zinc-200 rounded overflow-hidden">
                          {lines.length === 0 ? (
                            <p className="text-[10px] text-zinc-450 italic p-3 text-center">Empty file content.</p>
                          ) : (
                            lines.map((line, idx) => {
                              const lineNum = idx + 1;
                              const ann = getAnnotationForLineInFile(lineNum, file);
                              const isLastLineOfAnnotation = ann && lineNum === ann.endLine;

                              let bgClass = "";
                              if (ann) {
                                bgClass = ann.isSuspicious 
                                  ? "bg-red-50/70 text-red-955 border-l-4 border-red-500" 
                                  : "bg-emerald-50/70 text-emerald-955 border-l-4 border-emerald-500";
                              } else {
                                bgClass = "border-l-4 border-transparent";
                              }

                              return (
                                <React.Fragment key={idx}>
                                  <div className={`flex items-stretch font-mono text-[9px] leading-snug py-0.5 ${bgClass}`}>
                                    <span className="w-8 text-right pr-2 text-zinc-400 select-none border-r border-zinc-200 shrink-0 font-sans">{lineNum}</span>
                                    <pre className="pl-2 whitespace-pre-wrap break-all flex-1 text-zinc-900">{line || " "}</pre>
                                  </div>
                                  {isLastLineOfAnnotation && (
                                    <div className={`my-2 p-3 rounded-lg border text-xs leading-relaxed mx-8 ${
                                      ann.isSuspicious 
                                        ? "bg-red-50 text-red-955 border-red-200" 
                                        : "bg-emerald-50 text-emerald-955 border-emerald-200"
                                    }`}>
                                      <div className="font-bold uppercase text-[9px] mb-1 tracking-wider">
                                        {ann.isSuspicious ? "⚠️ AI Stylistic Indicator" : "✅ Expected Human Trait"} (Lines {ann.startLine}-{ann.endLine})
                                      </div>
                                      <p className="font-sans font-medium text-zinc-800">{ann.commentary}</p>
                                      {ann.codeBlock && (
                                        <pre className="mt-2 p-1.5 bg-white/60 border border-zinc-200 rounded text-[9px] font-mono overflow-x-auto text-zinc-900">{ann.codeBlock}</pre>
                                      )}
                                    </div>
                                  )}
                                </React.Fragment>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
