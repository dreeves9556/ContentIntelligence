"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { registerWithToken } from "./actions";

interface RegisterFormProps {
  email: string;
  token: string;
}

export function RegisterForm({ email, token }: RegisterFormProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await registerWithToken(token, password);
      if (result && "error" in result) {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="reg-email"
          className="block text-xs font-medium text-[#787878] uppercase tracking-wider mb-2"
        >
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#3a3a3a]" />
          <input
            id="reg-email"
            type="email"
            value={email}
            disabled
            className="w-full pl-10 pr-4 py-2.5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-[#3a3a3a] text-sm cursor-not-allowed"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="reg-password"
          className="block text-xs font-medium text-[#787878] uppercase tracking-wider mb-2"
        >
          Choose Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#787878]" />
          <input
            id="reg-password"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            className="w-full pl-10 pr-10 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-[#e8e8e8] placeholder-[#3a3a3a] focus:outline-none focus:border-[#c8952a]/50 transition-colors text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#787878] hover:text-[#e8e8e8] transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#c8952a] hover:bg-[#c8952a]/90 disabled:opacity-60 disabled:cursor-not-allowed text-[#0a0a0a] font-semibold rounded-lg transition-colors"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating Account…
          </>
        ) : (
          "Create Account & Continue"
        )}
      </button>
    </form>
  );
}
