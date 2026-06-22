"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Sparkles, Mail, Lock, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsPending(true);

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    console.log("[LOGIN] Submitting:", { email, passwordLength: password?.length });

    const result = await signIn("credentials", {
      email,
      password,
      rememberMe: rememberMe ? "true" : "false",
      redirect: false,
      callbackUrl: "/dashboard",
    });

    console.log("[LOGIN] Result:", result);

    if (result?.error) {
      setError("Invalid email or password");
      setIsPending(false);
    } else if (result?.ok) {
      try {
        const statusRes = await fetch("/api/user/onboarding-status");
        const { onboardingComplete } = await statusRes.json();
        window.location.href = onboardingComplete ? "/dashboard" : "/onboarding";
      } catch {
        window.location.href = "/dashboard";
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-primary px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-8 w-8 text-accent-primary" />
            <h1 
              className="text-3xl font-bold tracking-tight text-white" 
              style={{ fontFamily: "var(--font-playfair), 'Playfair Display', serif" }}
            >
              Content Intelligence
            </h1>
          </div>
          <p className="text-text-muted text-lg" style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
            Premium content strategy platform
          </p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(new FormData(e.currentTarget)); }} className="bg-background-card rounded-lg p-8 border border-background-secondary">
          <div className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-text-primary">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-text-muted" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-background-secondary border border-background-secondary rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary/50 transition-all"
                  style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-text-primary">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-text-muted" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-background-secondary border border-background-secondary rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary/50 transition-all"
                  style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-3 text-text-muted hover:text-text-primary transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-background-secondary bg-background-secondary accent-accent-primary cursor-pointer"
              />
              <label
                htmlFor="rememberMe"
                className="text-sm text-text-muted cursor-pointer select-none"
                style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
              >
                Stay signed in for 30 days
              </label>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 px-4 bg-accent-primary text-background-primary rounded-md font-medium hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
            >
              {isPending ? "Signing in..." : "Sign In"}
            </button>

          </div>
        </form>

        <p className="text-center text-sm text-text-muted" style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
          Protected access for approved coaching clients only
        </p>
      </div>
    </div>
  );
}
