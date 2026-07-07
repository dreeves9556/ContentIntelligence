"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import sanitizeHtml from "sanitize-html";

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "blockquote", "pre", "code", "hr",
    "a", "u", "em", "strong", "s", "del", "span", "sub", "sup",
  ],
  allowedAttributes: {
    a: ["href", "class", "target", "rel"],
    span: ["style", "class"],
    p: ["style", "class"],
    h1: ["style"], h2: ["style"], h3: ["style"],
    h4: ["style"], h5: ["style"], h6: ["style"],
  },
  allowedStyles: {
    "*": {
      "text-align": [/^(left|center|right|justify)$/],
    },
  },
  allowedSchemes: ["http", "https", "mailto"],
};

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
  authorDisplayName: string | null;
  authorImage: string | null;
  authorOrganization: string | null;
  authorContactEmail: string | null;
}

export interface AdminAuthorProfile {
  displayName: string;
  image: string;
  organization: string;
  contactEmail: string;
}

const AUTHOR_SELECT = {
  name: true,
  authorDisplayName: true,
  authorImage: true,
  authorOrganization: true,
  authorContactEmail: true,
} as const;

function mapPost(p: {
  id: string;
  title: string;
  content: string;
  category: string | null;
  published: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: {
    name: string | null;
    authorDisplayName: string | null;
    authorImage: string | null;
    authorOrganization: string | null;
    authorContactEmail: string | null;
  };
}): ResourcePostData {
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    category: p.category,
    published: p.published,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    authorName: p.author.name,
    authorDisplayName: p.author.authorDisplayName,
    authorImage: p.author.authorImage,
    authorOrganization: p.author.authorOrganization,
    authorContactEmail: p.author.authorContactEmail,
  };
}

export async function getResourcePosts(): Promise<ResourcePostData[]> {
  await requireAdmin();
  const posts = await prisma.resourcePost.findMany({
    orderBy: { createdAt: "desc" },
    include: { author: { select: AUTHOR_SELECT } },
  });
  return posts.map(mapPost);
}

export async function getPublishedResourcePosts(): Promise<ResourcePostData[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const posts = await prisma.resourcePost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    include: { author: { select: AUTHOR_SELECT } },
  });
  return posts.map((p) => {
    const mapped = mapPost(p);
    mapped.content = sanitizeHtml(mapped.content, SANITIZE_OPTIONS);
    return mapped;
  });
}

export async function getAdminAuthorProfile(): Promise<AdminAuthorProfile> {
  const id = await requireAdmin();
  const user = await prisma.user.findUnique({
    where: { id },
    select: { name: true, authorDisplayName: true, authorImage: true, authorOrganization: true, authorContactEmail: true },
  });
  return {
    displayName: user?.authorDisplayName ?? user?.name ?? "",
    image: user?.authorImage ?? "",
    organization: user?.authorOrganization ?? "",
    contactEmail: user?.authorContactEmail ?? "",
  };
}

export async function updateAdminAuthorProfile(data: {
  displayName: string;
  image: string;
  organization: string;
  contactEmail: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const id = await requireAdmin();
    await prisma.user.update({
      where: { id },
      data: {
        authorDisplayName: data.displayName.trim() || null,
        authorImage: data.image.trim() || null,
        authorOrganization: data.organization.trim() || null,
        authorContactEmail: data.contactEmail.trim() || null,
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
        content: sanitizeHtml(data.content, SANITIZE_OPTIONS),
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
        content: sanitizeHtml(data.content, SANITIZE_OPTIONS),
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
