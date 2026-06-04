import { useState } from "react";
import { Student, CodeFile, LineAnnotation, CommitInfo } from "../types";
import { fetchGithubFiles } from "../services/githubService";
import { analyzeCode, AnalyzeCodeParams, ApiKeys } from "../services/analysisService";
import { computeComprehensiveScore } from "../utils/scoring";

interface UseStudentAnalysisProps {
  mentor: any;
  githubToken: string;
  aiProvider: "gemini" | "grok" | "openai";
  geminiModel: string;
  updateStudent: (studentId: string, updates: Partial<Student>) => Promise<void>;
  setSelectedStudentId: (id: string | null) => void;
  setView: (view: "students" | "report" | "code") => void;
  setFinishedNotification: (notif: { name: string; rollNo: string; score: number } | null) => void;
}

export function useStudentAnalysis({
  mentor,
  githubToken,
  aiProvider,
  geminiModel,
  updateStudent,
  setSelectedStudentId,
  setView,
  setFinishedNotification,
}: UseStudentAnalysisProps) {
  const [isAnalyzingSandbox, setIsAnalyzingSandbox] = useState(false);
  const [isAnalyzingSingleFile, setIsAnalyzingSingleFile] = useState(false);

  // Perform Analysis for a Single Student Repo
  const handleAnalyzeStudent = async (student: Student, forceRefetch = false, preventRedirect = false) => {
    setSelectedStudentId(student.id);
    if (!preventRedirect) {
      setView("report");
    }
    try {
      let filesToUse = student.files || [];
      let commitsToUse = student.commits || [];
      
      // Step A: Fetch files from repo if non-existent or forced
      if (filesToUse.length === 0 || forceRefetch) {
        await updateStudent(student.id, { 
          status: "fetching", 
          errorMsg: null, 
          files: null, 
          activeReport: null 
        });

        const data = await fetchGithubFiles(student.githubUrl, githubToken || undefined);
        filesToUse = data.files;
        commitsToUse = data.commits || [];
        await updateStudent(student.id, { 
          status: "fetched", 
          files: filesToUse,
          commits: commitsToUse
        });
      }

      // Step B: Pick files to analyze and enforce context window limit (250k tokens ~ 200,000 characters)
      const eligibleForAnalysis = filesToUse.filter(f => {
        if (!f.content || f.content.trim().length === 0) return false;
        return f.content.trim().length > 30;
      });

      if (eligibleForAnalysis.length === 0) {
        throw new Error("No code files parsed containing content to analyze.");
      }

      let currentTotalChars = 0;
      const maxTotalChars = 200000;
      const filesToAnalyze: Array<{ path: string, content: string }> = [];

      for (const file of eligibleForAnalysis) {
        const fileLen = file.content.length;
        if (currentTotalChars + fileLen <= maxTotalChars) {
          filesToAnalyze.push({
            path: file.path,
            content: file.content
          });
          currentTotalChars += fileLen;
        } else {
          console.log(`Skipping file "${file.path}" (size: ${fileLen} chars) to respect the 250k token context window safety margin.`);
        }
      }

      if (filesToAnalyze.length === 0) {
        throw new Error("All code files exceeded the context size constraints.");
      }

      // Step C: Trigger Single Batch Analysis
      await updateStudent(student.id, { 
        status: "analyzing",
        errorMsg: `Auditing ${filesToAnalyze.length} repository code files...`
      });

      const geminiKey = mentor?.geminiApiKey || "";
      const grokKey = mentor?.grokApiKey || "";
      const openaiKey = mentor?.openaiApiKey || "";
      const keys: ApiKeys = { geminiKey, grokKey, openaiKey };

      const params: AnalyzeCodeParams = {
        provider: aiProvider,
        files: filesToAnalyze,
        studentName: student.name,
        rollNo: student.rollNo,
        modelName: geminiModel,
      };

      const reportData = await analyzeCode(params, keys);

      // Step D: Map report breakdowns back to individual files
      const updatedFiles = filesToUse.map(file => {
        const breakdown = reportData.fileBreakdowns?.find((b: any) => b.filePath === file.path);
        if (breakdown) {
          return {
            ...file,
            report: {
              probabilityScore: breakdown.probabilityScore,
              confidenceRating: breakdown.confidenceRating,
              verdictSummary: breakdown.verdictSummary,
              evidencePoints: breakdown.evidencePoints,
              lineAnnotations: breakdown.lineAnnotations,
              humanComparison: breakdown.humanComparison,
              analyzedAt: new Date().toISOString()
            }
          };
        }
        return file;
      });

      const analyzedFiles = updatedFiles.filter(f => f.report);
      const highestRiskFile = [...analyzedFiles].sort((a, b) => (b.report?.probabilityScore || 0) - (a.report?.probabilityScore || 0))[0];

      const aggregatedReport = {
        probabilityScore: reportData.probabilityScore,
        confidenceRating: reportData.confidenceRating,
        verdictSummary: reportData.verdictSummary,
        evidencePoints: reportData.evidencePoints,
        lineAnnotations: reportData.fileBreakdowns?.flatMap((b: any) => b.lineAnnotations || []) || [],
        humanComparison: reportData.humanComparison,
        analyzedAt: new Date().toISOString()
      };

      const tempStudent: Student = {
        ...student,
        files: updatedFiles,
        commits: commitsToUse
      };
      const finalReport = computeComprehensiveScore(tempStudent, aggregatedReport);

      let modelUsedLabel = "Gemini 3.5 Flash";
      if (aiProvider === "gemini") {
        modelUsedLabel = geminiModel === "gemini-3.5-flash" 
          ? "Gemini 3.5 Flash" 
          : geminiModel === "gemini-3.1-flash-lite"
            ? "Gemini 3.1 Flash Lite"
            : "Gemini 3.1 Pro";
      } else if (aiProvider === "grok") {
        modelUsedLabel = geminiModel === "grok-2-1212" ? "Grok 2" : "Grok Beta";
      } else {
        modelUsedLabel = geminiModel === "gpt-4o" ? "GPT-4o" : "GPT-4o mini";
      }

      await updateStudent(student.id, {
        status: "analyzed",
        analyzedFilename: highestRiskFile?.path || "multiple files",
        modelUsed: modelUsedLabel,
        errorMsg: null,
        files: updatedFiles,
        activeReport: finalReport
      });

      if (preventRedirect) {
        setFinishedNotification({
          name: student.name,
          rollNo: student.rollNo,
          score: finalReport.probabilityScore
        });
      }

    } catch (err: any) {
      console.error("Analysis failed:", err);
      await updateStudent(student.id, { 
        status: "error", 
        errorMsg: err.message || "An unpredictable error occurred" 
      });
    }
  };

  // Run Custom Pasteur Sandbox Analysis directly from Sandbox sub-panel
  const handleSandboxCodeAnalyze = async (selectedStudent: Student | null, filename: string, content: string) => {
    if (!selectedStudent) return;
    
    setIsAnalyzingSandbox(true);
    await updateStudent(selectedStudent.id, { 
      status: "analyzing", 
      errorMsg: null 
    });

    try {
      const geminiKey = mentor?.geminiApiKey || "";
      const grokKey = mentor?.grokApiKey || "";
      const openaiKey = mentor?.openaiApiKey || "";
      const keys: ApiKeys = { geminiKey, grokKey, openaiKey };

      const params: AnalyzeCodeParams = {
        provider: aiProvider,
        code: content,
        filename: filename,
        studentName: selectedStudent.name,
        rollNo: selectedStudent.rollNo,
        modelName: geminiModel,
      };

      const reportData = await analyzeCode(params, keys);
      
      const tempReport = {
        ...reportData,
        analyzedAt: new Date().toISOString()
      };

      const tempStudent: Student = {
        ...selectedStudent,
        files: [{ path: filename, content: content }],
        commits: selectedStudent.commits || []
      };

      const finalReport = computeComprehensiveScore(tempStudent, tempReport);

      const sandboxMockFile: CodeFile = {
        path: filename,
        content: content,
        report: finalReport
      };

      let modelUsedLabel = "Gemini 3.5 Flash";
      if (aiProvider === "gemini") {
        modelUsedLabel = geminiModel === "gemini-3.5-flash" 
          ? "Gemini 3.5 Flash" 
          : geminiModel === "gemini-3.1-flash-lite"
            ? "Gemini 3.1 Flash Lite"
            : "Gemini 3.1 Pro";
      } else if (aiProvider === "grok") {
        modelUsedLabel = geminiModel === "grok-2-1212" ? "Grok 2" : "Grok Beta";
      } else {
        modelUsedLabel = geminiModel === "gpt-4o" ? "GPT-4o" : "GPT-4o mini";
      }

      await updateStudent(selectedStudent.id, {
        status: "analyzed",
        files: [sandboxMockFile],
        analyzedFilename: filename,
        modelUsed: modelUsedLabel,
        errorMsg: null,
        activeReport: finalReport
      });
      
      setView("report");

    } catch (err: any) {
      console.error("Sandbox failure:", err);
      await updateStudent(selectedStudent.id, { 
        status: "error", 
        errorMsg: err.message || "Sandbox check encountered errors" 
      });
    } finally {
      setIsAnalyzingSandbox(false);
    }
  };

  // Run Audit on a single student file on-demand
  const handleSingleFileAnalyze = async (selectedStudent: Student | null, filePath: string) => {
    if (!selectedStudent) return;
    const fileToAnalyze = selectedStudent.files?.find(f => f.path === filePath);
    if (!fileToAnalyze) return;

    setIsAnalyzingSingleFile(true);
    try {
      const geminiKey = mentor?.geminiApiKey || "";
      const grokKey = mentor?.grokApiKey || "";
      const openaiKey = mentor?.openaiApiKey || "";
      const keys: ApiKeys = { geminiKey, grokKey, openaiKey };

      const params: AnalyzeCodeParams = {
        provider: aiProvider,
        code: fileToAnalyze.content,
        filename: fileToAnalyze.path,
        studentName: selectedStudent.name,
        rollNo: selectedStudent.rollNo,
        modelName: geminiModel,
      };

      const reportData = await analyzeCode(params, keys);
      
      const updatedFiles = (selectedStudent.files || []).map(file => {
        if (file.path === filePath) {
          return {
            ...file,
            report: {
              probabilityScore: reportData.probabilityScore,
              confidenceRating: reportData.confidenceRating,
              verdictSummary: reportData.verdictSummary,
              evidencePoints: reportData.evidencePoints,
              lineAnnotations: reportData.lineAnnotations,
              humanComparison: reportData.humanComparison,
              analyzedAt: new Date().toISOString()
            }
          };
        }
        return file;
      });

      const newEvidencePoints = (reportData.evidencePoints || []).map((pt: any) => ({
        ...pt,
        filePath: filePath
      }));

      let updatedActiveReport = selectedStudent.activeReport;
      if (updatedActiveReport) {
        const filteredEvidence = (updatedActiveReport.evidencePoints || []).filter(
          (pt: any) => pt.filePath !== filePath
        );
        const allAnnotations = updatedFiles.flatMap((f) => f.report?.lineAnnotations || []);
        
        const tempReport = {
          ...updatedActiveReport,
          evidencePoints: [...filteredEvidence, ...newEvidencePoints],
          lineAnnotations: allAnnotations,
        };

        const tempStudent: Student = {
          ...selectedStudent,
          files: updatedFiles,
          commits: selectedStudent.commits || []
        };

        updatedActiveReport = computeComprehensiveScore(tempStudent, tempReport);
      }

      await updateStudent(selectedStudent.id, {
        files: updatedFiles,
        activeReport: updatedActiveReport,
      });

    } catch (err: any) {
      console.error("Single-file analysis failure:", err);
      alert(err.message || "Single file audit check encountered errors.");
    } finally {
      setIsAnalyzingSingleFile(false);
    }
  };

  return {
    isAnalyzingSandbox,
    isAnalyzingSingleFile,
    handleAnalyzeStudent,
    handleSandboxCodeAnalyze,
    handleSingleFileAnalyze,
  };
}
