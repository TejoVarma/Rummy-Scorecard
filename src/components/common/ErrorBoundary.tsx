import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React Render Error in ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      localStorage.removeItem('rummy_active_game');
    } catch {
      // Ignore
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-100 font-sans select-none">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
              <AlertTriangle className="w-7 h-7 text-rose-400" />
            </div>
            
            <h2 className="text-lg font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              {this.state.error?.message || 'An unexpected rendering error occurred. You can reload the app to resume.'}
            </p>

            <div className="w-full flex flex-col gap-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition"
              >
                <RotateCcw className="w-4 h-4" /> Reload App
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium transition"
              >
                Reset Active Match & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
