import type { ChangelogType } from "@prisma/client";

export const GITHUB_REPO = "dreeves9556/ContentIntelligence";
export const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO}/commits`;

/**
 * Parse a conventional-commit message and map it to a ChangelogType.
 * Falls back to FEATURE for un-prefixed commits, ANNOUNCEMENT for merge commits.
 */
export function parseCommitType(message: string): ChangelogType {
  const firstLine = message.split("\n")[0].trim().toLowerCase();

  if (firstLine.startsWith("merge ")) return "ANNOUNCEMENT";
  if (firstLine.startsWith("security:") || firstLine.startsWith("sec:")) return "SECURITY";
  if (firstLine.startsWith("fix:") || firstLine.startsWith("bugfix:") || firstLine.startsWith("hotfix:")) return "BUGFIX";
  if (
    firstLine.startsWith("refactor:") ||
    firstLine.startsWith("perf:") ||
    firstLine.startsWith("improve:") ||
    firstLine.startsWith("style:") ||
    firstLine.startsWith("docs:") ||
    firstLine.startsWith("chore:") ||
    firstLine.startsWith("build:") ||
    firstLine.startsWith("ci:") ||
    firstLine.startsWith("test:")
  ) {
    return "IMPROVEMENT";
  }

  return "FEATURE";
}

/**
 * Extract a clean title from a commit message (first line, with conventional-commit prefix stripped).
 */
export function parseCommitTitle(message: string): string {
  const firstLine = message.split("\n")[0].trim();
  // Strip conventional-commit prefix: "type(scope): rest" → "rest"
  const match = firstLine.match(/^(?:\w+)(?:\([^)]+\))?:\s*(.+)$/);
  if (match) return match[1].trim();
  return firstLine;
}

/**
 * Extract the body of a commit message (everything after the first line).
 * Returns empty string if no body.
 */
export function parseCommitBody(message: string): string {
  const lines = message.split("\n");
  if (lines.length <= 1) return "";
  // Skip first line and any leading blank lines
  const body = lines.slice(1).join("\n").trim();
  return body;
}

/**
 * Verify GitHub webhook signature using HMAC-SHA256.
 */
export function verifyGithubSignature(payload: string, signature: string, secret: string): boolean {
  const crypto = require("crypto") as typeof import("crypto");
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
  // Timing-safe comparison
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export interface GitHubCommit {
  sha: string;
  message: string;
  authorName: string;
  date: string; // ISO string
  url: string;
}

/**
 * Fetch commits from GitHub API (paginated).
 * Uses GITHUB_TOKEN env var if available for higher rate limits.
 * Returns up to maxCommits commits (default 500).
 */
export async function fetchGithubCommits(maxCommits = 500): Promise<GitHubCommit[]> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "TheLocalPost-Changelog",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const commits: GitHubCommit[] = [];
  const perPage = 100;
  const maxPages = Math.ceil(maxCommits / perPage);

  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(`${GITHUB_API_BASE}?per_page=${perPage}&page=${page}`, { headers });
    if (!res.ok) {
      if (res.status === 409) break; // empty repo
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as Array<{
      sha: string;
      commit: {
        message: string;
        author: { name: string; date: string } | null;
      };
      html_url: string;
    }>;

    if (data.length === 0) break;

    for (const c of data) {
      commits.push({
        sha: c.sha,
        message: c.commit.message,
        authorName: c.commit.author?.name ?? "Unknown",
        date: c.commit.author?.date ?? new Date().toISOString(),
        url: c.html_url,
      });
    }

    if (data.length < perPage) break; // last page
  }

  return commits;
}
