import type { QuestionnaireFormData } from "./questionnaire-actions";
import type { TrendHeadline } from "./rss-trends";

type ProfileSurveyRow = { surveyType: string; answersJson: unknown };

const SURVEY_LABELS: Record<string, Record<string, string>> = {
  TRENCH_WARFARE: {
    wildestStory: "Wildest story",
    disagreesWith: "Disagrees with",
    negotiationStyle: "Negotiation style (3 words)",
    mostCommonDM: "Most common DM question",
    trophyRoomWin: "Trophy room win",
    objectionCrusher: "Objection crusher",
  },
  ORIGIN_STORY: {
    yearOneFailure: "Year one failure",
    agentPetPeeve: "Industry pet peeve",
    geekHobby: "Geek hobby",
    alternativeCareer: "Alternative career",
  },
  CLIENT_AVATAR: {
    favoriteClientType: "Favorite client type",
    clientBiggestFear: "Client biggest fear",
    clientRedFlag: "Client red flag",
    clientMisbeliefs: "What clients wrongly believe they should do first (myth-busting fuel)",
    clientDreamOutcome: "Client's dream outcome in their own words",
    beforeAfterStory: "A real client before → after story",
  },
  WEEKLY_CONTEXT: {
    personalHighlights: "Personal highlights this week",
    professionalUpdates: "Professional updates this week",
    newSpots: "New restaurants, hangouts, or spots discovered",
    winsMoments: "Wins, stories, or moments worth sharing",
    onYourMind: "What's on their mind this week",
  },
  MONTHLY_CONTEXT: {
    monthlyTheme: "Monthly theme or focus",
    majorMilestones: "Major milestones or events this month",
    newGoals: "New goals or priorities this month",
    businessChanges: "What's changing in their business this month",
    travelPlans: "Travel or personal plans this month",
    // Holiday-specific fields (only present for the relevant month)
    newYearsPlans: "New Year's Day plans",
    newYearsTraditions: "New Year's traditions",
    newYearsContent: "New Year's content ideas",
    valentinesPlans: "Valentine's Day plans",
    valentinesContent: "Valentine's Day content ideas",
    stPatricksPlans: "St. Patrick's Day plans",
    stPatricksContent: "St. Patrick's Day content ideas",
    easterPlans: "Easter plans",
    easterContent: "Easter content ideas",
    mothersDayPlans: "Mother's Day plans",
    mothersDayContent: "Mother's Day content ideas",
    memorialDayPlans: "Memorial Day plans",
    memorialDayContent: "Memorial Day content ideas",
    fathersDayPlans: "Father's Day plans",
    fathersDayContent: "Father's Day content ideas",
    juneteenthContent: "Juneteenth content ideas",
    july4Plans: "Independence Day plans",
    july4Traditions: "July 4th traditions",
    july4Content: "July 4th content ideas",
    backToSchool: "Back-to-school season content ideas",
    laborDayPlans: "Labor Day plans",
    laborDayContent: "Labor Day content ideas",
    halloweenPlans: "Halloween plans",
    halloweenContent: "Halloween content ideas",
    veteransDayContent: "Veterans Day content ideas",
    thanksgivingPlans: "Thanksgiving plans",
    thanksgivingTraditions: "Thanksgiving traditions",
    thanksgivingContent: "Thanksgiving content ideas",
    christmasPlans: "Christmas plans",
    christmasTraditions: "Christmas traditions",
    christmasContent: "Christmas content ideas",
    newYearsEvePlans: "New Year's Eve plans",
  },
};

const SURVEY_XML_TAG: Record<string, string> = {
  TRENCH_WARFARE: "trench_warfare",
  ORIGIN_STORY: "origin_story",
  CLIENT_AVATAR: "client_avatar",
  WEEKLY_CONTEXT: "weekly_context",
  MONTHLY_CONTEXT: "monthly_context",
};

const LOCAL_MAYOR_LABELS: Record<string, string> = {
  hiddenGems: "Hidden gems",
  fierceDebate: "Fierce local debate",
  idealSunday: "Ideal Sunday",
  underratedNeighborhood: "Underrated neighbourhood",
  topRestaurants: "Top 5 restaurants (with what's good)",
  topCoffeeShops: "Top 5 coffee shops (with what's special)",
  topShops: "Top 5 local shops/boutiques (what makes them great)",
  topParks: "Top 5 parks/outdoor spots (what's special)",
  topGyms: "Top 5 gyms/fitness spots (what stands out)",
};

const INDUSTRY_LABELS: Record<string, Record<string, string>> = {
  "Real Estate": {
    yearsLicensed: "Years licensed",
    niche: "Niche",
    biggestMisconception: "Biggest misconception buyers/sellers have",
  },
  "Fitness / Personal Training": {
    loveTrainingMost: "Who you love training most",
    biggestFitnessLie: "Biggest fitness lie",
  },
  "Financial Services": {
    specialization: "Financial specialization",
    clientFear: "Clients' biggest financial fear",
  },
  "Coaching / Consulting": {
    transformationDelivered: "Transformation delivered",
    methodologyName: "Named methodology or framework",
  },
  Other: {
    uniqueValue: "What makes your business uniquely valuable",
  },
};

function hasText(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function buildIndustryBlock(answers: QuestionnaireFormData): string {
  const industry = answers.industry;
  const industryAnswers = answers.industryAnswers;
  if (!industry || !industryAnswers || Object.keys(industryAnswers).length === 0) return "";

  const labels = INDUSTRY_LABELS[industry] ?? {};
  const lines: string[] = [`Industry: ${industry}`];
  for (const [key, value] of Object.entries(industryAnswers)) {
    if (hasText(value)) {
      const label = labels[key] ?? key;
      lines.push(`- ${label}: ${value}`);
    }
  }
  if (lines.length <= 1) return "";
  return `<industry_context>\n${lines.join("\n")}\n</industry_context>`;
}

function buildVoiceBlock(answers: QuestionnaireFormData): string {
  const parts: string[] = [];
  if (hasText(answers.signaturePhrases)) {
    parts.push(`- SIGNATURE PHRASES: naturally weave these into content where appropriate (do not force them): ${answers.signaturePhrases}`);
  }
  if (hasText(answers.brandWords)) {
    parts.push(`- BRAND VOCABULARY: lean into these words and this tone: ${answers.brandWords}`);
  }
  if (hasText(answers.contentSample)) {
    parts.push(`- VOICE REFERENCE: sample posts/captions the user wrote and loves. Study the tone, sentence structure, vocabulary, and rhythm. Match this voice:\n${answers.contentSample}`);
  }
  if (hasText(answers.speakingStyle)) {
    parts.push(`- SPEAKING STYLE: how this person actually talks: ${answers.speakingStyle}`);
  }
  if (hasText(answers.humorStyle)) {
    parts.push(`- HUMOR STYLE: ${answers.humorStyle}`);
  }
  parts.push(`- PROFANITY RULE: Curse words and profanity must NEVER be used in any generated content, regardless of user preferences. This is a hard rule that applies to all posts, captions, hooks, bodies, CTAs, and directions.`);
  if (hasText(answers.sentenceLength)) {
    parts.push(`- SENTENCE LENGTH PREFERENCE: ${answers.sentenceLength}`);
  }
  if (parts.length === 0) return "";
  return `<brand_voice>\nUse these signals to make the content sound like THIS person, not a generic AI.\n${parts.join("\n")}\n</brand_voice>`;
}

function buildCtaBlock(answers: QuestionnaireFormData): string {
  const parts: string[] = [];
  if (hasText(answers.currentOffer)) {
    parts.push(`- CURRENT OFFER: ${answers.currentOffer}`);
  }
  if (hasText(answers.preferredCTA)) {
    parts.push(`- PREFERRED CTA STYLE: ${answers.preferredCTA}`);
  }
  if (parts.length === 0) return "";
  return `<cta_calibration>\nMake every call-to-action specific to what the user is actually promoting, not generic.\n${parts.join("\n")}\n</cta_calibration>`;
}

function buildAudienceBlock(answers: QuestionnaireFormData): string {
  const parts: string[] = [];
  if (hasText(answers.audienceLabel)) {
    parts.push(`- AUDIENCE LABEL: the user calls their followers/audience: "${answers.audienceLabel}". Use this term when addressing them in captions and CTAs.`);
  }
  if (hasText(answers.clientWords)) {
    parts.push(`- CLIENT LANGUAGE: exact words the user's clients use to describe their problems. Mirror this language in hooks for instant resonance: ${answers.clientWords}`);
  }
  if (parts.length === 0) return "";
  return `<audience_calibration>\nUse the audience's own language to make content feel like it's speaking directly to them.\n${parts.join("\n")}\n</audience_calibration>`;
}

function buildBoundariesBlock(answers: QuestionnaireFormData): string {
  if (!hasText(answers.contentBoundaries)) return "";
  return `<content_boundaries>\nThe user has specified these hard limits. Do NOT suggest content that crosses these lines: ${answers.contentBoundaries}\n</content_boundaries>`;
}

function buildPersonalContextBlock(answers: QuestionnaireFormData): string {
  const parts: string[] = [];
  if (hasText(answers.familyContext)) {
    parts.push(`- LIFE CONTEXT: details about the user's life outside work they're comfortable sharing: ${answers.familyContext}`);
  }
  if (hasText(answers.morningRoutine)) {
    parts.push(`- MORNING ROUTINE: ${answers.morningRoutine}`);
  }
  if (hasText(answers.hotTakes)) {
    parts.push(`- HOT TAKES: controversial opinions the user is willing to stake their name on (great for engagement content): ${answers.hotTakes}`);
  }
  if (parts.length === 0) return "";
  return `<personal_context>\nUse these details for Personal bucket content and to add authentic human texture across all buckets.\n${parts.join("\n")}\n</personal_context>`;
}

function buildFormattingBlock(answers: QuestionnaireFormData): string {
  const parts: string[] = [];
  if (hasText(answers.emojiUsage)) parts.push(`- EMOJI USAGE: ${answers.emojiUsage}`);
  if (hasText(answers.formattingStyle)) parts.push(`- FORMATTING STYLE: ${answers.formattingStyle}`);
  if (hasText(answers.storytellingStyle)) parts.push(`- STORYTELLING STYLE: ${answers.storytellingStyle}`);
  if (parts.length === 0) return "";
  return `<formatting_preferences>\nMatch these output style preferences in all generated content.\n${parts.join("\n")}\n</formatting_preferences>`;
}

function buildContentPreferencesBlock(answers: QuestionnaireFormData): string {
  const parts: string[] = [];
  if (Array.isArray(answers.onCameraPersonality) && answers.onCameraPersonality.length > 0) {
    parts.push(`- On-camera personality: ${answers.onCameraPersonality.join(", ")}`);
  }
  if (Array.isArray(answers.contentEnjoyed) && answers.contentEnjoyed.length > 0) {
    parts.push(`- Formats enjoyed: ${answers.contentEnjoyed.join(", ")}`);
  }
  if (parts.length === 0) return "";
  return `<content_preferences>\n${parts.join("\n")}\n</content_preferences>`;
}

function buildLocalMayorBlock(profileSurveys: ProfileSurveyRow[]): string {
  const survey = profileSurveys.find((s) => s.surveyType === "LOCAL_MAYOR");
  if (!survey) return "";
  const answers = (survey.answersJson ?? {}) as Record<string, string>;
  const parts: string[] = [];
  for (const [key, label] of Object.entries(LOCAL_MAYOR_LABELS)) {
    if (hasText(answers[key])) {
      parts.push(`- ${label}: ${answers[key]}`);
    }
  }
  if (parts.length === 0) return "";
  return `<local_mayor>\nThis is the user's hyper-local knowledge. Use these specific spots, opinions, and neighbourhood insights to make "Local" bucket content feel authentic and specific, not generic. Reference real business names and details.\n${parts.join("\n")}\n</local_mayor>`;
}

function buildDeepDiveSurveysBlock(profileSurveys: ProfileSurveyRow[]): string {
  const blocks: string[] = [];
  for (const survey of profileSurveys) {
    if (survey.surveyType === "LOCAL_MAYOR") continue;
    const labels = SURVEY_LABELS[survey.surveyType];
    const tag = SURVEY_XML_TAG[survey.surveyType];
    if (!labels || !tag) continue;
    const answers = (survey.answersJson ?? {}) as Record<string, string>;
    const lines: string[] = [];
    for (const [key, label] of Object.entries(labels)) {
      if (hasText(answers[key])) {
        lines.push(`- ${label}: ${answers[key]}`);
      }
    }
    if (lines.length > 0) {
      const intro =
        survey.surveyType === "WEEKLY_CONTEXT"
          ? "This is what the creator is doing THIS WEEK, fresh, current input. Prioritize this over older questionnaire material where there's overlap."
          : survey.surveyType === "MONTHLY_CONTEXT"
            ? "Broad strokes for this month, use as a strategic backdrop for the week's content."
            : null;
      blocks.push(`<${tag}>\n${intro ? `${intro}\n` : ""}${lines.join("\n")}\n</${tag}>`);
    }
  }
  return blocks.join("\n\n");
}

function buildProofPointsBlock(answers: QuestionnaireFormData): string {
  const parts: string[] = [];
  if (hasText(answers.numbersThatImpress)) {
    parts.push(`- PROOF NUMBERS: real numbers from the user's career. Weave these into hooks and bodies for instant credibility (specific beats generic): ${answers.numbersThatImpress}`);
  }
  if (hasText(answers.recentWin)) {
    parts.push(`- RECENT WIN: something good that happened in their business in the last 30 days. Great fuel for a timely, current-feeling post: ${answers.recentWin}`);
  }
  if (hasText(answers.faqTop3)) {
    parts.push(`- TOP QUESTIONS THEY GET ASKED: answering these makes guaranteed-relevant Expert content: ${answers.faqTop3}`);
  }
  if (parts.length === 0) return "";
  return `<proof_points>\nConcrete specifics that separate this creator from generic AI content. Use them to make hooks and bodies feel earned and credible.\n${parts.join("\n")}\n</proof_points>`;
}

function buildSeasonalContextBlock(answers: QuestionnaireFormData): string {
  const parts: string[] = [];
  if (hasText(answers.seasonalRhythm)) {
    parts.push(`- SEASONAL RHYTHM: how their business changes through the year. Align content angles with the current time of year: ${answers.seasonalRhythm}`);
  }
  if (hasText(answers.upcomingEvents)) {
    parts.push(`- UPCOMING EVENTS (next ~60 days): real, dated material. Where natural, build content that promotes or references these: ${answers.upcomingEvents}`);
  }
  if (parts.length === 0) return "";
  return `<seasonal_context>\nUse these to make the calendar feel timely and anchored in the creator's real life, not evergreen-generic.\n${parts.join("\n")}\n</seasonal_context>`;
}

function buildGoalAndGuardrailBlocks(answers: QuestionnaireFormData): string {
  const parts: string[] = [];
  if (hasText(answers.primaryGoal)) {
    parts.push(`<primary_goal>\nThe user's primary marketing goal this month is: "${answers.primaryGoal}". Every piece of content, especially the CTA, should ladder up to this goal.\n</primary_goal>`);
  }
  if (hasText(answers.antiBrandWords)) {
    parts.push(`<vocabulary_guardrails>\nThe user has explicitly banned these words and phrases from ALL content. Do NOT use them anywhere (hook, body, cta, caption, directions): ${answers.antiBrandWords}\n</vocabulary_guardrails>`);
  }
  return parts.join("\n\n");
}

export interface PromptContext {
  answers: QuestionnaireFormData;
  profileSurveys: ProfileSurveyRow[];
}

export function buildUserProfileXml(ctx: PromptContext): string {
  const { answers, profileSurveys } = ctx;
  const blocks: string[] = [];

  const identity = [
    `<user_identity>`,
    `- Name: ${answers.name || "N/A"}`,
    `- Business: ${answers.businessName || "N/A"}`,
    `- City: ${answers.city || "N/A"}`,
    `- What they do: ${answers.whatYouDo || "N/A"}`,
    `- Brand type: ${answers.brandType || "N/A"}`,
    `</user_identity>`,
  ].join("\n");
  blocks.push(identity);

  const industryBlock = buildIndustryBlock(answers);
  if (industryBlock) blocks.push(industryBlock);

  const story = hasText(answers.personalStory)
    ? `<personal_story>\n${answers.personalStory}\n</personal_story>`
    : "";
  if (story) blocks.push(story);

  const prefs = buildContentPreferencesBlock(answers);
  if (prefs) blocks.push(prefs);

  const goalGuardrails = buildGoalAndGuardrailBlocks(answers);
  if (goalGuardrails) blocks.push(goalGuardrails);

  const proofPoints = buildProofPointsBlock(answers);
  if (proofPoints) blocks.push(proofPoints);

  const seasonal = buildSeasonalContextBlock(answers);
  if (seasonal) blocks.push(seasonal);

  const voice = buildVoiceBlock(answers);
  if (voice) blocks.push(voice);

  const cta = buildCtaBlock(answers);
  if (cta) blocks.push(cta);

  const audience = buildAudienceBlock(answers);
  if (audience) blocks.push(audience);

  const boundaries = buildBoundariesBlock(answers);
  if (boundaries) blocks.push(boundaries);

  const personal = buildPersonalContextBlock(answers);
  if (personal) blocks.push(personal);

  const formatting = buildFormattingBlock(answers);
  if (formatting) blocks.push(formatting);

  const localMayor = buildLocalMayorBlock(profileSurveys);
  if (localMayor) blocks.push(localMayor);

  const deepDives = buildDeepDiveSurveysBlock(profileSurveys);
  if (deepDives) blocks.push(deepDives);

  return blocks.join("\n\n");
}

const CATEGORY_LABELS: Record<TrendHeadline["category"], string> = {
  social_media: "Social Media",
  content_marketing: "Content Marketing",
  creator_coaching: "Creator & Personal Brand",
  business: "Business & Entrepreneurship",
};

export function buildTrendingTopicsBlock(headlines: TrendHeadline[]): string {
  if (headlines.length === 0) return "";

  const lines = headlines.map(
    (h) => `- [${CATEGORY_LABELS[h.category]}] ${h.title}`
  );

  return `<trending_industry_topics>
These are real headlines published TODAY from leading social media, content marketing, and creator economy sources. Use them as inspiration signals. Reference the themes, angles, or conversations that fit this creator's brand and audience. Do NOT copy headlines verbatim. Use them to make content feel timely and culturally relevant.
${lines.join("\n")}
</trending_industry_topics>`;
}

export function buildUsedTitlesBlock(titles: string[]): string {
  if (titles.length === 0) return "";
  const list = titles.map((t, i) => `${i + 1}. ${t}`).join("\n");
  return `<used_titles>\nPreviously used post titles. Do NOT repeat or closely paraphrase any of these:\n${list}\n</used_titles>`;
}

export const CALENDAR_SYSTEM_PROMPT = `You are an elite personal brand content strategist. Your job is to help this creator build an audience that follows THEM, the human, not just their business. The best personal brands on social media win because people see a real person with real interests, opinions, and a life outside work.

BUCKET DEFINITIONS: read these carefully:
- "Personal" = genuine off-duty human content. Hobbies, passions, family moments, opinions on life, things they geek out about, who they are when they're NOT working. Do NOT tie Personal posts back to their business or add a work lesson at the end. The post should feel like it could exist even if they had a completely different career.
- "Expert" = professional knowledge, hard-won lessons, industry insights, tips, myth-busting, client stories. Their work expertise front and centre. Even Expert posts should feel like they're coming from a real human with personality, not a corporate newsletter.
- "Local" = hyper-local content about their city, community, favourite spots, local events, neighbourhood energy. Builds a sense of place and belonging.

Content field definitions:
- "hook": the opening line the creator should say on camera (for Reels) or the headline of the post (for Carousel/Static). This should be copy-pasteable spoken text.
- "body": the full spoken script for Reels, or the main body text for Carousel/Static. This should be copy-pasteable text the creator delivers or writes directly into the post. Do NOT include filming instructions here.
- "directions": filming, performance, or design directions. Tell the creator HOW to make the piece (e.g., shot type, energy, visuals, slide layout). This is NOT copy-pasteable post text.
- "cta": the closing call-to-action the creator should say or write.
- "caption": the social media caption to paste below the post. Do NOT include any hashtags.
- "musicSuggestion": a specific song or audio track the creator should overlay on the post using Instagram's music sticker/feature. This applies to ALL formats (Reels, Carousels, AND Static posts). Pick a real, recognizable song that fits the mood and energy of the content. Always include the song name and artist.
- "duration": target length for Reels (e.g., "45-60 seconds") or read-time estimate for Carousels/Static.

HUMAN WRITING RULES: CRITICAL (obey these in every text field: hook, body, cta, caption, directions):
The content you generate must NOT sound like AI. These rules are non-negotiable.

PUNCTUATION: NO EM DASHES:
- Never use em dashes (—) or en dashes (–) anywhere. This is the #1 AI giveaway. Readers spot it instantly.
- Where you would use an em dash, use a comma, a period to split into two sentences, or parentheses.
- Do not use semicolons. They feel academic and unnatural in spoken or social content.

VOCABULARY BLACKLIST: never use these words or phrases in any field:
- delve, dive into, tapestry, landscape (as metaphor), realm, beacon, symphony, journey (as metaphor), roadmap
- unlock, unleash, harness, ignite, empower, foster, elevate, supercharge, optimize, streamline
- robust, seamless, cutting-edge, pivotal, multifaceted, comprehensive, myriad, plethora, unwavering, dynamic
- testament, transformative, revolutionary, game-changer, game-changing
- "in today's fast-paced world", "in the ever-evolving landscape of", "at its core", "imagine a world", "picture this"
- "let's dive in", "here's the thing", "but here's the kicker", "here's the truth", "real talk", "that's only half the story"
- "not just X, but Y" / "it's not X, it's Y" / "not only... but also" constructions
- "furthermore", "moreover", "additionally", "in conclusion", "ultimately", "in essence", "at the end of the day", "to summarize"
- "it's important to note", "it's worth noting", "it could be argued", "generally speaking", "aims to", "is designed to"

RHYTHM AND SENTENCE STRUCTURE:
- Vary sentence length dramatically. Mix very short sentences (3-8 words) with longer ones (20+ words) in the same field. A one-word sentence or fragment is fine and encouraged.
- Do not let three sentences in a row have similar length or shape. If they feel monotonous, break one in half.
- Use contractions naturally (it's, don't, you're, we'll, can't, won't, that's).
- It is fine to start a sentence with "And" or "But." Do it sometimes.
- Fragments are okay. Use them for punch and emphasis.
- Do not write in the "balanced paragraph" pattern (three sentences, all 15-20 words, same Subject-Verb-Object structure). That rhythm puts readers to sleep.

RULE OF THREE: BREAK IT:
- Do not stack three adjectives or three parallel phrases for rhythm ("dynamic, innovative, and impactful"). This is a dead AI giveaway.
- If you list things, use two, or four, or just one with a specific detail. Not always three.

TAKE A POSITION: NO HEDGING:
- Do not hedge. Do not present "both sides." Say what the creator actually thinks.
- Do not soften opinions with "it could be argued" or "some might say." Just say it.
- Be direct and confident. The creator has opinions and hot takes. Use them without wrapping them in cotton wool.

WRITE LIKE YOU TALK: THE PUB TEST:
- Read every hook and body aloud in your head. If it sounds like an essay, a press release, or a LinkedIn thought-leadership post, rewrite it.
- Use the words this person would actually say out loud to a friend or client. If they would not say "leverage" or "optimize" in conversation, do not put it in their content.
- Be specific, not generic. "I brought in 14 new clients last month" beats "I have had a lot of success." Real numbers, real names, real details win every time.
- Do not announce what you are about to say. Just say it. No "Let me tell you about..." or "Here is why this matters." Cut the throat-clearing and start with the point.
- Do not end with a summary of what you just said. End with the CTA or a punchy final thought, not a recap.

OUTPUT FORMAT:
You MUST return your response as raw, valid JSON only. No markdown formatting, no backticks, no explanation text.

The JSON schema must be:
{
  "weekStarting": "{{weekStarting}}",
  "days": [
    {
      "day": "{{firstDay}}",
      "format": "Reel",
      "bucket": "Local",
      "title": "...",
      "hook": "...",
      "body": "...",
      "cta": "...",
      "caption": "...",
      "directions": "...",
      "musicSuggestion": "...",
      "duration": "..."
    }
  ]
}

HASHTAG RULE: Do NOT include hashtags in captions, bodies, hooks, CTAs, or any other field. This is a hard rule, no exceptions.

Formats must be: Reel, Carousel, Static.
Buckets must be: Personal, Expert, Local.

WEEK-OVER-WEEK VARIETY: critical for long-term freshness:
- This creator may have been using this system for many weeks. The prompt includes blocks showing what hooks, archetypes, and themes have already been used. Treat these as exhaustion signals, they tell you what NOT to do again.
- Vary your hook styles across posts within this week AND across weeks. If you opened with questions recently, try bold statements, stories, or contrarian hooks.
- Rotate content archetypes (listicle, story, myth-bust, contrarian, behind-the-scenes, how-to, direct address, comparison). Don't let any single archetype dominate week after week.
- When the prompt includes <creative_constraints>, follow them. They are randomized each week to force fresh approaches.
- The questionnaire and survey data is the creator's FOUNDATION, not a script to recite. Use it as raw material to generate NEW angles, not to repeat the same stories, hot takes, or proof points in different packaging.
- If a theme, anecdote, or angle has been used in recent posts, let it rest. There are always new ways to approach a topic.
- The same topic can appear again only if the ANGLE is genuinely different, not just reworded. When in doubt, choose the less obvious approach.`;

export const CALENDAR_STRATEGY_SYSTEM_PROMPT = `You are an elite personal brand content strategist. Write concise "AI Strategy Notes" (2-3 sentences max) for a creator's upcoming content calendar. It should read like a weekly strategy brief.

The note should explain the balance of content "buckets" for the week: local community content (builds belonging around their city), expert authority (showcases professional expertise), and personal storytelling (human/off-duty moments). Naturally weave in the buckets, format mix, and timing insight.

HUMAN WRITING RULES: CRITICAL:
- Never use em dashes (—) or en dashes (–). Use commas, periods, or parentheses instead.
- Never use semicolons.
- Never use these words: delve, tapestry, landscape (as metaphor), realm, beacon, unlock, unleash, harness, elevate, robust, seamless, cutting-edge, pivotal, multifaceted, comprehensive, myriad, plethora, testament, transformative, revolutionary, game-changer.
- Never use these phrases: "in today's fast-paced world", "at its core", "let's dive in", "here's the thing", "but here's the kicker", "furthermore", "moreover", "additionally", "in conclusion", "ultimately", "in essence", "at the end of the day", "it's important to note", "it's worth noting", "generally speaking", "not just X but Y".
- Do not hedge or present both sides. Be confident and direct.
- Vary sentence length. Mix short punchy sentences with longer ones. Fragments are fine.
- Use contractions naturally (it's, don't, you're, we'll).
- Do not stack three adjectives or three parallel phrases for rhythm.
- Write like a human strategist talking to the creator, not like an essay or press release.

Respond with ONLY the strategy note text, no headers, no bullet points, no markdown. Keep it under 180 words. Make it feel like a confident strategist wrote it for the creator. Reference the buckets using the exact phrases "local community content", "expert authority", and "personal storytelling" when possible so they can be visually highlighted.`;
