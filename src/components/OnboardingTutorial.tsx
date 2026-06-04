import React, { useState } from "react";
import { 
  ShieldCheck, 
  KeyRound, 
  FileCode, 
  ArrowRight, 
  CheckCircle2, 
  Cpu, 
  HelpCircle,
  Eye,
  EyeOff
} from "lucide-react";

interface OnboardingTutorialProps {
  onSaveKeys: (keys: { geminiKey: string; githubToken: string; openaiKey: string }) => Promise<void>;
  onComplete: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export default function OnboardingTutorial({ onSaveKeys, onComplete, onSignOut }: OnboardingTutorialProps) {
  const [step, setStep] = useState(1);
  const [geminiKey, setGeminiKey] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  
  const [showGemini, setShowGemini] = useState(false);
  const [showGithub, setShowGithub] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleNext = () => {
    setErrorMsg("");
    if (step === 2) {
      if (!geminiKey.trim()) {
        setErrorMsg("Gemini API Key is mandatory to run academic analyses.");
        return;
      }
      if (!githubToken.trim()) {
        setErrorMsg("GitHub Personal Access Token is mandatory to parse student repos.");
        return;
      }
    }
    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setErrorMsg("");
    setStep((prev) => prev - 1);
  };

  const handleFinish = async () => {
    setErrorMsg("");
    setSubmitting(true);
    try {
      // 1. Save all keys
      await onSaveKeys({
        geminiKey: geminiKey.trim(),
        githubToken: githubToken.trim(),
        openaiKey: openaiKey.trim()
      });

      // 2. Mark tutorial completed in Firestore
      await onComplete();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to complete onboarding. Please verify your firestore permissions.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-md px-4 font-sans">
      {/* Glow circles behind card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="apple-glass w-full max-w-lg rounded-2xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]">
        
        {/* Header / Steps Indicator */}
        <div className="px-6 py-4 bg-zinc-950/40 border-b border-white/10 flex items-center justify-between">
          <span className="font-display font-bold text-xs text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            <span>Sentinel Onboarding</span>
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onSignOut}
              className="text-[10px] text-zinc-400 hover:text-rose-400 font-bold uppercase transition-colors cursor-pointer"
            >
              Sign Out
            </button>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map((s) => (
                <span 
                  key={s} 
                  className={`w-2 h-2 rounded-full transition-colors ${
                    s === step ? "bg-sky-400" : s < step ? "bg-sky-500/35" : "bg-white/5"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-955/20 border border-rose-500/20 text-rose-300 text-xs rounded-lg text-left">
              {errorMsg}
            </div>
          )}

          {/* STEP 1: WELCOME SLIDE */}
          {step === 1 && (
            <div className="text-center space-y-4 py-3 animate-fadeIn">
              <div className="w-16 h-16 bg-sky-500/10 rounded-2xl border border-sky-500/20 flex items-center justify-center text-sky-400 mx-auto shadow-inner">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-white font-display font-bold text-lg">Welcome to Sentinel AI</h2>
                <p className="text-zinc-400 text-xs leading-relaxed max-w-sm mx-auto">
                  Sentinel AI is a precision code integrity scanner designed to help academic instructors detect LLM generated programming patterns inside student repositories.
                </p>
              </div>
              <div className="bg-zinc-950/40 border border-white/5 p-4 rounded-xl text-left text-zinc-400 text-xs leading-relaxed space-y-2.5 max-w-sm mx-auto">
                <p className="font-medium text-zinc-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  <span>How it works:</span>
                </p>
                <ol className="list-decimal list-inside pl-1 text-[11px] space-y-1">
                  <li>You load student GitHub links manually or via Excel.</li>
                  <li>Our parser downloads code files and recent commits.</li>
                  <li>Our forensic model runs deep stylistic checks.</li>
                  <li>We highlight exact line matches suggesting AI creation.</li>
                </ol>
              </div>
            </div>
          )}

          {/* STEP 2: REQUIRED API KEYS */}
          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1">
                <h2 className="text-white font-display font-bold text-base flex items-center gap-1.5">
                  <KeyRound className="w-5 h-5 text-sky-400" />
                  <span>Required Configuration</span>
                </h2>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Sentinel AI requires your custom credentials to invoke LLM engines and crawl public repos without hitting rate-limit thresholds.
                </p>
              </div>

              <div className="space-y-3.5 pt-2">
                {/* Gemini Key Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-300 flex items-center justify-between">
                    <span>Google Gemini API Key <strong className="text-sky-450">*</strong></span>
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[10px] text-sky-400 hover:underline"
                    >
                      Get Gemini Key
                    </a>
                  </label>
                  <div className="relative">
                    <input
                      type={showGemini ? "text" : "password"}
                      placeholder="AIzaSy..."
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      className="w-full pl-3 pr-9 py-2 bg-zinc-950 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-zinc-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGemini(!showGemini)}
                      className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                    >
                      {showGemini ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500">Required to connect with the default Gemini models.</p>
                </div>

                {/* Github PAT Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-300 flex items-center justify-between">
                    <span>GitHub Personal Access Token (PAT) <strong className="text-sky-450">*</strong></span>
                    <a 
                      href="https://github.com/settings/tokens" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[10px] text-sky-400 hover:underline"
                    >
                      Create GitHub PAT
                    </a>
                  </label>
                  <div className="relative">
                    <input
                      type={showGithub ? "text" : "password"}
                      placeholder="ghp_xxxxxxxxxxxx"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      className="w-full pl-3 pr-9 py-2 bg-zinc-950 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-zinc-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGithub(!showGithub)}
                      className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                    >
                      {showGithub ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500">Required to download files from public repos. (No permission scopes needed).</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: OPTIONAL API KEYS */}
          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1">
                <h2 className="text-white font-display font-bold text-base flex items-center gap-1.5">
                  <Cpu className="w-5 h-5 text-sky-400" />
                  <span>Optional Configurations</span>
                </h2>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  You can also integrate OpenAI models like GPT-4o to serve as audit models if you have an active OpenAI API Key.
                </p>
              </div>

              <div className="space-y-3.5 pt-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-300 flex items-center justify-between">
                    <span>OpenAI API Key (Optional)</span>
                    <a 
                      href="https://platform.openai.com/api-keys" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[10px] text-sky-400 hover:underline"
                    >
                      Get OpenAI Key
                    </a>
                  </label>
                  <div className="relative">
                    <input
                      type={showOpenai ? "text" : "password"}
                      placeholder="sk-proj-..."
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      className="w-full pl-3 pr-9 py-2 bg-zinc-950 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-zinc-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenai(!showOpenai)}
                      className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                    >
                      {showOpenai ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500">Provide this key if you want to perform tests using GPT-4o or GPT-4o mini.</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: QUICK WALKTHROUGH */}
          {step === 4 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1">
                <h2 className="text-white font-display font-bold text-base flex items-center gap-1.5">
                  <FileCode className="w-5 h-5 text-sky-400" />
                  <span>Workspace Layout Guide</span>
                </h2>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Here is how to navigate the Sentinel AI workspace once you hit the dashboard:
                </p>
              </div>

              <div className="bg-zinc-950/40 border border-white/5 rounded-xl p-4 space-y-3.5 text-xs text-zinc-300">
                <div className="flex items-start gap-2">
                  <span className="p-1 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded shrink-0 font-bold font-mono text-[9px] w-5 h-5 flex items-center justify-center">1</span>
                  <div>
                    <h3 className="font-bold text-zinc-200">Analysis & Rate Limit Config</h3>
                    <p className="text-[10px] text-zinc-500">Top-left corner. Expand this to toggle providers (Gemini vs OpenAI) and update your API tokens.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="p-1 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded shrink-0 font-bold font-mono text-[9px] w-5 h-5 flex items-center justify-center">2</span>
                  <div>
                    <h3 className="font-bold text-zinc-200">Student Repositories</h3>
                    <p className="text-[10px] text-zinc-500">Bottom-left corner. Drag & drop student Excel lists or click "Add Student" to create them manually.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="p-1 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded shrink-0 font-bold font-mono text-[9px] w-5 h-5 flex items-center justify-center">3</span>
                  <div>
                    <h3 className="font-bold text-zinc-200">Report & Walkthrough</h3>
                    <p className="text-[10px] text-zinc-500">Right sidebar. Once audited, this panel shows risk metrics, probability score breakdown, and live style audits.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="px-6 py-4 bg-zinc-950/40 border-t border-white/10 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1 || submitting}
            className="py-1.5 px-4 font-semibold text-xs border border-white/10 text-zinc-400 rounded-lg hover:bg-white/5 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          >
            Back
          </button>
          
          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="py-1.5 px-4 bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow shadow-sky-500/30 focus:outline-none"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={submitting}
              className="py-1.5 px-5 bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed shadow shadow-sky-500/30 focus:outline-none"
            >
              {submitting ? (
                <>
                  <span className="inline-block animate-spin border-2 border-white border-t-transparent w-3.5 h-3.5 rounded-full" />
                  <span>Configuring Suite...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Finish & Enter Workspace</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
