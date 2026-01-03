import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ Error caught by ErrorBoundary:', error);
    console.error('❌ Error info:', errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // In produzione, potresti inviare l'errore a un servizio di logging
    // Es: Sentry, LogRocket, etc.
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-red-600" />
                <CardTitle className="text-xl font-bold text-slate-900">
                  Si è verificato un errore
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-medium text-red-900 mb-2">
                  {this.state.error?.message || 'Errore sconosciuto'}
                </p>
                {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-xs text-red-700 cursor-pointer">
                      Dettagli tecnici (solo in sviluppo)
                    </summary>
                    <pre className="mt-2 text-xs text-red-600 overflow-auto max-h-60 bg-red-100 p-2 rounded">
                      {this.state.error?.stack}
                      {'\n\n'}
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
              
              <div className="flex gap-3">
                <Button
                  onClick={this.handleReset}
                  variant="default"
                >
                  Riprova
                </Button>
                <Button
                  onClick={() => window.location.href = '/'}
                  variant="outline"
                >
                  Torna alla Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

