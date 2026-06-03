import React, { useState, useEffect } from "react";
import { Student, CodeFile } from "./types";
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
  Gauge
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
    saveTutorialCompleted,
    updateStudent,
  } = useFirebase();

  const handleSaveOnboardingKeys = async (keys: { geminiKey: string; githubToken: string; openaiKey: string }) => {
    await saveGeminiApiKey(keys.geminiKey);
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
  const [aiProvider, setAiProvider] = useState<"gemini" | "openai">("gemini");
  const [geminiModel, setGeminiModel] = useState<string>("gemini-3.1-flash-lite");
  const [activeTab, setActiveTab] = useState<"report" | "code">("report");
  const [isAnalyzingSandbox, setIsAnalyzingSandbox] = useState(false);

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
  const handleAnalyzeStudent = async (student: Student, forceRefetch = false) => {
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

      // Step B: Pick primary code file candidate
      const primeFile = findPrimeFile(filesToUse);
      if (!primeFile) {
        throw new Error("No code files parsed matching standard programming languages (JavaScript, Python, Java etc.)");
      }

      // Step C: Trigger Analysis
      await updateStudent(student.id, { 
        status: "analyzing",
        errorMsg: null
      });

      const geminiKey = mentor?.geminiApiKey || "";
      const openaiKey = mentor?.openaiApiKey || "";

      const analyzeRes = await fetch("/api/analyze/code", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-gemini-api-key": geminiKey,
          "x-openai-api-key": openaiKey
        },
        body: JSON.stringify({
          provider: aiProvider,
          code: primeFile.content,
          filename: primeFile.path,
          studentName: student.name,
          rollNo: student.rollNo,
          modelName: geminiModel,
        }),
      });

      if (!analyzeRes.ok) {
        const errBody = await analyzeRes.json().catch(() => ({}));
        throw new Error(errBody.error || `Analysis failed: ${analyzeRes.statusText}`);
      }

      const reportData = await analyzeRes.json();
      
      let modelUsedLabel = "Gemini 3.5 Flash";
      if (aiProvider === "gemini") {
        modelUsedLabel = geminiModel === "gemini-3.5-flash" 
          ? "Gemini 3.5 Flash" 
          : geminiModel === "gemini-3.1-flash-lite"
            ? "Gemini 3.1 Flash Lite"
            : "Gemini 3.1 Pro";
      } else {
        modelUsedLabel = geminiModel === "gpt-4o-mini" ? "GPT-4o mini" : "GPT-4o";
      }

      await updateStudent(student.id, {
        status: "analyzed",
        analyzedFilename: primeFile.path,
        modelUsed: modelUsedLabel,
        errorMsg: null,
        activeReport: {
          ...reportData,
          analyzedAt: new Date().toISOString()
        }
      });

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
      const openaiKey = mentor?.openaiApiKey || "";

      const analyzeRes = await fetch("/api/analyze/code", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-gemini-api-key": geminiKey,
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
        content: content
      };

      let modelUsedLabel = "Gemini 3.5 Flash";
      if (aiProvider === "gemini") {
        modelUsedLabel = geminiModel === "gemini-3.5-flash" 
          ? "Gemini 3.5 Flash" 
          : geminiModel === "gemini-3.1-flash-lite"
            ? "Gemini 3.1 Flash Lite"
            : "Gemini 3.1 Pro";
      } else {
        modelUsedLabel = geminiModel === "gpt-4o-mini" ? "GPT-4o mini" : "GPT-4o";
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
      setActiveTab("report");

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

  // Core Loading view
  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center font-mono">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin mb-4" />
        <span className="text-zinc-500 text-xs">Synchronizing Academic Workspace Securely...</span>
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
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans">
      
      {/* 1. Header Area with Google Auth Identity Management */}
      <header className="bg-zinc-950 border-b border-white/10 sticky top-0 z-10 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3.5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-display font-bold text-white text-lg leading-tight tracking-tight flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-400" />
                <span>SENTINEL AI</span>
                <span className="text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Academic Suite</span>
              </h1>
              <p className="text-zinc-400 text-xs mt-0.5">Analyze public student GitHub repositories for AI generation patterns</p>
            </div>
          </div>
          
          {/* Authenticated Identity Badge */}
          <div className="flex items-center gap-3 self-end sm:self-center bg-zinc-900 border border-white/5 py-1.5 pl-3 pr-1.5 rounded-xl">
            <div className="text-right hidden sm:block">
              <p className="text-[11px] text-white font-bold max-w-[120px] truncate leading-tight">{user.displayName || user.email}</p>
              <p className="text-[9px] text-zinc-500 font-mono tracking-wide">Authorized Mentor</p>
            </div>
            {user.photoURL ? (
              <img 
                referrerPolicy="no-referrer" 
                src={user.photoURL} 
                alt="Avatar" 
                className="w-7 h-7 rounded-full border border-sky-500/30 object-cover shrink-0" 
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center text-xs font-bold font-mono shrink-0">
                {String(user.email || 'M')[0].toUpperCase()}
              </div>
            )}
            <button
              onClick={logout}
              className="py-1 px-2.5 bg-zinc-800 hover:bg-zinc-755 hover:text-rose-400 text-zinc-400 text-[10px] uppercase font-bold rounded-lg transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* 2. Educational Tutorial Helper */}
      <section className="bg-sky-950/20 text-zinc-300 py-3 px-4 border-b border-white/10 shadow-inner">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs leading-relaxed">
          <div className="flex items-start md:items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5 md:mt-0" />
            <p className="font-medium">
              <strong className="text-sky-300">Educator Checklist:</strong> (1) Upload student records from Excel with Git urls (2) Push <strong>Analyze</strong> to pull public codes (3) Inspect structural anomalies in the Inspector tab!
            </p>
          </div>
          <span className="text-[10px] bg-white/5 border border-white/10 text-zinc-300 py-0.5 px-2 rounded-md font-mono shrink-0">
            Isolated Mentor Cloud Databases Active
          </span>
        </div>
      </section>

      {/* 3. Main Dashboard Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        
        {/* Left column: Student loading grid and token configurations */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5 min-h-0">
          <TokenSettings
            githubToken={githubToken}
            setGithubToken={setGithubToken}
            geminiModel={geminiModel}
            setGeminiModel={setGeminiModel}
            customGeminiKey={mentor?.geminiApiKey || ""}
            onSaveCustomGeminiKey={saveGeminiApiKey}
            aiProvider={aiProvider}
            setAiProvider={setAiProvider}
            customOpenaiKey={mentor?.openaiApiKey || ""}
            onSaveCustomOpenaiKey={saveOpenaiApiKey}
          />
          
          <div className="flex-1 min-h-[400px] lg:min-h-0 opacity-100 transition-opacity">
            <StudentList
              students={students}
              selectedStudentId={selectedStudentId}
              setSelectedStudentId={setSelectedStudentId}
              onAnalyzeStudent={handleAnalyzeStudent}
              onAnalyzeAll={handleAnalyzeAll}
            />
          </div>
        </div>

        {/* Right column: Dynamic analysis outputs and code walkthrough inspection panels */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full min-h-0">
          {selectedStudent ? (
            <div className="flex flex-col h-full space-y-4">
              
              {/* Selector Tabs (Report view or code file inspector) */}
              <div className="bg-zinc-900 border border-white/10 rounded-xl p-1.5 flex items-center justify-between shadow-md">
                <div className="flex gap-1">
                  <button
                    id="tab-report"
                    onClick={() => setActiveTab("report")}
                    className={`py-1.5 px-4 font-display font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                      activeTab === "report"
                        ? "bg-sky-500 text-white shadow-md shadow-sky-950/50"
                        : "text-zinc-400 hover:text-sky-400 hover:bg-white/5"
                    }`}
                  >
                    <Gauge className="w-3.5 h-3.5" />
                    <span>AI Detection Report</span>
                  </button>
                  
                  <button
                    id="tab-code"
                    onClick={() => setActiveTab("code")}
                    className={`py-1.5 px-4 font-display font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                      activeTab === "code"
                        ? "bg-sky-500 text-white shadow-md shadow-sky-950/50"
                        : "text-zinc-400 hover:text-sky-400 hover:bg-white/5"
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Live Code walkthrough</span>
                  </button>
                </div>

                <div className="px-3 text-xs text-zinc-400 font-medium truncate max-w-[200px] sm:max-w-none">
                  Active Student: <span className="font-bold text-white">{selectedStudent.name}</span>
                </div>
              </div>

              {/* Tab Frame Content */}
              <div className="flex-1 min-h-0">
                {activeTab === "report" ? (
                  /* Report Viewer or Prompt Analysis Frame */
                  selectedStudent.status === "analyzed" && selectedStudent.activeReport ? (
                    <ReportViewer
                      student={selectedStudent}
                      report={selectedStudent.activeReport}
                    />
                  ) : (
                    /* Setup prompt frame if student is not analyzed yet */
                    <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[400px] shadow-lg space-y-6 animate-fadeIn">
                      <div className="p-4 bg-sky-500/10 text-sky-450 rounded-full border border-sky-500/20 animate-pulse">
                        <Code2 className="w-10 h-10" />
                      </div>
                      
                      <div className="space-y-1.5 max-w-sm">
                        <h2 className="font-display font-bold text-white text-base">Unchecked Student Repository</h2>
                        <p className="text-zinc-400 text-xs leading-relaxed">
                          We haven't parsed the repositories or completed style inspections for <strong className="text-zinc-300">{selectedStudent.name}</strong> yet. Press below to fetch public source files and verify coding behavior.
                        </p>
                      </div>

                      {selectedStudent.errorMsg && (
                        <div className="max-w-lg p-3 bg-rose-950/40 text-rose-300 border border-rose-555/35 rounded-lg text-xs font-medium text-left flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-455" />
                          <div>
                            <span className="font-bold">Prior Attempt Failed: </span>
                            {selectedStudent.errorMsg}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2.5 justify-center pt-2">
                        <button
                          id="primary-analyze-btn"
                          onClick={() => handleAnalyzeStudent(selectedStudent, true)}
                          disabled={selectedStudent.status === "fetching" || selectedStudent.status === "analyzing"}
                          className="py-1.5 px-5 bg-sky-500 text-white font-semibold text-xs rounded-lg hover:bg-sky-400 transition-all flex items-center gap-1.5 cursor-pointer disabled:bg-zinc-800 disabled:text-zinc-555"
                        >
                          {selectedStudent.status === "fetching" || selectedStudent.status === "analyzing" ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
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
                            setActiveTab("code");
                          }}
                          className="py-1.5 px-4 font-semibold text-xs border border-white/10 text-zinc-300 rounded-lg hover:bg-white/5 transition-all bg-zinc-950 cursor-pointer"
                        >
                          Manual Code Sandbox
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  /* Code Inspector panel */
                  <CodeInspector
                    student={selectedStudent}
                    onCodeAnalyze={handleSandboxCodeAnalyze}
                    isAnalyzing={isAnalyzingSandbox}
                  />
                )}
              </div>

            </div>
          ) : (
            /* Welcome screen when no student is selected of all loaded records */
            <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-8 sm:p-12 text-center flex flex-col items-center justify-center h-full min-h-[400px] shadow-lg space-y-6">
              <div className="p-4 bg-white/5 text-zinc-500 rounded-full border border-white/10">
                <Layers className="w-12 h-12 text-zinc-400" />
              </div>
              
              <div className="space-y-2 max-w-sm">
                <h2 className="font-display font-semibold text-white text-lg leading-tight">No Selected Student Repo</h2>
                <p className="text-zinc-450 text-xs">
                  Upload an Excel spreadsheet containing students' GitHub links, or click on an existing record card in the list to inspect their files.
                </p>
              </div>

              {students.length === 0 && (
                <div className="flex flex-col items-center gap-3 pt-2">
                  <span className="text-[11px] font-bold text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" />
                    <span>How it works:</span>
                  </span>
                  <div className="bg-zinc-900 border border-white/10 rounded-lg p-4 text-left max-w-sm text-[11px] text-zinc-300 space-y-2">
                    <p className="font-semibold text-white">1. Prepare your spreadsheet with headers:</p>
                    <p className="text-sky-300 pl-3 font-mono font-semibold">"Student Name", "Roll No", "GitHub Link"</p>
                    <p className="font-semibold text-white mt-2">2. Upload sheet, then hit Audit to review structural metrics.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </main>

      {/* 4. Professional footer with explicit credits requested by the user */}
      <footer className="bg-zinc-950 border-t border-white/10 py-5 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-[10px] text-zinc-500 font-mono tracking-wide">
          <span>AI Code Detector &bull; Powered by Google Gemini &bull; Secure Academic Cloud Suite</span>
          <a 
            href="https://github.com/ayush-uttam"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-sky-450 font-semibold px-2.5 py-1 bg-white/5 rounded-full border border-white/10 sm:self-center transition-colors cursor-pointer"
          >
            Vibe coded by Ayush Uttam xD
          </a>
        </div>
      </footer>

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
