"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { User, Save, Loader2, CheckCircle2, Building2, ImageIcon, Mail } from "lucide-react";
import type { AdminAuthorProfile } from "./actions";
import { updateAdminAuthorProfile } from "./actions";

export default function AuthorProfileForm({ initial }: { initial: AdminAuthorProfile }) {
  const [form, setForm] = useState(initial);
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(field: keyof AdminAuthorProfile, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startSave(async () => {
      const result = await updateAdminAuthorProfile(form);
      if (result.success) {
        setSaved(true);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  const displayName = form.displayName.trim();
  const previewInitials = displayName
    ? displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <form onSubmit={handleSubmit} className="bg-[#111111] rounded-xl border border-[#1a1a1a] overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1a1a1a]">
        <div className="p-2 bg-[#c8952a]/10 rounded-lg">
          <User className="h-4 w-4 text-[#c8952a]" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[#e8e8e8]" style={{ fontFamily: "var(--font-playfair)" }}>
            Author Profile
          </h2>
          <p className="text-xs text-[#787878]">Shown as the byline on articles you publish</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Preview + headshot side by side on larger screens */}
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* Live preview */}
          <div className="shrink-0 flex flex-col items-center gap-3">
            <p className="text-[10px] font-bold tracking-wider uppercase text-[#787878]">Preview</p>
            <div className="flex items-center gap-3 bg-[#0a0a0a] rounded-xl border border-[#2a2a2a] px-4 py-3">
              {form.image.trim() ? (
                <div className="relative h-10 w-10 rounded-full overflow-hidden shrink-0 border border-[#2a2a2a]">
                  <Image
                    src={form.image.trim()}
                    alt={displayName || "Author"}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="h-10 w-10 rounded-full bg-[#c8952a]/10 border border-[#c8952a]/20 flex items-center justify-center text-[#c8952a] text-sm font-bold shrink-0">
                  {previewInitials}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#e8e8e8] leading-tight">
                  {displayName || "Your Name"}
                </p>
                {form.organization.trim() && (
                  <p className="text-xs text-[#787878] leading-tight mt-0.5">{form.organization.trim()}</p>
                )}
                {form.contactEmail.trim() && (
                  <a
                    href={`mailto:${form.contactEmail.trim()}`}
                    className="text-xs text-[#c8952a] leading-tight mt-0.5 hover:underline inline-flex items-center gap-1"
                  >
                    <Mail className="h-3 w-3" />
                    {form.contactEmail.trim()}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Fields */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Display name */}
            <div>
              <label className="block text-xs font-bold tracking-wider text-[#787878] uppercase mb-1.5">
                Display Name <span className="text-[#c8952a]">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#3a3a3a]" />
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) => handleChange("displayName", e.target.value)}
                  placeholder="e.g. Sarah Williams"
                  className="w-full pl-9 pr-4 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-[#e8e8e8] placeholder:text-[#3a3a3a] focus:outline-none focus:ring-2 focus:ring-[#c8952a]/40 text-sm"
                />
              </div>
            </div>

            {/* Organization */}
            <div>
              <label className="block text-xs font-bold tracking-wider text-[#787878] uppercase mb-1.5">
                Organization / Title <span className="text-[#3a3a3a] font-normal normal-case tracking-normal">optional</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#3a3a3a]" />
                <input
                  type="text"
                  value={form.organization}
                  onChange={(e) => handleChange("organization", e.target.value)}
                  placeholder="e.g. Core OS · Content Coach"
                  className="w-full pl-9 pr-4 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-[#e8e8e8] placeholder:text-[#3a3a3a] focus:outline-none focus:ring-2 focus:ring-[#c8952a]/40 text-sm"
                />
              </div>
            </div>

            {/* Headshot URL */}
            <div>
              <label className="block text-xs font-bold tracking-wider text-[#787878] uppercase mb-1.5">
                Headshot URL <span className="text-[#3a3a3a] font-normal normal-case tracking-normal">optional</span>
              </label>
              <div className="relative">
                <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#3a3a3a]" />
                <input
                  type="url"
                  value={form.image}
                  onChange={(e) => handleChange("image", e.target.value)}
                  placeholder="https://…"
                  className="w-full pl-9 pr-4 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-[#e8e8e8] placeholder:text-[#3a3a3a] focus:outline-none focus:ring-2 focus:ring-[#c8952a]/40 text-sm"
                />
              </div>
              <p className="text-xs text-[#3a3a3a] mt-1">Paste a direct image URL (e.g. from Cloudinary, Supabase Storage, or any CDN)</p>
            </div>

            {/* Contact email */}
            <div>
              <label className="block text-xs font-bold tracking-wider text-[#787878] uppercase mb-1.5">
                Contact Email <span className="text-[#3a3a3a] font-normal normal-case tracking-normal">optional</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#3a3a3a]" />
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => handleChange("contactEmail", e.target.value)}
                  placeholder="e.g. sarah@example.com"
                  className="w-full pl-9 pr-4 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-[#e8e8e8] placeholder:text-[#3a3a3a] focus:outline-none focus:ring-2 focus:ring-[#c8952a]/40 text-sm"
                />
              </div>
              <p className="text-xs text-[#3a3a3a] mt-1">Shown as a clickable mailto link in your article byline</p>
            </div>
          </div>
        </div>

        {/* Save button + feedback */}
        {error && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
          <button
            type="submit"
            disabled={saving || !form.displayName.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-[#c8952a] text-[#0a0a0a] font-semibold text-sm rounded-lg hover:bg-[#c8952a]/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Profile
          </button>
        </div>
      </div>
    </form>
  );
}
