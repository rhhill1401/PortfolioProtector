import React from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
  title?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Keep the info for UI; production apps could also log to a service here.
    this.setState({ error, errorInfo });
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    // Simple retry: reset boundary state to re-render children
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const title = this.props.title || 'Something went wrong';
    const message = this.state.error?.message || 'Unexpected error';

    return (
      <div className="p-4 border rounded-md bg-red-50 border-red-200 text-red-800">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold">{title}</h3>
          <button
            onClick={this.handleRetry}
            className="text-xs px-2 py-1 bg-white border border-red-300 rounded hover:bg-red-100"
          >
            Retry
          </button>
        </div>
        <p className="text-sm mb-2">{message}</p>
        {this.state.errorInfo?.componentStack && (
          <pre className="text-xs whitespace-pre-wrap text-red-700">
            {this.state.errorInfo.componentStack}
          </pre>
        )}
      </div>
    );
  }
}

export default ErrorBoundary;

