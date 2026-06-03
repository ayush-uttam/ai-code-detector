import React, { useState } from "react";
import { ShieldCheck, LogIn, Sparkles, Key, FileCheck, Layers } from "lucide-react";

interface LoginPageProps {
  onLogin: () => Promise<void>;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoginClick = async () => {
    setLoading(true);
    setError(null);
    try {
      await onLogin();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during authentication.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center font-sans px-4 relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-45 -right-45 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main card */}
      <div 
        id="login-card" 
        className="max-w-md w-full bg-zinc-900/80 border border-white/10 rounded-2xl p-8 shadow-2xl relative z-10 backdrop-blur-md flex flex-col items-center text-center animate-fadeIn"
      >
        {/* App Logo */}
        <div className="p-4 bg-sky-505/10 text-sky-400 rounded-full border border-sky-500/20 mb-6 flex items-center justify-center shadow-inner">
          <ShieldCheck className="w-10 h-10" />
        </div>

        {/* Hero Copy */}
        <div className="space-y-2 mb-8">
          <h1 className="font-display font-bold text-white text-2xl tracking-tight leading-tight">
            SENTINEL AI <span className="opacity-80 font-normal">Academic</span>
          </h1>
          <p className="text-zinc-400 text-xs leading-relaxed px-2">
            Verify programming academic integrity. Automatically analyze student GitHub repositories and code files using high-fidelity LLM forensic modeling.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div id="login-features" className="w-full text-left bg-zinc-950/40 border border-white/5 rounded-xl p-4 mb-8 space-y-3.5">
          <div className="flex items-start gap-2.5">
            <span className="p-1.5 bg-sky-500/15 text-sky-400 rounded-md mt-0.5">
              <Layers className="w-3.5 h-3.5" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-zinc-200">Educator Workspace</h3>
              <p className="text-[10px] text-zinc-400">Add custom students, upload class registers, and persist scans in real-time.</p>
            </div>
          </div>
          
          <div className="flex items-start gap-2.5">
            <span className="p-1.5 bg-sky-500/15 text-sky-400 rounded-md mt-0.5">
              <Key className="w-3.5 h-3.5" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-zinc-200">Personal Gemini Control</h3>
              <p className="text-[10px] text-zinc-400">Optionally supply your own API keys to query Gemini without daily quota limitations.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="p-1.5 bg-sky-500/15 text-sky-400 rounded-md mt-0.5">
              <FileCheck className="w-3.5 h-3.5" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-zinc-200">Zero-Trust Security</h3>
              <p className="text-[10px] text-zinc-400">Strictly isolated, secure Firestore boundaries keep classroom data completely private.</p>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="w-full p-3 mb-4 bg-rose-955/20 border border-rose-500/20 text-rose-300 text-xs rounded-lg text-left">
            {error}
          </div>
        )}

        {/* Google Authentication Trigger Button */}
        <button
          id="google-signin-btn"
          onClick={handleLoginClick}
          disabled={loading}
          className="w-full py-3 px-5 bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-sky-500/15 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-zinc-805 disabled:text-zinc-600 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="inline-block animate-spin border-2 border-white border-t-transparent w-4 h-4 rounded-full" />
          ) : (
            <LogIn className="w-4 h-4" />
          )}
          <span>{loading ? "Authenticating..." : "Sign in with Google"}</span>
        </button>

        {/* Subdued Academic Tagline */}
        <span className="text-[9px] text-zinc-650 mt-6 font-mono tracking-wider uppercase">
          Google Cloud Secure &bull; Academic Suite v2
        </span>
      </div>

      {/* Footer message required by the user */}
      <footer className="absolute bottom-5 text-[10px] text-zinc-600 font-mono text-center">
        Vibe coded by Ayush Uttam xD
      </footer>
    </div>
  );
}
