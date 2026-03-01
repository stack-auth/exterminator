import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="flex flex-col items-start gap-4 rounded-xl border border-red-900/60 bg-red-950/20 p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-900/40 text-lg">
              ✕
            </span>
            <div>
              <p className="text-sm font-semibold text-red-400">
                Unhandled Runtime Error
              </p>
              <p className="text-xs text-red-300/60 mt-0.5">
                This page crashed — see details below
              </p>
            </div>
          </div>

          <div className="w-full rounded-lg border border-red-900/40 bg-zinc-950 p-4">
            <p className="text-sm font-mono text-red-300">{error.message}</p>
          </div>

          {error.stack && (
            <details className="w-full">
              <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-400 transition-colors">
                Stack trace
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-[11px] leading-5 text-zinc-500 whitespace-pre-wrap">
                {error.stack}
              </pre>
            </details>
          )}

          <button
            onClick={() => this.setState({ error: null })}
            className="rounded-lg border border-red-800/60 px-4 py-1.5 text-xs text-red-400 hover:bg-red-950/40 transition-colors"
          >
            Dismiss
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
