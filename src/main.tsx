import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Mero Bike Uncaught App Error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#101214] text-[#F2F4F5] flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="w-16 h-16 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/40 flex items-center justify-center text-[#EF4444] mb-4">
            <span className="text-2xl font-bold">!</span>
          </div>

          <h2 className="text-lg font-bold text-[#F2F4F5]">
            Something went wrong
          </h2>
          <p className="text-xs text-[#929BA3] max-w-sm mt-1 mb-6">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReload}
              className="px-5 py-2.5 rounded-xl bg-[#22B8CF] hover:opacity-90 text-[#071316] font-semibold text-xs transition-all duration-150 active:scale-[0.98]"
            >
              Reload Mero Bike
            </button>
            <button
              onClick={this.handleReset}
              className="px-4 py-2.5 rounded-xl bg-[#1C2024] hover:bg-[#252B30] border border-[#30383E] text-xs font-semibold text-[#929BA3] transition-all duration-150 active:scale-[0.98]"
            >
              Reset Session
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
