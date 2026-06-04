import React, { useState, useEffect } from "react";
import { Student, CodeFile, LineAnnotation } from "./types";
import StudentList from "./components/StudentList";
import ReportViewer from "./components/ReportViewer";
import CodeInspector from "./components/CodeInspector";
import TokenSettings from "./components/TokenSettings";
import LoginPage from "./components/LoginPage";
import { useFirebase } from "./components/FirebaseProvider";
import OnboardingTutorial from "./components/OnboardingTutorial";
import { secureKey, resolveKey } from "./utils/crypto";
import { 
  Sparkles, 
  ShieldCheck, 
  BookOpen, 
  Layers,
  AlertCircle,
  Code2,
  Gauge,
  Menu,
  X,
  CheckCircle
} from "lucide-react";

export default function App() {
  const {
    user,
    mentor,
    loading,
    students,
    loginWithGoogle,
    logout,
    saveGeminiApiKey,
    saveOpenaiApiKey,
    saveGrokApiKey,
    saveTutorialCompleted,
    updateStudent,
  } = useFirebase();

  const handleSaveOnboardingKeys = async (keys: { geminiKey: string; githubToken: string; grokKey: string; openaiKey: string }) => {
    await saveGeminiApiKey(keys.geminiKey);
    await saveGrokApiKey(keys.grokKey);
    await saveOpenaiApiKey(keys.openaiKey);
    setGithubToken(keys.githubToken);
    if (user?.uid) {
      const encryptedGithub = secureKey(keys.githubToken, user.uid);
      localStorage.setItem("github_pat_token", encryptedGithub);
    } else {
      localStorage.setItem("github_pat_token", keys.githubToken);
    }
  };

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [githubToken, setGithubToken] = useState<string>("");
  const [aiProvider, setAiProvider] = useState<"gemini" | "grok" | "openai">("gemini");
  const [geminiModel, setGeminiModel] = useState<string>("gemini-3.1-flash-lite");
  const [view, setView] = useState<"students" | "report" | "code">("students");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAnalyzingSandbox, setIsAnalyzingSandbox] = useState(false);
  const [isAnalyzingSingleFile, setIsAnalyzingSingleFile] = useState(false);
  const [printTarget, setPrintTarget] = useState<{ type: "single" | "all"; studentId?: string } | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string>("");
  const [finishedNotification, setFinishedNotification] = useState<{ name: string; rollNo: string; score: number } | null>(null);

  const handleSelectStudent = (id: string | null) => {
    setSelectedStudentId(id);
    if (id) {
      setView("report");
    }
  };

  useEffect(() => {
    if (printTarget) {
      const timer = setTimeout(() => {
        window.print();
        setPrintTarget(null);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [printTarget]);

  // Mouse-following halo tracker
  useEffect(() => {
    const halo = document.getElementById("mouse-halo");
    if (!halo) return;

    let lastX = 0;
    let lastY = 0;
    let rafId: number;

    const handleMouseMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      
      cancelAnimationFrame(rafId);
      
      rafId = requestAnimationFrame(() => {
        halo.style.transform = `translate3d(${lastX}px, ${lastY}px, 0)`;
        halo.style.opacity = "1";
      });
    };

    const handleMouseLeave = () => {
      halo.style.opacity = "0";
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(rafId);
    };
  }, [user, loading, mentor?.tutorialCompleted]);

  // Load custom GitHub Token from local storage on auth change
  useEffect(() => {
    if (user?.uid) {
      const savedToken = localStorage.getItem("github_pat_token");
      if (savedToken) {
        setGithubToken(resolveKey(savedToken, user.uid));
      } else {
        setGithubToken("");
      }
    } else {
      setGithubToken("");
    }
  }, [user?.uid]);

  // Set default selected student when student list loads or changes
  useEffect(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].id);
    }
  }, [students, selectedStudentId]);

  const selectedStudent = students.find((s) => s.id === selectedStudentId) || null;
  const currentStudentIndex = students.findIndex((s) => s.id === selectedStudentId);

  const handlePrevStudent = () => {
    if (currentStudentIndex > 0) {
      setSelectedStudentId(students[currentStudentIndex - 1].id);
    }
  };

  const handleNextStudent = () => {
    if (currentStudentIndex >= 0 && currentStudentIndex < students.length - 1) {
      setSelectedStudentId(students[currentStudentIndex + 1].id);
    }
  };

  // Set default selected file path when selected student changes
  useEffect(() => {
    if (selectedStudent && selectedStudent.files && selectedStudent.files.length > 0) {
      setSelectedFilePath(selectedStudent.files[0].path);
    } else {
      setSelectedFilePath("");
    }
  }, [selectedStudentId, selectedStudent?.files?.length]);

  // Helper inside App to search relevant files for analysis
  const findPrimeFile = (files: CodeFile[]): CodeFile | null => {
    if (!files || files.length === 0) return null;
    
    // Priority extension matches
    const preferredExtensions = [".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".cpp", ".cs"];
    
    // Filter down
    const codeFiles = files.filter(f => {
      const path = f.path.toLowerCase();
      return preferredExtensions.some(ext => path.endsWith(ext));
    });

    if (codeFiles.length > 0) {
      // Find one with reasonable size, avoid massive config or setup files if possible
      const reasonable = codeFiles.find(f => {
        const path = f.path.toLowerCase();
        return !path.includes("config") && !path.includes("test") && (f.content || "").length > 400;
      });
      return reasonable || codeFiles[0];
    }

    return files[0];
  };

  // Perform Analysis for a Single Student Repo
  const handleAnalyzeStudent = async (student: Student, forceRefetch = false, preventRedirect = false) => {
    setSelectedStudentId(student.id);
    if (!preventRedirect) {
      setView("report");
    }
    try {
      let filesToUse = student.files || [];
      
      // Step A: Fetch files from repo if non-existent or forced
      if (filesToUse.length === 0 || forceRefetch) {
        await updateStudent(student.id, { 
          status: "fetching", 
          errorMsg: null, 
          files: null, 
          activeReport: null 
        });

        const res = await fetch("/api/github/fetch-files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            repoUrl: student.githubUrl, 
            token: githubToken || undefined 
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `GitHub Retrieval Failed (Status ${res.status})`);
        }

        const data = await res.json();
        if (!data.success || !data.files || data.files.length === 0) {
          throw new Error(data.message || "No suitable code source files retrieved from public folders.");
        }

        filesToUse = data.files;
        await updateStudent(student.id, { 
          status: "fetched", 
          files: filesToUse,
          commits: data.commits || []
        });
      }

      // Step B: Pick files to analyze and enforce context window limit (250k tokens ~ 200,000 characters)
      const eligibleForAnalysis = filesToUse.filter(f => {
        if (!f.content || f.content.trim().length === 0) return false;
        // Avoid tiny files with less than 30 characters
        return f.content.trim().length > 30;
      });

      if (eligibleForAnalysis.length === 0) {
        throw new Error("No code files parsed containing content to analyze.");
      }

      let currentTotalChars = 0;
      const maxTotalChars = 200000; // Safe threshold for 250k context token limit
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

      const analyzeRes = await fetch("/api/analyze/code", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-gemini-api-key": geminiKey,
          "x-grok-api-key": grokKey,
          "x-openai-api-key": openaiKey
        },
        body: JSON.stringify({
          provider: aiProvider,
          files: filesToAnalyze,
          studentName: student.name,
          rollNo: student.rollNo,
          modelName: geminiModel,
        }),
      });

      if (!analyzeRes.ok) {
        const errBody = await analyzeRes.json().catch(() => ({}));
        throw new Error(errBody.error || `Batch analysis failed: ${analyzeRes.statusText}`);
      }

      const reportData = await analyzeRes.json();

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

      // Find highest risk file for display and default focus
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
        activeReport: aggregatedReport
      });

      if (preventRedirect) {
        setFinishedNotification({
          name: student.name,
          rollNo: student.rollNo,
          score: reportData.probabilityScore
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

  // Perform Batch Trigger on all Loaded Student Repositories
  const handleAnalyzeAll = async () => {
    const pendingStudents = students.filter(s => s.status !== "analyzing" && s.status !== "fetching");
    for (const student of pendingStudents) {
      await handleAnalyzeStudent(student, false);
    }
  };

  // Run Custom Pasteur Sandbox Analysis directly from Sandbox sub-panel
  const handleSandboxCodeAnalyze = async (filename: string, content: string) => {
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

      const analyzeRes = await fetch("/api/analyze/code", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-gemini-api-key": geminiKey,
          "x-grok-api-key": grokKey,
          "x-openai-api-key": openaiKey
        },
        body: JSON.stringify({
          provider: aiProvider,
          code: content,
          filename: filename,
          studentName: selectedStudent.name,
          rollNo: selectedStudent.rollNo,
          modelName: geminiModel,
        }),
      });

      if (!analyzeRes.ok) {
        const errBody = await analyzeRes.json().catch(() => ({}));
        throw new Error(errBody.error || `Analysis failed: ${analyzeRes.statusText}`);
      }

      const reportData = await analyzeRes.json();
      
      // Cache this code content into sandbox mock file
      const sandboxMockFile: CodeFile = {
        path: filename,
        content: content,
        report: {
          ...reportData,
          analyzedAt: new Date().toISOString()
        }
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
        activeReport: {
          ...reportData,
          analyzedAt: new Date().toISOString()
        }
      });
      
      // Auto switch back to report tab on successful sandbox test
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
  const handleSingleFileAnalyze = async (filePath: string) => {
    if (!selectedStudent) return;
    const fileToAnalyze = selectedStudent.files?.find(f => f.path === filePath);
    if (!fileToAnalyze) return;

    setIsAnalyzingSingleFile(true);
    try {
      const geminiKey = mentor?.geminiApiKey || "";
      const grokKey = mentor?.grokApiKey || "";
      const openaiKey = mentor?.openaiApiKey || "";

      const analyzeRes = await fetch("/api/analyze/code", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-gemini-api-key": geminiKey,
          "x-grok-api-key": grokKey,
          "x-openai-api-key": openaiKey
        },
        body: JSON.stringify({
          provider: aiProvider,
          code: fileToAnalyze.content,
          filename: fileToAnalyze.path,
          studentName: selectedStudent.name,
          rollNo: selectedStudent.rollNo,
          modelName: geminiModel,
        }),
      });

      if (!analyzeRes.ok) {
        const errBody = await analyzeRes.json().catch(() => ({}));
        throw new Error(errBody.error || `Analysis failed: ${analyzeRes.statusText}`);
      }

      const reportData = await analyzeRes.json();
      
      // Update this file's report
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

      // Prepare newly mapped evidence points with filePath
      const newEvidencePoints = (reportData.evidencePoints || []).map((pt: any) => ({
        ...pt,
        filePath: filePath
      }));

      // Rebuild overall activeReport to merge evidence and annotations
      let updatedActiveReport = selectedStudent.activeReport;
      if (updatedActiveReport) {
        const filteredEvidence = (updatedActiveReport.evidencePoints || []).filter(
          (pt: any) => pt.filePath !== filePath
        );
        const allAnnotations = updatedFiles.flatMap((f) => f.report?.lineAnnotations || []);
        
        updatedActiveReport = {
          ...updatedActiveReport,
          evidencePoints: [...filteredEvidence, ...newEvidencePoints],
          lineAnnotations: allAnnotations,
        };
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

  // Core Loading view
  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center font-mono">
        <span className="inline-block animate-spin border-2 border-sky-400 border-t-transparent w-8 h-8 rounded-full mb-4" />
        <span className="text-zinc-550 text-xs">Synchronizing Academic Workspace Securely...</span>
      </div>
    );
  }

  // Core LoginPage gating auth state
  if (!user) {
    return <LoginPage onLogin={loginWithGoogle} />;
  }

  // Onboarding Wizard gating tutorial state
  if (mentor && mentor.tutorialCompleted !== true) {
    return (
      <OnboardingTutorial 
        onSaveKeys={handleSaveOnboardingKeys} 
        onComplete={() => saveTutorialCompleted(true)} 
        onSignOut={logout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans relative overflow-hidden">
      {/* Mouse Halo */}
      <div id="mouse-halo" className="opacity-0 no-print" />

      {/* Decorative ambient background glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-500/10 rounded-full blur-[120px] pointer-events-none no-print" />
      <div className="absolute -bottom-45 -right-45 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none no-print" />

      <div className="no-print flex-1 flex flex-col relative z-10">
        {/* 1. Header Area with Google Auth Identity Management */}
        <header className="bg-zinc-950/80 border-b border-white/10 sticky top-0 z-10 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="font-display font-bold text-white text-lg leading-tight tracking-tight flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-sky-400" />
                  <span>SENTINEL AI <span className="opacity-80 font-normal">Academic</span></span>
                </h1>
                <p className="text-zinc-550 text-[10px] mt-0.5 font-mono tracking-wider uppercase">High-Fidelity Code Audit Dashboard</p>
              </div>
            </div>

            <button
              onClick={() => setIsMenuOpen(true)}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-350 rounded-full transition-colors cursor-pointer shrink-0"
              title="API Config & Settings"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* 2. Educational Tip (Minimal Banner) */}
        <section className="bg-zinc-955/20 text-zinc-400 py-2 px-4 border-b border-white/10 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[11px] tracking-wide">
            <div className="flex items-start md:items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
              <p>
                <span className="font-semibold text-sky-400">Roster Check:</span> Import Excel file roster &bull; Scan repositories &bull; View AI probability report details.
              </p>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              Secure Isolated Sandbox Active
            </span>
          </div>
        </section>

        {/* 3. Main Dashboard Workspace Layout */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col min-h-0">
          {view === "students" && (
            /* Page 1: Roster and Settings (Full Width Spacious) */
            <div className="w-full flex-1 flex flex-col min-h-[500px] animate-fadeIn">
              <StudentList
                students={students}
                selectedStudentId={selectedStudentId}
                setSelectedStudentId={handleSelectStudent}
                onAnalyzeStudent={handleAnalyzeStudent}
                onAnalyzeAll={handleAnalyzeAll}
                onPrintAll={() => setPrintTarget({ type: "all" })}
              />
            </div>
          )}

          {view === "report" && (
            /* Page 2: Forensic Report Page */
            <div className="max-w-5xl w-full mx-auto space-y-6 animate-fadeIn">
              {/* Report Sub-Navbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 apple-glass p-4 rounded-xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => setView("students")}
                    className="py-1.5 px-3 border border-white/10 hover:bg-white/5 text-zinc-350 bg-zinc-950 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer text-xs font-semibold focus:outline-none focus:ring-0"
                  >
                    ← Back to Classroom Roster
                  </button>
                  
                  {students.length > 1 && (
                    <>
                      <span className="text-zinc-700">|</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handlePrevStudent}
                          disabled={currentStudentIndex <= 0}
                          className="py-1.5 px-2.5 border border-white/10 hover:bg-white/5 text-zinc-350 bg-zinc-950 rounded-lg disabled:opacity-30 disabled:hover:bg-zinc-950 transition-colors cursor-pointer text-xs font-semibold focus:outline-none focus:ring-0"
                          title="Previous Student"
                        >
                          ◀ Prev
                        </button>
                        <span className="text-[10px] text-zinc-500 font-mono px-1">
                          {currentStudentIndex + 1} / {students.length}
                        </span>
                        <button
                          onClick={handleNextStudent}
                          disabled={currentStudentIndex < 0 || currentStudentIndex >= students.length - 1}
                          className="py-1.5 px-2.5 border border-white/10 hover:bg-white/5 text-zinc-300 bg-zinc-950 rounded-lg disabled:opacity-30 disabled:hover:bg-zinc-950 transition-colors cursor-pointer text-xs font-semibold focus:outline-none focus:ring-0"
                          title="Next Student"
                        >
                          Next ▶
                        </button>
                      </div>
                    </>
                  )}

                  <span className="text-zinc-700">|</span>
                  <span className="text-xs text-zinc-400">
                    Active Student: <strong className="text-white font-semibold">{selectedStudent?.name}</strong> {selectedStudent?.rollNo && `(Roll: ${selectedStudent.rollNo})`}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {selectedStudent && selectedStudent.status === "analyzed" && (
                    <button
                      onClick={() => setView("code")}
                      className="py-1.5 px-4 bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer focus:outline-none"
                    >
                      Inspect Source Code →
                    </button>
                  )}
                </div>
              </div>

              {/* Report Frame Content */}
              {selectedStudent ? (
                selectedStudent.status === "analyzed" && selectedStudent.activeReport ? (
                  <div key={selectedStudent.id} className="animate-fadeIn">
                    <ReportViewer
                      student={selectedStudent}
                      report={selectedStudent.activeReport}
                      onPrint={() => setPrintTarget({ type: "single", studentId: selectedStudent.id })}
                      onViewFileInInspector={(filePath) => {
                        setSelectedFilePath(filePath);
                        setView("code");
                      }}
                    />
                  </div>
                ) : (
                  /* Setup audit prompt if student is not analyzed yet */
                  <div className="bg-zinc-900 border border-white/10 rounded-xl p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[400px] shadow-lg space-y-6">
                    <div className="p-4 bg-white/5 text-zinc-400 rounded-full border border-white/10">
                      <Code2 className="w-8 h-8" />
                    </div>
                    
                    <div className="space-y-2 max-w-md mx-auto">
                      <h2 className="font-display font-bold text-white text-xl tracking-tight leading-tight">Unchecked Student Repository</h2>
                      <p className="text-zinc-400 text-sm leading-relaxed font-light">
                        We haven't parsed the repositories or completed style inspections for <strong className="text-zinc-300">{selectedStudent.name}</strong> yet. Press below to fetch public source files and verify coding behavior.
                      </p>
                    </div>

                    {selectedStudent.errorMsg && (
                      <div className="max-w-lg p-3 bg-rose-955/20 border border-rose-500/20 text-rose-300 text-xs rounded-lg text-left flex items-start gap-2 mx-auto">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                        <div>
                          <span className="font-bold">Status: </span>
                          {selectedStudent.errorMsg}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2.5 justify-center pt-2">
                      <button
                        id="primary-analyze-btn"
                        onClick={() => handleAnalyzeStudent(selectedStudent, true)}
                        disabled={selectedStudent.status === "fetching" || selectedStudent.status === "analyzing"}
                        className="py-2 px-5 bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:bg-zinc-800 disabled:text-zinc-500 shadow shadow-sky-500/20 focus:outline-none"
                      >
                        {selectedStudent.status === "fetching" || selectedStudent.status === "analyzing" ? (
                          <>
                            <span className="inline-block animate-spin border-2 border-white border-t-transparent w-3.5 h-3.5 rounded-full" />
                            <span>Scanning Files...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Run Gemini AI Code Audit</span>
                          </>
                        )}
                      </button>
                      
                      <button
                        id="fallback-paste-tab-btn"
                        onClick={() => {
                          setView("code");
                          // Also default sandbox mode if empty
                          setSelectedFilePath("");
                        }}
                        className="py-2 px-4 font-semibold text-xs border border-white/10 text-zinc-300 rounded-lg hover:bg-white/5 transition-all bg-zinc-950 cursor-pointer"
                      >
                        Manual Code Sandbox
                      </button>
                    </div>
                  </div>
                )
              ) : (
                /* No student active */
                <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
                  <Layers className="w-10 h-10 text-zinc-600 mb-2 animate-bounce" />
                  <p className="text-zinc-400 text-sm">Please select a student from the roster list to view their integrity report.</p>
                  <button
                    onClick={() => setView("students")}
                    className="mt-4 py-1.5 px-3 bg-zinc-950 hover:bg-zinc-900 border border-white/10 text-zinc-350 rounded-lg text-xs cursor-pointer"
                  >
                    Go to Classroom Roster
                  </button>
                </div>
              )}
            </div>
          )}

          {view === "code" && (
            /* Page 3: Code Inspector Page */
            <div className="w-full space-y-6 animate-fadeIn">
              {/* Code Inspector Sub-Navbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 apple-glass p-4 rounded-xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  {selectedStudent && selectedStudent.status === "analyzed" && (
                    <button
                      onClick={() => setView("report")}
                      className="py-1.5 px-3 border border-white/10 hover:bg-white/5 text-zinc-350 bg-zinc-950 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer text-xs font-semibold focus:outline-none focus:ring-0"
                    >
                      ← Back to Forensic Report
                    </button>
                  )}
                  <button
                    onClick={() => setView("students")}
                    className="py-1.5 px-3 border border-white/10 hover:bg-white/5 text-zinc-350 bg-zinc-950 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer text-xs font-semibold focus:outline-none focus:ring-0"
                  >
                    Classroom Roster
                  </button>

                  {students.length > 1 && (
                    <>
                      <span className="text-zinc-700">|</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handlePrevStudent}
                          disabled={currentStudentIndex <= 0}
                          className="py-1.5 px-2.5 border border-white/10 hover:bg-white/5 text-zinc-350 bg-zinc-950 rounded-lg disabled:opacity-30 disabled:hover:bg-zinc-950 transition-colors cursor-pointer text-xs font-semibold focus:outline-none focus:ring-0"
                          title="Previous Student"
                        >
                          ◀ Prev
                        </button>
                        <span className="text-[10px] text-zinc-500 font-mono px-1">
                          {currentStudentIndex + 1} / {students.length}
                        </span>
                        <button
                          onClick={handleNextStudent}
                          disabled={currentStudentIndex < 0 || currentStudentIndex >= students.length - 1}
                          className="py-1.5 px-2.5 border border-white/10 hover:bg-white/5 text-zinc-300 bg-zinc-950 rounded-lg disabled:opacity-30 disabled:hover:bg-zinc-950 transition-colors cursor-pointer text-xs font-semibold focus:outline-none focus:ring-0"
                          title="Next Student"
                        >
                          Next ▶
                        </button>
                      </div>
                    </>
                  )}

                  <span className="text-zinc-700">|</span>
                  <span className="text-xs text-zinc-400">
                    Inspecting Code: <strong className="text-white font-semibold">{selectedStudent?.name}</strong>
                  </span>
                </div>
              </div>

              {/* Code Inspector Content Wrapper */}
              {selectedStudent ? (
                <div key={selectedStudent.id} className="h-[650px] animate-fadeIn">
                  <CodeInspector
                    student={selectedStudent}
                    onCodeAnalyze={handleSandboxCodeAnalyze}
                    isAnalyzing={isAnalyzingSandbox}
                    selectedFilePath={selectedFilePath}
                    setSelectedFilePath={setSelectedFilePath}
                    onSingleFileAnalyze={handleSingleFileAnalyze}
                    isAnalyzingSingleFile={isAnalyzingSingleFile}
                  />
                </div>
              ) : (
                <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
                  <Layers className="w-10 h-10 text-zinc-600 mb-2" />
                  <p className="text-zinc-400 text-sm">Please select a student from the roster list to view their code.</p>
                  <button
                    onClick={() => setView("students")}
                    className="mt-4 py-1.5 px-3 bg-zinc-950 hover:bg-zinc-900 border border-white/10 text-zinc-350 rounded-lg text-xs cursor-pointer"
                  >
                    Go to Classroom Roster
                  </button>
                </div>
              )}
            </div>
          )}
        </main>

        {/* 4. Professional footer with explicit credits requested by the user */}
        <footer className="bg-zinc-950 border-t border-white/10 py-5 mt-auto">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-[10px] text-zinc-550 font-mono tracking-wide">
            <span>AI Code Detector &bull; Powered by Google Gemini &bull; Secure Academic Cloud Suite</span>
            <a 
              href="https://github.com/ayush-uttam"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-sky-455 font-semibold px-2.5 py-1 bg-white/5 rounded-full border border-white/10 sm:self-center transition-colors cursor-pointer"
            >
              Vibe coded by Ayush Uttam xD
            </a>
          </div>
        </footer>
      </div>

      {/* Slide-over settings drawer */}
      <div className={`fixed inset-0 z-55 flex justify-end no-print ${
        isMenuOpen ? "pointer-events-auto" : "pointer-events-none"
      }`}>
        {/* Backdrop overlay */}
        <div 
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm ${
            isMenuOpen ? "opacity-100 drawer-backdrop-in" : "opacity-0 drawer-backdrop-out"
          }`}
          onClick={() => setIsMenuOpen(false)}
        />
        
        {/* Drawer body */}
        <div className={`relative w-full max-w-md apple-glass border-l border-white/10 p-6 flex flex-col gap-6 shadow-2xl h-full overflow-y-auto transform ${
          isMenuOpen ? "translate-x-0 drawer-body-in" : "translate-x-full drawer-body-out"
        }`}>
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-white font-display font-bold text-lg">System Configuration</h2>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white rounded-full transition-colors cursor-pointer focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Authenticated Identity Badge */}
          <div className="flex items-center justify-between bg-zinc-900 border border-white/10 p-3 rounded-xl shadow-inner">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img 
                  referrerPolicy="no-referrer" 
                  src={user.photoURL} 
                  alt="Avatar" 
                  className="w-8 h-8 rounded-full border border-white/10 object-cover shrink-0" 
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center justify-center text-xs font-bold font-mono shrink-0">
                  {String(user.email || 'M')[0].toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-xs text-white font-semibold max-w-[150px] truncate leading-tight">{user.displayName || user.email}</p>
                <p className="text-[9px] text-zinc-500 font-mono mt-0.5">Authorized Mentor</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="py-1 px-3 bg-zinc-950 hover:bg-zinc-800 border border-white/10 text-zinc-450 hover:text-zinc-300 text-[10px] font-bold rounded-full transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
          
          <TokenSettings
            githubToken={githubToken}
            setGithubToken={setGithubToken}
            geminiModel={geminiModel}
            setGeminiModel={setGeminiModel}
            customGeminiKey={mentor?.geminiApiKey || ""}
            onSaveCustomGeminiKey={saveGeminiApiKey}
            aiProvider={aiProvider}
            setAiProvider={setAiProvider}
            customGrokKey={mentor?.grokApiKey || ""}
            onSaveCustomGrokKey={saveGrokApiKey}
            customOpenaiKey={mentor?.openaiApiKey || ""}
            onSaveCustomOpenaiKey={saveOpenaiApiKey}
          />
        </div>
      </div>

      {printTarget && (
        <div id="print-report-root" className="print-only">
          <PrintReportLayout students={students} target={printTarget} />
        </div>
      )}

      {/* Finished Assessment Toast Dialog */}
      {finishedNotification && (
        <div className="fixed bottom-6 right-6 z-55 max-w-sm w-full bg-zinc-950/95 border border-white/10 p-4 rounded-xl shadow-2xl backdrop-blur-md animate-slideIn no-print">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-450 shrink-0">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-white font-semibold text-xs leading-tight">Assessment Completed</h4>
                <p className="text-[11px] text-zinc-450 mt-0.5 leading-snug">
                  Analysis completed for <strong className="text-zinc-200">{finishedNotification.name}</strong> {finishedNotification.rollNo && `(Roll: ${finishedNotification.rollNo})`}.
                </p>
                <span className="inline-block text-[10px] text-sky-400 font-semibold mt-1 font-mono">
                  Verdict Score: {finishedNotification.score}% AI
                </span>
              </div>
            </div>
            <button
              onClick={() => setFinishedNotification(null)}
              className="p-1 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full transition-colors cursor-pointer shrink-0 focus:outline-none"
              title="Close Notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Print layout component for PDF reports
function PrintReportLayout({ students, target }: { students: Student[], target: { type: "single" | "all"; studentId?: string } }) {
  const studentsToPrint = target.type === "single"
    ? students.filter(s => s.id === target.studentId)
    : students.filter(s => s.status === "analyzed");

  const total = students.length;
  const analyzed = students.filter(s => s.status === "analyzed");
  const averageProbability = analyzed.length > 0
    ? Math.round(analyzed.reduce((acc, s) => acc + (s.activeReport?.probabilityScore || 0), 0) / analyzed.length)
    : 0;
  const highRisk = analyzed.filter(s => s.activeReport && s.activeReport.probabilityScore >= 70).length;
  const mediumRisk = analyzed.filter(s => s.activeReport && s.activeReport.probabilityScore >= 30 && s.activeReport.probabilityScore < 70).length;
  const lowRisk = analyzed.filter(s => s.activeReport && s.activeReport.probabilityScore < 30).length;

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
              <span className="text-lg font-bold text-sky-600">{analyzed.length}</span>
            </div>
            <div className="border border-zinc-350 p-3 rounded-lg bg-zinc-50">
              <span className="block text-[10px] text-zinc-500 font-semibold uppercase">Average AI Risk</span>
              <span className="text-lg font-bold text-zinc-800">{averageProbability}%</span>
            </div>
            <div className="border border-zinc-350 p-3 rounded-lg bg-zinc-50">
              <span className="block text-[10px] text-zinc-500 font-semibold uppercase">High Risk Alerts</span>
              <span className="text-lg font-bold text-red-650">{highRisk}</span>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xs font-bold text-zinc-800 mb-3 uppercase tracking-wider">Classroom Risk Distribution</h2>
            <div className="flex h-3.5 rounded-full overflow-hidden bg-zinc-100 mb-2 border border-zinc-300">
              <div style={{ width: `${total ? (highRisk/total)*100 : 0}%` }} className="bg-red-500"></div>
              <div style={{ width: `${total ? (mediumRisk/total)*100 : 0}%` }} className="bg-amber-500"></div>
              <div style={{ width: `${total ? (lowRisk/total)*100 : 0}%` }} className="bg-emerald-500"></div>
              <div style={{ width: `${total ? ((total - analyzed.length)/total)*100 : 0}%` }} className="bg-zinc-300"></div>
            </div>
            <div className="flex gap-4 text-[10px] text-zinc-600 justify-center">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-500 rounded-full inline-block"></span> High Risk ({highRisk})</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-500 rounded-full inline-block"></span> Medium Risk ({mediumRisk})</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block"></span> Low Risk ({lowRisk})</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-zinc-300 rounded-full inline-block"></span> Unaudited ({total - analyzed.length})</span>
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

            {/* Findings Columns */}
            <div className="grid grid-cols-2 gap-5 text-xs mb-6">
              {/* Evidence Points */}
              <div className="border border-zinc-300 rounded-lg p-3.5 space-y-3 bg-white">
                <h3 className="font-bold text-zinc-800 border-b pb-1.5 uppercase tracking-wider text-[10px]">Stylistic Indicators ({report.evidencePoints.length})</h3>
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
                      <p className="text-zinc-650 text-[11px] leading-relaxed">{pt.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Code comparison */}
              <div className="border border-zinc-300 rounded-lg p-3.5 space-y-3 bg-white">
                <h3 className="font-bold text-zinc-800 border-b pb-1.5 uppercase tracking-wider text-[10px]">Code Signature Comparison</h3>
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
                <h3 className="font-bold text-zinc-800 border-b pb-1.5 mb-3 uppercase tracking-wider text-[10px]">GitHub timeline & Commit History</h3>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-250 text-zinc-600 font-bold bg-zinc-50 text-[10px]">
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
                  <p className="text-[9px] text-zinc-450 italic mt-2 text-right">Showing first 8 of {student.commits.length} commits.</p>
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
                                  ? "bg-red-50/70 text-red-950 border-l-4 border-red-500" 
                                  : "bg-emerald-50/70 text-emerald-950 border-l-4 border-emerald-500";
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
                                        ? "bg-red-50 text-red-950 border-red-200" 
                                        : "bg-emerald-50 text-emerald-950 border-emerald-200"
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

// Low level spinner component
function Loader2(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
