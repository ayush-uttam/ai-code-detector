import React, { useState } from "react";
import StudentList from "./components/StudentList";
import ReportViewer from "./components/ReportViewer";
import CodeInspector from "./components/CodeInspector";
import TokenSettings from "./components/TokenSettings";
import LoginPage from "./components/LoginPage";
import OnboardingTutorial from "./components/OnboardingTutorial";
import { useFirebase } from "./components/FirebaseProvider";
import { PrintReportLayout } from "./components/PrintReportLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAppView } from "./hooks/useAppView";
import { useGithubToken } from "./hooks/useGithubToken";
import { useStudentAnalysis } from "./hooks/useStudentAnalysis";
import { useMouseHalo } from "./hooks/useMouseHalo";
import { 
  Sparkles, 
  ShieldCheck, 
  Layers,
  AlertCircle,
  Code2,
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

  const { githubToken, saveGithubToken } = useGithubToken(user?.uid);
  
  const {
    selectedStudentId,
    setSelectedStudentId,
    selectedStudent,
    currentStudentIndex,
    handlePrevStudent,
    handleNextStudent,
    view,
    setView,
    isMenuOpen,
    setIsMenuOpen,
    printTarget,
    setPrintTarget,
    selectedFilePath,
    setSelectedFilePath,
    finishedNotification,
    setFinishedNotification,
  } = useAppView(students);

  const [aiProvider, setAiProvider] = useState<"gemini" | "grok" | "openai">("gemini");
  const [geminiModel, setGeminiModel] = useState<string>("gemini-3.1-flash-lite");

  const {
    isAnalyzingSandbox,
    isAnalyzingSingleFile,
    handleAnalyzeStudent,
    handleSandboxCodeAnalyze,
    handleSingleFileAnalyze,
  } = useStudentAnalysis({
    mentor,
    githubToken,
    aiProvider,
    geminiModel,
    updateStudent,
    setSelectedStudentId,
    setView,
    setFinishedNotification,
  });

  // Mouse halo tracker hook
  useMouseHalo(!!user && !loading && !!mentor?.tutorialCompleted);

  const handleSaveOnboardingKeys = async (keys: { geminiKey: string; githubToken: string; grokKey: string; openaiKey: string }) => {
    await saveGeminiApiKey(keys.geminiKey);
    await saveGrokApiKey(keys.grokKey);
    await saveOpenaiApiKey(keys.openaiKey);
    saveGithubToken(keys.githubToken);
  };

  const handleAnalyzeAll = async () => {
    const pendingStudents = students.filter(s => s.status !== "analyzing" && s.status !== "fetching");
    for (const student of pendingStudents) {
      await handleAnalyzeStudent(student, false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center font-mono">
        <span className="inline-block animate-spin border-2 border-sky-400 border-t-transparent w-8 h-8 rounded-full mb-4" />
        <span className="text-zinc-550 text-xs">Synchronizing Academic Workspace Securely...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={loginWithGoogle} />;
  }

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
              <ErrorBoundary fallbackTitle="Classroom Roster Panel Crashed">
                <StudentList
                  students={students}
                  selectedStudentId={selectedStudentId}
                  setSelectedStudentId={setSelectedStudentId}
                  onAnalyzeStudent={handleAnalyzeStudent}
                  onAnalyzeAll={handleAnalyzeAll}
                  onPrintAll={() => setPrintTarget({ type: "all" })}
                />
              </ErrorBoundary>
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
                    <ErrorBoundary fallbackTitle="Forensic Report Viewer Crashed">
                      <ReportViewer
                        student={selectedStudent}
                        report={selectedStudent.activeReport}
                        onPrint={() => setPrintTarget({ type: "single", studentId: selectedStudent.id })}
                        onViewFileInInspector={(filePath) => {
                          setSelectedFilePath(filePath);
                          setView("code");
                        }}
                      />
                    </ErrorBoundary>
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
                    className="mt-4 py-1.5 px-3 bg-zinc-955 hover:bg-zinc-900 border border-white/10 text-zinc-350 rounded-lg text-xs cursor-pointer"
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
                  <ErrorBoundary fallbackTitle="Source Code Inspector Crashed">
                    <CodeInspector
                      student={selectedStudent}
                      onCodeAnalyze={(filename, content) => handleSandboxCodeAnalyze(selectedStudent, filename, content)}
                      isAnalyzing={isAnalyzingSandbox}
                      selectedFilePath={selectedFilePath}
                      setSelectedFilePath={setSelectedFilePath}
                      onSingleFileAnalyze={(filePath) => handleSingleFileAnalyze(selectedStudent, filePath)}
                      isAnalyzingSingleFile={isAnalyzingSingleFile}
                    />
                  </ErrorBoundary>
                </div>
              ) : (
                <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
                  <Layers className="w-10 h-10 text-zinc-600 mb-2" />
                  <p className="text-zinc-400 text-sm">Please select a student from the roster list to view their code.</p>
                  <button
                    onClick={() => setView("students")}
                    className="mt-4 py-1.5 px-3 bg-zinc-955 hover:bg-zinc-900 border border-white/10 text-zinc-350 rounded-lg text-xs cursor-pointer"
                  >
                    Go to Classroom Roster
                  </button>
                </div>
              )}
            </div>
          )}
        </main>

        {/* 4. Professional footer with explicit credits */}
        <footer className="bg-zinc-955 border-t border-white/10 py-5 mt-auto">
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
            setGithubToken={saveGithubToken}
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
        <div className="fixed bottom-6 right-6 z-55 max-w-sm w-full bg-zinc-955/95 border border-white/10 p-4 rounded-xl shadow-2xl backdrop-blur-md animate-slideIn no-print">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-450 shrink-0">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-white font-semibold text-xs leading-tight">Assessment Completed</h4>
                <p className="text-[11px] text-zinc-455 mt-0.5 leading-snug">
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
