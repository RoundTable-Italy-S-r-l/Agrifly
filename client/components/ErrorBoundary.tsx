import React, { useState, useCallback, ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetError }) => {
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
              {error.message || "Errore sconosciuto"}
            </p>
            {process.env.NODE_ENV === "development" && (
              <details className="mt-2">
                <summary className="text-xs text-red-700 cursor-pointer">
                  Dettagli tecnici (solo in sviluppo)
                </summary>
                <pre className="mt-2 text-xs text-red-600 overflow-auto max-h-60 bg-red-100 p-2 rounded">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>

          <div className="flex gap-3">
            <Button onClick={resetError} variant="default">
              Riprova
            </Button>
            <Button
              onClick={() => (window.location.href = "/")}
              variant="outline"
            >
              Torna alla Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children, fallback }) => {
  const [error, setError] = useState<Error | null>(null);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error("❌ Error caught by ErrorBoundary:", error);
    setError(error);
  }, []);

  React.useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      handleError(event.error);
    };

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      handleError(new Error(event.reason));
    };

    window.addEventListener("error", errorHandler);
    window.addEventListener("unhandledrejection", rejectionHandler);

    return () => {
      window.removeEventListener("error", errorHandler);
      window.removeEventListener("unhandledrejection", rejectionHandler);
    };
  }, [handleError]);

  if (error) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return <ErrorFallback error={error} resetError={resetError} />;
  }

  try {
    return <>{children}</>;
  } catch (caughtError) {
    handleError(caughtError as Error);
    return null;
  }
};
