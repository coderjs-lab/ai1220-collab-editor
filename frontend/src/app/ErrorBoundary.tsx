import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../components/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      message: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Draftboard runtime error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="editor-texture flex min-h-screen items-center justify-center px-4">
          <div className="shell-card status-glow w-full max-w-lg rounded-[32px] px-8 py-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
              Runtime error
            </p>
            <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight text-[color:var(--text)]">
              The workspace hit an unexpected client error
            </h1>
            <p className="mt-3 text-base leading-7 text-[color:var(--text-soft)]">
              {this.state.message ?? 'The app could not finish rendering this screen.'}
            </p>
            <div className="mt-6 flex justify-center">
              <Button onClick={() => window.location.reload()} variant="secondary">
                Reload app
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
