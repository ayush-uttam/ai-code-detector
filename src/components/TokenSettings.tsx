import React, { useState, useEffect } from "react";
import { Settings, HelpCircle, ShieldAlert, KeyRound, Cpu, Check, Eye, EyeOff } from "lucide-react";
import { useFirebase } from "./FirebaseProvider";
import { secureKey } from "../utils/crypto";

interface TokenSettingsProps {
  githubToken: string;
  setGithubToken: (val: string) => void;
  geminiModel: string;
  setGeminiModel: (val: string) => void;
  customGeminiKey: string;
  onSaveCustomGeminiKey: (key: string) => Promise<void>;
  aiProvider: "gemini" | "grok" | "openai";
  setAiProvider: (val: "gemini" | "grok" | "openai") => void;
  customGrokKey: string;
  onSaveCustomGrokKey: (key: string) => Promise<void>;
  customOpenaiKey: string;
  onSaveCustomOpenaiKey: (key: string) => Promise<void>;
}

export default function TokenSettings({
  githubToken,
  setGithubToken,
  geminiModel,
  setGeminiModel,
  customGeminiKey,
  onSaveCustomGeminiKey,
  aiProvider,
  setAiProvider,
  customGrokKey,
  onSaveCustomGrokKey,
  customOpenaiKey,
  onSaveCustomOpenaiKey,
}: TokenSettingsProps) {
  const { user } = useFirebase();
  const [isOpen, setIsOpen] = useState(false);
  
  // Masking and modification states
  const [isGithubModified, setIsGithubModified] = useState(false);
  const [githubInput, setGithubInput] = useState("");
  const [showGithubToken, setShowGithubToken] = useState(false);
  
  const [isGeminiModified, setIsGeminiModified] = useState(false);
  const [geminiInput, setGeminiInput] = useState("");
  const [isGrokModified, setIsGrokModified] = useState(false);
  const [grokInput, setGrokInput] = useState("");
  const [isOpenaiModified, setIsOpenaiModified] = useState(false);
  const [openaiInput, setOpenaiInput] = useState("");

  const [saved, setSaved] = useState(false);
  const [geminiSaved, setGeminiSaved] = useState(false);
  const [grokSaved, setGrokSaved] = useState(false);
  const [openaiSaved, setOpenaiSaved] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showGrokKey, setShowGrokKey] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);

  useEffect(() => {
    if (customGeminiKey) {
      setGeminiInput("••••••••••••••••••••••••••••••••");
      setIsGeminiModified(false);
    } else {
      setGeminiInput("");
      setIsGeminiModified(true);
    }
  }, [customGeminiKey]);

  useEffect(() => {
    if (customGrokKey) {
      setGrokInput("••••••••••••••••••••••••••••••••");
      setIsGrokModified(false);
    } else {
      setGrokInput("");
      setIsGrokModified(true);
    }
  }, [customGrokKey]);

  useEffect(() => {
    if (customOpenaiKey) {
      setOpenaiInput("••••••••••••••••••••••••••••••••");
      setIsOpenaiModified(false);
    } else {
      setOpenaiInput("");
      setIsOpenaiModified(true);
    }
  }, [customOpenaiKey]);

  const handleGithubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!isGithubModified) {
      setIsGithubModified(true);
      setGithubInput(val.replace(/•/g, ""));
    } else {
      setGithubInput(val);
    }
  };

  const handleGeminiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!isGeminiModified) {
      setIsGeminiModified(true);
      setGeminiInput(val.replace(/•/g, ""));
    } else {
      setGeminiInput(val);
    }
  };

  const handleGrokChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!isGrokModified) {
      setIsGrokModified(true);
      setGrokInput(val.replace(/•/g, ""));
    } else {
      setGrokInput(val);
    }
  };

  const handleOpenaiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!isOpenaiModified) {
      setIsOpenaiModified(true);
      setOpenaiInput(val.replace(/•/g, ""));
    } else {
      setOpenaiInput(val);
    }
  };

  const handleSaveToken = () => {
    if (!isGithubModified) return;
    setGithubToken(githubInput);
    if (user?.uid) {
      const encrypted = secureKey(githubInput, user.uid);
      localStorage.setItem("github_pat_token", encrypted);
    } else {
      localStorage.setItem("github_pat_token", githubInput);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setIsGithubModified(false);
  };

  const handleSaveGeminiKey = async () => {
    if (!isGeminiModified) return;
    try {
      await onSaveCustomGeminiKey(geminiInput);
      setGeminiSaved(true);
      setTimeout(() => setGeminiSaved(false), 2000);
      setIsGeminiModified(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save Gemini API key.");
    }
  };

  const handleSaveGrokKey = async () => {
    if (!isGrokModified) return;
    try {
      await onSaveCustomGrokKey(grokInput);
      setGrokSaved(true);
      setTimeout(() => setGrokSaved(false), 2000);
      setIsGrokModified(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save Grok API key.");
    }
  };

  const handleSaveOpenaiKey = async () => {
    if (!isOpenaiModified) return;
    try {
      await onSaveCustomOpenaiKey(openaiInput);
      setOpenaiSaved(true);
      setTimeout(() => setOpenaiSaved(false), 2000);
      setIsOpenaiModified(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save OpenAI API key.");
    }
  };

  return (
    <div id="settings-group" className="apple-glass rounded-xl p-4">
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-sky-400" />
          <h2 className="font-display font-semibold text-white text-sm">Analysis & Rate Limit Config</h2>
        </div>
        <button
          id="toggle-settings-btn"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
        >
          {isOpen ? "Hide Settings" : "Show Settings"}
        </button>
      </div>

      {!isOpen && (
        <div className="mt-2 text-xs text-zinc-400 flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-zinc-550" />
            <span>
              Provider: <strong className="text-zinc-200 uppercase">
                {aiProvider === "grok" ? "xAI Grok" : aiProvider === "openai" ? "OpenAI" : aiProvider}
              </strong> &bull; 
              Model: <strong className="text-zinc-200">
                {aiProvider === "gemini" 
                  ? (geminiModel === "gemini-3.5-flash" 
                      ? "Gemini 3.5 Flash" 
                      : geminiModel === "gemini-3.1-flash-lite"
                        ? "Gemini 3.1 Flash Lite"
                        : "Gemini 3.1 Pro")
                  : aiProvider === "grok"
                    ? (geminiModel === "grok-2-1212" ? "Grok 2" : "Grok Beta")
                    : (geminiModel === "gpt-4o" ? "GPT-4o" : "GPT-4o mini")}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-zinc-550" />
            <span>
              API Key: {
                aiProvider === "gemini"
                  ? (customGeminiKey ? <span className="text-emerald-400 font-semibold font-mono text-[10px]">Gemini Custom</span> : <span className="text-zinc-500 font-medium">Gemini Default</span>)
                  : aiProvider === "grok"
                    ? (customGrokKey ? <span className="text-emerald-400 font-semibold font-mono text-[10px]">Grok Custom</span> : <span className="text-zinc-500 font-medium">Grok Default</span>)
                    : (customOpenaiKey ? <span className="text-emerald-400 font-semibold font-mono text-[10px]">OpenAI Custom</span> : <span className="text-zinc-500 font-medium">OpenAI Default</span>)
              }
            </span>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="mt-4 space-y-4 text-xs animate-fadeIn">
          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Select AI Provider
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                id="provider-gemini-btn"
                type="button"
                onClick={() => {
                  setAiProvider("gemini");
                  setGeminiModel("gemini-3.1-flash-lite");
                }}
                className={`py-1.5 px-2 rounded-lg border text-left flex items-center justify-between transition-colors cursor-pointer ${
                  aiProvider === "gemini"
                    ? "border-sky-550 bg-sky-505/10 text-sky-300"
                    : "border-white/10 hover:bg-white/5 text-zinc-450"
                }`}
              >
                <span className="font-semibold text-[10px] flex items-center gap-0.5 truncate">
                  Gemini {aiProvider === "gemini" && <Check className="w-2.5 h-2.5 text-sky-400 shrink-0" />}
                </span>
              </button>
              
              <button
                id="provider-grok-btn"
                type="button"
                onClick={() => {
                  setAiProvider("grok");
                  setGeminiModel("grok-beta");
                }}
                className={`py-1.5 px-2 rounded-lg border text-left flex items-center justify-between transition-colors cursor-pointer ${
                  aiProvider === "grok"
                    ? "border-sky-550 bg-sky-505/10 text-sky-300"
                    : "border-white/10 hover:bg-white/5 text-zinc-450"
                }`}
              >
                <span className="font-semibold text-[10px] flex items-center gap-0.5 truncate">
                  Grok {aiProvider === "grok" && <Check className="w-2.5 h-2.5 text-sky-400 shrink-0" />}
                </span>
              </button>

              <button
                id="provider-openai-btn"
                type="button"
                onClick={() => {
                  setAiProvider("openai");
                  setGeminiModel("gpt-4o-mini");
                }}
                className={`py-1.5 px-2 rounded-lg border text-left flex items-center justify-between transition-colors cursor-pointer ${
                  aiProvider === "openai"
                    ? "border-sky-550 bg-sky-505/10 text-sky-300"
                    : "border-white/10 hover:bg-white/5 text-zinc-450"
                }`}
              >
                <span className="font-semibold text-[10px] flex items-center gap-0.5 truncate">
                  OpenAI {aiProvider === "openai" && <Check className="w-2.5 h-2.5 text-sky-400 shrink-0" />}
                </span>
              </button>
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1">
              Select {aiProvider === "gemini" ? "Gemini" : "Grok"} Model
              <span className="group relative">
                <HelpCircle className="w-3 h-3 text-zinc-500 cursor-help" />
                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 bg-zinc-950 text-zinc-200 border border-white/10 p-2 rounded text-[10px] leading-tight opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal z-50 shadow-lg">
                  Flash / Beta is faster and lower cost, while Pro / Grok 2 handles highly complex or heavily obfuscated code structures better.
                </span>
              </span>
            </label>
            {aiProvider === "gemini" ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <button
                  id="model-flash-btn"
                  type="button"
                  onClick={() => setGeminiModel("gemini-3.5-flash")}
                  className={`py-2 px-3 rounded-lg border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                    geminiModel === "gemini-3.5-flash"
                      ? "border-sky-550 bg-sky-505/10 text-sky-300"
                      : "border-white/10 hover:bg-white/5 text-zinc-400"
                  }`}
                >
                  <span className="font-semibold text-[11px] flex items-center gap-1">
                    Gemini 3.5 Flash {geminiModel === "gemini-3.5-flash" && <Check className="w-3 h-3 text-sky-400" />}
                  </span>
                  <span className="text-[10px] text-zinc-550 mt-0.5 font-normal">Super fast, perfect for typical student tasks.</span>
                </button>

                <button
                  id="model-lite-btn"
                  type="button"
                  onClick={() => setGeminiModel("gemini-3.1-flash-lite")}
                  className={`py-2 px-3 rounded-lg border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                    geminiModel === "gemini-3.1-flash-lite"
                      ? "border-sky-550 bg-sky-505/10 text-sky-300"
                      : "border-white/10 hover:bg-white/5 text-zinc-400"
                  }`}
                >
                  <span className="font-semibold text-[11px] flex items-center gap-1">
                    Gemini 3.1 Flash Lite {geminiModel === "gemini-3.1-flash-lite" && <Check className="w-3 h-3 text-sky-400" />}
                  </span>
                  <span className="text-[10px] text-zinc-550 mt-0.5 font-normal">Highly cost-efficient, ultra low latency, fast checks.</span>
                </button>
                
                <button
                  id="model-pro-btn"
                  type="button"
                  onClick={() => setGeminiModel("gemini-3.1-pro-preview")}
                  className={`py-2 px-3 rounded-lg border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                    geminiModel === "gemini-3.1-pro-preview"
                      ? "border-sky-550 bg-sky-505/10 text-sky-300"
                      : "border-white/10 hover:bg-white/5 text-zinc-400"
                  }`}
                >
                  <span className="font-semibold text-[11px] flex items-center gap-1">
                    Gemini 3.1 Pro {geminiModel === "gemini-3.1-pro-preview" && <Check className="w-3 h-3 text-sky-400" />}
                  </span>
                  <span className="text-[10px] text-zinc-550 mt-0.5 font-normal">Deep reasoning. Best for complex algorithms.</span>
                </button>
              </div>
            ) : aiProvider === "grok" ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="model-grok-beta-btn"
                  type="button"
                  onClick={() => setGeminiModel("grok-beta")}
                  className={`py-2 px-3 rounded-lg border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                    geminiModel === "grok-beta"
                      ? "border-sky-550 bg-sky-505/10 text-sky-300"
                      : "border-white/10 hover:bg-white/5 text-zinc-400"
                  }`}
                >
                  <span className="font-semibold text-[11px] flex items-center gap-1">
                    Grok Beta {geminiModel === "grok-beta" && <Check className="w-3 h-3 text-sky-400" />}
                  </span>
                  <span className="text-[10px] text-zinc-550 mt-0.5 font-normal">Fast response, ideal for active developer audits.</span>
                </button>
                
                <button
                  id="model-grok-pro-btn"
                  type="button"
                  onClick={() => setGeminiModel("grok-2-1212")}
                  className={`py-2 px-3 rounded-lg border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                    geminiModel === "grok-2-1212"
                      ? "border-sky-550 bg-sky-505/10 text-sky-300"
                      : "border-white/10 hover:bg-white/5 text-zinc-400"
                  }`}
                >
                  <span className="font-semibold text-[11px] flex items-center gap-1">
                    Grok 2 {geminiModel === "grok-2-1212" && <Check className="w-3 h-3 text-sky-400" />}
                  </span>
                  <span className="text-[10px] text-zinc-550 mt-0.5 font-normal">High intelligence and reasoning, best for obfuscation scanning.</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="model-openai-mini-btn"
                  type="button"
                  onClick={() => setGeminiModel("gpt-4o-mini")}
                  className={`py-2 px-3 rounded-lg border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                    geminiModel === "gpt-4o-mini"
                      ? "border-sky-550 bg-sky-505/10 text-sky-300"
                      : "border-white/10 hover:bg-white/5 text-zinc-400"
                  }`}
                >
                  <span className="font-semibold text-[11px] flex items-center gap-1">
                    GPT-4o mini {geminiModel === "gpt-4o-mini" && <Check className="w-3 h-3 text-sky-400" />}
                  </span>
                  <span className="text-[10px] text-zinc-550 mt-0.5 font-normal">Ultra fast, highly cost-efficient audits.</span>
                </button>
                
                <button
                  id="model-openai-pro-btn"
                  type="button"
                  onClick={() => setGeminiModel("gpt-4o")}
                  className={`py-2 px-3 rounded-lg border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                    geminiModel === "gpt-4o"
                      ? "border-sky-550 bg-sky-505/10 text-sky-300"
                      : "border-white/10 hover:bg-white/5 text-zinc-400"
                  }`}
                >
                  <span className="font-semibold text-[11px] flex items-center gap-1">
                    GPT-4o {geminiModel === "gpt-4o" && <Check className="w-3 h-3 text-sky-400" />}
                  </span>
                  <span className="text-[10px] text-zinc-550 mt-0.5 font-normal">High intelligence, best for multi-file complexity scanning.</span>
                </button>
              </div>
            )}
            {geminiModel === "gemini-3.1-pro-preview" && (
              <p className="text-[10px] text-amber-300 bg-amber-955/20 rounded-md p-2 mt-2 flex items-start gap-1.5 border border-amber-500/20">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                <span>Requires a paid workspace key or a prior workspace-confirmed model flow if prompted by the workspace UI.</span>
              </p>
            )}
          </div>

          {/* Gemini Key Input */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1">
              Custom Gemini API Key (Instructor Option)
            </label>
            <p className="text-[10px] text-zinc-500 mb-1.5">
              Input your own personal API key from Google AI Studio. This saves to your secure backend profile so you bypass default platform limits.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="gemini-key-input"
                  type={showGeminiKey ? "text" : "password"}
                  placeholder="AIzaSy..."
                  value={showGeminiKey ? (isGeminiModified ? geminiInput : customGeminiKey) : geminiInput}
                  onChange={handleGeminiChange}
                  className="w-full pl-3 pr-9 py-1.5 bg-zinc-950 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-zinc-700"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-2.5 top-2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                id="save-gemini-key-btn"
                onClick={handleSaveGeminiKey}
                disabled={!isGeminiModified}
                className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                {geminiSaved ? "Saved!" : "Save Key"}
              </button>
            </div>
            {customGeminiKey && (
              <button
                id="clear-gemini-key-btn"
                onClick={async () => {
                  setGeminiInput("");
                  setIsGeminiModified(true);
                  await onSaveCustomGeminiKey("");
                }}
                className="text-[10px] text-rose-400 hover:underline mt-1.5 font-medium cursor-pointer"
              >
                Reset to System Default Key
              </button>
            )}
          </div>

          {/* Grok Key Input */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1">
              Custom Grok API Key (Instructor Option)
            </label>
            <p className="text-[10px] text-zinc-500 mb-1.5">
              Input your own personal API key from xAI (Grok). This saves to your secure backend profile so you bypass default platform limits.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="grok-key-input"
                  type={showGrokKey ? "text" : "password"}
                  placeholder="xai-..."
                  value={showGrokKey ? (isGrokModified ? grokInput : customGrokKey) : grokInput}
                  onChange={handleGrokChange}
                  className="w-full pl-3 pr-9 py-1.5 bg-zinc-950 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-zinc-700"
                />
                <button
                  type="button"
                  onClick={() => setShowGrokKey(!showGrokKey)}
                  className="absolute right-2.5 top-2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {showGrokKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                id="save-grok-key-btn"
                onClick={handleSaveGrokKey}
                disabled={!isGrokModified}
                className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                {grokSaved ? "Saved!" : "Save Key"}
              </button>
            </div>
            {customGrokKey && (
              <button
                id="clear-grok-key-btn"
                onClick={async () => {
                  setGrokInput("");
                  setIsGrokModified(true);
                  await onSaveCustomGrokKey("");
                }}
                className="text-[10px] text-rose-400 hover:underline mt-1.5 font-medium cursor-pointer"
              >
                Reset to System Default Key
              </button>
            )}
          </div>

          {/* OpenAI Key Input */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1">
              Custom OpenAI API Key (Instructor Option)
            </label>
            <p className="text-[10px] text-zinc-500 mb-1.5">
              Input your own personal API key from OpenAI. This saves to your secure backend profile so you bypass default platform limits.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="openai-key-input"
                  type={showOpenai ? "text" : "password"}
                  placeholder="sk-proj-..."
                  value={showOpenai ? (isOpenaiModified ? openaiInput : customOpenaiKey) : openaiInput}
                  onChange={handleOpenaiChange}
                  className="w-full pl-3 pr-9 py-1.5 bg-zinc-950 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-zinc-700"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenai(!showOpenai)}
                  className="absolute right-2.5 top-2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {showOpenai ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                id="save-openai-key-btn"
                onClick={handleSaveOpenaiKey}
                disabled={!isOpenaiModified}
                className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                {openaiSaved ? "Saved!" : "Save Key"}
              </button>
            </div>
            {customOpenaiKey && (
              <button
                id="clear-openai-key-btn"
                onClick={async () => {
                  setOpenaiInput("");
                  setIsOpenaiModified(true);
                  await onSaveCustomOpenaiKey("");
                }}
                className="text-[10px] text-rose-400 hover:underline mt-1.5 font-medium cursor-pointer"
              >
                Reset to System Default Key
              </button>
            )}
          </div>

          {/* GitHub PAT Input */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              GitHub Personal Access Token (PAT)
            </label>
            <p className="text-[10px] text-zinc-500 mb-1.5">
              GitHub restricts anonymous API parsing to 60 requests/hr. Add a token (no scopes needed for public repos) to bypass limits.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="github-token-input"
                  type={showGithubToken ? "text" : "password"}
                  placeholder="ghp_xxxxxxxxxxxx"
                  value={showGithubToken ? (isGithubModified ? githubInput : githubToken) : githubInput}
                  onChange={handleGithubChange}
                  className="w-full pl-3 pr-9 py-1.5 bg-zinc-950 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-zinc-700"
                />
                <button
                  type="button"
                  onClick={() => setShowGithubToken(!showGithubToken)}
                  className="absolute right-2.5 top-2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {showGithubToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                id="save-token-btn"
                onClick={handleSaveToken}
                disabled={!isGithubModified}
                className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                {saved ? "Saved!" : "Save Token"}
              </button>
            </div>
            {githubToken && (
              <button
                id="clear-token-btn"
                onClick={() => {
                  setGithubInput("");
                  setIsGithubModified(true);
                  setGithubToken("");
                  localStorage.removeItem("github_pat_token");
                }}
                className="text-[10px] text-rose-400 hover:underline mt-1.5 font-medium cursor-pointer"
              >
                Delete stored GitHub Token
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
