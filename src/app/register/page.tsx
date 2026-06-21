import { prisma } from "@/lib/prisma";
import { Crown, ShieldAlert } from "lucide-react";
import { RegisterForm } from "./RegisterForm";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  if (!token) {
    return <InvalidLink reason="No invitation token was provided." />;
  }

  const invite = await prisma.inviteToken.findUnique({ where: { token } });

  if (!invite) {
    return <InvalidLink reason="This invitation link is invalid or has already been used." />;
  }

  if (invite.expiresAt < new Date()) {
    return <InvalidLink reason="This invitation link has expired. Please ask your admin to send a new one." />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Crown className="h-7 w-7 text-[#c8952a]" />
          <span
            className="text-2xl font-bold text-[#e8e8e8]"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Core OS
          </span>
        </div>

        <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] p-8 shadow-2xl">
          <div className="mb-8">
            <h1
              className="text-2xl font-bold text-[#e8e8e8] mb-2"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Create Your Account
            </h1>
            <p className="text-sm text-[#787878]">
              You&apos;ve been invited to join Core OS. Set your password to get started.
            </p>
          </div>

          <RegisterForm email={invite.email} token={token} />
        </div>

        <p className="text-center text-xs text-[#3a3a3a] mt-6">
          This link is single-use and expires 7 days after it was issued.
        </p>
      </div>
    </div>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Crown className="h-7 w-7 text-[#c8952a]" />
          <span
            className="text-2xl font-bold text-[#e8e8e8]"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Core OS
          </span>
        </div>

        <div className="bg-[#111111] rounded-xl border border-red-500/20 p-8 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-8 w-8 text-red-400" />
          </div>
          <h1
            className="text-xl font-bold text-[#e8e8e8] mb-2"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Invalid Invitation Link
          </h1>
          <p className="text-sm text-[#787878]">{reason}</p>
        </div>
      </div>
    </div>
  );
}
