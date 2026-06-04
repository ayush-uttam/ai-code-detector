import * as React from "react";
import { ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    // @ts-ignore
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="bg-zinc-950 border border-red-500/20 rounded-xl p-6 text-center space-y-4 shadow-lg max-w-md mx-auto my-6 font-sans">
          <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto border border-red-500/20">
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
              className="w-6 h-6"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-white font-bold text-sm leading-tight">
              {/* @ts-ignore */}
              {this.props.fallbackTitle || "Application Module Crash"}
            </h3>
            <p className="text-zinc-400 text-xs leading-normal font-light">
              An unexpected error occurred in this interface panel:
            </p>
            <p className="bg-zinc-900 border border-white/5 p-2 rounded text-[10px] font-mono text-zinc-550 text-left max-h-24 overflow-y-auto break-all select-all">
              {this.state.error?.message || "Unknown error"}
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="py-1.5 px-4 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 font-semibold text-xs rounded-lg transition-colors cursor-pointer focus:outline-none"
          >
            Retry Panel Rendering
          </button>
        </div>
      );
    }

    // @ts-ignore
    return this.props.children;
  }
}
