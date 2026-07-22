"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ChangelogType } from "@prisma/client";
import { fetchGithubCommits, parseCommitType, parseCommitTitle, parseCommitBody } from "@/lib/github";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

export interface ChangelogEntryData {
  id: string;
  version: string | null;
  title: string;
  type: ChangelogType;
  content: string;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  gitSha: string | null;
  gitAuthor: string | null;
  gitUrl: string | null;
}

function mapEntry(e: {
  id: string;
  version: string | null;
  title: string;
  type: ChangelogType;
  content: string;
  published: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  gitSha: string | null;
  gitAuthor: string | null;
  gitUrl: string | null;
}): ChangelogEntryData {
  return {
    id: e.id,
    version: e.version,
    title: e.title,
    type: e.type,
    content: e.content,
    published: e.published,
    publishedAt: e.publishedAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    gitSha: e.gitSha,
    gitAuthor: e.gitAuthor,
    gitUrl: e.gitUrl,
  };
}

export async function getChangelogEntries(): Promise<ChangelogEntryData[]> {
  await requireAdmin();
  const entries = await prisma.changelogEntry.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
  return entries.map(mapEntry);
}

export async function getPublishedChangelogEntries(): Promise<ChangelogEntryData[]> {
  const entries = await prisma.changelogEntry.findMany({
    where: { published: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
  return entries.map(mapEntry);
}

export async function createChangelogEntry(data: {
  version?: string;
  title: string;
  type: ChangelogType;
  content: string;
  published: boolean;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    await requireAdmin();
    const entry = await prisma.changelogEntry.create({
      data: {
        version: data.version?.trim() || null,
        title: data.title.trim(),
        type: data.type,
        content: data.content.trim(),
        published: data.published,
        publishedAt: data.published ? new Date() : null,
      },
    });
    revalidatePath("/admin/changelog");
    return { success: true, id: entry.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: msg };
  }
}

export async function updateChangelogEntry(
  id: string,
  data: {
    version?: string;
    title: string;
    type: ChangelogType;
    content: string;
    published: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const existing = await prisma.changelogEntry.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Entry not found" };

    const wasUnpublished = !existing.published;
    await prisma.changelogEntry.update({
      where: { id },
      data: {
        version: data.version?.trim() || null,
        title: data.title.trim(),
        type: data.type,
        content: data.content.trim(),
        published: data.published,
        publishedAt: data.published && wasUnpublished ? new Date() : existing.publishedAt,
      },
    });
    revalidatePath("/admin/changelog");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: msg };
  }
}

export async function deleteChangelogEntry(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    await prisma.changelogEntry.delete({ where: { id } });
    revalidatePath("/admin/changelog");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: msg };
  }
}

export async function backfillFromGithub(): Promise<{
  success: boolean;
  error?: string;
  created?: number;
  skipped?: number;
}> {
  try {
    await requireAdmin();
    const commits = await fetchGithubCommits(500);

    let created = 0;
    let skipped = 0;

    for (const c of commits) {
      const existing = await prisma.changelogEntry.findUnique({
        where: { gitSha: c.sha },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const type = parseCommitType(c.message);
      const title = parseCommitTitle(c.message);
      const contentBody = parseCommitBody(c.message);

      await prisma.changelogEntry.create({
        data: {
          title,
          type,
          content: contentBody || title,
          published: true,
          publishedAt: new Date(c.date),
          gitSha: c.sha,
          gitAuthor: c.authorName,
          gitUrl: c.url,
        },
      });
      created++;
    }

    revalidatePath("/admin/changelog");
    return { success: true, created, skipped };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: msg };
  }
}
