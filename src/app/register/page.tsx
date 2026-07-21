import { prisma } from "@/lib/prisma";
import { Crown, ShieldAlert } from "lucide-react";
import { RegisterForm } from "./RegisterForm";
import { RotatingTagline } from "@/components/RotatingTagline";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  if (!token) {
    return <InvalidLink reason="No invitation token was provided." />;
  }

  // Check both InviteToken (admin/team invite) and PendingStripeInvite (public checkout)
  const [invite, pendingInvite] = await Promise.all([
    prisma.inviteToken.findUnique({ where: { token } }),
    prisma.pendingStripeInvite.findUnique({ where: { token } }),
  ]);

  if (!invite && !pendingInvite) {
    return <InvalidLink reason="This invitation link is invalid or has already been used." />;
  }

  const activeInvite = invite ?? pendingInvite!;

  if (activeInvite.expiresAt < new Date()) {
    return <InvalidLink reason="This invitation link has expired. Please request a new one." />;
  }

  const isPaidRegistration = !!pendingInvite;
  const email = activeInvite.email;

  return (
    <div className="min-h-screen bg-background-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Crown className="h-7 w-7 text-accent-primary" />
          <span
            className="text-2xl font-bold text-text-primary"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            The Local Post
          </span>
        </div>
        <div className="text-center mb-8">
          <RotatingTagline />
        </div>

        <div className="bg-background-card rounded-xl border border-border-primary p-8 shadow-2xl">
          <div className="mb-8">
            <h1
              className="text-2xl font-bold text-text-primary mb-2"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Create Your Account
            </h1>
            <p className="text-sm text-text-muted">
              {isPaidRegistration
                ? "Your membership is active. Set your password to access your account."
                : "You've been invited to join The Local Post. Set your password to get started."}
            </p>
          </div>

          <RegisterForm email={email} token={token} />
        </div>

        <p className="text-center text-xs text-text-muted mt-6">
          This link is single-use and expires {isPaidRegistration ? "14" : "7"} days after it was issued.
        </p>
      </div>
    </div>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  return (
    <div className="min-h-screen bg-background-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Crown className="h-7 w-7 text-accent-primary" />
          <span
            className="text-2xl font-bold text-text-primary"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            The Local Post
          </span>
        </div>

        <div className="bg-background-card rounded-xl border border-red-500/20 p-8 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-8 w-8 text-red-400" />
          </div>
          <h1
            className="text-xl font-bold text-text-primary mb-2"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Invalid Invitation Link
          </h1>
          <p className="text-sm text-text-muted">{reason}</p>
        </div>
      </div>
    </div>
  );
}
