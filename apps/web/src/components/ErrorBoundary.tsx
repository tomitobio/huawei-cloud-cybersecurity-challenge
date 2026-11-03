import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. Without it, any render error unmounts the whole
 * React tree and leaves a blank page (which looks like "nothing works").
 * Here we surface the problem and offer a reload instead.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto mt-16 max-w-lg rounded-xl border border-accent/40 bg-base-850 p-6 text-center space-y-3">
          <h1 className="text-lg font-semibold text-white">Algo salió mal / Something went wrong</h1>
          <p className="text-sm text-slate-400">{this.state.error.message}</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Recargar / Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
