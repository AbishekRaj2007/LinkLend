import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, AlertTriangle } from "lucide-react";
import { useLogin } from "@workspace/api-client-react";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { extractErrorMessage } from "../lib/errors";
import AuthLayout from "../components/AuthLayout";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const login = useLogin();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(
      { data: { email, password } },
      { onSuccess: () => setLocation("/app/assess") },
    );
  };

  const errorMessage = login.isError
    ? extractErrorMessage(login.error, "Something went wrong. Please try again.")
    : null;

  return (
    <AuthLayout>
      <h1 className="text-3xl font-semibold text-white text-center">Login</h1>
      <p className="text-sm text-muted-foreground text-center mt-1.5 mb-8">
        Enter your credentials to access your account
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
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
            placeholder="you@bank.com"
            autoComplete="email"
            className="h-11 bg-white/5 border-white/10"
          />
        </div>

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
            placeholder="••••••••"
            autoComplete="current-password"
            className="h-11 bg-white/5 border-white/10"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer select-none">
          <Checkbox
            checked={remember}
            onCheckedChange={(v) => setRemember(v === true)}
          />
          Remember me
        </label>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 flex gap-2 text-xs text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={login.isPending}
          className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white h-11 rounded-lg text-sm font-semibold tracking-wide transition-colors"
        >
          {login.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {login.isPending ? "Logging in…" : "Login"}
        </button>
      </form>

      <p className="text-center text-sm text-white/50 mt-6">
        Not a member?{" "}
        <Link href="/signup" className="text-primary font-semibold hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
