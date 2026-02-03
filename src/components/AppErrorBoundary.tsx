import React from "react";

import { Button } from "@/components/ui/button";

type AppErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
  componentStack?: string;
};

/**
 * Prevents blank screens by catching render/commit errors and showing a recovery UI.
 * Also logs the component stack so we can pinpoint the culprit of update loops.
 */
export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Keep this as console.error so it shows up in the browser console.
    console.error("[AppErrorBoundary] Caught error:", error);
    console.error("[AppErrorBoundary] Component stack:", errorInfo.componentStack);

    this.setState({ componentStack: errorInfo.componentStack });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto max-w-3xl px-4 py-12">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The app hit a runtime error and stopped rendering to avoid a blank screen.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button type="button" onClick={this.handleReload}>
                Reload
              </Button>
              <Button type="button" variant="secondary" onClick={this.handleGoHome}>
                Go to Home
              </Button>
            </div>

            <details className="mt-6 rounded-lg border bg-muted/30 p-4">
              <summary className="cursor-pointer text-sm font-medium">
                Technical details
              </summary>
              <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">
{String(this.state.error?.stack || this.state.error?.message || "Unknown error")}

{this.state.componentStack ? `\n\nComponent stack:${this.state.componentStack}` : ""}
              </pre>
            </details>
          </div>
        </div>
      </main>
    );
  }
}
