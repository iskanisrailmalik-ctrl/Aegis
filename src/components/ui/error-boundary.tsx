"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global React Error Boundary — Ensures Aegis never crashes to a blank screen.
 *
 * Catches unhandled JavaScript exceptions anywhere in the React component tree,
 * logs the error context, and presents a user-friendly recovery interface.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Aegis React Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  private handleResetCache = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.error("Failed to clear storage:", e);
      }
      window.location.href = "/";
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto text-amber-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-100">Something went wrong</h2>
              <p className="text-sm text-slate-400">
                Aegis encountered an unexpected interface error. Your financial data remains safe on-device.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 text-left overflow-x-auto max-h-32 text-xs font-mono text-amber-300/80">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                onClick={this.handleReload}
                className="bg-teal-600 hover:bg-teal-500 text-white flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </Button>
              <Button
                onClick={this.handleResetCache}
                variant="outline"
                className="border-slate-700 hover:bg-slate-800 text-slate-300 flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                Reset App View
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
