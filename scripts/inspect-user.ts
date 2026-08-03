/**
 * Inspect a single user account across DB + Stripe + Resend.
 *
 * Usage:
 *   npx tsx scripts/inspect-user.ts <email>
 *
 * Requires .env.local with DATABASE_URL, STRIPE_SECRET_KEY,
 * and (optional) RESEND_API_KEY.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";

// ─── Env loading ───────────────────────────────────────────────────────────

function loadEnv() {
  for (const filename of [".env.local", ".env.stripe.generated"]) {
    const envPath = resolve(process.cwd(), filename);
    try {
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch {
      // file not found — skip
    }
  }
}

loadEnv();

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: npx tsx scripts/inspect-user.ts <email>");
  process.exit(1);
}

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-06-24.dahlia" as Stripe.LatestApiVersion,
  typescript: true,
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmt(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString();
}

function banner(title: string) {
  console.log("\n━━━ " + title + " ━━━");
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Account inspection for " + email + " ===");

  // ── 1. Database row ──────────────────────────────────────────────────────
  banner("Database (User)");
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.log("❌ No User row found for this email.");
  } else {
    console.log("id:                   " + user.id);
    console.log("email:                " + user.email);
    console.log("name:                 " + (user.name ?? "—"));
    console.log("role:                 " + user.role);
    console.log("plan:                 " + user.plan);
    console.log("emailVerified:        " + fmt(user.emailVerified));
    console.log("accountStatus:        " + user.accountStatus);
    console.log("isComped:             " + user.isComped);
    console.log("internalTag:          " + (user.internalTag ?? "—"));
    console.log("accessExpiresAt:      " + fmt(user.accessExpiresAt));
    console.log("expirationAction:     " + user.expirationAction);
    console.log("organizationId:       " + (user.organizationId ?? "—"));
    console.log("createdAt:            " + fmt(user.createdAt));
    console.log("updatedAt:            " + fmt(user.updatedAt));
    console.log("--- Stripe fields on User row ---");
    console.log("stripeCustomerId:     " + (user.stripeCustomerId ?? "—"));
    console.log("stripeSubscriptionId: " + (user.stripeSubscriptionId ?? "—"));
    console.log("stripeStatus:         " + (user.stripeStatus ?? "—"));
    console.log("--- Trial ---");
    console.log("hasUsedTrial:         " + user.hasUsedTrial);
    console.log("trialEndsAt:          " + fmt(user.trialEndsAt));
    console.log("trialWillEndNotified: " + fmt(user.trialWillEndNotifiedAt));
  }

  // ── 2. Verification tokens (email verification) ──────────────────────────
  banner("Email verification tokens");
  const tokens = await prisma.verificationToken.findMany({
    where: { identifier: email },
    orderBy: { expires: "desc" },
    take: 5,
  });
  if (tokens.length === 0) {
    console.log("No verification tokens. (OK if emailVerified is set, or if using OAuth.)");
  } else {
    for (const t of tokens) {
      const expired = t.expires < new Date();
      console.log(
        `  token ${t.token.slice(0, 8)}… expires ${fmt(t.expires)} ${expired ? "(EXPIRED)" : "(valid)"}`
      );
    }
  }

  // ── 3. Password reset / invite tokens ────────────────────────────────────
  banner("Reset / invite tokens");
  const resets = await prisma.passwordResetToken.findMany({
    where: { email },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  if (resets.length === 0) {
    console.log("No password reset tokens.");
  } else {
    for (const r of resets) {
      const expired = r.expiresAt < new Date();
      console.log(
        `  reset ${r.token.slice(0, 8)}… created ${fmt(r.createdAt)} expires ${fmt(r.expiresAt)} ${expired ? "(EXPIRED)" : "(valid)"}`
      );
    }
  }

  const invites = await prisma.inviteToken.findMany({
    where: { email },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  if (invites.length > 0) {
    console.log("Invite tokens:");
    for (const i of invites) {
      const expired = i.expiresAt < new Date();
      console.log(
        `  invite org=${i.organizationId ?? "—"} created ${fmt(i.createdAt)} expires ${fmt(i.expiresAt)} ${expired ? "(EXPIRED)" : "(valid)"}`
      );
    }
  }

  // ── 4. Stripe customer lookup ────────────────────────────────────────────
  banner("Stripe customer");
  let customer: Stripe.Customer | null = null;
  try {
    const list = await stripe.customers.list({ email, limit: 5 });
    if (list.data.length === 0) {
      console.log("❌ No Stripe customer found with this email.");
    } else if (list.data.length === 1) {
      customer = list.data[0];
    } else {
      console.log(`⚠️  ${list.data.length} Stripe customers match this email. Showing the first.`);
      customer = list.data[0];
    }
  } catch (err) {
    console.log("Stripe customer lookup failed: " + err);
  }

  if (customer) {
    console.log("customer id:    " + customer.id);
    console.log("email:          " + customer.email);
    console.log("name:           " + (customer.name ?? "—"));
    console.log("description:    " + (customer.description ?? "—"));
    console.log("created:        " + fmt(new Date(customer.created * 1000)));
    console.log("currency:       " + (customer.currency ?? "—"));
    console.log("default_source: " + (customer.default_source ?? "—"));
    console.log("livemode:       " + customer.livemode);

    // ── 5. Stripe subscriptions for this customer ───────────────────────────
    banner("Stripe subscriptions");
    try {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        limit: 10,
        expand: ["data.latest_invoice", "data.items.data.price"],
      });
      if (subs.data.length === 0) {
        console.log("No subscriptions on this customer.");
      } else {
        for (const s of subs.data) {
          console.log("--- subscription " + s.id + " ---");
          console.log("  status:           " + s.status);
          console.log("  livemode:         " + s.livemode);
          const safeDate = (ts: number | null | undefined) => (ts ? fmt(new Date(ts * 1000)) : "—");
          console.log("  cancel_at:        " + safeDate(s.cancel_at));
          console.log("  canceled_at:      " + safeDate(s.canceled_at));
          const firstItem = s.items.data[0];
          console.log("  current_period:   " + safeDate(firstItem?.current_period_start) + " → " + safeDate(firstItem?.current_period_end));
          console.log("  trial:            " + (s.trial_end ? `start ${safeDate(s.trial_start ?? s.created)} end ${safeDate(s.trial_end)}` : "none"));
          console.log("  items:");
          for (const item of s.items.data) {
            const price = item.price;
            console.log(
              `    - ${price?.id} ${price?.recurring?.interval ?? "?"} ${price?.unit_amount ? "$" + (price.unit_amount / 100).toFixed(2) : "(tiered)"} qty=${item.quantity}`
            );
          }
        }
      }
    } catch (err) {
      console.log("Subscription lookup failed: " + err);
    }

    // ── 6. Payment methods ──────────────────────────────────────────────────
    banner("Payment methods");
    try {
      const pms = await stripe.paymentMethods.list({ customer: customer.id, limit: 5 });
      if (pms.data.length === 0) {
        console.log("No saved payment methods.");
      } else {
        for (const pm of pms.data) {
          if (pm.type === "card" && pm.card) {
            console.log(`  card ${pm.card.brand} •••• ${pm.card.last4} exp ${pm.card.exp_month}/${pm.card.exp_year}`);
          } else {
            console.log(`  ${pm.type}`);
          }
        }
      }
    } catch (err) {
      console.log("Payment method lookup failed: " + err);
    }

    // ── 7. Recent charges ───────────────────────────────────────────────────
    banner("Recent charges");
    try {
      const charges = await stripe.charges.list({ customer: customer.id, limit: 5 });
      if (charges.data.length === 0) {
        console.log("No charges.");
      } else {
        for (const c of charges.data) {
          console.log(
            `  ${c.id} ${c.status} $${(c.amount / 100).toFixed(2)} ${c.currency} ${fmt(new Date(c.created * 1000))}${c.refunded ? " (REFUNDED)" : ""}`
          );
        }
      }
    } catch (err) {
      console.log("Charge lookup failed: " + err);
    }
  }

  // ── 8. Resend email events (if API key present) ──────────────────────────
  banner("Resend (recent emails)");
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.log("RESEND_API_KEY not set — skipping Resend lookup.");
  } else {
    try {
      const res = await fetch("https://api.resend.com/emails?to=" + encodeURIComponent(email), {
        headers: { Authorization: "Bearer " + resendKey },
      });
      if (!res.ok) {
        const text = await res.text();
        console.log(`Resend API returned ${res.status}: ${text.slice(0, 200)}`);
      } else {
        const data = (await res.json()) as { data?: Array<{ id: string; subject?: string; status?: string; created_at?: string; to?: string[] }> };
        const items = data.data ?? [];
        if (items.length === 0) {
          console.log("No emails found in Resend for this address.");
        } else {
          for (const e of items.slice(0, 5)) {
            console.log(`  ${e.id} status=${e.status ?? "?"} subject="${e.subject ?? "?"}" created=${fmt(e.created_at)}`);
          }
        }
      }
    } catch (err) {
      console.log("Resend lookup failed: " + err);
    }
  }

  // ── 9. Cross-check: User.stripeCustomerId vs Stripe customer id ──────────
  banner("Cross-check");
  if (user && customer) {
    if (user.stripeCustomerId && user.stripeCustomerId !== customer.id) {
      console.log(`⚠️  Mismatch: User.stripeCustomerId=${user.stripeCustomerId} but Stripe customer=${customer.id}`);
    } else if (!user.stripeCustomerId) {
      console.log(`⚠️  User row has no stripeCustomerId, but Stripe customer ${customer.id} exists.`);
    } else {
      console.log("✅ User.stripeCustomerId matches Stripe customer id.");
    }
  } else if (user && !customer) {
    console.log("⚠️  User exists in DB but no Stripe customer found.");
  } else if (!user && customer) {
    console.log("⚠️  Stripe customer exists but no DB User row.");
  } else {
    console.log("❌  No user in DB and no Stripe customer.");
  }

  console.log("\n=== done ===\n");
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
