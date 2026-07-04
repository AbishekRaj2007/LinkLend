import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useMe } from "@workspace/api-client-react";

const ROLE_HOME = { lender: "/app/assess", borrower: "/borrower" } as const;

export default function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: ReactNode;
  requiredRole?: "lender" | "borrower";
}) {
  const [, setLocation] = useLocation();
  const { data, isLoading, isError } = useMe();
  const roleMismatch =
    !isLoading && !isError && requiredRole && data?.user.role !== requiredRole;

  useEffect(() => {
    if (isError) {
      setLocation("/login", { replace: true });
    } else if (roleMismatch && data) {
      // Wrong dashboard for this account's role — bounce to the right one
      // instead of erroring, so typing the wrong URL just redirects.
      setLocation(ROLE_HOME[data.user.role], { replace: true });
    }
  }, [isError, roleMismatch, data, setLocation]);

  if (isLoading || isError || roleMismatch) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
