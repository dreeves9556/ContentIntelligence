"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import type { MemoryType, Importance } from "@prisma/client";
import {
  getUserMemories,
  deleteMemory,
  updateMemory,
} from "@/lib/memory/memory-service";
import type { CreatorMemoryData } from "@/lib/memory/memory-types";

export async function getMyMemories(): Promise<CreatorMemoryData[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  return getUserMemories(session.user.id);
}

export async function deleteMyMemory(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated" };

  const memories = await getUserMemories(session.user.id);
  if (!memories.some((m) => m.id === id)) {
    return { success: false, error: "Memory not found" };
  }

  await deleteMemory(id);
  revalidatePath("/dashboard/brand-brain");
  revalidatePath("/dashboard/questionnaire");
  return { success: true };
}

export async function togglePinMemory(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated" };

  const memories = await getUserMemories(session.user.id);
  const memory = memories.find((m) => m.id === id);
  if (!memory) {
    return { success: false, error: "Memory not found" };
  }

  await updateMemory(id, { pinned: !memory.pinned });
  revalidatePath("/dashboard/brand-brain");
  revalidatePath("/dashboard/questionnaire");
  return { success: true };
}

export async function correctMemory(
  id: string,
  summary: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated" };

  const memories = await getUserMemories(session.user.id);
  if (!memories.some((m) => m.id === id)) {
    return { success: false, error: "Memory not found" };
  }

  if (!summary.trim()) {
    return { success: false, error: "Summary cannot be empty" };
  }

  await updateMemory(id, { summary: summary.trim() });
  revalidatePath("/dashboard/brand-brain");
  revalidatePath("/dashboard/questionnaire");
  return { success: true };
}

export async function getMyMemoriesByType(): Promise<Record<MemoryType, CreatorMemoryData[]>> {
  const session = await auth();
  if (!session?.user?.id) return {} as Record<MemoryType, CreatorMemoryData[]>;

  const memories = await getUserMemories(session.user.id);
  const grouped = {} as Record<MemoryType, CreatorMemoryData[]>;
  const types: MemoryType[] = ["IDENTITY", "VOICE", "AUDIENCE", "CONTENT", "PERFORMANCE", "STRATEGY", "PREFERENCE", "WARNING"];
  for (const type of types) {
    grouped[type] = memories.filter((m) => m.memoryType === type);
  }
  return grouped;
}

// ─── Admin actions ─────────────────────────────────────────────────

export async function adminGetAllMemories(filters?: {
  userId?: string;
  memoryType?: MemoryType;
  importance?: Importance;
  search?: string;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return [];

  const { getAllMemoriesForAdmin } = await import("@/lib/memory/memory-service");
  return getAllMemoriesForAdmin(filters);
}

export async function adminUpdateMemory(
  id: string,
  patch: {
    title?: string;
    summary?: string;
    confidence?: number;
    importance?: Importance;
  }
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { success: false, error: "Unauthorized" };

  await updateMemory(id, patch);
  revalidatePath("/admin/memories");
  return { success: true };
}

export async function adminDeleteMemory(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { success: false, error: "Unauthorized" };

  await deleteMemory(id);
  revalidatePath("/admin/memories");
  return { success: true };
}

export async function adminMergeDuplicateMemories(userId: string): Promise<{ success: boolean; merged?: number; deleted?: number; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { success: false, error: "Unauthorized" };

  const { mergeDuplicateMemories } = await import("@/lib/memory/memory-service");
  const result = await mergeDuplicateMemories(userId);
  revalidatePath("/admin/memories");
  return { success: true, ...result };
}
