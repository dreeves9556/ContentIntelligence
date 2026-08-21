"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

interface CommunityInquiryFormProps {
  initialName?: string | null;
  initialEmail?: string | null;
}

interface FormFields {
  name: string;
  email: string;
  organization: string;
  estimatedMembers: string;
  message: string;
}

const EMPTY_FIELDS: FormFields = {
  name: "",
  email: "",
  organization: "",
  estimatedMembers: "",
  message: "",
};

export default function CommunityInquiryForm({
  initialName,
  initialEmail,
}: CommunityInquiryFormProps) {
  const [fields, setFields] = useState<FormFields>({
    ...EMPTY_FIELDS,
    name: initialName ?? "",
    email: initialEmail ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(field: keyof FormFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitted(false);
    setError(null);

    try {
      const response = await fetch("/api/community-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, requestId: crypto.randomUUID() }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "We could not send your inquiry. Please try again.");
        return;
      }

      setSubmitted(true);
      setFields(EMPTY_FIELDS);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400" role="status">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <p>Thanks. Dylan will be in touch to discuss a custom Communities plan.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="community-inquiry-name" className="text-sm font-medium text-text-primary block mb-1">
            Name
          </label>
          <input
            id="community-inquiry-name"
            name="name"
            type="text"
            required
            maxLength={100}
            autoComplete="name"
            value={fields.name}
            onChange={(event) => updateField("name", event.target.value)}
            className="w-full px-3 py-2 bg-background-card border border-border-primary rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50"
            placeholder="Your name"
          />
        </div>
        <div>
          <label htmlFor="community-inquiry-email" className="text-sm font-medium text-text-primary block mb-1">
            Email
          </label>
          <input
            id="community-inquiry-email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            value={fields.email}
            onChange={(event) => updateField("email", event.target.value)}
            className="w-full px-3 py-2 bg-background-card border border-border-primary rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50"
            placeholder="you@company.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="community-inquiry-organization" className="text-sm font-medium text-text-primary block mb-1">
          Organization
        </label>
        <input
          id="community-inquiry-organization"
          name="organization"
          type="text"
          required
          maxLength={120}
          autoComplete="organization"
          value={fields.organization}
          onChange={(event) => updateField("organization", event.target.value)}
          className="w-full px-3 py-2 bg-background-card border border-border-primary rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50"
          placeholder="Your company or team"
        />
      </div>

      <div>
        <label htmlFor="community-inquiry-members" className="text-sm font-medium text-text-primary block mb-1">
          Estimated members
        </label>
        <input
          id="community-inquiry-members"
          name="estimatedMembers"
          type="text"
          required
          maxLength={50}
          value={fields.estimatedMembers}
          onChange={(event) => updateField("estimatedMembers", event.target.value)}
          className="w-full px-3 py-2 bg-background-card border border-border-primary rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50"
          placeholder="e.g. 5, 10–20, or 25+"
        />
      </div>

      <div>
        <label htmlFor="community-inquiry-message" className="text-sm font-medium text-text-primary block mb-1">
          How can we help?
        </label>
        <textarea
          id="community-inquiry-message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          value={fields.message}
          onChange={(event) => updateField("message", event.target.value)}
          className="w-full px-3 py-2 bg-background-card border border-border-primary rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50 resize-y"
          placeholder="Tell us about your team and what you need."
        />
      </div>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 py-3 bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending inquiry…
          </>
        ) : (
          "Talk to us about Communities"
        )}
      </button>
    </form>
  );
}
