// Tests for account and organization deletion hardening decision logic.
// Run: npx tsx src/lib/__tests__/deletion-hardening.test.ts
//
// Exercises the real `decideAccountDelete`, `decideOrgDelete`, and
// `decideAfterStripeCancelFailure` from src/lib/deletion-hardening.ts.

import {
  decideAccountDelete,
  decideOrgDelete,
  decideAfterStripeCancelFailure,
} from "../deletion-hardening";

let failures = 0;
function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    failures++;
  }
}

// ─── Account deletion tests ───────────────────────────────────────────────

function testAccountNoPassword() {
  const d = decideAccountDelete({
    userId: "u1",
    role: "USER",
    hasPassword: false,
    passwordValid: false,
    stripeSubscriptionId: null,
    stripeConfigured: true,
  });
  assert(d.kind === "BLOCK", "no password → BLOCK");
  if (d.kind === "BLOCK") assert(d.status === 400, "no password → 400");
}

function testAccountWrongPassword() {
  const d = decideAccountDelete({
    userId: "u1",
    role: "USER",
    hasPassword: true,
    passwordValid: false,
    stripeSubscriptionId: null,
    stripeConfigured: true,
  });
  assert(d.kind === "BLOCK", "wrong password → BLOCK");
  if (d.kind === "BLOCK") assert(d.status === 403, "wrong password → 403");
}

function testAccountTeamAdmin() {
  const d = decideAccountDelete({
    userId: "u1",
    role: "TEAM_ADMIN",
    hasPassword: true,
    passwordValid: true,
    stripeSubscriptionId: null,
    stripeConfigured: true,
  });
  assert(d.kind === "BLOCK", "TEAM_ADMIN → BLOCK");
  if (d.kind === "BLOCK") assert(d.status === 400, "TEAM_ADMIN → 400");
  if (d.kind === "BLOCK") assert(d.error.includes("transfer"), "TEAM_ADMIN error mentions transfer");
}

function testAccountGlobalAdmin() {
  const d = decideAccountDelete({
    userId: "u1",
    role: "ADMIN",
    hasPassword: true,
    passwordValid: true,
    stripeSubscriptionId: null,
    stripeConfigured: true,
  });
  assert(d.kind === "BLOCK", "global ADMIN → BLOCK");
  if (d.kind === "BLOCK") assert(d.status === 400, "global ADMIN → 400");
}

function testAccountSubscriptionStripeNotConfigured() {
  const d = decideAccountDelete({
    userId: "u1",
    role: "USER",
    hasPassword: true,
    passwordValid: true,
    stripeSubscriptionId: "sub_123",
    stripeConfigured: false,
  });
  assert(d.kind === "BLOCK", "subscription + Stripe not configured → BLOCK");
  if (d.kind === "BLOCK") assert(d.status === 500, "subscription + not configured → 500");
  if (d.kind === "BLOCK") assert(d.error.includes("contact support"), "error mentions contact support");
}

function testAccountProceedNoSubscription() {
  const d = decideAccountDelete({
    userId: "u1",
    role: "USER",
    hasPassword: true,
    passwordValid: true,
    stripeSubscriptionId: null,
    stripeConfigured: false, // doesn't matter — no subscription
  });
  assert(d.kind === "PROCEED", "USER with no subscription → PROCEED");
}

function testAccountProceedWithSubscriptionConfigured() {
  const d = decideAccountDelete({
    userId: "u1",
    role: "USER",
    hasPassword: true,
    passwordValid: true,
    stripeSubscriptionId: "sub_123",
    stripeConfigured: true,
  });
  assert(d.kind === "PROCEED", "USER with subscription + Stripe configured → PROCEED");
}

function testAccountProceedWithSubscriptionConfiguredFalse() {
  // Edge: subscription exists, Stripe configured true → PROCEED (caller cancels)
  const d = decideAccountDelete({
    userId: "u1",
    role: "USER",
    hasPassword: true,
    passwordValid: true,
    stripeSubscriptionId: "sub_123",
    stripeConfigured: true,
  });
  assert(d.kind === "PROCEED", "PROCEED when subscription + configured");
}

// ─── Org deletion tests ───────────────────────────────────────────────────

function testOrgNonAdmin() {
  const d = decideOrgDelete({
    callerRole: "USER",
    confirmName: "Test Org",
    orgName: "Test Org",
    hasStripeSubscription: false,
    stripeConfigured: true,
  });
  assert(d.kind === "BLOCK", "non-admin → BLOCK");
  if (d.kind === "BLOCK") assert(d.status === 403, "non-admin → 403");
}

function testOrgTeamAdmin() {
  const d = decideOrgDelete({
    callerRole: "TEAM_ADMIN",
    confirmName: "Test Org",
    orgName: "Test Org",
    hasStripeSubscription: false,
    stripeConfigured: true,
  });
  assert(d.kind === "BLOCK", "TEAM_ADMIN caller → BLOCK");
  if (d.kind === "BLOCK") assert(d.status === 403, "TEAM_ADMIN caller → 403");
}

function testOrgWrongConfirmName() {
  const d = decideOrgDelete({
    callerRole: "ADMIN",
    confirmName: "Wrong Name",
    orgName: "Test Org",
    hasStripeSubscription: false,
    stripeConfigured: true,
  });
  assert(d.kind === "BLOCK", "wrong confirmName → BLOCK");
  if (d.kind === "BLOCK") assert(d.status === 400, "wrong confirmName → 400");
  if (d.kind === "BLOCK") assert(d.error.includes("Test Org"), "error mentions org name");
}

function testOrgEmptyConfirmName() {
  const d = decideOrgDelete({
    callerRole: "ADMIN",
    confirmName: "",
    orgName: "Test Org",
    hasStripeSubscription: false,
    stripeConfigured: true,
  });
  assert(d.kind === "BLOCK", "empty confirmName → BLOCK");
}

function testOrgWhitespaceConfirmName() {
  // The helper trims confirmName, so whitespace-padded input matches.
  const d = decideOrgDelete({
    callerRole: "ADMIN",
    confirmName: "  Test Org  ",
    orgName: "Test Org",
    hasStripeSubscription: false,
    stripeConfigured: true,
  });
  assert(d.kind === "PROCEED", "whitespace-padded confirmName → PROCEED (trim matches)");
}

function testOrgSubscriptionNotConfigured() {
  const d = decideOrgDelete({
    callerRole: "ADMIN",
    confirmName: "Test Org",
    orgName: "Test Org",
    hasStripeSubscription: true,
    stripeConfigured: false,
  });
  assert(d.kind === "BLOCK", "org subscription + not configured → BLOCK");
  if (d.kind === "BLOCK") assert(d.status === 500, "org subscription + not configured → 500");
}

function testOrgProceedNoSubscription() {
  const d = decideOrgDelete({
    callerRole: "ADMIN",
    confirmName: "Test Org",
    orgName: "Test Org",
    hasStripeSubscription: false,
    stripeConfigured: false, // doesn't matter — no subscription
  });
  assert(d.kind === "PROCEED", "admin + correct name + no subscription → PROCEED");
}

function testOrgProceedWithSubscriptionConfigured() {
  const d = decideOrgDelete({
    callerRole: "ADMIN",
    confirmName: "Test Org",
    orgName: "Test Org",
    hasStripeSubscription: true,
    stripeConfigured: true,
  });
  assert(d.kind === "PROCEED", "admin + correct name + subscription + configured → PROCEED");
}

// ─── Stripe cancel failure tests ──────────────────────────────────────────

function testCancelFailureAccount() {
  const r = decideAfterStripeCancelFailure("account");
  assert(r.status === 500, "account cancel failure → 500");
  assert(r.error.includes("account was not deleted"), "account cancel failure error");
}

function testCancelFailureOrg() {
  const r = decideAfterStripeCancelFailure("org");
  assert(r.status === 500, "org cancel failure → 500");
  assert(r.error.includes("organization was not deleted"), "org cancel failure error");
}

// ─── Run ──────────────────────────────────────────────────────────────────

function main() {
  testAccountNoPassword();
  testAccountWrongPassword();
  testAccountTeamAdmin();
  testAccountGlobalAdmin();
  testAccountSubscriptionStripeNotConfigured();
  testAccountProceedNoSubscription();
  testAccountProceedWithSubscriptionConfigured();
  testAccountProceedWithSubscriptionConfiguredFalse();
  testOrgNonAdmin();
  testOrgTeamAdmin();
  testOrgWrongConfirmName();
  testOrgEmptyConfirmName();
  testOrgWhitespaceConfirmName();
  testOrgSubscriptionNotConfigured();
  testOrgProceedNoSubscription();
  testOrgProceedWithSubscriptionConfigured();
  testCancelFailureAccount();
  testCancelFailureOrg();

  if (failures > 0) {
    console.error(`\n${failures} test(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log("All deletion-hardening tests passed.");
  }
}

main();
