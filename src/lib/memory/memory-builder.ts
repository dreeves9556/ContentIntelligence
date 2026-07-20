import { prisma } from "@/lib/prisma";
import type { MemoryType, Importance, MemorySource } from "@prisma/client";
import type { QuestionnaireFormData } from "@/lib/questionnaire-actions";
import { saveMemory } from "./memory-service";
import { summarizeDemographicsForAI } from "@/lib/deep-analytics";
import { classifyPost } from "@/lib/freshness";

// ─── Helpers ───────────────────────────────────────────────────────

function hasText(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

interface CandidateMemory {
  memoryType: MemoryType;
  title: string;
  summary: string;
  evidence?: string;
  importance: Importance;
  source: MemorySource;
  confidence?: number;
}

async function saveCandidates(
  userId: string,
  candidates: CandidateMemory[]
): Promise<number> {
  let saved = 0;
  for (const c of candidates) {
    if (!c.summary.trim()) continue;
    await saveMemory({
      userId,
      memoryType: c.memoryType,
      title: c.title,
      summary: c.summary,
      evidence: c.evidence,
      importance: c.importance,
      source: c.source,
      confidence: c.confidence,
    });
    saved++;
  }
  return saved;
}

// ─── Initial Memory Creation from Questionnaire ────────────────────

export async function buildMemoriesFromQuestionnaire(
  userId: string,
  answers: QuestionnaireFormData
): Promise<number> {
  const candidates: CandidateMemory[] = [];

  // IDENTITY — business & industry
  const identityParts: string[] = [];
  if (hasText(answers.businessName)) identityParts.push(`Business: ${answers.businessName}`);
  if (hasText(answers.whatYouDo)) identityParts.push(`What they do: ${answers.whatYouDo}`);
  if (hasText(answers.industry)) identityParts.push(`Industry: ${answers.industry}`);
  if (hasText(answers.city)) identityParts.push(`Location: ${answers.city}`);
  if (hasText(answers.brandType)) identityParts.push(`Brand type: ${answers.brandType}`);
  if (identityParts.length > 0) {
    candidates.push({
      memoryType: "IDENTITY",
      title: "Business identity & positioning",
      summary: identityParts.join(". "),
      importance: "CRITICAL",
      source: "QUESTIONNAIRE",
      confidence: 90,
    });
  }

  // IDENTITY — personal story
  if (hasText(answers.personalStory)) {
    candidates.push({
      memoryType: "IDENTITY",
      title: "Personal origin story",
      summary: answers.personalStory.slice(0, 500),
      evidence: answers.personalStory,
      importance: "HIGH",
      source: "QUESTIONNAIRE",
      confidence: 85,
    });
  }

  // VOICE — signature phrases & brand vocabulary
  const voiceParts: string[] = [];
  if (hasText(answers.signaturePhrases)) voiceParts.push(`Signature phrases: ${answers.signaturePhrases}`);
  if (hasText(answers.brandWords)) voiceParts.push(`Brand vocabulary: ${answers.brandWords}`);
  if (hasText(answers.speakingStyle)) voiceParts.push(`Speaking style: ${answers.speakingStyle}`);
  if (hasText(answers.humorStyle)) voiceParts.push(`Humor style: ${answers.humorStyle}`);
  if (hasText(answers.sentenceLength)) voiceParts.push(`Sentence length: ${answers.sentenceLength}`);
  if (hasText(answers.contentSample)) voiceParts.push(`Voice reference sample: ${answers.contentSample.slice(0, 300)}`);
  if (voiceParts.length > 0) {
    candidates.push({
      memoryType: "VOICE",
      title: "Brand voice & language patterns",
      summary: voiceParts.join(". "),
      evidence: hasText(answers.contentSample) ? answers.contentSample : undefined,
      importance: "HIGH",
      source: "QUESTIONNAIRE",
      confidence: 85,
    });
  }

  // VOICE — formatting & storytelling
  const formatParts: string[] = [];
  if (hasText(answers.emojiUsage)) formatParts.push(`Emoji usage: ${answers.emojiUsage}`);
  if (hasText(answers.formattingStyle)) formatParts.push(`Formatting style: ${answers.formattingStyle}`);
  if (hasText(answers.storytellingStyle)) formatParts.push(`Storytelling style: ${answers.storytellingStyle}`);
  if (formatParts.length > 0) {
    candidates.push({
      memoryType: "VOICE",
      title: "Formatting & storytelling preferences",
      summary: formatParts.join(". "),
      importance: "MEDIUM",
      source: "QUESTIONNAIRE",
      confidence: 75,
    });
  }

  // AUDIENCE — who they target
  const audienceParts: string[] = [];
  if (hasText(answers.audienceLabel)) audienceParts.push(`Audience label: ${answers.audienceLabel}`);
  if (hasText(answers.clientWords)) audienceParts.push(`Client language: ${answers.clientWords}`);
  if (audienceParts.length > 0) {
    candidates.push({
      memoryType: "AUDIENCE",
      title: "Target audience & client language",
      summary: audienceParts.join(". "),
      evidence: hasText(answers.clientWords) ? answers.clientWords : undefined,
      importance: "HIGH",
      source: "QUESTIONNAIRE",
      confidence: 85,
    });
  }

  // CONTENT — on-camera personality & formats enjoyed
  const contentParts: string[] = [];
  if (Array.isArray(answers.onCameraPersonality) && answers.onCameraPersonality.length > 0) {
    contentParts.push(`On-camera personality: ${answers.onCameraPersonality.join(", ")}`);
  }
  if (Array.isArray(answers.contentEnjoyed) && answers.contentEnjoyed.length > 0) {
    contentParts.push(`Formats enjoyed: ${answers.contentEnjoyed.join(", ")}`);
  }
  if (contentParts.length > 0) {
    candidates.push({
      memoryType: "CONTENT",
      title: "Content format preferences",
      summary: contentParts.join(". "),
      importance: "MEDIUM",
      source: "QUESTIONNAIRE",
      confidence: 75,
    });
  }

  // PREFERENCE — posting cadence
  if (typeof answers.daysToPost === "number" && answers.daysToPost > 0) {
    candidates.push({
      memoryType: "PREFERENCE",
      title: "Posting cadence preference",
      summary: `Posts ${answers.daysToPost} time${answers.daysToPost > 1 ? "s" : ""} per week.`,
      importance: "MEDIUM",
      source: "QUESTIONNAIRE",
      confidence: 80,
    });
  }

  // STRATEGY — primary goal
  if (hasText(answers.primaryGoal)) {
    candidates.push({
      memoryType: "STRATEGY",
      title: "Primary marketing goal",
      summary: `Primary goal: ${answers.primaryGoal}`,
      importance: "HIGH",
      source: "QUESTIONNAIRE",
      confidence: 85,
    });
  }

  // STRATEGY — current offer & CTA
  const offerParts: string[] = [];
  if (hasText(answers.currentOffer)) offerParts.push(`Current offer: ${answers.currentOffer}`);
  if (hasText(answers.preferredCTA)) offerParts.push(`Preferred CTA style: ${answers.preferredCTA}`);
  if (offerParts.length > 0) {
    candidates.push({
      memoryType: "STRATEGY",
      title: "Current offer & CTA calibration",
      summary: offerParts.join(". "),
      importance: "HIGH",
      source: "QUESTIONNAIRE",
      confidence: 80,
    });
  }

  // STRATEGY — proof points
  const proofParts: string[] = [];
  if (hasText(answers.numbersThatImpress)) proofParts.push(`Proof numbers: ${answers.numbersThatImpress}`);
  if (hasText(answers.recentWin)) proofParts.push(`Recent win: ${answers.recentWin}`);
  if (hasText(answers.faqTop3)) proofParts.push(`Top FAQ: ${answers.faqTop3}`);
  if (proofParts.length > 0) {
    candidates.push({
      memoryType: "STRATEGY",
      title: "Credibility proof points",
      summary: proofParts.join(". "),
      importance: "MEDIUM",
      source: "QUESTIONNAIRE",
      confidence: 75,
    });
  }

  // STRATEGY — seasonal context
  const seasonalParts: string[] = [];
  if (hasText(answers.seasonalRhythm)) seasonalParts.push(`Seasonal rhythm: ${answers.seasonalRhythm}`);
  if (hasText(answers.upcomingEvents)) seasonalParts.push(`Upcoming events: ${answers.upcomingEvents}`);
  if (seasonalParts.length > 0) {
    candidates.push({
      memoryType: "STRATEGY",
      title: "Seasonal & event context",
      summary: seasonalParts.join(". "),
      importance: "MEDIUM",
      source: "QUESTIONNAIRE",
      confidence: 70,
    });
  }

  // WARNING — anti-brand words
  if (hasText(answers.antiBrandWords)) {
    candidates.push({
      memoryType: "WARNING",
      title: "Banned vocabulary & anti-brand words",
      summary: `Avoid these words/phrases: ${answers.antiBrandWords}`,
      evidence: answers.antiBrandWords,
      importance: "CRITICAL",
      source: "QUESTIONNAIRE",
      confidence: 95,
    });
  }

  // WARNING — content boundaries
  if (hasText(answers.contentBoundaries)) {
    candidates.push({
      memoryType: "WARNING",
      title: "Content boundaries & hard limits",
      summary: `Content boundaries: ${answers.contentBoundaries}`,
      importance: "HIGH",
      source: "QUESTIONNAIRE",
      confidence: 90,
    });
  }

  // PREFERENCE — personal context
  const personalParts: string[] = [];
  if (hasText(answers.familyContext)) personalParts.push(`Life context: ${answers.familyContext}`);
  if (hasText(answers.morningRoutine)) personalParts.push(`Morning routine: ${answers.morningRoutine}`);
  if (hasText(answers.hotTakes)) personalParts.push(`Hot takes: ${answers.hotTakes}`);
  if (personalParts.length > 0) {
    candidates.push({
      memoryType: "PREFERENCE",
      title: "Personal context & life details",
      summary: personalParts.join(". "),
      importance: "MEDIUM",
      source: "QUESTIONNAIRE",
      confidence: 70,
    });
  }

  // Industry-specific answers
  if (answers.industryAnswers && typeof answers.industryAnswers === "object") {
    const industryEntries = Object.entries(answers.industryAnswers).filter(([, v]) => hasText(v));
    if (industryEntries.length > 0) {
      candidates.push({
        memoryType: "IDENTITY",
        title: `Industry deep-dive: ${answers.industry || "Other"}`,
        summary: industryEntries.map(([k, v]) => `${k}: ${v}`).join(". "),
        importance: "MEDIUM",
        source: "QUESTIONNAIRE",
        confidence: 75,
      });
    }
  }

  return saveCandidates(userId, candidates);
}

// ─── Initial Memory Creation from Profile Surveys ──────────────────

interface SurveyMemoryConfig {
  type: MemoryType;
  title: string;
  importance: Importance;
  fields?: string[];
}

const SURVEY_MEMORY_MAP: Record<string, SurveyMemoryConfig | SurveyMemoryConfig[]> = {
  LOCAL_MAYOR: { type: "CONTENT", title: "Hyper-local knowledge & spots", importance: "MEDIUM" },
  TRENCH_WARFARE: { type: "IDENTITY", title: "Trench warfare stories & negotiation style", importance: "HIGH" },
  ORIGIN_STORY: { type: "IDENTITY", title: "Origin story & industry pet peeves", importance: "HIGH" },
  CLIENT_AVATAR: { type: "AUDIENCE", title: "Client avatar & dream outcome", importance: "HIGH" },
  STORY_REFRESH: { type: "CONTENT", title: "Story refresh: new anecdotes & observations", importance: "HIGH" },
  OFFER_FUNNEL: [
    {
      type: "STRATEGY",
      title: "Offer, funnel & CTAs",
      importance: "HIGH",
      fields: ["mainOffer", "offerForWho", "painPointSolved", "dreamOutcome", "offerDetails", "primaryCTA", "bookingLink", "leadMagnet", "commonObjections", "urgencyReason", "proofPoints"],
    },
    {
      type: "WARNING",
      title: "Offer guardrails: do NOT promise",
      importance: "HIGH",
      fields: ["doNotPromise"],
    },
  ],
  PROOF_BANK: [
    {
      type: "PERFORMANCE",
      title: "Proof bank: testimonials & client wins",
      importance: "HIGH",
      fields: ["bestTestimonials", "clientWins", "beforeAfterStories", "numbersAndStats", "caseStudyDetails", "permissionLevel"],
    },
    {
      type: "WARNING",
      title: "Proof boundaries: do NOT share",
      importance: "HIGH",
      fields: ["proofBoundaries"],
    },
  ],
  COMPLIANCE_GUARDRAILS: [
    {
      type: "WARNING",
      title: "Compliance guardrails: forbidden claims & words",
      importance: "CRITICAL",
      fields: ["forbiddenClaims", "wordsToAvoidForCompliance", "sensitiveTopics", "regulatedTopics"],
    },
    {
      type: "PREFERENCE",
      title: "Compliance: disclaimers, approval & credentials",
      importance: "HIGH",
      fields: ["requiredDisclaimers", "companyRules", "approvalProcess", "licenseOrCredentialRules"],
    },
  ],
};

export async function buildMemoriesFromSurvey(
  userId: string,
  surveyType: string,
  answers: Record<string, string>
): Promise<number> {
  const config = SURVEY_MEMORY_MAP[surveyType];
  if (!config) return 0;

  const configs = Array.isArray(config) ? config : [config];
  let saved = 0;

  for (const cfg of configs) {
    const allEntries = Object.entries(answers).filter(([, v]) => hasText(v));
    const entries = cfg.fields
      ? allEntries.filter(([k]) => cfg.fields!.includes(k))
      : allEntries;
    if (entries.length === 0) continue;

    const summary = entries.map(([k, v]) => `${k}: ${v}`).join(". ");
    const evidence = entries.map(([k, v]) => `${k}: ${v}`).join("\n");

    await saveMemory({
      userId,
      memoryType: cfg.type,
      title: cfg.title,
      summary: summary.slice(0, 500),
      evidence,
      importance: cfg.importance,
      source: "PROFILE_SURVEY",
      confidence: 80,
    });
    saved++;
  }

  return saved;
}

// ─── Auto-Learning from Analytics ──────────────────────────────────

interface AnalyticsPostRow {
  title: string;
  format: string;
  views: number;
  likes: number;
  comments: number;
}

interface ArchiveRow {
  title: string;
  format: string;
  bucket: string;
  caption: string;
  hook: string;
}

interface FeedbackRow {
  title: string;
  format: string;
  bucket: string;
  feedback: string;
}

function engagement(row: { likes: number; comments: number }): number {
  return row.likes + row.comments;
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 60);
}

export async function learnFromAnalytics(userId: string): Promise<number> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [analyticsRows, archiveRows, feedbackRows, demographicsRows] = await Promise.all([
    prisma.postAnalytics.findMany({
      where: { userId, publishedAt: { gte: ninetyDaysAgo } },
      select: { title: true, format: true, views: true, likes: true, comments: true },
    }),
    prisma.contentArchive.findMany({
      where: { userId },
      orderBy: { archivedAt: "desc" },
      take: 50,
      select: { title: true, format: true, bucket: true, caption: true, hook: true },
    }),
    prisma.contentFeedback.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { title: true, format: true, bucket: true, feedback: true },
    }),
    prisma.deepAnalytics.findMany({
      where: { userId, dataType: "demographics" },
      select: { platform: true, data: true },
    }),
  ]);

  const candidates: CandidateMemory[] = [];

  // 1. Bucket performance comparison (Personal vs Expert vs Local)
  const matches = matchArchiveToAnalytics(archiveRows, analyticsRows);
  if (matches.length >= 3) {
    const bucketStats = new Map<string, { total: number; count: number }>();
    for (const m of matches) {
      const stat = bucketStats.get(m.bucket) ?? { total: 0, count: 0 };
      stat.total += engagement(m);
      stat.count++;
      bucketStats.set(m.bucket, stat);
    }

    const bucketAvgs = Array.from(bucketStats.entries()).map(([bucket, stat]) => ({
      bucket,
      avg: stat.count > 0 ? stat.total / stat.count : 0,
      count: stat.count,
    }));

    if (bucketAvgs.length >= 2) {
      bucketAvgs.sort((a, b) => b.avg - a.avg);
      const top = bucketAvgs[0];
      const bottom = bucketAvgs[bucketAvgs.length - 1];
      if (top.avg > 0 && bottom.avg >= 0 && top.avg > bottom.avg * 1.3) {
        candidates.push({
          memoryType: "PERFORMANCE",
          title: `${top.bucket} content outperforms ${bottom.bucket} content`,
          summary: `${top.bucket} content averages ${Math.round(top.avg)} interactions per post, outperforming ${bottom.bucket} content (${Math.round(bottom.avg)} interactions). Lean toward more ${top.bucket} content.`,
          evidence: `Based on ${matches.length} matched posts over 90 days.`,
          importance: "HIGH",
          source: "ANALYTICS",
          confidence: 70,
        });
      }
    }
  }

  // 2. Format performance comparison
  if (analyticsRows.length >= 5) {
    const formatStats = new Map<string, { total: number; count: number; views: number }>();
    for (const row of analyticsRows) {
      const stat = formatStats.get(row.format) ?? { total: 0, count: 0, views: 0 };
      stat.total += engagement(row);
      stat.count++;
      stat.views += row.views;
      formatStats.set(row.format, stat);
    }
    const formatAvgs = Array.from(formatStats.entries()).map(([format, stat]) => ({
      format,
      avgEng: stat.count > 0 ? stat.total / stat.count : 0,
      avgViews: stat.count > 0 ? stat.views / stat.count : 0,
      count: stat.count,
    }));
    if (formatAvgs.length >= 2) {
      formatAvgs.sort((a, b) => b.avgEng - a.avgEng);
      const top = formatAvgs[0];
      const bottom = formatAvgs[formatAvgs.length - 1];
      if (top.avgEng > 0 && top.avgEng > bottom.avgEng * 1.5) {
        candidates.push({
          memoryType: "PERFORMANCE",
          title: `${top.format} format outperforms ${bottom.format}`,
          summary: `${top.format} posts average ${Math.round(top.avgEng)} interactions (${Math.round(top.avgViews)} avg views), significantly outperforming ${bottom.format} (${Math.round(bottom.avgEng)} interactions).`,
          evidence: `Based on ${top.count} ${top.format} posts vs ${bottom.count} ${bottom.format} posts.`,
          importance: "HIGH",
          source: "ANALYTICS",
          confidence: 65,
        });
      }
    }
  }

  // 3. Content feedback patterns — repeated thumbs-down
  const rejected = feedbackRows.filter((r) => r.feedback === "down");
  if (rejected.length >= 3) {
    const bucketCounts = new Map<string, number>();
    for (const r of rejected) {
      bucketCounts.set(r.bucket, (bucketCounts.get(r.bucket) ?? 0) + 1);
    }
    for (const [bucket, count] of bucketCounts) {
      if (count >= 3) {
        candidates.push({
          memoryType: "WARNING",
          title: `Audience consistently rejects ${bucket} content`,
          summary: `User has thumbs-down rejected ${count} ${bucket} posts. This bucket may need a different angle or approach.`,
          evidence: rejected.filter((r) => r.bucket === bucket).map((r) => `- "${r.title}"`).join("\n"),
          importance: "HIGH",
          source: "CONTENT_FEEDBACK",
          confidence: 60,
        });
      }
    }
  }

  // 4. Content feedback patterns — repeated thumbs-up
  const loved = feedbackRows.filter((r) => r.feedback === "up");
  if (loved.length >= 3) {
    const bucketCounts = new Map<string, number>();
    for (const r of loved) {
      bucketCounts.set(r.bucket, (bucketCounts.get(r.bucket) ?? 0) + 1);
    }
    for (const [bucket, count] of bucketCounts) {
      if (count >= 3) {
        candidates.push({
          memoryType: "CONTENT",
          title: `User loves ${bucket} content`,
          summary: `User has thumbs-up approved ${count} ${bucket} posts. This angle resonates with their taste.`,
          evidence: loved.filter((r) => r.bucket === bucket).map((r) => `- "${r.title}"`).join("\n"),
          importance: "MEDIUM",
          source: "CONTENT_FEEDBACK",
          confidence: 60,
        });
      }
    }
  }

  // 5. Demographics → audience memory
  if (demographicsRows.length > 0) {
    const demoSummary = summarizeDemographicsForAI(
      demographicsRows.map((r) => ({
        platform: r.platform,
        data: r.data as unknown as { kind: string; payload: unknown },
      }))
    );
    if (demoSummary) {
      candidates.push({
        memoryType: "AUDIENCE",
        title: "Audience demographics from analytics",
        summary: demoSummary.slice(0, 500),
        importance: "HIGH",
        source: "ANALYTICS",
        confidence: 70,
      });
    }
  }

  // 6. Winning formula extraction — distill patterns from top-performing posts
  if (matches.length >= 5) {
    const sortedMatches = [...matches].sort((a, b) => engagement(b) - engagement(a));
    const topPosts = sortedMatches.slice(0, 5).filter((p) => engagement(p) > 0);

    if (topPosts.length >= 3) {
      // Classify archetypes of top posts
      const archetypeCounts = new Map<string, number>();
      const bucketCounts = new Map<string, number>();
      for (const post of topPosts) {
        const archetype = classifyPost({
          title: post.title,
          hook: post.hook,
          bucket: post.bucket,
          format: post.format,
        });
        archetypeCounts.set(archetype, (archetypeCounts.get(archetype) ?? 0) + 1);
        bucketCounts.set(post.bucket, (bucketCounts.get(post.bucket) ?? 0) + 1);
      }

      // Find dominant archetype(s) — any appearing in ≥40% of top posts
      const dominantArchetypes: string[] = [];
      for (const [archetype, count] of archetypeCounts) {
        if (archetype !== "Other" && count / topPosts.length >= 0.4) {
          dominantArchetypes.push(`${archetype} (${count}/${topPosts.length} top posts)`);
        }
      }

      // Find dominant bucket
      const sortedBuckets = [...bucketCounts.entries()].sort((a, b) => b[1] - a[1]);
      const dominantBucket = sortedBuckets[0]?.[0];

      // Extract common hook keywords from top posts
      const hookWords = new Map<string, number>();
      for (const post of topPosts) {
        const words = post.hook.toLowerCase().match(/[a-z]+/g) ?? [];
        const seen = new Set<string>();
        for (const word of words) {
          if (word.length < 4 || seen.has(word)) continue;
          seen.add(word);
          hookWords.set(word, (hookWords.get(word) ?? 0) + 1);
        }
      }
      const commonHookWords = [...hookWords.entries()]
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);

      // Build summary
      const parts: string[] = [];
      if (dominantArchetypes.length > 0) {
        parts.push(`Dominant archetype(s) in top posts: ${dominantArchetypes.join(", ")}`);
      }
      if (dominantBucket) {
        const bucketCount = bucketCounts.get(dominantBucket) ?? 0;
        parts.push(`${dominantBucket} bucket appears in ${bucketCount}/${topPosts.length} top posts`);
      }
      if (commonHookWords.length > 0) {
        parts.push(`Common hook keywords in top posts: ${commonHookWords.join(", ")}`);
      }

      if (parts.length > 0) {
        candidates.push({
          memoryType: "STRATEGY",
          title: "Winning formula: top-performing content patterns",
          summary: `Top ${topPosts.length} posts by engagement share these patterns. ${parts.join(". ")}. Lean toward these archetypes, buckets, and hook styles in future content without repeating the exact posts.`,
          importance: "HIGH",
          source: "ANALYTICS",
          confidence: 65,
        });
      }
    }
  }

  return saveCandidates(userId, candidates);
}

function matchArchiveToAnalytics(
  archives: ArchiveRow[],
  analytics: AnalyticsPostRow[]
): { title: string; hook: string; bucket: string; format: string; views: number; likes: number; comments: number }[] {
  const matches: { title: string; hook: string; bucket: string; format: string; views: number; likes: number; comments: number }[] = [];
  for (const archive of archives) {
    const captionKey = normalizeForMatch(archive.caption);
    const hookKey = normalizeForMatch(archive.hook);
    if (!captionKey && !hookKey) continue;
    const hit = analytics.find((a) => {
      const titleKey = normalizeForMatch(a.title);
      if (!titleKey) return false;
      return (
        (captionKey.length >= 20 && (titleKey.startsWith(captionKey.slice(0, 40)) || captionKey.startsWith(titleKey.slice(0, 40)))) ||
        (hookKey.length >= 20 && (titleKey.startsWith(hookKey.slice(0, 40)) || hookKey.startsWith(titleKey.slice(0, 40))))
      );
    });
    if (hit) {
      matches.push({
        title: archive.title,
        hook: archive.hook,
        bucket: archive.bucket,
        format: archive.format,
        views: hit.views,
        likes: hit.likes,
        comments: hit.comments,
      });
    }
  }
  return matches;
}

// ─── Auto-Learning from Content Feedback ───────────────────────────

export async function learnFromFeedback(
  userId: string,
  feedback: "up" | "down",
  dayContent: { title: string; format: string; bucket: string }
): Promise<void> {
  if (feedback === "down") {
    await saveMemory({
      userId,
      memoryType: "WARNING",
      title: `Rejected: "${dayContent.title}"`,
      summary: `User thumbs-down rejected a ${dayContent.format} (${dayContent.bucket}) post titled "${dayContent.title}". Avoid similar angles.`,
      importance: "LOW",
      source: "CONTENT_FEEDBACK",
      confidence: 40,
    });
  }
}

// ─── Full Learning Pipeline ────────────────────────────────────────

export async function runLearningPipeline(userId: string): Promise<number> {
  return learnFromAnalytics(userId);
}
