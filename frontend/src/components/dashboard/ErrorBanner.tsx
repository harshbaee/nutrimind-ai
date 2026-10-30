import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function ErrorBanner({ error, title = "Something went wrong" }: { error: unknown; title?: string }) {
  if (!error) return null;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <Alert variant="destructive" className="rounded-md">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="text-xs">{msg}</AlertDescription>
    </Alert>
  );
}
