import "./error-boundary.styles.css";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary__icon">⚠️</div>
          <h2 className="error-boundary__title">Что-то пошло не так</h2>
          <p className="error-boundary__message">
            {this.state.error?.message || "Произошла непредвиденная ошибка"}
          </p>
          <button className="error-boundary__button" onClick={this.handleRetry}>
            Попробовать снова
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
