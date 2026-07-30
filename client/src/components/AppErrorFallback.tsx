import type { FallbackRender } from "@sentry/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { getErrorMessage } from "@/lib/getErrorMessage";

type AppErrorFallbackProps = Parameters<FallbackRender>[0];

export function AppErrorFallback({
  error,
  eventId,
  resetError,
}: AppErrorFallbackProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground relative overflow-hidden p-4">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md">
        <Card className="border border-border bg-card/60 backdrop-blur-md shadow-2xl rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <CardHeader className="space-y-1.5 p-6 pb-4">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground text-center">
              Something went wrong
            </CardTitle>
            <CardDescription className="text-center text-xs text-muted-foreground">
              The error has been reported automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-2 space-y-4">
            <Alert variant="destructive" className="border-red-200 bg-red-50">
              <AlertTitle className="text-red-700 font-semibold text-sm">
                Unexpected error
              </AlertTitle>
              <AlertDescription className="text-red-700/90 text-xs">
                {getErrorMessage(error)}
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button className="flex-1" onClick={resetError}>
                Try again
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => window.location.assign("/dashboard")}
              >
                Back to dashboard
              </Button>
            </div>

            {eventId && (
              <p className="text-center text-[10px] font-mono text-muted-foreground">
                Event ID: {eventId}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
