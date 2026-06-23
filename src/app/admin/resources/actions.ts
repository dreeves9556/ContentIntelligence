"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

export interface ResourcePostData {
  id: string;
  title: string;
  content: string;
  category: string | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  authorName: string | null;
}

export async function getResourcePosts(): Promise<ResourcePostData[]> {
  const posts = await prisma.resourcePost.findMany({
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
  });
  return posts.map((p) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    category: p.category,
    published: p.published,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    authorName: p.author.name,
  }));
}

export async function getPublishedResourcePosts(): Promise<ResourcePostData[]> {
  const posts = await prisma.resourcePost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    include: { author: { select: { name: true } } },
  });
  return posts.map((p) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    category: p.category,
    published: p.published,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    authorName: p.author.name,
  }));
}

export async function createResourcePost(data: {
  title: string;
  content: string;
  category?: string;
  published: boolean;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const authorId = await requireAdmin();
    const post = await prisma.resourcePost.create({
      data: {
        title: data.title.trim(),
        content: data.content,
        category: data.category?.trim() || null,
        published: data.published,
        publishedAt: data.published ? new Date() : null,
        authorId,
      },
    });
    revalidatePath("/admin/resources");
    revalidatePath("/dashboard/library");
    return { success: true, id: post.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: msg };
  }
}

export async function updateResourcePost(
  id: string,
  data: { title: string; content: string; category?: string; published: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const existing = await prisma.resourcePost.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Post not found" };

    const wasUnpublished = !existing.published;
    await prisma.resourcePost.update({
      where: { id },
      data: {
        title: data.title.trim(),
        content: data.content,
        category: data.category?.trim() || null,
        published: data.published,
        publishedAt: data.published && wasUnpublished ? new Date() : existing.publishedAt,
      },
    });
    revalidatePath("/admin/resources");
    revalidatePath("/dashboard/library");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: msg };
  }
}

export async function deleteResourcePost(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    await prisma.resourcePost.delete({ where: { id } });
    revalidatePath("/admin/resources");
    revalidatePath("/dashboard/library");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: msg };
  }
}
