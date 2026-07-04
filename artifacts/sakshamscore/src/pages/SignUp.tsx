import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, AlertTriangle } from "lucide-react";
import { useSignup } from "@workspace/api-client-react";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { extractErrorMessage } from "../lib/errors";
import AuthLayout from "../components/AuthLayout";
import RoleToggle, { type AuthRole } from "../components/RoleToggle";

export default function SignUp() {
  const [, setLocation] = useLocation();
  const [role, setRole] = useState<AuthRole>("lender");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msmeId, setMsmeId] = useState("");
  const signup = useSignup();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    signup.mutate(
      {
        data: {
          name,
          email,
          password,
          role,
          ...(role === "borrower" ? { msme_id: msmeId } : {}),
        },
      },
      {
        onSuccess: (data) => {
          setLocation(data.user.role === "borrower" ? "/borrower" : "/app/assess");
        },
      },
    );
  };

  const errorMessage = signup.isError
    ? extractErrorMessage(signup.error, "Something went wrong. Please try again.")
    : null;

  return (
    <AuthLayout>
      <h1 className="text-3xl font-semibold text-white text-center">
        Create account
      </h1>
      <p className="text-sm text-muted-foreground text-center mt-1.5 mb-8">
        Assess MSMEs with alternate-data SakshamScores
      </p>

      <RoleToggle value={role} onChange={setRole} />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-white/70">
            Full name
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Priya Nair"
            autoComplete="name"
            className="h-11 bg-white/5 border-white/10"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-white/70">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder={role === "borrower" ? "you@business.com" : "you@bank.com"}
            autoComplete="email"
            className="h-11 bg-white/5 border-white/10"
          />
        </div>

        {role === "borrower" && (
          <div className="space-y-1.5">
            <Label htmlFor="msmeId" className="text-white/70">
              MSME ID
            </Label>
            <Input
              id="msmeId"
              value={msmeId}
              onChange={(e) => setMsmeId(e.target.value)}
              required
              placeholder="MSME-000001"
              className="h-11 bg-white/5 border-white/10 font-mono"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-white/70">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            className="h-11 bg-white/5 border-white/10"
          />
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 flex gap-2 text-xs text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={signup.isPending}
          className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white h-11 rounded-lg text-sm font-semibold tracking-wide transition-colors"
        >
          {signup.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {signup.isPending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-white/50 mt-6">
        Already a member?{" "}
        <Link href="/login" className="text-primary font-semibold hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
