import { Resend } from "resend";

export const COMMUNITY_INQUIRY_RECIPIENT = "dylanballard@kw.com";

export interface CommunityInquiry {
  name: string;
  email: string;
  organization: string;
  estimatedMembers: string;
  message: string;
  requestId: string;
}

interface ValidationSuccess {
  success: true;
  data: CommunityInquiry;
}

interface ValidationFailure {
  success: false;
  error: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateCommunityInquiry(
  input: unknown
): ValidationSuccess | ValidationFailure {
  if (!input || typeof input !== "object") {
    return { success: false, error: "Invalid request." };
  }

  const body = input as Record<string, unknown>;
  const name = readString(body.name);
  const email = readString(body.email).toLowerCase();
  const organization = readString(body.organization);
  const estimatedMembers = readString(body.estimatedMembers);
  const message = readString(body.message);
  const requestId = readString(body.requestId);

  if (name.length < 2 || name.length > 100) {
    return { success: false, error: "Please enter your name." };
  }
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }
  if (organization.length < 2 || organization.length > 120) {
    return { success: false, error: "Please enter your organization." };
  }
  if (estimatedMembers.length < 1 || estimatedMembers.length > 50) {
    return { success: false, error: "Please enter your estimated member count." };
  }
  if (message.length < 10 || message.length > 2000) {
    return { success: false, error: "Please enter a message between 10 and 2,000 characters." };
  }
  if (!UUID_PATTERN.test(requestId)) {
    return { success: false, error: "Invalid request." };
  }

  return {
    success: true,
    data: { name, email, organization, estimatedMembers, message, requestId },
  };
}

export async function sendCommunityInquiry(
  inquiry: CommunityInquiry
): Promise<boolean> {
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send(
      {
        from: `The Local Post <${fromAddress}>`,
        to: COMMUNITY_INQUIRY_RECIPIENT,
        replyTo: inquiry.email,
        subject: `New Communities inquiry — ${inquiry.organization}`,
        text: [
          "New Communities inquiry",
          "",
          `Name: ${inquiry.name}`,
          `Email: ${inquiry.email}`,
          `Organization: ${inquiry.organization}`,
          `Estimated members: ${inquiry.estimatedMembers}`,
          "",
          "Message:",
          inquiry.message,
        ].join("\n"),
      },
      { idempotencyKey: `community-inquiry/${inquiry.requestId}` }
    );

    if (result.error) {
      console.error("[COMMUNITY INQUIRY] Resend error:", result.error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[COMMUNITY INQUIRY] Failed to send:", error);
    return false;
  }
}
