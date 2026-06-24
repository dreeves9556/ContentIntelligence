"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Sparkles, Lock, AlertCircle, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { resetPassword } from "@/app/login/password-reset-actions";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link. Please request a new password reset.");
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsPending(true);
    const result = await resetPassword(token!, password);
    setIsPending(false);

    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error ?? "Something went wrong. Please try again.");
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
        </div>

        <div className="bg-background-card rounded-lg p-8 border border-background-secondary">
          {success ? (
            <div className="space-y-6">
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-emerald-400 text-sm">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>Your password has been reset successfully.</span>
              </div>
              <button
                onClick={() => router.push("/login")}
                className="w-full py-2.5 px-4 bg-accent-primary text-background-primary rounded-md font-medium hover:bg-accent-primary/90 transition-colors"
                style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <h2
                  className="text-xl font-semibold text-white"
                  style={{ fontFamily: "var(--font-playfair), 'Playfair Display', serif" }}
                >
                  Set New Password
                </h2>
                <p
                  className="text-sm text-text-muted"
                  style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
                >
                  Enter your new password below.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-text-primary">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-text-muted" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    disabled={!token}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 chars, 1 letter & 1 number"
                    className="w-full pl-10 pr-10 py-2.5 bg-background-secondary border border-background-secondary rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary/50 transition-all disabled:opacity-50"
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

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-text-primary">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-text-muted" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    disabled={!token}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full pl-10 pr-4 py-2.5 bg-background-secondary border border-background-secondary rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary/50 transition-all disabled:opacity-50"
                    style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending || !token}
                className="w-full py-2.5 px-4 bg-accent-primary text-background-primary rounded-md font-medium hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
              >
                {isPending ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
