"use server";

import { Resend } from "resend";
import { Prisma } from "@prisma/client";
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

  const systemPrompt = `You are a world-class email marketing designer and copywriter for "The Local Post" — a premium content intelligence platform for real estate agents and local business owners. You design emails that look like they came from a top-tier brand: Apple, Stripe, Airbnb quality. Emails that make people stop scrolling and actually read.

Your job: take the admin's plain-text announcement and transform it into a visually stunning, conversion-optimized HTML email that jumps off the screen.

DESIGN PHILOSOPHY:
- Think like a marketing director, not a developer. The email should feel exciting, premium, and alive.
- Use visual hierarchy: large hero headlines, section breaks, colored callout boxes, feature cards, pull quotes, stat highlights, and bold CTAs.
- Vary section backgrounds: alternate between white (#FFFFFF) and off-white (#F7F9FC) sections to create visual rhythm and separation.
- Use accent blue (#1E56D6) strategically — for hero accents, button backgrounds, section dividers, highlight bars, icon backgrounds, and key text emphasis. Never as a full-bleed background.
- Add visual elements between text blocks: thin colored divider lines, accent bars (3-4px tall blue strips), boxed highlights, circle badges with emoji or letters.
- Make CTAs impossible to miss: large buttons with padding, bold text, maybe a subtle shadow (box-shadow: 0 2px 8px rgba(30,86,214,0.3)).

LAYOUT PATTERNS TO USE (mix and match based on content):
1. HERO SECTION: Off-white or gradient-tinted background, large Georgia serif headline (28-32px), a subheadline in muted text, maybe a thin blue accent bar above the headline. This is the "above the fold" attention grabber.
2. FEATURE CARDS: 2-3 cards side by side or stacked, each with a colored circle icon badge (emoji or letter), a bold title, and a description. Use for listing benefits or features.
3. CALLOUT BOXES: A box with blue left-border (4px solid #1E56D6), off-white background, and important text inside. Use for key messages or quotes.
4. PULL QUOTE: Large Georgia serif italic text, centered, with a blue accent line above and below. Use for impactful statements.
5. STAT HIGHLIGHTS: Big numbers in blue (#1E56D6, 32-36px Georgia serif bold) with a label below in muted text. Use if the content has any numbers or metrics.
6. CTA SECTION: A distinct section (maybe off-white background) with a clear instruction and a large blue button. Center it. Make it feel like the climax of the email.
7. SIGNATURE BLOCK: The sender's name in Georgia serif, with a thin divider above it. Personal and warm.

BRAND GUIDELINES (must follow exactly):
- Font: Georgia, 'Times New Roman', serif for headings, wordmark, pull quotes, stats, and signature. Arial, sans-serif for body text and labels.
- Colors: White (#FFFFFF), off-white (#F7F9FC), ink (#101418), muted (#5B6472), blue accent (#1E56D6), border (#E2E8F0). You may use a very light blue tint (#EBF2FF) for highlight backgrounds.
- Layout: max-width 480px, centered, 12px border-radius on outer container, 8px on inner cards. 1px solid #E2E8F0 border on outer container.
- Header: "The Local Post" wordmark in Georgia serif, 24px, bold, centered. Below it a small uppercase tagline in blue (#1E56D6) with letter-spacing 0.12em. Consider adding a thin blue accent bar (3px height, #1E56D6, maybe 40px wide, centered) between the wordmark and tagline for a premium masthead feel.
- Body text: 14-15px, muted color (#5B6472), 1.6 line-height. Key phrases can be bolded with color #101418.
- Section headings: Georgia serif, 20-24px, bold, #101418. Add a small uppercase label above some sections in blue (#1E56D6, 11px, letter-spacing 0.1em) — like "WHAT'S NEW" or "GET STARTED".
- Buttons: blue background (#1E56D6), white text, 6px border-radius, 14px 28px padding, bold, 14px, inline-block. Add box-shadow for depth. If there are multiple CTAs, make the primary one blue and secondary ones outline style (white bg, blue text, blue border).
- Footer: off-white background, centered, 11px muted text: "The Local Post — Be the local authority." Consider a thin blue accent bar above the footer.
- NEVER use the colors #0a0a0a, #111111, #c8952a, or any dark/gold palette.
- Use inline CSS on every element. No <style> tags, no classes, no external CSS, no external images.
- Do NOT include <html>, <head>, or <body> tags — return only the inner <div> email template.
- You may use emoji as visual icons in feature cards or callout boxes (e.g., 📰 🚀 📊 ✨ 🏠 📝). Keep them tasteful and relevant.
- Do NOT fabricate URLs. If the admin's text mentions an action (like "subscribe" or "sign up"), create a button with href="#" — the admin can edit the HTML to add a real link.

COPYWRITING ENHANCEMENT:
- Elevate the admin's language to be more punchy and marketing-grade, but PRESERVE all facts and meaning.
- Turn vague statements into benefit-driven headlines. "We are taking this to the next level" becomes a bold hero headline like "We're Taking Things to the Next Level."
- Break long paragraphs into shorter, scannable chunks. One idea per paragraph.
- Add uppercase section labels (like "WHAT'S NEW", "WHY IT MATTERS", "YOUR NEXT STEP") to create structure.
- If the admin signed off with their name, format it as a warm signature block with Georgia serif.

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
        max_tokens: 6000,
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

export async function suggestSubject(plainText: string): Promise<{ success: boolean; subject?: string; error?: string }> {
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

  const systemPrompt = `You are an expert email marketing copywriter for "The Local Post" — a premium content intelligence platform for real estate agents and local business owners.

Your job: write ONE compelling email subject line based on the admin's announcement body text.

RULES:
- Maximum 60 characters (most email clients truncate after that).
- Make it punchy, intriguing, and action-oriented. Think like a marketing pro.
- Use curiosity, urgency, or benefit-driven language — but never clickbait.
- Do NOT use ALL CAPS, excessive punctuation, or spammy words like "FREE" or "ACT NOW".
- Do NOT include quotes around the subject line.
- Do NOT include any explanation — return ONLY the subject line text.
- Match the tone of the announcement. If it's exciting, be exciting. If it's informative, be clear and authoritative.
- Consider patterns like: questions, bold statements, teasers, benefit promises, or time-sensitive framing.

Good examples:
- "We're taking things to the next level"
- "Your front page is about to get a lot smarter"
- "What if your content could write itself?"
- "A new way to reach your audience"

Return ONLY the subject line. No quotes, no explanation, no markdown.`;

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
        max_tokens: 100,
        system: systemPrompt,
        messages: [{ role: "user", content: `Here is the announcement body. Write a compelling subject line for it:\n\n---\n${plainText}\n---` }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI SUBJECT] Anthropic error:", errorText);
      return { success: false, error: `AI service error (${response.status})` };
    }

    const data = await response.json();
    const subject = data.content?.[0]?.text?.trim() || "";

    if (!subject) {
      return { success: false, error: "AI returned empty response." };
    }

    return { success: true, subject };
  } catch (err) {
    console.error("[AI SUBJECT] Failed:", err);
    return { success: false, error: "Failed to generate subject line." };
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

  return executeBroadcast(subject, htmlContent, segment);
}

async function executeBroadcast(
  subject: string,
  htmlContent: string,
  segment: EmailSegment
): Promise<BroadcastResult> {
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

export interface ScheduledBroadcastData {
  id: string;
  subject: string;
  segment: string;
  scheduledFor: string;
  status: string;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

export async function scheduleBroadcast(
  subject: string,
  htmlContent: string,
  segment: EmailSegment,
  scheduledFor: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  if (!subject.trim() || !htmlContent.trim()) {
    return { success: false, error: "Subject and content are required." };
  }

  const scheduledDate = new Date(scheduledFor);
  if (isNaN(scheduledDate.getTime())) {
    return { success: false, error: "Invalid date/time." };
  }

  if (scheduledDate.getTime() <= Date.now()) {
    return { success: false, error: "Scheduled time must be in the future." };
  }

  try {
    await prisma.scheduledBroadcast.create({
      data: {
        subject: subject.trim(),
        htmlContent,
        segment,
        scheduledFor: scheduledDate,
        status: "PENDING",
        createdBy: session.user.id,
      },
    });
    return { success: true };
  } catch (err) {
    console.error("[SCHEDULE BROADCAST] Failed:", err);
    return { success: false, error: "Failed to schedule broadcast." };
  }
}

export async function getScheduledBroadcasts(): Promise<{ broadcasts: ScheduledBroadcastData[] }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { broadcasts: [] };
  }

  const rows = await prisma.scheduledBroadcast.findMany({
    orderBy: { scheduledFor: "desc" },
    take: 50,
  });

  return {
    broadcasts: rows.map((r) => ({
      id: r.id,
      subject: r.subject,
      segment: r.segment,
      scheduledFor: r.scheduledFor.toISOString(),
      status: r.status,
      sentCount: r.sentCount,
      failedCount: r.failedCount,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function cancelScheduledBroadcast(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const broadcast = await prisma.scheduledBroadcast.findUnique({ where: { id } });
    if (!broadcast) {
      return { success: false, error: "Broadcast not found." };
    }
    if (broadcast.status !== "PENDING") {
      return { success: false, error: "Only pending broadcasts can be cancelled." };
    }

    await prisma.scheduledBroadcast.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    return { success: true };
  } catch (err) {
    console.error("[CANCEL BROADCAST] Failed:", err);
    return { success: false, error: "Failed to cancel broadcast." };
  }
}

export async function processDueBroadcasts(): Promise<{ processed: number; sent: number; failed: number }> {
  const dueBroadcasts = await prisma.scheduledBroadcast.findMany({
    where: {
      status: "PENDING",
      scheduledFor: { lte: new Date() },
    },
    orderBy: { scheduledFor: "asc" },
    take: 10,
  });

  let processed = 0;
  let totalSent = 0;
  let totalFailed = 0;

  for (const broadcast of dueBroadcasts) {
    processed++;
    const result = await executeBroadcast(
      broadcast.subject,
      broadcast.htmlContent,
      broadcast.segment as EmailSegment
    );

    await prisma.scheduledBroadcast.update({
      where: { id: broadcast.id },
      data: {
        status: result.success ? "SENT" : "FAILED",
        sentCount: result.sent,
        failedCount: result.failed,
        errors: result.errors.length > 0 ? result.errors : Prisma.JsonNull,
      },
    });

    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return { processed, sent: totalSent, failed: totalFailed };
}
