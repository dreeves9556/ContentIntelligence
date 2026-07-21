import { CheckCircle2, Mail, ArrowRight, Home } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Welcome to The Local Post — Checkout Complete",
  description: "Your membership is being activated. Check your email to finish setting up your account.",
};

interface SuccessPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: SuccessPageProps) {
  const { session_id } = await searchParams;

  return (
    <div className="min-h-screen bg-background-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Masthead */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span
              className="text-2xl font-bold text-text-primary"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              The Local Post
            </span>
          </div>
          <p className="text-xs font-semibold text-accent-primary tracking-widest uppercase">
            Your Town. Your Post.
          </p>
        </div>

        <div className="bg-background-card rounded-xl border border-border-primary p-8 shadow-2xl">
          {/* Success icon */}
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>

          <h1
            className="text-2xl font-bold text-text-primary text-center mb-3"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            You&apos;re In. Welcome to The Local Post.
          </h1>

          <p className="text-sm text-text-muted text-center mb-6 leading-relaxed">
            Your membership is being activated. We&apos;ve sent a registration link to your email
            so you can set your password and access your account.
          </p>

          {/* Instructions */}
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3 p-4 bg-background-secondary rounded-lg border border-border-primary">
              <Mail className="h-5 w-5 text-accent-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-text-primary">Check your email</p>
                <p className="text-xs text-text-muted mt-1">
                  Look for a message from The Local Post with a link to create your account.
                  The link expires in 14 days.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-background-secondary rounded-lg border border-border-primary">
              <ArrowRight className="h-5 w-5 text-accent-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-text-primary">Already have an account?</p>
                <p className="text-xs text-text-muted mt-1">
                  If you used an email that&apos;s already registered, your membership has been
                  applied. Just log in to access your upgraded account.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/login"
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-accent-primary hover:bg-accent-primary/90 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              Member Login
            </Link>
            <Link
              href="/"
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-background-secondary hover:bg-background-secondary/80 border border-border-primary text-text-primary font-semibold rounded-lg transition-colors text-sm"
            >
              <Home className="h-4 w-4" />
              Back to Home
            </Link>
          </div>

          {session_id && (
            <p className="text-center text-xs text-text-muted mt-6">
              Session ID: {session_id.slice(0, 20)}…
            </p>
          )}
        </div>

        <p className="text-center text-xs text-text-muted mt-6">
          Didn&apos;t receive an email? Check your spam folder or contact support.
        </p>
      </div>
    </div>
  );
}
