import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useMe } from "@workspace/api-client-react";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { isLoading, isError } = useMe();

  useEffect(() => {
    if (isError) {
      setLocation("/login", { replace: true });
    }
  }, [isError, setLocation]);

  if (isLoading || isError) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
