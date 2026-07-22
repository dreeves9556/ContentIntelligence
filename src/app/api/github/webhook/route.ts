import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyGithubSignature, parseCommitType, parseCommitTitle, parseCommitBody } from "@/lib/github";

export async function POST(req: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const signature = req.headers.get("x-hub-signature-256") ?? "";
  const event = req.headers.get("x-github-event") ?? "";
  const payload = await req.text();

  // Verify signature
  if (!verifyGithubSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event !== "push") {
    return NextResponse.json({ message: `Ignored event: ${event}` });
  }

  const body = JSON.parse(payload) as {
    commits?: Array<{
      id: string;
      message: string;
      author?: { name: string };
      timestamp?: string;
      url?: string;
    }>;
    repository?: { html_url?: string };
  };

  const commits = body.commits ?? [];
  if (commits.length === 0) {
    return NextResponse.json({ message: "No commits in push" });
  }

  const repoUrl = body.repository?.html_url ?? "https://github.com";

  let created = 0;
  let skipped = 0;

  for (const c of commits) {
    // Skip if already exists (gitSha is unique)
    const existing = await prisma.changelogEntry.findUnique({
      where: { gitSha: c.id },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const type = parseCommitType(c.message);
    const title = parseCommitTitle(c.message);
    const contentBody = parseCommitBody(c.message);
    const commitDate = c.timestamp ? new Date(c.timestamp) : new Date();

    await prisma.changelogEntry.create({
      data: {
        title,
        type,
        content: contentBody || title,
        published: true,
        publishedAt: commitDate,
        gitSha: c.id,
        gitAuthor: c.author?.name ?? null,
        gitUrl: c.url ?? `${repoUrl}/commit/${c.id}`,
      },
    });
    created++;
  }

  return NextResponse.json({ created, skipped, total: commits.length });
}
