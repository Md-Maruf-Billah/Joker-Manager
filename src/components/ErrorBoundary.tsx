import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";
import { Panel } from "./Panel";

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="grid min-h-screen place-items-center bg-felt-950 px-4 py-10 text-paper">
        <Panel className="w-full max-w-xl p-5">
          <h1 className="text-2xl font-black">Page could not load</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            App caught a display error instead of showing a blank screen. Refresh after latest build finishes.
          </p>
          <pre className="mt-4 max-h-44 overflow-auto rounded-md border border-paper/10 bg-ink p-3 text-xs text-muted">
            {this.state.error.message}
          </pre>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </Panel>
      </main>
    );
  }
}

