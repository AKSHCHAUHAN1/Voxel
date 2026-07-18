import React from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

/**
 * ErrorBoundary — Catches rendering crashes and displays a clean fallback UI.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an execution error', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] w-full flex items-center justify-center p-8 text-center select-none bg-slate-50 dark:bg-[#030509]">
          <div className="max-w-md mx-auto space-y-6">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <AlertOctagon size={24} />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Something went wrong</h2>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                An unexpected runtime error occurred inside this section of the layout workspace.
              </p>
              {this.state.error?.message && (
                <pre className="p-3 rounded-lg bg-slate-100 dark:bg-white/5 font-mono text-[10px] text-left overflow-x-auto border border-slate-200/50 dark:border-white/5 text-slate-600 dark:text-slate-350">
                  <code>{this.state.error.message}</code>
                </pre>
              )}
            </div>

            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
            >
              <RotateCcw size={12} /> Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
