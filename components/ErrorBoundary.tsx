
import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

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
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-red-950 z-[100] text-white font-mono p-8 overflow-auto flex flex-col items-start justify-center">
          <div className="max-w-3xl w-full mx-auto border-4 border-white p-6 bg-black shadow-2xl">
             <h1 className="text-4xl font-bold bg-white text-black px-4 py-2 mb-6 inline-block">SYSTEM_FAILURE</h1>
             
             <div className="border border-red-500/50 p-4 mb-6 bg-red-900/20">
                <p className="text-red-500 font-bold mb-2">KERNEL PANIC: UNRECOVERABLE EXCEPTION</p>
                <p className="text-xl mb-4">{this.state.error?.toString()}</p>
             </div>

             <details className="text-xs text-zinc-500 mb-6 bg-zinc-900 p-4 overflow-x-auto whitespace-pre">
                <summary className="cursor-pointer hover:text-white mb-2">[+] EXPAND STACK TRACE</summary>
                {this.state.errorInfo?.componentStack}
             </details>

             <div className="flex gap-4">
                <button 
                    onClick={() => window.location.reload()}
                    className="bg-white text-black px-6 py-3 font-bold hover:bg-zinc-200 transition-colors uppercase tracking-widest"
                >
                    INITIATE_HARD_RESET
                </button>
             </div>
             
             <div className="mt-8 text-[10px] text-zinc-600">
                ERROR_CODE: 0xDEADBEEF // MEMORY_DUMP_COMPLETE
             </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
