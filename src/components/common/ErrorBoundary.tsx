/**
 * Top-level error boundary.
 *
 * Without this, a single thrown error unmounts the whole React tree and the
 * visitor is left staring at a blank white page. `updateMember()` throws
 * "Member not found" when an id has gone stale — for example when another tab
 * deleted the record mid-batch — and `AdminBulkUpdate` loops over ids without
 * guarding, so that is a realistic path rather than a theoretical one.
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white font-outfit">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              The page hit an unexpected error. Reloading usually clears it — your saved data in this
              browser is untouched.
            </p>
          </div>

          <details className="text-left bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
            <summary className="text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-pointer select-none">
              Technical details
            </summary>
            <pre className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words max-h-32 overflow-auto">
              {error.message}
            </pre>
          </details>

          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>

          <button
            onClick={() => window.location.reload()}
            className="block w-full text-xs text-slate-500 dark:text-slate-400 hover:underline"
          >
            Reload the page
          </button>
        </div>
      </div>
    );
  }
}
