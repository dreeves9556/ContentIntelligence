"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getStripe } from "@/lib/stripe";
import { isStripeCheckoutConfigured } from "@/lib/stripe-config";
import {
  listRecoveryRequiredOperations,
  getRecoveryRequiredOperation,
  resolveRecoveryRequiredOperation,
} from "@/lib/seat-recovery-service";
import type {
  RecoveryResolutionType,
  RecoveryListRow,
  RecoveryDetailRow,
  RecoveryDeps,
} from "@/lib/seat-recovery-service";
import type { SeatReconciliationPrisma, SeatStripeClient } from "@/lib/seat-reconciliation-service";

/**
 * Admin server actions for seat-reconciliation recovery.
 *
 * Every action reloads the session from trusted server state and requires
 * global ADMIN. TEAM_ADMIN and regular users are denied.
 */

export async function listRecoveryOps(): Promise<{
  rows?: RecoveryListRow[];
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user) return { error: "User not found." };

  const stripe = isStripeCheckoutConfigured() ? getStripe() : null;

  const deps: RecoveryDeps = {
    prisma: prisma as unknown as SeatReconciliationPrisma,
    stripe: stripe as unknown as SeatStripeClient | null,
  };

  return listRecoveryRequiredOperations(
    deps,
    { userId: user.id, role: user.role }
  );
}

export async function getRecoveryOp(
  opId: string
): Promise<{ row?: RecoveryDetailRow; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user) return { error: "User not found." };

  const stripe = isStripeCheckoutConfigured() ? getStripe() : null;

  const deps: RecoveryDeps = {
    prisma: prisma as unknown as SeatReconciliationPrisma,
    stripe: stripe as unknown as SeatStripeClient | null,
  };

  return getRecoveryRequiredOperation(
    deps,
    { userId: user.id, role: user.role },
    opId
  );
}

export async function resolveRecoveryOp(
  opId: string,
  resolution: RecoveryResolutionType,
  confirmation: string
): Promise<{ success: boolean; error?: string; summary?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user) return { success: false, error: "User not found." };

  if (!isStripeCheckoutConfigured()) {
    return { success: false, error: "Stripe is not configured." };
  }
  const stripe = getStripe();

  const deps: RecoveryDeps = {
    prisma: prisma as unknown as SeatReconciliationPrisma,
    stripe: stripe as unknown as SeatStripeClient | null,
  };

  const result = await resolveRecoveryRequiredOperation(
    deps,
    { userId: user.id, role: user.role },
    opId,
    resolution,
    confirmation
  );

  if (result.success) {
    return { success: true, summary: result.summary };
  }
  return { success: false, error: result.error };
}
