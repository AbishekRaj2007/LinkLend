import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Activity, Loader2, ArrowRight, AlertTriangle } from "lucide-react";
import { useLogin } from "@workspace/api-client-react";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { extractErrorMessage } from "../lib/errors";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center justify-center gap-2 mb-8">
          <Activity className="w-6 h-6 text-primary" />
          <span className="font-bebas text-2xl tracking-wide text-white">
            SAKSHAMSCORE
          </span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
          <h1 className="font-bebas text-3xl text-white tracking-wide mb-1">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Log in to continue assessing MSMEs.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="Your password"
                autoComplete="current-password"
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
              disabled={login.isPending}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white px-6 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-colors"
            >
              {login.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              {login.isPending ? "Logging in…" : "Log in"}
            </button>
          </form>

          <p className="text-center text-xs text-white/40 mt-6">
            Need an account?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          <Link href="/" className="hover:text-white/60">
            ← Back to home
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
