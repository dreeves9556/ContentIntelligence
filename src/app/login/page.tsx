"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { Newspaper, Mail, Lock, AlertCircle, Eye, EyeOff, CheckCircle2, ArrowLeft, Calendar, BarChart3, Brain } from "lucide-react";
import { requestPasswordReset } from "./password-reset-actions";
import { RotatingTagline } from "@/components/RotatingTagline";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetPending, setResetPending] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    );
  }, []);

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);
    setResetPending(true);

    const result = await requestPasswordReset(resetEmail);

    setResetPending(false);

    if (result.success) {
      setResetSuccess(true);
    } else {
      setResetError(result.error ?? "Something went wrong. Please try again.");
    }
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsPending(true);

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const result = await signIn("credentials", {
      email,
      password,
      rememberMe: rememberMe ? "true" : "false",
      redirect: false,
      callbackUrl: "/dashboard",
    });

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
    <div className="h-screen flex bg-background-secondary overflow-hidden">
      {/* ── Left Panel: Editorial Hero (desktop only) ── */}
      <div className="hidden lg:flex flex-col justify-between w-[60%] bg-background-primary px-10 py-6 overflow-hidden">
        {/* Top: Masthead */}
        <div className="relative animate-fade-in-up" style={{ animationDelay: "0ms" }}>
          {/* Double rules — newspaper masthead convention */}
          <div className="border-t-2 border-border-secondary mb-1" />
          <div className="border-t border-border-secondary mb-3" />
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Newspaper className="h-7 w-7 text-accent-primary shrink-0" />
              <h1
                className="text-2xl font-bold tracking-tight text-text-primary"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                The Local Post
              </h1>
            </div>
            <span
              className="text-xs uppercase tracking-wider text-text-muted"
              style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
            >
              Est. 2026
            </span>
          </div>
          <div className="border-t border-border-secondary mb-1" />
          <div className="border-t-2 border-border-secondary mb-5" />

          {/* Dateline */}
          <p
            className="text-xs uppercase tracking-wider text-text-muted mb-4"
            style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
          >
            {today || "Today"} &middot; Vol. I, No. 1
          </p>

          {/* Hero headline */}
          <h2
            className="text-[2.25rem] leading-[1.1] font-bold text-text-primary mb-2"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Your town&apos;s front page, ready to fill.
          </h2>

          {/* Subheadline */}
          <p
            className="text-sm text-text-muted leading-relaxed max-w-md"
            style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
          >
            The content platform for local experts.
            Plan, write, and publish like a newsroom.
          </p>
        </div>

        {/* Middle: Feature cards — newspaper article previews */}
        <div className="relative flex-1 flex flex-col gap-3 my-6 min-h-0">
          {[
            { icon: Calendar, label: "The Editorial Desk", title: "Plan your week", body: "AI-generated content calendars tailored to your market.", delay: "100ms" },
            { icon: BarChart3, label: "The Analytics Desk", title: "Track your reach", body: "See what resonates across every platform you publish to.", delay: "200ms" },
            { icon: Brain, label: "The Newsroom", title: "Your AI editor", body: "A brand brain that learns your voice and sharpens every post.", delay: "300ms" },
          ].map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.label}
                className="animate-fade-in-up flex-1 bg-background-secondary border border-border-primary rounded-lg p-5 transition-colors hover:border-border-secondary flex flex-col justify-center"
                style={{ animationDelay: feature.delay }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center h-11 w-11 rounded-md bg-accent-primary/10 shrink-0">
                    <Icon className="h-5 w-5 text-accent-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs uppercase tracking-wider text-text-muted mb-1"
                      style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
                    >
                      {feature.label}
                    </p>
                    <h3
                      className="text-lg font-semibold text-text-primary mb-1"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {feature.title}
                    </h3>
                    <p
                      className="text-sm text-text-muted leading-relaxed"
                      style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
                    >
                      {feature.body}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom: Tagline + Content pillar labels */}
        <div className="relative space-y-3 animate-fade-in-up" style={{ animationDelay: "400ms" }}>
          <RotatingTagline />
          <div className="border-t border-border-primary" />
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand-personal" />
              <span
                className="text-xs uppercase tracking-wider text-text-muted"
                style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
              >
                Personal
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand-expert" />
              <span
                className="text-xs uppercase tracking-wider text-text-muted"
                style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
              >
                Expert
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand-local" />
              <span
                className="text-xs uppercase tracking-wider text-text-muted"
                style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
              >
                Local
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Divider: Newspaper double-rule ── */}
      <div className="hidden lg:flex shrink-0">
        <div className="w-px bg-border-secondary" />
        <div className="w-[3px] bg-background-primary" />
        <div className="w-px bg-border-secondary" />
      </div>

      {/* ── Right Panel: Auth Form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 relative">
        {/* Theme toggle — top right corner */}
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md space-y-6">
          {/* Mobile/compact masthead (shown when left panel hidden) */}
          <div className="text-center space-y-3 lg:hidden">
            <div className="border-t border-border-secondary mb-4" />
            <div className="flex items-center justify-center gap-2">
              <Newspaper className="h-7 w-7 text-accent-primary shrink-0" />
              <h1
                className="text-2xl font-bold tracking-tight text-text-primary"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                The Local Post
              </h1>
            </div>
            <div className="border-t border-border-secondary mb-2" />
            <RotatingTagline />
          </div>

          {/* Desktop welcome heading */}
          <div className="hidden lg:block space-y-2 animate-fade-in-up" style={{ animationDelay: "150ms" }}>
            <p
              className="text-xs uppercase tracking-wider text-text-muted"
              style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
            >
              Welcome Back
            </p>
            <h2
              className="text-2xl font-bold text-text-primary"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Sign in to your edition
            </h2>
            <div className="border-t border-border-primary pt-4" />
          </div>

        {showForgot ? (
          <div className="bg-background-card rounded-lg p-6 border border-border-primary animate-fade-in-up" style={{ animationDelay: "250ms" }}>
            {resetSuccess ? (
              <div className="space-y-6">
                <div className="flex items-center gap-2 p-3 bg-brand-local/10 border border-brand-local/20 rounded-md text-brand-local text-sm">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  <span>If an account exists for that email, reset instructions have been sent.</span>
                </div>
                <button
                  onClick={() => {
                    setShowForgot(false);
                    setResetSuccess(false);
                    setResetEmail("");
                  }}
                  className="w-full py-2.5 px-4 bg-background-secondary text-text-primary rounded-md font-medium hover:bg-background-secondary/80 transition-colors"
                  style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetRequest} className="space-y-6">
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowForgot(false)}
                    className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors"
                    style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to sign in
                  </button>
                  <h2 className="text-xl font-semibold text-text-primary" style={{ fontFamily: "var(--font-serif), 'Playfair Display', serif" }}>
                    Reset Password
                  </h2>
                  <p className="text-sm text-text-muted" style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
                    Enter your account email and we&apos;ll send you a link to reset your password.
                  </p>
                </div>

                {resetError && (
                  <div className="flex items-center gap-2 p-3 bg-brand-personal/10 border border-brand-personal/20 rounded-md text-brand-personal text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{resetError}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="reset-email" className="text-sm font-medium text-text-primary">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-text-muted" />
                    <input
                      id="reset-email"
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-background-secondary border border-border-primary rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary/50 transition-all"
                      style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={resetPending}
                  className="w-full py-2.5 px-4 bg-accent-primary text-background-primary rounded-md font-medium hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
                >
                  {resetPending ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            )}
          </div>
        ) : (
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(new FormData(e.currentTarget)); }} className="bg-background-card rounded-lg p-6 border border-border-primary animate-fade-in-up" style={{ animationDelay: "250ms" }}>
          <div className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-brand-personal/10 border border-brand-personal/20 rounded-md text-brand-personal text-sm">
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
                  className="w-full pl-10 pr-4 py-2.5 bg-background-secondary border border-border-primary rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary/50 transition-all"
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
                  className="w-full pl-10 pr-10 py-2.5 bg-background-secondary border border-border-primary rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary/50 transition-all"
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

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-border-primary bg-background-secondary accent-accent-primary cursor-pointer"
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
                type="button"
                onClick={() => {
                  setShowForgot(true);
                  setError(null);
                }}
                className="text-sm text-accent-primary hover:text-accent-primary/80 transition-colors"
                style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
              >
                Forgot password?
              </button>
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
        )}

        <p className="text-center text-sm text-text-muted" style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
          Invite-only access for The Local Post community
        </p>
        </div>
      </div>
    </div>
  );
}
