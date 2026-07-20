# Content Freshness System — Full Audit & Architecture

> **Audited:** July 2026
> **Scope:** Every component that combats repetitive, stale, or declining AI-generated content across repeated calendar generations.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture: Data Flow](#2-architecture-data-flow)
3. [Layer A — Static History Blocks](#3-layer-a--static-history-blocks)
4. [Layer B — Dynamic Variation Directives](#4-layer-b--dynamic-variation-directives)
5. [Layer C — Questionnaire Material Tracking](#5-layer-c--questionnaire-material-tracking)
6. [Layer D — Temporal & Seasonal Awareness](#6-layer-d--temporal--seasonal-awareness)
7. [Layer E — Analytics-Driven Signals](#7-layer-e--analytics-driven-signals)
8. [Layer F — Proactive Staleness Score](#8-layer-f--proactive-staleness-score)
9. [Layer G — Persistent AI Memory (CreatorMemory)](#9-layer-g--persistent-ai-memory-creatormemory)
10. [Layer H — Profile Survey System](#10-layer-h--profile-survey-system)
11. [Prompt Assembly Order](#11-prompt-assembly-order)
12. [Integration Points](#12-integration-points)
13. [Hardness Audit Findings](#13-hardness-audit-findings)
14. [Known Limitations & Gaps](#14-known-limitations--gaps)
15. [File Reference](#15-file-reference)

---

## 1. System Overview

The Content Freshness System is a multi-layered prompt-engineering architecture that prevents the AI from generating repetitive content across repeated weekly calendar generations. Without it, a creator using the platform for 3+ months would see the same anecdotes, archetypes, hooks, and seasonal angles recycled indefinitely.

The system operates across **8 conceptual layers**, implemented across 4 primary files:

| File | Role |
|---|---|
| `src/lib/freshness.ts` | Core freshness engine — 11 XML block builders, archetype classification, theme extraction, staleness scoring |
| `src/lib/prompt-builder.ts` | Assembles the full user profile XML, including survey blocks, compliance guardrails, offer funnel, proof bank |
| `src/app/dashboard/calendar/actions.ts` | Integration layer — fetches DB data, calls all block builders, assembles final prompt, makes API call |
| `src/lib/memory/memory-builder.ts` | Auto-learning pipeline — extracts patterns from analytics, feedback, and surveys into persistent CreatorMemory entries |

**Key design principle:** Every block is **opt-in and gracefully degrades**. If there's insufficient data (too few posts, no analytics, no surveys), the block returns an empty string and is omitted from the prompt. A brand-new user with zero archived posts gets a clean prompt with no freshness constraints; a 6-month user with 50+ posts gets the full suite.

---

## 2. Architecture: Data Flow

```
generateWeeklyCalendar()
│
├── 1. Fetch ContentArchive (last 50 posts) → freshnessPosts[]
├── 2. Fetch ContentArchive (11-13 months ago) → seasonalPosts[]
├── 3. Fetch PostAnalytics (90 days) → analyticsRows[]
├── 4. Fetch FollowerStats (30 days) → followerRows[]
├── 5. Fetch DeepAnalytics (demographics, cadence, decay) → cadenceRows[]
├── 6. Fetch ContentFeedback (30 most recent) → feedbackRows[]
├── 7. Fetch ProfileSurveys (all types) → profileSurveys[]
├── 8. Fetch CreatorMemory (HIGH/CRITICAL + pinned) → relevantMemories[]
├── 9. Fetch trending headlines → trendHeadlines[]
│
├── 10. Build all XML blocks (Layers A–F + prompt-builder survey blocks)
├── 11. Build userProfileXml (includes Layer H survey blocks)
├── 12. Assemble final userPrompt (blocks in defined order)
│
├── 13. [Power users only] Pre-generation API call for dynamic constraints
│
├── 14. Main API call to Claude with system + user prompt
│
└── 15. Post-generation: touch used memories, run learning pipeline (non-blocking)
```

**Parallelization:** Steps 3–6 are parallelized via `Promise.all`. Steps 2, 9, and config fetch are parallelized in a separate `Promise.all`. The seasonal query (step 2) is batched with config + trending headlines to avoid an extra sequential DB round-trip.

---

## 3. Layer A — Static History Blocks

These blocks analyze the creator's recent post archive and inject structural history into the prompt.

### 3.1 Used Titles Block

**Function:** `buildUsedTitlesBlock(titles: string[])` — in `prompt-builder.ts`
**XML tag:** `<used_titles>`
**Minimum data:** 1 post
**Purpose:** Lists all previously used post titles. Instructs the AI not to repeat or closely paraphrase any of them.

### 3.2 Used Hooks Block

**Function:** `buildUsedHooksBlock(posts, maxHooks=20)` — in `freshness.ts`
**XML tag:** `<used_hooks>`
**Minimum data:** 1 post with a non-empty hook
**Purpose:** Lists the last 20 opening hooks. Instructs the AI not to repeat opening patterns, sentence structures, or phrasings. Emphasizes different *approaches*, not just different words.

### 3.3 Archetype History Block

**Function:** `buildArchetypeHistoryBlock(posts)` — in `freshness.ts`
**XML tag:** `<archetype_history>`
**Minimum data:** 3 posts
**Purpose:** Classifies each post into one of 10 content archetypes using regex pattern matching, then shows the distribution. Flags archetypes used >35% as OVERUSED (avoid) and archetypes used <10% as UNDERUSED (lean into).

**Archetype classification:** `classifyPost(post)` checks the hook first, then the title, against pattern sets for each archetype. Falls back to "Other" if no pattern matches.

**10 archetypes:**
| Archetype | Example trigger patterns |
|---|---|
| Listicle | `\d+ things/reasons/tips/ways`, `top \d+` |
| Contrarian / Hot Take | `unpopular opinion`, `hot take`, `stop doing`, `overrated` |
| Myth-Bust | `myth`, `debunk`, `wrong about`, `actually`, `misconception` |
| Question Hook | `^why/what/how/when...`, `ever wondered`, `are you` |
| Story / Anecdote | `^yesterday/last week/a client...`, `once`, `a client/customer` |
| Behind-the-Scenes | `behind the scenes`, `day in the life`, `how i`, `process` |
| How-To / Educational | `how to`, `step by step`, `tutorial`, `guide to`, `try this` |
| Bold Statement | `nobody tells you`, `here's the truth`, `the real reason` |
| Comparison / Vs | `vs`, `better than`, `the difference`, `compared to` |
| Direct Address | `^you/your/listen/hey...`, `you need/should/must` |

**Thresholds:**
- Overused: archetype appears in >35% of posts
- Underused: archetype appears in <10% of posts (or never)

### 3.4 Themes Explored Block

**Function:** `buildThemesExploredBlock(posts)` — in `freshness.ts`
**XML tag:** `<themes_explored>`
**Minimum data:** 5 posts
**Purpose:** Extracts the top 15 recurring keywords and bigrams from post titles + hooks (stop words filtered, words ≥4 chars, themes appearing in ≥2 posts). Also groups recent posts by bucket (Personal/Expert/Local) with titles for context. Instructs the AI to find new angles, not re-tread the same ground.

**Theme extraction:** `extractThemes(posts, maxThemes)` tokenizes text into unigrams and bigrams, filters stop words and short words, counts occurrences across posts, returns themes appearing in ≥2 posts sorted by frequency.

---

## 4. Layer B — Dynamic Variation Directives

### 4.1 Variation Directive Block

**Function:** `buildVariationDirectiveBlock(generationCount)` — in `freshness.ts`
**XML tag:** `<variation_directive>`
**Always emitted** (no minimum data requirement)
**Purpose:** Scales urgency based on how many calendars have been generated. Three tiers:

| Tier | Trigger | Message |
|---|---|---|
| Normal | < 5 generations | "Always think about long-term variety" |
| FRESHNESS WARNING | ≥ 5 generations | "Questionnaire tropes are becoming familiar. Actively seek new angles." |
| FRESHNESS CRITICAL | ≥ 10 generations | "You MUST find new angles. Do NOT recycle anecdotes or hook patterns." |

**Generation count estimation:** Counted as distinct `weekStarting` values in the recent archive. This is an approximation — a user who generates twice in one week counts as 1.

**Always includes** 5 variety rules (vary hooks, rotate archetypes, rest anecdotes 3-4 weeks, different angles not just rewording, choose less obvious angle).

### 4.2 Creative Constraints Block

**Function:** `buildCreativeConstraintsBlock(seed?, dynamicConstraints?)` — in `freshness.ts`
**XML tag:** `<creative_constraints>`
**Always emitted** (falls back to static pool)
**Purpose:** Selects 4 creative constraints per week to force fresh approaches.

**Two modes:**

**Static mode (default):** Fisher-Yates shuffles a pool of 40 constraints using a deterministic `mulberry32` RNG (seeded by generation count). 4 constraints selected. The pool covers:
- Hook style constraints (7)
- Structural/archetype constraints (16)
- Emotional/vulnerability constraints (6)
- Local/temporal constraints (3)
- Audience interaction constraints (4)
- Format/delivery constraints (10+)

**Dynamic mode (power users):** When `generationCount >= DYNAMIC_CONSTRAINTS_THRESHOLD (8)` AND `posts.length >= 8`, the system makes a **pre-generation API call** to Claude with a tailored prompt (`buildDynamicConstraintsPrompt`). This prompt sends the creator's archetype history, overused/underused archetypes, recurring themes, and recent titles. Claude proposes 4 constraints targeting the creator's specific unexplored territory. The response is parsed, cleaned (strip numbering, filter <10 chars, take 4), and formatted via `formatDynamicConstraintsBlock`.

**Fallback:** On any failure (API error, parse failure, empty response), falls back to the static pool. Generation is never blocked.

**Performance:** Dynamic mode uses `max_tokens: 500` (~2-3s added latency). The pre-call uses the same model as the main generation.

---

## 5. Layer C — Questionnaire Material Tracking

### 5.1 Anecdote Cooldown Block

**Function:** `buildAnecdoteCooldownBlock(material, posts)` — in `freshness.ts`
**XML tag:** `<anecdote_cooldown>`
**Minimum data:** 5 posts + ≥1 questionnaire material item
**Purpose:** Tracks which questionnaire/survey anecdotes have been used in previous posts and which are still fresh.

**How it works:**
1. Extracts `QuestionnaireMaterial` (label + value pairs) from questionnaire answers and profile surveys
2. For each material item, extracts key phrases (4+ char words, bigrams, stop words filtered, max 12 phrases)
3. Checks if any key phrase appears in any post's title or hook (`phraseInPosts`)
4. Classifies as USED or FRESH

**Three output modes:**

| Condition | Output |
|---|---|
| Fresh + Used both > 0 | Lists USED (let rest 3-4 weeks) and FRESH (prioritize) |
| All used (fresh=0, used>0) | **Directive switch:** "REIMAGINE THESE" — instructs AI to revisit each topic with a different archetype, audience lens, or perspective. Prevents bare "everything's been used" prompt. |
| All fresh (used=0) | Lists all as FRESH (normal early-user behavior) |

**Material sources:** Questionnaire fields (personalStory, recentWin, hotTakes, morningRoutine, faqTop3, numbersThatImpress, seasonalRhythm, upcomingEvents, familyContext, contentBoundaries) + all industry-branched answers.

### 5.2 Content Gap Block

**Function:** `buildContentGapBlock(material, posts)` — in `freshness.ts`
**XML tag:** `<untapped_material>`
**Minimum data:** ≥1 material item (no post minimum for listing untapped material)
**Purpose:** Finds questionnaire material whose key phrases haven't appeared in any posts. Highlights untapped content opportunities.

**How it works:**
1. Extracts themes from recent posts (top 20)
2. For each material item, checks if its top key phrase is NOT in the theme set AND NOT in any post
3. Lists untapped items

**Exhausted material handling:**
- When `untapped.length === 0` AND `posts.length >= 8`: Returns a directive to "find NEW ANGLES in familiar topics — different archetypes, different perspectives, updated takes." References the archetype history block.
- When `untapped.length === 0` AND `posts.length < 8`: Returns empty string (too early to conclude material is exhausted).

---

## 6. Layer D — Temporal & Seasonal Awareness

### 6.1 Temporal Context Block

**Function:** `buildTemporalContextBlock()` — in `freshness.ts`
**XML tag:** `<temporal_context>`
**Always emitted**
**Purpose:** Injects the current date, season, and upcoming US holidays (within 14 days). Instructs the AI to weave seasonal relevance where natural and authentic, but NOT force it.

**Seasons:** Spring (Mar-May), Summer (Jun-Aug), Fall (Sep-Nov), Winter (Dec-Feb)

**Holidays:** 16 US holidays hardcoded with approximate dates (some floating holidays like MLK Day, Memorial Day use approximate fixed dates).

### 6.2 Seasonal History Block (Cross-Year Awareness)

**Function:** `buildSeasonalHistoryBlock(posts)` — in `freshness.ts`
**XML tag:** `<seasonal_history>`
**Minimum data:** 1 post from 11-13 months ago
**Purpose:** Prevents year-over-year seasonal content repeats. A user in their 12th month sees what they posted about during the same season last year and is instructed to find DIFFERENT angles.

**How it works:**
1. `calendar/actions.ts` fetches `ContentArchive` posts with `archivedAt` between 11 and 13 months ago (take 20)
2. `buildSeasonalHistoryBlock` lists up to 10 titles from that period
3. Extracts recurring themes from those posts (top 8)
4. Instructs: "Find DIFFERENT seasonal angles. Do NOT repeat the same topics, hooks, or angles. If covered last year, approach from a fresh perspective or skip entirely."

**Date calculation:** `13 * 30 days` and `11 * 30 days` from now (approximate month boundaries, not calendar-accurate).

### 6.3 Arc Directive Block

**Function:** `buildArcDirectiveBlock(arcTheme)` — in `freshness.ts`
**XML tag:** `<content_arc>`
**Condition:** Monthly context survey has a `monthlyTheme` field with content
**Purpose:** Threads a user-defined monthly theme through the week's content as a connective narrative. Each post connects from a different angle. The arc is a thread, not a constraint — posts still stand alone.

---

## 7. Layer E — Analytics-Driven Signals

### 7.1 Audience Fatigue Block (Lagging Indicator)

**Function:** `buildAudienceFatigueBlock(rows)` — in `freshness.ts`
**XML tag:** `<audience_fatigue>`
**Minimum data:** 8 analytics rows (≥3 in each 4-week window)
**Purpose:** Detects engagement decline by comparing recent 4 weeks vs previous 4 weeks. This is a **lagging indicator** — it fires AFTER engagement has already dropped.

**Calculation:**
1. Split analytics rows into recent (last 28 days) and previous (29-56 days)
2. Compute engagement rate for each window: `(likes + comments) / views * 100`
3. If `previousRate > 0` and `change < -15%` (i.e., >15% decline), emit warning
4. If decline ≤15%, return empty string (no warning)

**Warning content:** Shows the exact rates and decline percentage. Instructs: "Push harder for fresh approaches. Try new topics, new archetypes, new hook styles. Consider more personal/off-duty content to re-engage emotionally."

### 7.2 Performance Signals Block

**Function:** `buildPerformanceSignalsBlock(analyticsRows)` — in `src/lib/performance-prompt.ts`
**XML tag:** (part of `<performance_signals>`)
**Purpose:** Extracts top and bottom performers from analytics data, showing the AI which posts resonated and which didn't.

### 7.3 Content Performance Block

**Function:** `buildContentPerformanceBlock(matches)` — in `src/lib/performance-prompt.ts`
**Purpose:** Matches archive posts to analytics rows and shows per-post performance with bucket/format context.

### 7.4 Follower Trend Block

**Function:** `buildFollowerTrendBlock(followerRows)` — in `src/lib/performance-prompt.ts`
**Purpose:** Shows follower growth trend over the last 30 days.

### 7.5 Cadence Block

**Function:** `buildCadenceBlock(postingFrequency, decayByPlatform, daysToPost)` — in `src/lib/performance-prompt.ts`
**Purpose:** Combines posting frequency analysis and content decay data to inform optimal posting cadence.

### 7.6 Demographics Block

**Purpose:** Injects audience demographics (age, gender, location) from DeepAnalytics so the AI can tailor tone and topics.

### 7.7 Feedback Block

**Purpose:** Injects recent thumbs-up/thumbs-down feedback so the AI can see which content the creator approved or rejected.

---

## 8. Layer F — Proactive Staleness Score

### 8.1 Compute Freshness Score

**Function:** `computeFreshnessScore(posts)` — in `freshness.ts`
**Minimum data:** 8 posts (returns `null` if fewer)
**Purpose:** Computes a 0-100 freshness score as a **leading indicator** — fires BEFORE engagement declines. This complements the lagging `buildAudienceFatigueBlock`.

**Three weighted signals:**

| Signal | Weight | Calculation | Range |
|---|---|---|---|
| Archetype diversity | 40% | Unique non-Other archetypes / total posts | 0–1 |
| Theme diversity | 30% | Unique meaningful words / total meaningful words (stop words filtered, ≥4 chars, from titles + hooks) | 0–1 |
| Hook dissimilarity | 30% | 1 − average pairwise Jaccard similarity of hook word sets | 0–1 |

**Score formula:** `round((archetypeDiversity * 0.4 + themeDiversity * 0.3 + hookDissimilarity * 0.3) * 100)`

**Interpretation:**
- Score ≥ 50: No warning emitted
- Score < 50: Staleness warning injected

**Performance optimization (audited):**
- Hook word sets are pre-computed once via `hookWordSet()` (O(n) setup), then pairwise Jaccard runs on pre-built `Set<string>` objects (no redundant regex/string allocation in the inner loop)
- Stop words and words <4 chars are filtered from hook word sets to prevent inflated similarity from common words
- Theme diversity uses unique-words/total-words ratio (not `extractThemes` which requires ≥2 occurrences — that was a backwards metric that penalized high diversity)

### 8.2 Staleness Warning Block

**Function:** `buildStalenessWarningBlock(posts)` — in `freshness.ts`
**XML tag:** `<staleness_warning>`
**Minimum data:** 8 posts, score < 50
**Purpose:** Injects a proactive alert with a breakdown of which dimension is low and actionable guidance.

**Warning content:**
- Exact score and threshold
- Breakdown of all 3 dimensions with LOW/moderate labels:
  - Archetype diversity <30% → "LOW — too few structural approaches"
  - Theme diversity <40% → "LOW — topics are repeating"
  - Hook similarity >40% → "HIGH — hooks are too alike"
- Action: "Push harder for fresh approaches. Try underused archetypes, explore new topics, vary hook structures."

### 8.3 Lagging vs Leading Indicators

| Indicator | Type | Trigger | When it fires |
|---|---|---|---|
| `buildAudienceFatigueBlock` | Lagging | >15% engagement rate decline over 4 weeks | After audience already disengaging |
| `buildStalenessWarningBlock` | Leading | Freshness score < 50 | Before engagement declines |

Both can fire simultaneously. The staleness warning is the earlier signal — it detects structural repetition before it manifests as engagement decline.

---

## 9. Layer G — Persistent AI Memory (CreatorMemory)

### 9.1 Overview

The CreatorMemory system stores long-term strategic insights about each creator in a Prisma model. These memories persist across calendar generations and are injected into every prompt as a `<creator_memory>` block at the top.

**Memory types:** IDENTITY, VOICE, AUDIENCE, CONTENT, PERFORMANCE, STRATEGY, PREFERENCE, WARNING

**Prompt injection filter:** Only HIGH and CRITICAL importance memories + pinned memories are injected. LOW and MEDIUM memories are stored but not sent to the AI.

### 9.2 Memory Sources

**Questionnaire → Memory** (`buildMemoriesFromQuestionnaire`):
- Extracts identity, voice, audience, content preferences, goals, guardrails, proof points, seasonal context from onboarding questionnaire
- Creates 5-8 candidate memories on first questionnaire save

**Survey → Memory** (`buildMemoriesFromSurvey`):
- Each survey type maps to one or more memory entries via `SURVEY_MEMORY_MAP`
- Multi-memory surveys (OFFER_FUNNEL, PROOF_BANK, COMPLIANCE_GUARDRAILS) create separate memories per field group
- Runs on survey save (non-blocking)

**Analytics → Memory** (`learnFromAnalytics`):
- Bucket performance comparison (e.g., "Personal outperforms Expert")
- Format performance comparison (e.g., "Reels outperform Carousels")
- Content feedback patterns (repeated thumbs-down/up by bucket)
- Demographics summary
- **Winning formula extraction** (see below)

**Feedback → Memory** (`learnFromFeedback`):
- Thumbs-down on a post creates a WARNING memory to avoid similar angles

### 9.3 Winning Formula Extraction

**Location:** `learnFromAnalytics` in `memory-builder.ts`
**Trigger:** ≥5 matched archive+analytics posts, ≥3 with engagement > 0
**Purpose:** Distills patterns from top-performing posts into a STRATEGY memory so the AI doesn't have to re-infer what works from scratch each generation.

**Process:**
1. Match archive posts to analytics via `matchArchiveToAnalytics` (normalizes titles/hooks/captions, matches on first-40-char prefix)
2. Sort by engagement (likes + comments), take top 5
3. Classify archetypes using `classifyPost` (exported from `freshness.ts`)
4. Extract:
   - Dominant archetype(s): any appearing in ≥40% of top posts
   - Dominant bucket: most frequent bucket among top posts
   - Common hook keywords: words ≥4 chars appearing in ≥2 top posts' hooks (stop words filtered)
5. Save as STRATEGY memory: "Winning formula: top-performing content patterns"
6. On subsequent syncs, `saveMemory` auto-merges with existing memory (title similarity ≥0.6 triggers merge)

**Merge behavior:** Merging increases confidence by 10, replaces summary (not appends), keeps existing evidence. The winning formula candidate intentionally omits `evidence` to prevent unbounded DB growth from repeated merges.

### 9.4 Memory Deduplication

`saveMemory` calls `findSimilarMemory` before creating. If an existing memory of the same type has title Jaccard similarity ≥0.6, it merges instead of creating a duplicate. This prevents the same insight from being stored multiple times across syncs.

### 9.5 Memory Touch

After calendar generation, each memory that was included in the prompt has its `lastUsedAt` updated. This tracks which memories are actively influencing content.

---

## 10. Layer H — Profile Survey System

### 10.1 Survey Types

| Survey | Type Key | Expiry | Memory Type | Purpose |
|---|---|---|---|---|
| Trench Warfare | `TRENCH_WARFARE` | Never | IDENTITY | War stories, negotiation style, industry-specific battle wisdom |
| Origin Story | `ORIGIN_STORY` | Never | IDENTITY | How they got here, industry pet peeves |
| Client Avatar | `CLIENT_AVATAR` | Never | AUDIENCE | Dream client, before/after story, dream outcome |
| Local Mayor | `LOCAL_MAYOR` | Never | CONTENT | Hyper-local spots, restaurants, coffee shops, neighbourhood knowledge |
| Weekly Context | `WEEKLY_CONTEXT` | Every Monday | (prompt only) | What's happening this week — fresh, current input |
| Monthly Context | `MONTHLY_CONTEXT` | 1st of month | (prompt only) | Broad strokes for the month, holiday-specific fields |
| Story Refresh | `STORY_REFRESH` | 42 days (6 weeks) | CONTENT | New wins, stories, observations, client interactions, market changes |
| Offer & Funnel | `OFFER_FUNNEL` | Never | STRATEGY + WARNING | What they're selling, CTAs, booking links, lead magnets, what NOT to promise |
| Proof Bank | `PROOF_BANK` | Never | PERFORMANCE + WARNING | Testimonials, client wins, case studies, permission levels, proof boundaries |
| Compliance & Brand Safety | `COMPLIANCE_GUARDRAILS` | Never | WARNING (CRITICAL) + PREFERENCE | Forbidden claims, regulated topics, disclaimers, approval process, credential rules |

### 10.2 Survey → Prompt Injection

Surveys are injected into the prompt via two mechanisms in `prompt-builder.ts`:

**Direct block builders** (for structured surveys with custom XML tags):
- `buildLocalMayorBlock` → `<local_mayor>`
- `buildOfferFunnelBlock` → `<offer_funnel>`
- `buildProofBankBlock` → `<proof_bank>`
- `buildComplianceGuardrailsBlock` → `<compliance_guardrails>`

**Generic `buildDeepDiveSurveysBlock`** (for TRENCH_WARFARE, ORIGIN_STORY, CLIENT_AVATAR, WEEKLY_CONTEXT, MONTHLY_CONTEXT, STORY_REFRESH):
- Uses `SURVEY_LABELS` for field display names
- Uses `SURVEY_XML_TAG` for XML tag names
- Has survey-type-specific intro text
- Skips OFFER_FUNNEL, PROOF_BANK, COMPLIANCE_GUARDRAILS (handled by direct builders)
- Skips LOCAL_MAYOR (handled by `buildLocalMayorBlock`)

### 10.3 Survey → Memory

Each survey save triggers `buildMemoriesFromSurvey` (non-blocking). The `SURVEY_MEMORY_MAP` defines:
- Single-memory surveys: one memory entry with all fields
- Multi-memory surveys: separate memory entries per field group (e.g., OFFER_FUNNEL creates a STRATEGY memory for offer details and a WARNING memory for "do not promise")

### 10.4 Survey Expiry Logic

| Survey | Expiry check | UI behavior when expired |
|---|---|---|
| Weekly Context | `updatedAt < Monday midnight` | Amber "Expired" badge, auto-opens edit form |
| Monthly Context | `updatedAt < 1st of month` | Amber "Expired" badge, auto-opens, clears old holiday answers |
| Story Refresh | `updatedAt < (now - 42 days)` | Amber "Expired" badge, auto-opens edit form |
| All others | Never expire | No expiry UI |

### 10.5 Industry-Branching

Several surveys have industry-specific subtitles, field labels, and placeholders via lookup maps:
- `INDUSTRY_SUBTITLE_OVERRIDES` — per-survey, per-industry subtitle customization
- `INDUSTRY_FIELD_OVERRIDES` — per-survey, per-industry field label/placeholder customization
- `TRENCH_WARFARE_WILDEST_LABEL` / `ORIGIN_STORY_PETPEEVE_LABEL` — industry-specific question labels

Industries covered: Real Estate, Car Sales, Fitness / Personal Training, Financial Services, Coaching / Consulting, Other.

### 10.6 Compliance Survey Disclaimer

The COMPLIANCE_GUARDRAILS survey includes a `disclaimer` field rendered in the UI:
> "The Local Post does not provide legal, financial, medical, or compliance advice. These settings only guide AI-generated content."

Displayed as an amber banner with a ShieldAlert icon in both the edit and new-survey forms.

---

## 11. Prompt Assembly Order

The final user prompt is assembled in `calendar/actions.ts` in this exact order:

```
<creator_memory>                    ← Persistent AI memories (HIGH/CRITICAL + pinned)
<user_identity>                     ← Name, business, industry, location, brand type
<industry>                          ← Industry-specific context
<personal_story>                    ← Origin story
<content_preferences>               ← Content style preferences
<goal_guardrails>                   ← Primary goal + anti-brand words
<proof_points>                      ← Numbers that impress
<seasonal_context>                  ← Seasonal rhythm, upcoming events
<voice>                             ← On-camera personality, content enjoyed
<cta>                               ← CTA preferences
<audience>                          ← Target audience
<boundaries>                        ← Content boundaries
<compliance_guardrails>             ← Compliance survey (HARD GUARDRAILS — overrides all)
<personal_context>                  ← Family context, morning routine
<formatting>                        ← Format preferences
<local_mayor>                       ← Local Mayor survey
<offer_funnel>                      ← Offer & Funnel survey
<proof_bank>                        ← Proof Bank survey
<trench_warfare> / <origin_story> / <client_avatar> / <weekly_context> / <monthly_context> / <story_refresh>
                                    ← Deep dive surveys (via buildDeepDiveSurveysBlock)
<used_titles>                       ← Previously used titles
<used_hooks>                        ← Previously used hooks
<archetype_history>                 ← Archetype distribution + overused/underused
<themes_explored>                   ← Recurring themes + posts by bucket
<anecdote_cooldown>                 ← Used vs fresh questionnaire anecdotes
<untapped_material>                 ← Untapped questionnaire material
<variation_directive>               ← Generation count-based urgency
<creative_constraints>              ← 4 randomized or AI-generated constraints
<temporal_context>                  ← Current date, season, holidays
<seasonal_history>                  ← Posts from same season last year
<content_arc>                       ← Monthly theme arc
<audience_fatigue>                  ← Lagging indicator (engagement decline)
<staleness_warning>                 ← Leading indicator (freshness score < 50)
<best_times>                        ← Best time to post heatmaps
<audience_demographics>             ← Age/gender/location demographics
<performance_signals>               ← Top/bottom performers
<content_performance>               ← Per-post performance with context
<follower_trend>                    ← Follower growth trend
<cadence>                           ← Posting frequency + content decay
<feedback>                          ← Thumbs-up/down feedback
<trending_industry_topics>          ← Real headlines from today

<generation_instructions>           ← Days, format mix, bucket distribution, music
```

**Key ordering principles:**
- `<creator_memory>` is first — accumulated strategic context overrides generic assumptions
- `<compliance_guardrails>` is positioned before offer/proof blocks — it's labeled as HARD GUARDRAILS that override all other context
- Freshness blocks (used titles, hooks, archetypes, themes) come after profile context — the AI knows the creator first, then sees what to avoid
- Analytics blocks come after freshness blocks — performance data informs but doesn't override freshness directives
- `<generation_instructions>` is last — the final actionable directive

---

## 12. Integration Points

### 12.1 Calendar Generation (`generateWeeklyCalendar`)

**File:** `src/app/dashboard/calendar/actions.ts`

This is the primary integration. Every calendar generation:
1. Fetches all data (archive, analytics, surveys, memories, demographics, feedback)
2. Builds all XML blocks
3. Assembles the prompt in defined order
4. [Power users] Makes pre-generation API call for dynamic constraints
5. Makes main API call to Claude
6. Post-generation: touches used memories, runs learning pipeline (non-blocking `.catch`)

### 12.2 Analytics Sync (`syncAnalytics`)

**File:** `src/app/dashboard/integrations/actions.ts`

After syncing analytics from Zernio, calls `runLearningPipeline(userId)` (non-blocking). This triggers `learnFromAnalytics` which extracts bucket performance, format performance, feedback patterns, demographics, and winning formula patterns into CreatorMemory entries.

### 12.3 Survey Save (`saveProfileSurvey`)

**File:** `src/app/dashboard/profile/actions.ts`

After saving a profile survey, calls `buildMemoriesFromSurvey(userId, surveyType, answers)` (non-blocking). Creates or merges CreatorMemory entries based on `SURVEY_MEMORY_MAP`.

### 12.4 Content Feedback (`addFeedback`)

**File:** `src/app/dashboard/calendar/actions.ts`

When a user thumbs-downs a post, calls `learnFromFeedback(userId, "down", dayContent)` (non-blocking). Creates a WARNING memory to avoid similar angles.

### 12.5 Questionnaire Save

**File:** `src/app/api/questionnaire/route.ts`

After saving the onboarding questionnaire, calls `buildMemoriesFromQuestionnaire(userId, answers)` (non-blocking). Creates initial IDENTITY, VOICE, AUDIENCE, CONTENT memories.

---

## 13. Hardness Audit Findings

### Issues Found & Fixed (5)

| # | Severity | Issue | Fix Applied |
|---|---|---|---|
| 1 | Medium-High | `computeFreshnessScore` did O(n²) Jaccard comparisons with redundant regex + Set creation on every pair (~40K redundant ops for 200 posts) | Pre-compute hook word sets once via `hookWordSet()`, pass `Set<string>` to `jaccardSimilarity()`. O(n) setup + O(n²) comparisons on pre-built sets. |
| 2 | High (logic bug) | Theme diversity used `extractThemes()` which only returns themes appearing in ≥2 posts. Highly diverse content (no repeats) → 0 themes → `themeDiversity = 0` → score tanks. **Metric was backwards.** | Replaced with unique meaningful words / total meaningful words ratio. High diversity now correctly produces high score. |
| 3 | Medium (accuracy) | `jaccardSimilarity` used ALL words including stop words. Hooks sharing only "the", "a", "is" got inflated similarity scores. | Added `hookWordSet()` that filters words <4 chars and `STOP_WORDS` before Jaccard comparison. |
| 4 | Medium (DB growth) | Winning formula memory has constant title → `saveMemory` always merges → `mergeMemory` appends `evidence` with `\n---\n` on every analytics sync. Unbounded `evidence` column growth. | Removed `evidence` field from winning formula candidate. `summary` already contains all actionable info. On merge, `evidence: undefined` → keeps existing (null) evidence. |
| 5 | Low (perf) | Seasonal archive query was a sequential `await` adding a DB round-trip to the generation path. | Parallelized into existing `Promise.all([getPlatformConfig(), fetchTrendingHeadlines(), ...])`. Zero added latency. |

### Also Fixed (Cosmetic)
- Removed unnecessary `as ArchivePostForFreshness` type cast in winning formula code
- Removed resulting unused `ArchivePostForFreshness` type import in `memory-builder.ts`

### Verified Safe (No Issues)

- **Anecdote/gap directive switching:** Edge cases (`fresh.length === 0 && used.length === 0`, `posts.length < 8`) all handled correctly
- **Story Refresh survey:** All 5 integration points wired correctly (VALID_SURVEY_TYPES, SURVEY_MEMORY_MAP, SURVEY_LABELS, SURVEY_XML_TAG, QuestionnaireClient, SURVEYS.md)
- **Seasonal history:** Empty result for new users → `buildSeasonalHistoryBlock` returns `""` → no prompt impact
- **Winning formula guards:** `matches.length >= 5`, `topPosts.length >= 3`, `parts.length > 0` — three layers of protection against empty/meaningless memories
- **`summarizeMemoriesForPrompt`** only uses `summary`, not `evidence` — so evidence growth was DB-only, not prompt bloat
- **Dynamic constraints fallback:** On any failure (API error, parse failure, empty response), falls back to static pool — generation is never blocked
- **All auto-learning hooks** run via non-blocking `.catch()` — never block the user-facing action

---

## 14. Known Limitations & Gaps

### 14.1 Dead Code

- **`buildFreshInputBlock`** in `freshness.ts` is exported but never called. It was superseded by `buildDeepDiveSurveysBlock` in `prompt-builder.ts` which handles weekly/monthly context surveys. The function and its label maps (`WEEKLY_CONTEXT_LABELS`, `MONTHLY_CONTEXT_LABELS`) could be removed.

### 14.2 Approximate Date Calculations

- **Seasonal history window:** Uses `13 * 30 days` and `11 * 30 days` instead of calendar-accurate month boundaries. This means the window drifts by ~5 days per year. For a system designed to prevent year-over-year repeats, this is acceptable but could be made calendar-accurate.
- **Holiday dates:** Several US holidays use fixed approximate dates (e.g., MLK Day is always Jan 20 in the code, but it's actually the 3rd Monday — which ranges from Jan 15-21). This could cause off-by-one-day holiday references.
- **Generation count:** Estimated as distinct `weekStarting` values, not actual generation count. A user who regenerates the same week twice counts as 1.

### 14.3 Archetype Classification Limitations

- **Regex-based:** Archetype classification relies on regex pattern matching against hooks and titles. Posts that use unconventional openings or non-English text will be classified as "Other." This is a deliberate trade-off (no API call needed) but means the archetype distribution may undercount creative/non-standard openings.
- **No body text analysis:** Classification only looks at hook and title, not the full body text. A post with a listicle hook but a narrative body is classified as Listicle.
- **"Other" bucket:** Posts classified as "Other" are excluded from the archetype diversity calculation in `computeFreshnessScore`. This means a creator whose posts don't match any pattern gets archetypeDiversity = 0, which could unfairly tank their score. However, the ≥8 post minimum and the 40% weight mean this is unlikely to trigger false staleness warnings alone.

### 14.4 Theme Extraction Limitations

- **No semantic understanding:** Theme extraction is purely lexical (word/bigram frequency). "Real estate market" and "housing market" would be counted as different themes despite being semantically identical.
- **No stemming/lemmatization:** "Selling" and "sold" are different words. This inflates the apparent theme diversity slightly.

### 14.5 Memory Merge Limitations

- **Title similarity threshold (0.6 Jaccard):** The merge deduplication uses word-level Jaccard similarity on titles. Two memories with similar meaning but different wording (e.g., "Personal content outperforms Expert" vs "Personal bucket drives more engagement") would NOT merge because the word overlap is low.
- **Evidence accumulation:** For memories that DO merge (like the winning formula), evidence is appended with `\n---\n` separators. The winning formula candidate was fixed to omit evidence, but other candidates (bucket performance, format performance) still include evidence and will accumulate on repeated syncs. This is lower risk because their titles include the specific bucket/format names, so they only merge when the same comparison is detected.

### 14.6 Prompt Size

- ~~No token budget management~~ **RESOLVED:** The prompt now uses a budget manager (`src/lib/prompt-budget.ts`) that assigns each block a priority (CRITICAL/HIGH/MEDIUM/LOW) and trim strategy. When the combined block sizes exceed 120K chars, lower-priority blocks are trimmed or omitted. CRITICAL blocks (memory, user profile with compliance guardrails, generation instructions) are always preserved. LOW blocks (performance, follower trend, cadence, feedback, trending) use `omit_if_over` — dropped entirely if they don't fit. Block metadata (included/trimmed/omitted with char counts) is logged to `CalendarGenerationLog` for debugging.

### 14.7 No A/B Testing or Effectiveness Measurement

- The system injects many blocks but there's no mechanism to measure which blocks are actually effective at improving content variety or engagement. The staleness score is a proxy, but there's no controlled experiment comparing "with freshness blocks" vs "without."

---

## 15. File Reference

### Core Freshness Engine

| File | Lines | Purpose |
|---|---|---|
| `src/lib/freshness.ts` | ~900 | All freshness block builders, archetype classification, theme extraction, staleness scoring, creative constraints (static + dynamic), anecdote cooldown, content gap, temporal context, seasonal history, audience fatigue, arc directive |

### Prompt Assembly

| File | Lines | Purpose |
|---|---|---|
| `src/lib/prompt-builder.ts` | ~624 | User profile XML assembly, survey block builders (local mayor, offer funnel, proof bank, compliance guardrails, deep dive surveys), trending topics, used titles, system prompt template |
| `src/lib/performance-prompt.ts` | — | Performance signals, content performance, follower trend, cadence, feedback blocks |

### Integration

| File | Lines | Purpose |
|---|---|---|
| `src/app/dashboard/calendar/actions.ts` | ~870 | `generateWeeklyCalendar` — fetches all data, builds all blocks, assembles prompt via budget manager, API call, post-generation learning, generation logging |
| `src/app/dashboard/calendar/GenerateButton.tsx` | — | UI status steps including "Checking your recent content for freshness..." |

### Prompt Budget & Logging

| File | Purpose |
|---|---|
| `src/lib/prompt-budget.ts` | Prompt budget manager — `buildBudgetedPrompt()` with block priorities (CRITICAL/HIGH/MEDIUM/LOW) and trim strategies |
| `src/app/admin/clients/[id]/freshness/actions.ts` | `getFreshnessDebugData()` — admin-only server action returning all freshness debug data |
| `src/app/admin/clients/[id]/freshness/page.tsx` | Admin freshness debug page with archetype distribution, hooks, themes, material usage, context status, generation logs |

### Memory System

| File | Lines | Purpose |
|---|---|---|
| `src/lib/memory/memory-builder.ts` | ~710 | `buildMemoriesFromQuestionnaire`, `buildMemoriesFromSurvey`, `learnFromAnalytics` (including winning formula), `learnFromFeedback`, `runLearningPipeline`, `matchArchiveToAnalytics` |
| `src/lib/memory/memory-service.ts` | ~368 | `saveMemory` (with auto-merge), `mergeMemory`, `getRelevantMemories` (HIGH/CRITICAL + pinned filter), `findSimilarMemory` (title Jaccard ≥0.6), `getUserMemories`, `updateMemory`, `deleteMemory` |
| `src/lib/memory/memory-summarizer.ts` | ~73 | `summarizeMemoriesForPrompt` — builds `<creator_memory>` XML block grouped by type, ordered by SECTION_ORDER |
| `src/lib/memory/memory-types.ts` | — | Type definitions, enum re-exports, constants (IMPORTANCE_FOR_PROMPT, confidence bounds, section order) |

### Survey System

| File | Lines | Purpose |
|---|---|---|
| `src/app/dashboard/questionnaire/QuestionnaireClient.tsx` | ~940 | All survey UI — deep dive surveys, timed surveys (weekly, monthly, story refresh), industry-branched labels, accordion display, edit/new forms, compliance disclaimer |
| `src/app/dashboard/profile/actions.ts` | — | `saveProfileSurvey`, `deleteProfileSurvey` — validates survey type, saves to DB, triggers memory building |
| `SURVEYS.md` | — | Canonical source of truth for all survey questions, fields, and expiry logic |

### Documentation

| File | Purpose |
|---|---|
| `CODEBASE_CONTEXT.md` §16 | Full freshness system documentation (updated with all enhancements) |
| `CODEBASE_CONTEXT.md` §14.5 | CreatorMemory system documentation |
| `SURVEYS.md` | All survey definitions (9 survey types documented) |
| `CONTENT_FRESHNESS_AUDIT.md` | This document |
