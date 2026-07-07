"use server";

import { Resend } from "resend";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAnthropicApiKey, getAnthropicModel } from "@/lib/platform-config";

export type EmailSegment = "all" | "CALENDAR_ONLY" | "CREATOR" | "PRO" | "connected" | "unconnected";

export interface BroadcastResult {
  success: boolean;
  sent: number;
  failed: number;
  errors: string[];
}

export async function enhanceWithAI(plainText: string): Promise<{ success: boolean; html?: string; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  if (!plainText.trim()) {
    return { success: false, error: "Please write some content first." };
  }

  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    return { success: false, error: "AI service not configured." };
  }

  const model = await getAnthropicModel();

  const systemPrompt = `You are an expert email designer for "The Local Post" — a premium content intelligence platform for real estate agents and local business owners.

Your job: take the admin's plain-text announcement and transform it into a beautiful, branded HTML email.

BRAND GUIDELINES (must follow exactly):
- Font: Georgia, 'Times New Roman', serif for headings and the wordmark. Arial, sans-serif for body text.
- Colors: White background (#FFFFFF), off-white header/footer (#F7F9FC), ink text (#101418), muted text (#5B6472), blue accent (#1E56D6), border (#E2E8F0).
- Layout: max-width 480px, centered, rounded corners (12px on outer, 8px on inner cards), 1px solid #E2E8F0 border.
- Header: "The Local Post" wordmark in Georgia serif, 24px, bold, centered. Below it a small uppercase tagline in blue (#1E56D6) with letter-spacing.
- Body: 32px padding. Heading in Georgia serif 22px bold. Body text 14px, muted color, 1.6 line-height.
- Buttons: blue background (#1E56D6), white text, 6px border-radius, 12px 28px padding, inline-block.
- Footer: off-white background, centered, 11px muted text: "The Local Post — Be the local authority."
- NEVER use the colors #0a0a0a, #111111, #c8952a, or any dark/gold palette — those are admin-only colors.
- Use inline CSS styles on every element (email-safe). No <style> tags, no classes, no external CSS.
- Do NOT include <html>, <head>, or <body> tags — return only the inner <div> email template.
- Do NOT include placeholder links unless the admin's text explicitly mentions a URL or action.

Take the admin's raw text and make it feel like a premium editorial email. Preserve all the information they wrote — don't add facts, don't remove content. Just make it beautiful.

Return ONLY the HTML. No explanation, no markdown, no backticks.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: `Here is the announcement to transform into a branded HTML email:\n\n---\n${plainText}\n---` }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI ENHANCE] Anthropic error:", errorText);
      return { success: false, error: `AI service error (${response.status})` };
    }

    const data = await response.json();
    const html = data.content?.[0]?.text?.trim() || "";

    if (!html) {
      return { success: false, error: "AI returned empty response." };
    }

    return { success: true, html };
  } catch (err) {
    console.error("[AI ENHANCE] Failed:", err);
    return { success: false, error: "Failed to enhance email with AI." };
  }
}

export async function sendBroadcast(
  subject: string,
  htmlContent: string,
  segment: EmailSegment
): Promise<BroadcastResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, sent: 0, failed: 0, errors: ["Unauthorized"] };
  }

  if (!subject.trim() || !htmlContent.trim()) {
    return { success: false, sent: 0, failed: 0, errors: ["Subject and content are required."] };
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const resend = new Resend(process.env.RESEND_API_KEY);

  let users: { email: string | null }[] = [];

  if (segment === "all") {
    users = await prisma.user.findMany({
      where: { email: { not: null } },
      select: { email: true },
    });
  } else if (segment === "connected") {
    users = await prisma.user.findMany({
      where: {
        email: { not: null },
        zernioAccounts: { some: {} },
      },
      select: { email: true },
      distinct: ["id"],
    });
  } else if (segment === "unconnected") {
    users = await prisma.user.findMany({
      where: {
        email: { not: null },
        zernioAccounts: { none: {} },
      },
      select: { email: true },
    });
  } else {
    users = await prisma.user.findMany({
      where: {
        email: { not: null },
        plan: segment,
      },
      select: { email: true },
    });
  }

  const emails = users
    .map((u) => u.email!)
    .filter((e) => e.includes("@"));

  if (emails.length === 0) {
    return { success: false, sent: 0, failed: 0, errors: ["No recipients found for this segment."] };
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const email of emails) {
    try {
      const result = await resend.emails.send({
        from: `The Local Post <${fromAddress}>`,
        to: email,
        subject,
        html: htmlContent,
      });
      if (result.error) {
        failed++;
        errors.push(`${email}: ${result.error.message}`);
      } else {
        sent++;
      }
    } catch (err) {
      failed++;
      errors.push(`${email}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return { success: failed === 0, sent, failed, errors };
}
