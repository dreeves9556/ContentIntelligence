export interface ArchivePostForFreshness {
  title: string;
  hook: string;
  bucket: string;
  format: string;
  weekStarting?: string;
}

export type ContentArchetype =
  | "Listicle"
  | "Question Hook"
  | "Bold Statement"
  | "Story / Anecdote"
  | "Myth-Bust"
  | "Behind-the-Scenes"
  | "How-To / Educational"
  | "Contrarian / Hot Take"
  | "Direct Address"
  | "Comparison / Vs"
  | "Other";

const ARCHETYPE_PATTERNS: { archetype: ContentArchetype; patterns: RegExp[] }[] = [
  {
    archetype: "Listicle",
    patterns: [
      /\b\d+\s+(things|reasons|tips|ways|signs|mistakes|secrets|lessons|habits|steps|ideas|myths)\b/i,
      /\btop\s+\d+\b/i,
      /\b\d+\s+of\s+the\s+best\b/i,
    ],
  },
  {
    archetype: "Contrarian / Hot Take",
    patterns: [
      /\bunpopular\s+opinion\b/i,
      /\bhot\s+take\b/i,
      /\bi\s+disagree\b/i,
      /\bstop\s+(doing|saying|posting|telling)\b/i,
      /\bnobody\s+should\b/i,
      /\boverrated\b/i,
    ],
  },
  {
    archetype: "Myth-Bust",
    patterns: [
      /\bmyth\b/i,
      /\bdebunk/i,
      /\bwrong\s+about\b/i,
      /\btruth\s+(is|about)\b/i,
      /\bactually\b/i,
      /\bmisconception\b/i,
      /\bdon.?t\s+believe\b/i,
    ],
  },
  {
    archetype: "Question Hook",
    patterns: [
      /^(why|what|how|when|where|did you know|ever wondered|have you ever|are you|do you|should you|what if)\b/i,
    ],
  },
  {
    archetype: "Story / Anecdote",
    patterns: [
      /^(yesterday|last week|last night|the other day|a client|i remember|so i|funny story|story time|let me tell you)\b/i,
      /\bonce\b/i,
      /\ba\s+(client|customer|guy|friend|buyer|seller)\b/i,
    ],
  },
  {
    archetype: "Behind-the-Scenes",
    patterns: [
      /\bbehind\s+the\s+scenes\b/i,
      /\bday\s+in\s+(the\s+)?life\b/i,
      /\bhow\s+i\b/i,
      /\btake\s+you\s+(behind|inside|through)\b/i,
      /\bmy\s+(morning|evening|daily)\s+routine\b/i,
      /\bprocess\b/i,
    ],
  },
  {
    archetype: "How-To / Educational",
    patterns: [
      /\bhow\s+to\b/i,
      /\bstep.by.step\b/i,
      /\btutorial\b/i,
      /\bguide\s+to\b/i,
      /\bwalkthrough\b/i,
      /\bdo\s+this\b/i,
      /\btry\s+this\b/i,
    ],
  },
  {
    archetype: "Bold Statement",
    patterns: [
      /\bnobody\s+tells\s+you\b/i,
      /\bhere.?s\s+the\s+(truth|thing|reality)\b/i,
      /\blet\s+me\s+be\s+(honest|real)\b/i,
      /\bi.?ll\s+be\s+(honest|real)\b/i,
      /\bthe\s+real\s+reason\b/i,
      /\bthis\s+is\s+(why|how|what)\b/i,
      /\beveryone\s+(gets|is|does)\b/i,
    ],
  },
  {
    archetype: "Comparison / Vs",
    patterns: [
      /\bvs\.?\b/i,
      /\bthis\s+vs\s+that\b/i,
      /\bbetter\s+than\b/i,
      /\bthe\s+difference\b/i,
      /\bcompared\s+to\b/i,
    ],
  },
  {
    archetype: "Direct Address",
    patterns: [
      /^(you|your|listen|hey|real talk|let.?s\s+talk)\b/i,
      /\byou\s+(need|should|must|have\s+to|are)\b/i,
    ],
  },
];

function classifyArchetype(text: string): ContentArchetype {
  const combined = `${text}`.trim();
  if (!combined) return "Other";
  for (const { archetype, patterns } of ARCHETYPE_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(combined)) return archetype;
    }
  }
  return "Other";
}

function classifyPost(post: ArchivePostForFreshness): ContentArchetype {
  const hookArchetype = classifyArchetype(post.hook);
  if (hookArchetype !== "Other") return hookArchetype;
  const titleArchetype = classifyArchetype(post.title);
  if (titleArchetype !== "Other") return titleArchetype;
  return "Other";
}

const STOP_WORDS = new Set([
  "the", "a", "an", "to", "of", "in", "on", "for", "and", "or", "but", "is",
  "are", "was", "were", "be", "been", "being", "have", "has", "had", "do",
  "does", "did", "will", "would", "could", "should", "may", "might", "must",
  "can", "this", "that", "these", "those", "i", "you", "he", "she", "it",
  "we", "they", "what", "which", "who", "when", "where", "why", "how", "all",
  "each", "every", "both", "few", "more", "most", "other", "some", "such",
  "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "just", "your", "my", "me", "our", "us", "them", "his", "her", "its",
  "from", "with", "about", "into", "through", "during", "before", "after",
  "above", "below", "up", "down", "out", "off", "over", "under", "again",
  "further", "then", "once", "here", "there", "don", "don't", "s", "t",
  "if", "at", "by", "as", "also", "really", "actually", "things", "thing",
  "way", "ways", "make", "made", "get", "got", "going", "go", "one", "two",
  "three", "post", "reel", "carousel", "static", "content", "video",
]);

function extractThemes(posts: ArchivePostForFreshness[], maxThemes: number = 12): string[] {
  const themeCounts = new Map<string, number>();

  for (const post of posts) {
    const text = `${post.title} ${post.hook}`.toLowerCase();
    const words = text.match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
    const seen = new Set<string>();

    for (const word of words) {
      if (word.length < 4) continue;
      if (STOP_WORDS.has(word)) continue;
      if (seen.has(word)) continue;
      seen.add(word);
      themeCounts.set(word, (themeCounts.get(word) ?? 0) + 1);
    }

    // Also extract bigrams (two-word phrases) for more specific themes
    const bigrams = text.match(/[a-z]+ [a-z]+/g) ?? [];
    for (const bigram of bigrams) {
      const [w1, w2] = bigram.split(" ");
      if (STOP_WORDS.has(w1) || STOP_WORDS.has(w2)) continue;
      if (w1.length < 4 || w2.length < 4) continue;
      const key = `${w1} ${w2}`;
      if (seen.has(key)) continue;
      seen.add(key);
      themeCounts.set(key, (themeCounts.get(key) ?? 0) + 1);
    }
  }

  return [...themeCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxThemes)
    .map(([theme]) => theme);
}

export function buildUsedHooksBlock(posts: ArchivePostForFreshness[], maxHooks: number = 20): string {
  const hooks = posts
    .slice(0, maxHooks)
    .map((p) => p.hook)
    .filter((h) => h && h.trim().length > 0);

  if (hooks.length === 0) return "";

  const list = hooks.map((h, i) => `${i + 1}. "${h.trim().slice(0, 150)}"`).join("\n");
  return `<used_hooks>\nRecently used opening hooks — do NOT repeat these opening patterns, sentence structures, or phrasings. The goal is not just different words but different APPROACHES to opening a post:\n${list}\n</used_hooks>`;
}

export function buildArchetypeHistoryBlock(posts: ArchivePostForFreshness[]): string {
  if (posts.length < 3) return "";

  const counts = new Map<ContentArchetype, number>();
  for (const post of posts) {
    const archetype = classifyPost(post);
    counts.set(archetype, (counts.get(archetype) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = posts.length;

  const overused = sorted.filter(([, c]) => c / total > 0.35 && ("," as ContentArchetype) !== "Other");
  const underused: ContentArchetype[] = [];
  const allArchetypes: ContentArchetype[] = [
    "Listicle", "Question Hook", "Bold Statement", "Story / Anecdote",
    "Myth-Bust", "Behind-the-Scenes", "How-To / Educational",
    "Contrarian / Hot Take", "Direct Address", "Comparison / Vs",
  ];
  for (const a of allArchetypes) {
    if (!counts.has(a) || (counts.get(a) ?? 0) / total < 0.1) {
      underused.push(a);
    }
  }

  const lines = sorted.map(([archetype, count]) => {
    const pct = ((count / total) * 100).toFixed(0);
    return `- ${archetype}: ${count} posts (${pct}%)`;
  });

  const sections: string[] = [
    `ARCHETYPE BREAKDOWN (last ${total} posts):`,
    ...lines,
  ];

  if (overused.length > 0) {
    sections.push(
      `\nOVERUSED — these archetypes have been used too frequently. AVOID or significantly reduce them this week:\n${overused.map(([a]) => `- ${a}`).join("\n")}`
    );
  }

  if (underused.length > 0) {
    sections.push(
      `\nUNDERUSED — these archetypes have been rarely or never used. LEAN INTO at least 2 of them this week:\n${underused.map((a) => `- ${a}`).join("\n")}`
    );
  }

  return `<archetype_history>\nThis is a structural analysis of the creator's recent content. Use it to ROTATE approaches and avoid falling into repetitive patterns — even when the topic is different, the same structural archetype feels stale to the audience.\n${sections.join("\n")}\n</archetype_history>`;
}

export function buildThemesExploredBlock(posts: ArchivePostForFreshness[]): string {
  if (posts.length < 5) return "";

  const themes = extractThemes(posts, 15);
  if (themes.length === 0) return "";

  // Group posts by bucket for context
  const byBucket = new Map<string, string[]>();
  for (const post of posts.slice(0, 30)) {
    const list = byBucket.get(post.bucket) ?? [];
    list.push(post.title);
    byBucket.set(post.bucket, list);
  }

  const bucketLines: string[] = [];
  for (const [bucket, titles] of byBucket) {
    bucketLines.push(`- ${bucket}: ${titles.slice(0, 6).map((t) => `"${t}"`).join(", ")}`);
  }

  return `<themes_explored>\nThese are the topics and themes the creator has ALREADY covered in recent posts. Do not re-tread the same ground — find new angles, new stories, or untouched topics. The questionnaire data is raw material, not a script. Each week should explore NEW territory.\n\nRECURRING KEYWORDS (themes already explored — try different ones):\n${themes.map((t) => `- ${t}`).join("\n")}\n\nRECENT POSTS BY BUCKET (for context on what's been done):\n${bucketLines.join("\n")}\n</themes_explored>`;
}

const CREATIVE_CONSTRAINTS_POOL: string[] = [
  // ── Hook style constraints ──
  "Open at least one post with a question this week.",
  "Open at least one post with a bold, provocative statement that makes people stop scrolling.",
  "Use a contrarian hook for at least one post — start with a position people might disagree with.",
  "Open at least one post with a one-word or two-word punchy opening (e.g., 'Stop.' or 'Listen up.')",
  "Open at least one post mid-story — drop the audience into the middle of a moment without context.",
  "Open at least one post with a surprising statistic or number from the creator's experience.",
  "Open at least one post with a direct challenge to the audience ('You're doing X wrong.')",
  // ── Structural / archetype constraints ──
  "Include at least one contrarian or hot-take post that challenges a common belief in your industry.",
  "Use a behind-the-scenes angle for at least one post — show the process, not just the result.",
  "Tell a story (not a list or tips) for at least one post. Narrative arc with a beginning, middle, and end.",
  "Make at least one post a myth-bust — debunk a common misconception in your industry.",
  "Use a day-in-the-life framing for at least one post.",
  "Try a before-and-after transformation angle for at least one post.",
  "Use a this-vs-that comparison angle for at least one post.",
  "Try a rapid-fire or quick-tips format for at least one post — punchy, fast-paced value.",
  "Make at least one post a client story or case study (anonymized if needed) — show, don't tell.",
  "Include at least one post that takes the audience behind a specific decision the creator made.",
  "Include at least one post that's purely entertaining or funny, with no business lesson attached.",
  "Structure one post as a mini-rant — short, punchy, opinionated, with a clear point.",
  "Use a 'things I wish I knew before...' framing for at least one post.",
  "Try an 'unpopular opinion' format for at least one post — something the creator genuinely believes that most people don't.",
  "Include at least one post structured as a Q&A — answer a question the creator gets asked all the time.",
  "Make at least one post a 'reaction' — react to something in the industry, a trend, or a common practice.",
  // ── Emotional / vulnerability constraints ──
  "Share a failure or mistake in at least one post, and what was learned from it.",
  "Include at least one post where the creator shares something they changed their mind about.",
  "Use humour or self-deprecation in at least one post — don't take yourself too seriously.",
  "Include at least one post that shows a moment of doubt or vulnerability — real human emotion, not a lesson.",
  "Share something the creator is currently struggling with or working on — work-in-progress, not polished advice.",
  "Include at least one post expressing genuine gratitude — for a specific person, client, or moment.",
  // ── Local / temporal constraints ──
  "Make at least one post hyper-local — reference a specific local spot, event, or neighbourhood detail.",
  "Make at least one post that ties into something happening THIS week (current event, season, holiday, trend).",
  "Reference the current weather or season in at least one post — make it feel like it was made today.",
  // ── Audience interaction constraints ──
  "Include at least one post that directly responds to a question or DM the creator gets frequently.",
  "End at least one post with a question to the audience instead of a CTA — spark a conversation.",
  "Include at least one post that asks the audience to vote or choose between options.",
  "Make at least one post that references a specific comment or reply from a follower.",
  // ── Format / delivery constraints ──
  "Make at least one post feel like a text message or voice note — casual, unpolished, intimate.",
  "Use a 'steal my...' framing for at least one post (e.g., 'steal my morning routine,' 'steal my follow-up template').",
  "Include at least one post that's a hot take delivered calmly — the contrast between calm tone and bold claim is the hook.",
  "Try a 'two truths and a lie' format for at least one post about the creator's industry.",
  "Include at least one post that breaks the fourth wall — acknowledge the act of making content itself.",
  "Make at least one post that's a mini-lesson — one specific, actionable tip, nothing else.",
  "Include at least one post where the creator predicts something about their industry in the next 6-12 months.",
  "Use a 'what I would tell my younger self' angle for at least one post.",
  "Include at least one post that connects two seemingly unrelated topics from the creator's life.",
  "Make at least one post that's a response to something the creator saw on social media this week — a stitch or reaction energy.",
  "Include at least one post that lists the creator's current favourite tools, apps, or resources.",
  "Use a 'common question, uncommon answer' structure for at least one post.",
];

export function buildCreativeConstraintsBlock(seed?: number): string {
  // Deterministic-ish shuffle using seed if provided, otherwise Math.random
  const constraints = [...CREATIVE_CONSTRAINTS_POOL];
  const rng = seed !== undefined ? mulberry32(seed) : Math.random;

  // Fisher-Yates shuffle
  for (let i = constraints.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [constraints[i], constraints[j]] = [constraints[j], constraints[i]];
  }

  const selected = constraints.slice(0, 4);
  return `<creative_constraints>\nThis week, incorporate at least 2 of these 4 creative constraints. They are randomized each week to force fresh approaches and prevent the content from settling into repetitive patterns:\n${selected.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n</creative_constraints>`;
}

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildVariationDirectiveBlock(generationCount: number): string {
  const count = generationCount;
  const isHigh = count >= 5;
  const isVeryHigh = count >= 10;

  const lines: string[] = [
    `GENERATION COUNT: This is approximately the ${ordinal(count)} calendar generated for this creator.`,
  ];

  if (isVeryHigh) {
    lines.push(
      "FRESHNESS CRITICAL — This creator has been using the system for many weeks. The questionnaire data has been fed into the prompt many times. You MUST find new angles, new stories, and new structural approaches. Do NOT recycle the same anecdotes, hot takes, or hook patterns. The creator's audience has seen the same themes repeatedly — give them something genuinely fresh.",
    );
  } else if (isHigh) {
    lines.push(
      "FRESHNESS WARNING — This creator has generated several calendars. The questionnaire tropes are becoming familiar. Actively seek new angles and avoid repeating the same stories or structural patterns. Use the archetype history and themes explored blocks above to identify what's been overused.",
    );
  } else {
    lines.push(
      "While this is still early, always think about long-term variety. The questionnaire data is a foundation to build from, not a script to recite.",
    );
  }

  lines.push(
    "VARIETY RULES:\n- Vary hook styles across posts within this week AND across weeks (question, bold statement, story, contrarian, direct address).\n- Rotate content archetypes — don't let listicles or myth-busts dominate.\n- If a specific anecdote, hot take, or proof point was used in recent posts, let it rest for at least 3-4 weeks before revisiting.\n- The same topic can be approached from multiple angles, but only if the ANGLE is genuinely different (not just reworded).\n- When in doubt, choose the less obvious angle.",
  );

  return `<variation_directive>\n${lines.join("\n")}\n</variation_directive>`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ─── #2: Anecdote Cooldown ──────────────────────────────────────────

export interface QuestionnaireMaterial {
  label: string;
  value: string;
}

function extractKeyPhrases(text: string): string[] {
  const cleaned = text.toLowerCase().replace(/[^\w\s]/g, " ");
  const words = cleaned.split(/\s+/).filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
  const phrases: string[] = [];

  // Single words
  for (const word of words.slice(0, 8)) {
    phrases.push(word);
  }

  // Bigrams
  for (let i = 0; i < words.length - 1; i++) {
    phrases.push(`${words[i]} ${words[i + 1]}`);
  }

  return phrases.slice(0, 12);
}

function phraseInPosts(phrase: string, posts: ArchivePostForFreshness[]): boolean {
  for (const post of posts) {
    const text = `${post.title} ${post.hook}`.toLowerCase();
    if (text.includes(phrase)) return true;
  }
  return false;
}

export function buildAnecdoteCooldownBlock(
  material: QuestionnaireMaterial[],
  posts: ArchivePostForFreshness[],
): string {
  if (posts.length < 5 || material.length === 0) return "";

  const used: { label: string; snippet: string }[] = [];
  const fresh: { label: string; snippet: string }[] = [];

  for (const item of material) {
    if (!item.value || item.value.trim().length < 10) continue;
    const phrases = extractKeyPhrases(item.value);
    const isUsed = phrases.some((p) => phraseInPosts(p, posts));
    const snippet = item.value.trim().slice(0, 80);
    if (isUsed) {
      used.push({ label: item.label, snippet });
    } else {
      fresh.push({ label: item.label, snippet });
    }
  }

  if (used.length === 0 && fresh.length === 0) return "";

  const sections: string[] = [];

  if (used.length > 0) {
    sections.push(
      `ANECDOTES ALREADY USED (let them rest for 3-4 weeks before revisiting):\n${used.map((u) => `- ${u.label}: "${u.snippet}..."`).join("\n")}`,
    );
  }

  if (fresh.length > 0) {
    sections.push(
      `FRESH ANECDOTES (not yet used — great material to draw from this week):\n${fresh.map((f) => `- ${f.label}: "${f.snippet}..."`).join("\n")}`,
    );
  }

  return `<anecdote_cooldown>\nThe creator's questionnaire and survey answers contain specific stories, opinions, and experiences. Some have already been turned into posts — let those rest. Others are untapped — prioritize them.\n${sections.join("\n\n")}\n</anecdote_cooldown>`;
}

// ─── #3: Content Gap Analysis ───────────────────────────────────────

export function buildContentGapBlock(
  material: QuestionnaireMaterial[],
  posts: ArchivePostForFreshness[],
): string {
  if (material.length === 0) return "";

  const themes = extractThemes(posts, 20);
  const themeSet = new Set(themes.flatMap((t) => t.split(" ")));

  const untapped: { label: string; snippet: string }[] = [];

  for (const item of material) {
    if (!item.value || item.value.trim().length < 10) continue;
    const phrases = extractKeyPhrases(item.value);
    const topPhrase = phrases[0];
    if (topPhrase && !themeSet.has(topPhrase) && !phraseInPosts(topPhrase, posts)) {
      untapped.push({ label: item.label, snippet: item.value.trim().slice(0, 80) });
    }
  }

  if (untapped.length === 0) return "";

  return `<untapped_material>\nThese are specific pieces of the creator's questionnaire/survey data that have NOT been explored in recent posts. They are prime material for fresh content this week:\n${untapped.map((u) => `- ${u.label}: "${u.snippet}..."`).join("\n")}\n</untapped_material>`;
}

// ─── #6: Temporal Context ───────────────────────────────────────────

const US_HOLIDAYS: { date: string; name: string }[] = [
  { date: "01-01", name: "New Year's Day" },
  { date: "01-20", name: "MLK Day (3rd Monday of Jan — approximate)" },
  { date: "02-14", name: "Valentine's Day" },
  { date: "02-17", name: "Presidents Day (3rd Monday of Feb — approximate)" },
  { date: "03-17", name: "St. Patrick's Day" },
  { date: "04-15", name: "Tax Day" },
  { date: "05-26", name: "Memorial Day (last Monday of May — approximate)" },
  { date: "06-19", name: "Juneteenth" },
  { date: "07-04", name: "Independence Day" },
  { date: "09-01", name: "Labor Day (1st Monday of Sep — approximate)" },
  { date: "10-13", name: "Columbus Day (2nd Monday of Oct — approximate)" },
  { date: "10-31", name: "Halloween" },
  { date: "11-11", name: "Veterans Day" },
  { date: "11-27", name: "Thanksgiving (4th Thursday of Nov — approximate)" },
  { date: "12-25", name: "Christmas Day" },
  { date: "12-31", name: "New Year's Eve" },
];

function getSeason(date: Date): string {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return "Spring";
  if (month >= 5 && month <= 7) return "Summer";
  if (month >= 8 && month <= 10) return "Fall";
  return "Winter";
}

function getUpcomingHolidays(withinDays: number = 14): string[] {
  const now = new Date();
  const results: string[] = [];
  for (const holiday of US_HOLIDAYS) {
    const [month, day] = holiday.date.split("-").map(Number);
    let year = now.getFullYear();
    let holidayDate = new Date(year, month - 1, day);
    if (holidayDate < now) {
      holidayDate = new Date(year + 1, month - 1, day);
    }
    const diffDays = Math.ceil((holidayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= withinDays) {
      results.push(`${holiday.name} (${holidayDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`);
    }
  }
  return results;
}

export function buildTemporalContextBlock(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const season = getSeason(now);
  const holidays = getUpcomingHolidays(14);

  const lines: string[] = [
    `Today is ${dateStr}.`,
    `Season: ${season}.`,
  ];

  if (holidays.length > 0) {
    lines.push(`Upcoming holidays/events (next 14 days): ${holidays.join(", ")}.`);
    lines.push("Where natural and authentic, weave seasonal or holiday relevance into at least one post. Do NOT force it if it doesn't fit the creator's brand.");
  }

  return `<temporal_context>\n${lines.join("\n")}\n</temporal_context>`;
}

// ─── #8: Audience Fatigue Signal ────────────────────────────────────

export interface AnalyticsRowForFatigue {
  title: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt?: Date;
}

export function buildAudienceFatigueBlock(rows: AnalyticsRowForFatigue[]): string {
  if (rows.length < 8) return "";

  const now = Date.now();
  const fourWeeksAgo = now - 28 * 24 * 60 * 60 * 1000;
  const eightWeeksAgo = now - 56 * 24 * 60 * 60 * 1000;

  const recent = rows.filter((r) => {
    const date = r.publishedAt ? r.publishedAt.getTime() : 0;
    return date >= fourWeeksAgo;
  });
  const previous = rows.filter((r) => {
    const date = r.publishedAt ? r.publishedAt.getTime() : 0;
    return date >= eightWeeksAgo && date < fourWeeksAgo;
  });

  if (recent.length < 3 || previous.length < 3) return "";

  const avgEngagement = (posts: AnalyticsRowForFatigue[]): number => {
    if (posts.length === 0) return 0;
    const totalEng = posts.reduce((s, p) => s + p.likes + p.comments, 0);
    const totalViews = posts.reduce((s, p) => s + p.views, 0);
    return totalViews > 0 ? (totalEng / totalViews) * 100 : 0;
  };

  const recentRate = avgEngagement(recent);
  const previousRate = avgEngagement(previous);

  if (previousRate <= 0) return "";

  const change = ((recentRate - previousRate) / previousRate) * 100;

  if (change > -15) return ""; // Not declining significantly

  const lines: string[] = [
    `ENGAGEMENT TREND: Recent 4 weeks avg engagement rate is ${recentRate.toFixed(1)}% vs ${previousRate.toFixed(1)}% in the previous 4 weeks — a ${change.toFixed(0)}% decline.`,
    "AUDIENCE FATIGUE DETECTED — engagement is declining. This is a strong signal that content is becoming repetitive or stale for this audience.",
    "ACTION REQUIRED: Push harder for fresh approaches this week. Try new topics, new archetypes, and new hook styles. Avoid the overused archetypes listed above. Consider more personal/off-duty content to re-engage the audience emotionally.",
  ];

  return `<audience_fatigue>\n${lines.join("\n")}\n</audience_fatigue>`;
}

// ─── #5: Fresh User Input ───────────────────────────────────────────

const WEEKLY_CONTEXT_LABELS: Record<string, string> = {
  personalHighlights: "Personal highlights this week",
  professionalUpdates: "Professional updates this week",
  newSpots: "New restaurants, hangouts, or spots discovered",
  winsMoments: "Wins, stories, or moments worth sharing",
  onYourMind: "What's on your mind this week",
};

const MONTHLY_CONTEXT_LABELS: Record<string, string> = {
  monthlyTheme: "Monthly theme or focus",
  majorMilestones: "Major milestones or events this month",
  newGoals: "New goals or priorities this month",
  businessChanges: "What's changing in your business this month",
  travelPlans: "Travel or personal plans this month",
};

export function buildFreshInputBlock(
  weeklyAnswers: Record<string, string>,
  monthlyAnswers: Record<string, string>,
): string {
  const parts: string[] = [];

  const weeklyLines: string[] = [];
  for (const [key, label] of Object.entries(WEEKLY_CONTEXT_LABELS)) {
    if (weeklyAnswers[key] && weeklyAnswers[key].trim().length > 0) {
      weeklyLines.push(`- ${label}: ${weeklyAnswers[key].trim()}`);
    }
  }
  if (weeklyLines.length > 0) {
    parts.push(`WEEKLY CONTEXT (fresh input from the creator for THIS week — prioritize over older questionnaire material):\n${weeklyLines.join("\n")}`);
  }

  const monthlyLines: string[] = [];
  for (const [key, label] of Object.entries(MONTHLY_CONTEXT_LABELS)) {
    if (monthlyAnswers[key] && monthlyAnswers[key].trim().length > 0) {
      monthlyLines.push(`- ${label}: ${monthlyAnswers[key].trim()}`);
    }
  }
  if (monthlyLines.length > 0) {
    parts.push(`MONTHLY CONTEXT (broader strokes for this month — use as a strategic backdrop):\n${monthlyLines.join("\n")}`);
  }

  if (parts.length === 0) return "";

  return `<fresh_input>\nThis is current, time-bound input from the creator — not from the original questionnaire. It represents what's happening in their life and business RIGHT NOW. Weave it into this week's content where it fits naturally. This takes priority over older questionnaire material when there's overlap.\n${parts.join("\n\n")}\n</fresh_input>`;
}

// ─── #7: Arc / Campaign Directive ───────────────────────────────────

export function buildArcDirectiveBlock(arcTheme: string): string {
  if (!arcTheme || arcTheme.trim().length === 0) return "";

  return `<content_arc>\nThe creator has defined a thematic arc for this period: "${arcTheme.trim()}". Thread this theme through the week's content — each post should connect to this arc from a different angle. The arc is a connective thread, not a constraint — posts should still stand alone, but together they should build toward a narrative or message.\n</content_arc>`;
}
