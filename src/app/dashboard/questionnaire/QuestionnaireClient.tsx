"use client";

import { useState, useTransition } from "react";
import {
  Save,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Trash2,
  MapPin,
  Sword,
  BookOpen,
  Users,
  ClipboardList,
  CalendarDays,
  CalendarRange,
  RefreshCw,
  Brain,
  Settings as SettingsIcon,
  Target,
  Award,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { saveProfileSurvey, deleteProfileSurvey } from "../profile/actions";
import SettingsForm from "../settings/SettingsForm";
import BrandBrainClient from "../brand-brain/BrandBrainClient";
import type { QuestionnaireFormData } from "@/lib/questionnaire-actions";
import type { MemoryType } from "@prisma/client";
import type { CreatorMemoryData } from "@/lib/memory/memory-types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileSurveyRecord {
  id: string;
  surveyType: string;
  answersJson: Record<string, string>;
  updatedAt?: string;
}

interface Props {
  questionnaire: { id: string; formData: QuestionnaireFormData; lastUpdated: string | null } | null;
  profileSurveys: ProfileSurveyRecord[];
  groupedMemories: Record<MemoryType, CreatorMemoryData[]>;
  typeLabels: Record<MemoryType, string>;
  typeDescriptions: Record<MemoryType, string>;
  memoryStats: { total: number; pinned: number; highConfidence: number };
}

// ─── Survey definitions ───────────────────────────────────────────────────────

interface SurveyField {
  key: string;
  label: string;
  placeholder: string;
}

interface SurveyDef {
  type: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  fields: SurveyField[];
  disclaimer?: string;
}

const INDUSTRY_SUBTITLE_OVERRIDES: Record<string, Record<string, string>> = {
  LOCAL_MAYOR: {
    "Real Estate": "Hyper-local knowledge that sets you apart from every out-of-town agent.",
    "Car Sales": "Hyper-local knowledge that sets you apart from every out-of-town dealer.",
    "Fitness / Personal Training": "Hyper-local knowledge that sets you apart from every out-of-town trainer.",
    "Financial Services": "Hyper-local knowledge that sets you apart from every out-of-town advisor.",
    "Coaching / Consulting": "Hyper-local knowledge that sets you apart from every out-of-town competitor.",
    Other: "Hyper-local knowledge that sets you apart from every out-of-town competitor.",
  },
  TRENCH_WARFARE: {
    "Real Estate": "Battle-tested wisdom from the deals only real agents survive.",
    "Car Sales": "Battle-tested wisdom from the deals only real car salesmen survive.",
    "Fitness / Personal Training": "Battle-tested wisdom from the trenches only real trainers survive.",
    "Financial Services": "Battle-tested wisdom from the trenches only real advisors survive.",
    "Coaching / Consulting": "Battle-tested wisdom from the trenches only real practitioners survive.",
    Other: "Battle-tested wisdom from the trenches only real pros survive.",
  },
  OFFER_FUNNEL: {
    "Real Estate": "Tell the AI what you're selling — listings, consultations, buyer services — and how content should drive leads.",
    "Car Sales": "Tell the AI what you're selling — vehicles, financing, trade-ins — and how content should drive floor traffic.",
    "Fitness / Personal Training": "Tell the AI what you're selling — programs, coaching, memberships — and how content should drive signups.",
    "Financial Services": "Tell the AI what you're offering — reviews, planning, consultations — and how content should drive appointments.",
    "Coaching / Consulting": "Tell the AI what you're selling — coaching, programs, courses — and how content should drive leads.",
    Other: "Tell the AI what you are selling, who it is for, and how content should move people toward action.",
  },
  PROOF_BANK: {
    "Real Estate": "Give the AI real wins, testimonials, and deal results it can use to build trust.",
    "Car Sales": "Give the AI real wins, testimonials, and sales results it can use to build trust.",
    "Fitness / Personal Training": "Give the AI real transformations, testimonials, and client wins it can use to build trust.",
    "Financial Services": "Give the AI real outcomes, testimonials, and client results it can use to build trust.",
    "Coaching / Consulting": "Give the AI real breakthroughs, testimonials, and client wins it can use to build trust.",
    Other: "Give the AI real proof it can use to make your content more specific and credible.",
  },
  COMPLIANCE_GUARDRAILS: {
    "Real Estate": "Fair housing, brokerage rules, license disclosure — set the guardrails the AI must follow.",
    "Car Sales": "Financing claims, approval claims, dealership rules — set the guardrails the AI must follow.",
    "Fitness / Personal Training": "Medical claims, injury claims, supplement rules — set the guardrails the AI must follow.",
    "Financial Services": "Investment claims, compliance rules, fiduciary language — set the guardrails the AI must follow.",
    "Coaching / Consulting": "Income claims, guaranteed results, testimonial rules — set the guardrails the AI must follow.",
    Other: "Set the rules for what the AI should avoid, soften, disclose, or never claim.",
  },
};

const INDUSTRY_FIELD_OVERRIDES: Record<string, Record<string, Record<string, { label?: string; placeholder?: string }>>> = {
  TRENCH_WARFARE: {
    "Real Estate": {
      wildestStory: { label: "Wildest thing you've seen at an inspection or closing?" },
      negotiationStyle: { label: "Your negotiation style in 3 words?" },
      trophyRoomWin: { placeholder: "The deal everyone said couldn't be done..." },
    },
    "Car Sales": {
      wildestStory: { label: "Wildest thing you've seen on the lot or in the finance office?" },
      negotiationStyle: { label: "Your closing style in 3 words?" },
      trophyRoomWin: { placeholder: "The deal everyone said couldn't be done..." },
    },
    "Fitness / Personal Training": {
      wildestStory: { label: "Wildest thing you've seen in a gym or training session?" },
      negotiationStyle: { label: "Your sales or closing style in 3 words?" },
      trophyRoomWin: { placeholder: "The client transformation everyone said was impossible..." },
    },
    "Financial Services": {
      wildestStory: { label: "Wildest thing you've seen in a client's portfolio or tax audit?" },
      negotiationStyle: { label: "Your negotiation style in 3 words?" },
      trophyRoomWin: { placeholder: "The outcome everyone said couldn't be done..." },
    },
    "Coaching / Consulting": {
      wildestStory: { label: "Wildest thing you've uncovered during a client discovery call?" },
      negotiationStyle: { label: "Your sales or closing style in 3 words?" },
      trophyRoomWin: { placeholder: "The breakthrough everyone said was impossible..." },
    },
    Other: {
      wildestStory: { label: "Wildest thing you've uncovered during a client engagement?" },
    },
  },
  ORIGIN_STORY: {
    "Real Estate": {
      agentPetPeeve: { label: "Your biggest pet peeve about other agents?" },
      yearOneFailure: { placeholder: "The deal that fell apart, the client you lost, and what changed after..." },
    },
    "Car Sales": {
      agentPetPeeve: { label: "Your biggest pet peeve about other car salesmen?" },
      yearOneFailure: { placeholder: "The deal that fell through, the customer you lost, and what changed after..." },
    },
    "Fitness / Personal Training": {
      agentPetPeeve: { label: "Your biggest pet peeve about other trainers or influencers?" },
      yearOneFailure: { placeholder: "The client you couldn't help, the program that failed, and what changed after..." },
    },
    "Financial Services": {
      agentPetPeeve: { label: "Your biggest pet peeve about other advisors?" },
      yearOneFailure: { placeholder: "The client you lost, the portfolio that blew up, and what changed after..." },
    },
    "Coaching / Consulting": {
      agentPetPeeve: { label: "Your biggest pet peeve about others in your industry?" },
      yearOneFailure: { placeholder: "The engagement that failed, the breakthrough that didn't happen, and what changed after..." },
    },
    Other: {
      agentPetPeeve: { label: "Your biggest pet peeve about others in your industry?" },
    },
  },
  CLIENT_AVATAR: {
    "Real Estate": {
      clientBiggestFear: { placeholder: "The thing that keeps them awake at 2am before signing..." },
    },
    "Car Sales": {
      clientBiggestFear: { placeholder: "The thing that keeps them awake at 2am before signing on the dotted line..." },
    },
    "Fitness / Personal Training": {
      clientBiggestFear: { placeholder: "The thing that keeps them awake at 2am before committing to a program..." },
    },
    "Financial Services": {
      clientBiggestFear: { placeholder: "The thing that keeps them awake at 2am before trusting you with their money..." },
    },
    "Coaching / Consulting": {
      clientBiggestFear: { placeholder: "The thing that keeps them awake at 2am before signing up to work with you..." },
    },
  },
  WEEKLY_CONTEXT: {
    "Real Estate": {
      professionalUpdates: { placeholder: "Deals in motion, client meetings, showings, deadlines..." },
    },
    "Car Sales": {
      professionalUpdates: { placeholder: "Deals in motion, test drives, deliveries, month-end push, deadlines..." },
    },
    "Fitness / Personal Training": {
      professionalUpdates: { placeholder: "Clients in progress, training sessions, program launches, deadlines..." },
    },
    "Financial Services": {
      professionalUpdates: { placeholder: "Clients in motion, portfolio reviews, meetings, deadlines..." },
    },
    "Coaching / Consulting": {
      professionalUpdates: { placeholder: "Client engagements in motion, sessions, projects, launches, deadlines..." },
    },
  },
  COMPLIANCE_GUARDRAILS: {
    "Real Estate": {
      requiredDisclaimers: { placeholder: "Equal Housing Opportunity, fair housing disclaimers, brokerage disclosures..." },
      forbiddenClaims: { placeholder: "Guaranteed appreciation, guaranteed sale, best rate, risk-free investment..." },
      regulatedTopics: { placeholder: "Market predictions, lending/mortgage claims, protected-class language, fair housing..." },
      companyRules: { placeholder: "Brokerage rules, team rules, MLS guidelines, commission disclosures..." },
      licenseOrCredentialRules: { placeholder: "How your license, brokerage affiliation, or designations should be mentioned..." },
    },
    "Car Sales": {
      requiredDisclaimers: { placeholder: "Price/payment disclaimers, availability disclaimers, financing subject to approval..." },
      forbiddenClaims: { placeholder: "Guaranteed approval, guaranteed financing, lowest price, risk-free, no credit check guaranteed..." },
      regulatedTopics: { placeholder: "Financing claims, approval claims, trade-in estimates, warranty claims, pricing..." },
      companyRules: { placeholder: "Dealership rules, manufacturer guidelines, advertising standards, compliance review..." },
      licenseOrCredentialRules: { placeholder: "How your dealership affiliation, sales license, or certifications should be mentioned..." },
    },
    "Fitness / Personal Training": {
      requiredDisclaimers: { placeholder: "Results not guaranteed, consult your doctor before starting, not medical advice..." },
      forbiddenClaims: { placeholder: "Guaranteed weight loss, guaranteed results, cure or treat any condition, spot reduction..." },
      regulatedTopics: { placeholder: "Medical claims, injury claims, supplement claims, diagnosis language..." },
      companyRules: { placeholder: "Gym/studio rules, brand guidelines, certification requirements, insurance..." },
      licenseOrCredentialRules: { placeholder: "How your certifications, training credentials, or affiliations should be mentioned..." },
    },
    "Financial Services": {
      requiredDisclaimers: { placeholder: "Not financial advice, past performance not indicative of future results, consult your advisor..." },
      forbiddenClaims: { placeholder: "Guaranteed returns, risk-free, guaranteed growth, best investment, tax savings guaranteed..." },
      regulatedTopics: { placeholder: "Investment advice, tax claims, risk disclosures, fiduciary language, specific recommendations..." },
      companyRules: { placeholder: "Firm/broker-dealer rules, compliance review, SEC/FINRA guidelines, advertising standards..." },
      licenseOrCredentialRules: { placeholder: "How your licenses, registrations, designations, or firm affiliation should be mentioned..." },
    },
    "Coaching / Consulting": {
      requiredDisclaimers: { placeholder: "Results not guaranteed, income claims disclaimers, not financial/medical/legal advice..." },
      forbiddenClaims: { placeholder: "Guaranteed income, guaranteed results, specific earnings claims, cure or treat..." },
      regulatedTopics: { placeholder: "Income claims, client confidentiality, case-study permissions, testimonial rules..." },
      companyRules: { placeholder: "Company/brand rules, client confidentiality, NDA restrictions, advertising standards..." },
      licenseOrCredentialRules: { placeholder: "How your credentials, certifications, or professional affiliations should be mentioned..." },
    },
    Other: {
      regulatedTopics: { placeholder: "Topics that require review or careful wording in your industry..." },
      forbiddenClaims: { placeholder: "Claims that create legal, regulatory, or brand risk..." },
    },
  },
};

function resolveSubtitle(surveyType: string, defaultSubtitle: string, industry?: string): string {
  if (!industry) return defaultSubtitle;
  return INDUSTRY_SUBTITLE_OVERRIDES[surveyType]?.[industry] ?? defaultSubtitle;
}

function resolveFields(surveyType: string, fields: SurveyField[], industry?: string): SurveyField[] {
  if (!industry) return fields;
  const overrides = INDUSTRY_FIELD_OVERRIDES[surveyType]?.[industry];
  if (!overrides) return fields;
  return fields.map((f) => {
    const ov = overrides[f.key];
    if (!ov) return f;
    return {
      ...f,
      label: ov.label ?? f.label,
      placeholder: ov.placeholder ?? f.placeholder,
    };
  });
}

const DEEP_DIVE_SURVEYS: SurveyDef[] = [
  {
    type: "LOCAL_MAYOR",
    title: "The Local Mayor",
    subtitle: "Hyper-local knowledge that sets you apart from every out-of-town competitor.",
    icon: MapPin,
    color: "#3b82f6",
    fields: [
      { key: "hiddenGems", label: "Top 3 hidden gem businesses in your market?", placeholder: "The coffee shop no tourists know about, the family-run hardware store..." },
      { key: "fierceDebate", label: "The most fiercely debated local topic right now?", placeholder: "The new development going up downtown, the school rezoning..." },
      { key: "idealSunday", label: "Your ideal unplugged Sunday in your city?", placeholder: "Farmer's market, hike at Runyon, brunch at..." },
      { key: "underratedNeighborhood", label: "The most underrated neighborhood that will boom in 5 years?", placeholder: "And why you believe that..." },
      { key: "topRestaurants", label: "Your 5 favorite restaurants and what's good there?", placeholder: "1. Maria's Tacqueria — the al pastor is unreal\n2. The Loft — best burger in town\n3. ..." },
      { key: "topCoffeeShops", label: "Your 5 favorite coffee shops and what's special about them?", placeholder: "1. Blue Bottle — the pour-over bar is a ritual\n2. Daydream — they roast their own beans\n3. ..." },
      { key: "topShops", label: "Your 5 favorite local shops or boutiques and what makes them great?", placeholder: "1. Foundry — curated vintage and local makers\n2. Olive & Birch — the best home goods\n3. ..." },
      { key: "topParks", label: "Your 5 favorite parks or outdoor spots and what's special about them?", placeholder: "1. Riverside Trail — 3 miles along the water\n2. Elm Park — best sunset view in the city\n3. ..." },
      { key: "topGyms", label: "Your 5 favorite gyms, studios, or fitness spots and what stands out?", placeholder: "1. Iron Yard — 24/7 access, old-school vibe\n2. Flow Yoga — the heated classes are unmatched\n3. ..." },
    ],
  },
  {
    type: "TRENCH_WARFARE",
    title: "Trench Warfare",
    subtitle: "Battle-tested wisdom from the trenches only real pros survive.",
    icon: Sword,
    color: "#ef4444",
    fields: [
      { key: "wildestStory", label: "Wildest thing you've seen on the job?", placeholder: "The story that still makes you shake your head..." },
      { key: "disagreesWith", label: "Common advice you publicly disagree with?", placeholder: "The myth you push back on at every dinner party..." },
      { key: "negotiationStyle", label: "Your negotiation style in 3 words?", placeholder: "e.g. Patient, Strategic, Relentless" },
      { key: "mostCommonDM", label: "What's the #1 question you get in your DMs?", placeholder: "The question you answer so often you could do it in your sleep..." },
      { key: "trophyRoomWin", label: "The Trophy Room: A recent 'miracle' win you pulled off for a client that seemed impossible?", placeholder: "The one everyone said couldn't be done..." },
      { key: "objectionCrusher", label: "The Objection Crusher: Most common reason a prospect says 'no' or 'I want to wait', and how you respond?", placeholder: "The hesitation you've heard a hundred times..." },
    ],
  },
  {
    type: "ORIGIN_STORY",
    title: "Origin Story",
    subtitle: "The authentic backstory that makes followers root for you.",
    icon: BookOpen,
    color: "#a855f7",
    fields: [
      { key: "yearOneFailure", label: "Your biggest failure in year 1 and the lesson it taught you?", placeholder: "The project that fell apart, the client you lost, and what changed after..." },
      { key: "agentPetPeeve", label: "Your biggest pet peeve about others in your industry?", placeholder: "The thing that makes you cringe when you see it..." },
      { key: "geekHobby", label: "A hobby or interest you absolutely geek out about?", placeholder: "The thing your friends tease you for knowing too much about..." },
      { key: "alternativeCareer", label: "If not in this industry, what career would you have pursued?", placeholder: "Your alternate universe..." },
    ],
  },
  {
    type: "CLIENT_AVATAR",
    title: "Client Avatar",
    subtitle: "Know your people deeply — attract more of the right ones.",
    icon: Users,
    color: "#10b981",
    fields: [
      { key: "favoriteClientType", label: "Describe your absolute favourite type of client to work with?", placeholder: "Not just demographics — what's their energy, attitude, situation?" },
      { key: "clientBiggestFear", label: "What is the single biggest fear your ideal client has?", placeholder: "The thing that keeps them awake at 2am before making a decision..." },
      { key: "clientRedFlag", label: "A red flag that tells you to politely walk away from a client?", placeholder: "The moment you know it's not a good fit..." },
      { key: "clientMisbeliefs", label: "What do clients wrongly believe they should do first? (myth-busting fuel)", placeholder: "The common misconception you love correcting in your content..." },
      { key: "clientDreamOutcome", label: "What is your client's dream outcome — in their own words?", placeholder: "The transformation they fantasize about but rarely say out loud..." },
      { key: "beforeAfterStory", label: "A real client before → after story?", placeholder: "Where they started, what you did, where they ended up..." },
    ],
  },
  {
    type: "OFFER_FUNNEL",
    title: "Offer & Funnel",
    subtitle: "Tell the AI what you are selling, who it is for, and how content should move people toward action.",
    icon: Target,
    color: "#f97316",
    fields: [
      { key: "mainOffer", label: "What is your main offer right now?", placeholder: "Example: listing consultation, buyer consult, dealership appointment, 6-week training program, financial review..." },
      { key: "offerForWho", label: "Who is this offer specifically for?", placeholder: "Example: first-time buyers, growing families, busy parents, local business owners, car shoppers with trade-ins..." },
      { key: "painPointSolved", label: "What problem does this solve?", placeholder: "What frustration, fear, confusion, or bottleneck does this solve?" },
      { key: "dreamOutcome", label: "What result does someone want when they buy, book, or reach out?", placeholder: "What does success look like in the client's own words?" },
      { key: "offerDetails", label: "What exactly is included?", placeholder: "What do they actually get when they say yes?" },
      { key: "primaryCTA", label: "What should people do next?", placeholder: "DM me, book a call, fill out the form, visit the link, comment a word..." },
      { key: "bookingLink", label: "Booking link, lead form, website, or landing page", placeholder: "Paste the link you want people to use." },
      { key: "leadMagnet", label: "Do you have a free resource, checklist, guide, giveaway, or event?", placeholder: "Example: free checklist, buyer guide, seller guide, car buying guide, webinar, workshop..." },
      { key: "commonObjections", label: "Why do people hesitate before saying yes?", placeholder: "Example: I'm not ready, I need to think about it, it costs too much, I don't know where to start..." },
      { key: "urgencyReason", label: "Is there a real reason to act now?", placeholder: "Only include real urgency. Avoid fake scarcity." },
      { key: "proofPoints", label: "What proof supports this offer?", placeholder: "Numbers, results, testimonials, experience, awards, client wins, examples..." },
      { key: "doNotPromise", label: "What should the AI never promise about this offer?", placeholder: "Anything legal, ethical, compliance-related, or unrealistic that should never be claimed." },
    ],
  },
  {
    type: "PROOF_BANK",
    title: "Proof Bank",
    subtitle: "Give the AI real proof it can use to make your content more specific and credible.",
    icon: Award,
    color: "#eab308",
    fields: [
      { key: "bestTestimonials", label: "Paste testimonials or kind words from clients/customers.", placeholder: "Paste exact quotes if you have permission, or summarize the kind words you often hear." },
      { key: "clientWins", label: "List 3-5 client/customer wins you helped create.", placeholder: "Example: helped a buyer win in a multiple-offer situation, helped a client lose 20 lbs, helped a customer get approved..." },
      { key: "beforeAfterStories", label: "Describe before-and-after stories you are allowed to share.", placeholder: "Before they worked with you, they were ___. Afterward, they were able to ___." },
      { key: "numbersAndStats", label: "What numbers, rankings, results, milestones, or experience markers can you mention?", placeholder: "Years in business, number of clients served, awards, rankings, sales volume, reviews, repeat customers, certifications..." },
      { key: "caseStudyDetails", label: "Tell one detailed client/customer success story.", placeholder: "What was the situation, what did you do, and what changed?" },
      { key: "permissionLevel", label: "How can this proof be used publicly?", placeholder: "Public - can be shared directly | Anonymized - remove names/details | Inspiration only - do not quote directly | Private - save for context but do not use in generated content" },
      { key: "proofBoundaries", label: "What should not be shared publicly?", placeholder: "Names, dollar amounts, medical/financial/legal claims, private details, or anything that needs approval." },
    ],
  },
  {
    type: "COMPLIANCE_GUARDRAILS",
    title: "Compliance & Brand Safety",
    subtitle: "Set the rules for what the AI should avoid, soften, disclose, or never claim.",
    icon: ShieldAlert,
    color: "#dc2626",
    disclaimer: "The Local Post does not provide legal, financial, medical, or compliance advice. These settings only guide AI-generated content.",
    fields: [
      { key: "requiredDisclaimers", label: "Are there any disclaimers you must include?", placeholder: "Example: Equal Housing Opportunity, results not guaranteed, not financial advice, consult your advisor..." },
      { key: "forbiddenClaims", label: "What claims should the AI never make?", placeholder: "Example: guaranteed approval, guaranteed returns, guaranteed weight loss, best rate, cheapest, risk-free..." },
      { key: "regulatedTopics", label: "What topics require extra caution in your industry?", placeholder: "Topics that require review or careful wording." },
      { key: "companyRules", label: "Are there company, brokerage, dealership, firm, or brand rules we need to follow?", placeholder: "Brokerage, dealership, team, employer, compliance, or brand rules." },
      { key: "approvalProcess", label: "Does content need approval before posting?", placeholder: "Example: I need to send posts to my broker/compliance manager before publishing." },
      { key: "wordsToAvoidForCompliance", label: "Any legal, compliance, or brand-sensitive words to avoid?", placeholder: "Words that create legal, regulatory, or brand risk." },
      { key: "sensitiveTopics", label: "Any topics you avoid publicly?", placeholder: "Topics you avoid because they are polarizing, private, risky, or off-brand." },
      { key: "licenseOrCredentialRules", label: "How should your license, credentials, certifications, or company affiliation be mentioned?", placeholder: "How credentials should be shown or not shown." },
    ],
  },
];

// ─── Time-based context surveys (weekly & monthly) ────────────────────────────

interface TimedSurveyDef extends SurveyDef {
  resetLabel: string;
  isExpired: (updatedAt: string | undefined) => boolean;
}

function getLastSunday(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function getFirstOfMonth(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

const WEEKLY_CONTEXT_DEF: TimedSurveyDef = {
  type: "WEEKLY_CONTEXT",
  title: "Weekly Context",
  subtitle: "What's happening THIS week — refreshes every Sunday.",
  icon: CalendarDays,
  color: "#f59e0b",
  resetLabel: "Resets every Sunday",
  isExpired: (updatedAt) => {
    if (!updatedAt) return true;
    return new Date(updatedAt) < getLastSunday();
  },
  fields: [
    { key: "personalHighlights", label: "What's happening personally this week?", placeholder: "Family stuff, social plans, things you're excited about outside of work..." },
    { key: "professionalUpdates", label: "What's happening professionally this week?", placeholder: "Clients in motion, meetings, projects, launches, deadlines..." },
    { key: "newSpots", label: "Any new restaurants, hangouts, or spots you've discovered?", placeholder: "Tried a new coffee shop? Found a hidden trail? A new lunch spot?" },
    { key: "winsMoments", label: "Any wins, stories, or moments worth sharing this week?", placeholder: "A client win, a funny moment, something that surprised you..." },
    { key: "onYourMind", label: "What's on your mind this week that could spark content?", placeholder: "An opinion forming, a question you keep getting asked, a trend you're noticing..." },
  ],
};

const MONTHLY_CONTEXT_BASE_FIELDS: SurveyField[] = [
  { key: "monthlyTheme", label: "What's the big theme or focus for this month?", placeholder: "e.g., 'client success stories', 'behind-the-scenes month', 'myth-busting March'..." },
  { key: "majorMilestones", label: "Any major milestones, launches, or events this month?", placeholder: "Anniversaries, product launches, big meetings, conferences, personal milestones..." },
  { key: "newGoals", label: "New goals or priorities you're focused on this month?", placeholder: "What are you pushing toward that's different from last month?" },
  { key: "businessChanges", label: "What's changing in your business this month?", placeholder: "New offerings, new team members, process changes, market shifts you're responding to..." },
  { key: "travelPlans", label: "Any travel or personal plans this month that could inspire content?", placeholder: "Trips, events, seasonal activities, family plans..." },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const HOLIDAY_FIELDS_BY_MONTH: Record<number, SurveyField[]> = {
  0: [
    { key: "newYearsPlans", label: "Any plans for New Year's Day?", placeholder: "Brunch, football, recovery, fresh starts..." },
    { key: "newYearsTraditions", label: "How do you typically ring in the new year?", placeholder: "Annual traditions, resolutions, reflection rituals..." },
    { key: "newYearsContent", label: "Any New Year's content ideas?", placeholder: "Goal-setting, fresh starts, year-in-review, predictions for the year ahead..." },
  ],
  1: [
    { key: "valentinesPlans", label: "Any Valentine's Day plans?", placeholder: "Date nights, gifts, Galentine's celebrations..." },
    { key: "valentinesContent", label: "Any Valentine's Day content ideas?", placeholder: "Love, relationships, appreciation, anti-Valentine's takes..." },
  ],
  2: [
    { key: "stPatricksPlans", label: "Any St. Patrick's Day plans?", placeholder: "Parades, pub crawls, Irish food, family traditions..." },
    { key: "stPatricksContent", label: "Any St. Patrick's Day content ideas?", placeholder: "Local events, Irish heritage, fun angles for your brand..." },
  ],
  3: [
    { key: "easterPlans", label: "Any Easter plans?", placeholder: "Family gatherings, egg hunts, brunch, church..." },
    { key: "easterContent", label: "Any Easter content ideas?", placeholder: "Spring themes, renewal, family traditions, local Easter events..." },
  ],
  4: [
    { key: "mothersDayPlans", label: "Any Mother's Day plans?", placeholder: "Brunch, gifts, family time, honoring mom..." },
    { key: "mothersDayContent", label: "Any Mother's Day content ideas?", placeholder: "Appreciation posts, mom stories, gift guides..." },
    { key: "memorialDayPlans", label: "Any Memorial Day plans?", placeholder: "BBQs, beach, camping, the unofficial start of summer..." },
    { key: "memorialDayContent", label: "Any Memorial Day content ideas?", placeholder: "Summer kickoff, gratitude, local events, remembrance..." },
  ],
  5: [
    { key: "fathersDayPlans", label: "Any Father's Day plans?", placeholder: "BBQ, gifts, family time, honoring dad..." },
    { key: "fathersDayContent", label: "Any Father's Day content ideas?", placeholder: "Dad stories, appreciation, gift guides..." },
    { key: "juneteenthContent", label: "Any Juneteenth content ideas?", placeholder: "Reflection, education, celebration, community events..." },
  ],
  6: [
    { key: "july4Plans", label: "Any plans for Independence Day (July 4th)?", placeholder: "BBQs, fireworks, beach days, parades, family gatherings..." },
    { key: "july4Traditions", label: "How do you typically celebrate the 4th?", placeholder: "Annual traditions, favorite fireworks spots, go-to BBQ recipes, host or attend..." },
    { key: "july4Content", label: "Any July 4th content ideas?", placeholder: "Patriotic angles, local events, holiday-themed posts, what freedom means to you..." },
  ],
  7: [
    { key: "backToSchool", label: "Any back-to-school season content ideas?", placeholder: "Fall prep, new routines, seasonal transitions, school-related angles for your brand..." },
  ],
  8: [
    { key: "laborDayPlans", label: "Any Labor Day plans?", placeholder: "Last summer hurrah, BBQ, beach, weekend trip..." },
    { key: "laborDayContent", label: "Any Labor Day content ideas?", placeholder: "Summer wrap-up, fall transition, work ethic reflections, gratitude..." },
  ],
  9: [
    { key: "halloweenPlans", label: "Any Halloween plans?", placeholder: "Costumes, parties, trick-or-treating, haunted houses..." },
    { key: "halloweenContent", label: "Any Halloween content ideas?", placeholder: "Spooky themes, costumes, local events, scary stories, fun holiday angles..." },
  ],
  10: [
    { key: "veteransDayContent", label: "Any Veterans Day content ideas?", placeholder: "Gratitude, service, reflection, honoring veterans..." },
    { key: "thanksgivingPlans", label: "Any Thanksgiving plans?", placeholder: "Family gatherings, turkey, Friendsgiving, travel..." },
    { key: "thanksgivingTraditions", label: "What are your Thanksgiving traditions?", placeholder: "The turkey fry, the gratitude circle, the football game, the leftovers..." },
    { key: "thanksgivingContent", label: "Any Thanksgiving content ideas?", placeholder: "Gratitude posts, food content, family stories, what you're thankful for in business and life..." },
  ],
  11: [
    { key: "christmasPlans", label: "Any Christmas plans?", placeholder: "Family gatherings, gift exchanges, travel, traditions..." },
    { key: "christmasTraditions", label: "What are your Christmas traditions?", placeholder: "Tree cutting, cookie baking, Christmas Eve dinner, morning rituals..." },
    { key: "christmasContent", label: "Any Christmas content ideas?", placeholder: "Holiday themes, gift guides, year-in-review, seasonal tips, festive behind-the-scenes..." },
    { key: "newYearsEvePlans", label: "Any New Year's Eve plans?", placeholder: "Parties, fireworks, quiet night in, reflections on the year..." },
  ],
};

function getMonthlyContextDef(date: Date = new Date()): TimedSurveyDef {
  const month = date.getMonth();
  const monthName = MONTH_NAMES[month];
  const holidayFields = HOLIDAY_FIELDS_BY_MONTH[month] ?? [];
  return {
    type: "MONTHLY_CONTEXT",
    title: "Monthly Context",
    subtitle: `Broad strokes for ${monthName} — refreshes on the 1st.`,
    icon: CalendarRange,
    color: "#8b5cf6",
    resetLabel: "Resets on the 1st of each month",
    isExpired: (updatedAt) => {
      if (!updatedAt) return true;
      return new Date(updatedAt) < getFirstOfMonth(date);
    },
    fields: [...MONTHLY_CONTEXT_BASE_FIELDS, ...holidayFields],
  };
}

const STORY_REFRESH_DEF: TimedSurveyDef = {
  type: "STORY_REFRESH",
  title: "Story Refresh",
  subtitle: "New stories and observations — refreshes every 4-6 weeks.",
  icon: RefreshCw,
  color: "#06b6d4",
  resetLabel: "Resets every 4-6 weeks",
  isExpired: (updatedAt) => {
    if (!updatedAt) return true;
    return new Date(updatedAt) < new Date(Date.now() - 42 * 24 * 60 * 60 * 1000);
  },
  fields: [
    { key: "recentWins", label: "Any wins or successes since you last updated this?", placeholder: "Deals closed, client breakthroughs, milestones hit, recognition received..." },
    { key: "newStories", label: "Any new stories, anecdotes, or memorable moments?", placeholder: "Funny things that happened, surprising situations, behind-the-scenes moments..." },
    { key: "newObservations", label: "New observations or opinions forming in your industry?", placeholder: "Trends you're noticing, shifts in client behavior, takes you're developing..." },
    { key: "newClientStories", label: "Any new client interactions worth sharing?", placeholder: "A conversation that stuck with you, a question you keep getting, a transformation..." },
    { key: "whatsChanging", label: "What's changing in your business or market right now?", placeholder: "New offerings, new processes, market shifts, competitive landscape changes..." },
  ],
};

function getTimedSurveys(date: Date = new Date()): TimedSurveyDef[] {
  return [WEEKLY_CONTEXT_DEF, getMonthlyContextDef(date), STORY_REFRESH_DEF];
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

const inputClass =
  "w-full px-4 py-3 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary/50 transition-all text-sm resize-none";

function StatusBanner({ status, error }: { status: "success" | "error" | null; error?: string }) {
  if (!status) return null;
  if (status === "success") {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Saved successfully.
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {error || "Something went wrong."}
    </div>
  );
}

// ─── Deep-dive survey inline panel ───────────────────────────────────────────

function DeepDivePanel({
  survey,
  existing,
  industry,
}: {
  survey: SurveyDef;
  existing: ProfileSurveyRecord | undefined;
  industry?: string;
}) {
  const [isEditing, setIsEditing] = useState(!existing);
  const [answers, setAnswers] = useState<Record<string, string>>(existing?.answersJson ?? {});
  const [isPending, startTransition] = useTransition();
  const [deleteIsPending, startDeleteTransition] = useTransition();
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const resolvedFields = resolveFields(survey.type, survey.fields, industry);

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveProfileSurvey(survey.type, answers);
      if (result.success) {
        setStatus("success");
        setIsEditing(false);
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Unknown error");
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(`Clear your "${survey.title}" survey? This cannot be undone.`)) return;
    startDeleteTransition(async () => {
      await deleteProfileSurvey(survey.type);
    });
  };

  if (!isEditing && existing) {
    return (
      <div className="pt-4 space-y-4">
        <StatusBanner status={status} error={errorMsg} />
        {survey.disclaimer && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs leading-relaxed">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{survey.disclaimer}</span>
          </div>
        )}
        <div className="space-y-3">
          {resolvedFields.map((field) => {
            const answer = answers[field.key] ?? existing.answersJson[field.key];
            return (
              <div key={field.key} className="space-y-1">
                <p className="text-xs font-medium text-text-muted">{field.label}</p>
                {answer ? (
                  <p className="text-sm text-text-primary leading-relaxed bg-background-secondary rounded-lg px-3 py-2 border border-border-primary/50">
                    {answer}
                  </p>
                ) : (
                  <p className="text-sm text-text-muted/50 italic bg-background-secondary rounded-lg px-3 py-2 border border-border-primary/30">
                    Not answered yet
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border-primary text-text-muted hover:text-text-primary hover:border-border-secondary transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit answers
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteIsPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-red-500/20 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleteIsPending ? "Clearing…" : "Clear"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 space-y-4">
      <StatusBanner status={status} error={errorMsg} />
      {survey.disclaimer && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs leading-relaxed">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{survey.disclaimer}</span>
        </div>
      )}
      {resolvedFields.map((field) => (
        <div key={field.key}>
          <label className="block text-xs font-medium text-text-muted mb-1.5">{field.label}</label>
          <textarea
            rows={3}
            placeholder={field.placeholder}
            value={answers[field.key] ?? ""}
            onChange={(e) => setAnswers((p) => ({ ...p, [field.key]: e.target.value }))}
            className={inputClass}
          />
        </div>
      ))}
      <div className="flex flex-wrap gap-3 pt-1">
        {existing && (
          <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-lg text-sm text-text-muted border border-border-primary hover:bg-background-secondary transition-colors">
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold bg-accent-primary text-white disabled:opacity-60 hover:bg-accent-primary/90 transition-colors"
        >
          <Save className="h-3.5 w-3.5" />
          {isPending ? "Saving…" : "Save Survey"}
        </button>
      </div>
    </div>
  );
}

// ─── Timed survey inline panel (weekly/monthly context) ──────────────────────

function TimedSurveyPanel({
  survey,
  existing,
  industry,
}: {
  survey: TimedSurveyDef;
  existing: ProfileSurveyRecord | undefined;
  industry?: string;
}) {
  const expired = survey.isExpired(existing?.updatedAt);
  const [isEditing, setIsEditing] = useState(!existing || expired);
  const [answers, setAnswers] = useState<Record<string, string>>(
    existing && !expired ? existing.answersJson : {},
  );
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const resolvedFields = resolveFields(survey.type, survey.fields, industry);

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveProfileSurvey(survey.type, answers);
      if (result.success) {
        setStatus("success");
        setIsEditing(false);
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Unknown error");
      }
    });
  };

  if (!isEditing && existing && !expired) {
    return (
      <div className="pt-4 space-y-4">
        <StatusBanner status={status} error={errorMsg} />
        <div className="space-y-3">
          {resolvedFields.map((field) => {
            const answer = answers[field.key] ?? existing.answersJson[field.key];
            return (
              <div key={field.key} className="space-y-1">
                <p className="text-xs font-medium text-text-muted">{field.label}</p>
                {answer ? (
                  <p className="text-sm text-text-primary leading-relaxed bg-background-secondary rounded-lg px-3 py-2 border border-border-primary/50">
                    {answer}
                  </p>
                ) : (
                  <p className="text-sm text-text-muted/50 italic bg-background-secondary rounded-lg px-3 py-2 border border-border-primary/30">
                    Not answered yet
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border-primary text-text-muted hover:text-text-primary hover:border-border-secondary transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Update answers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 space-y-4">
      <StatusBanner status={status} error={errorMsg} />
      {expired && existing && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
          <RefreshCw className="h-4 w-4 shrink-0" />
          Your previous answers have expired ({survey.resetLabel}). Update them with what&apos;s happening now.
        </div>
      )}
      {resolvedFields.map((field) => (
        <div key={field.key}>
          <label className="block text-xs font-medium text-text-muted mb-1.5">{field.label}</label>
          <textarea
            rows={3}
            placeholder={field.placeholder}
            value={answers[field.key] ?? ""}
            onChange={(e) => setAnswers((p) => ({ ...p, [field.key]: e.target.value }))}
            className={inputClass}
          />
        </div>
      ))}
      <div className="flex flex-wrap gap-3 pt-1">
        {existing && !expired && (
          <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-lg text-sm text-text-muted border border-border-primary hover:bg-background-secondary transition-colors">
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold bg-accent-primary text-white disabled:opacity-60 hover:bg-accent-primary/90 transition-colors"
        >
          <Save className="h-3.5 w-3.5" />
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ─── Accordion row ────────────────────────────────────────────────────────────

function AccordionRow({
  icon: Icon,
  title,
  subtitle,
  color,
  isCompleted,
  badge,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color: string;
  isCompleted: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-border-primary bg-background-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 text-left hover:bg-background-secondary/50 transition-colors"
      >
        <div className="shrink-0 p-2 sm:p-2.5 rounded-xl" style={{ background: `${color}20` }}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text-primary text-sm" style={{ fontFamily: "var(--font-serif)" }}>{title}</p>
          <p className="text-xs text-text-muted mt-0.5 truncate">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {badge && (
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-background-secondary text-text-muted border border-border-primary">
              {badge}
            </span>
          )}
          {isCompleted ? (
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/20">
              {badge ? "Current" : "Completed"}
            </span>
          ) : badge ? (
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
              Expired
            </span>
          ) : (
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-background-secondary text-text-muted border border-border-primary">
              Not started
            </span>
          )}
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-green-400 sm:hidden" />
          ) : (
            <div className="h-4 w-4 rounded-full border border-border-secondary sm:hidden" />
          )}
          {open ? (
            <ChevronUp className="h-4 w-4 text-text-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-muted" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-border-primary px-4 sm:px-5 pb-4 sm:pb-5">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function QuestionnaireClient({
  questionnaire,
  profileSurveys,
  groupedMemories,
  typeLabels,
  typeDescriptions,
  memoryStats,
}: Props) {
  const industry = questionnaire?.formData.industry as string | undefined;
  const completedCount = profileSurveys.length + (questionnaire ? 1 : 0);
  const totalCount = DEEP_DIVE_SURVEYS.length + 1 + 3; // +1 for brand questionnaire, +3 for timed surveys

  return (
    <div className="max-w-2xl mx-auto lg:max-w-none lg:mx-0 space-y-4 sm:space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
          Questionnaires
        </h1>
        <p className="text-text-muted text-sm mt-1">
          Everything the AI knows about you — your brand, your story, your market, and what it&apos;s learned over time.
        </p>
      </div>

      {/* ── AI context progress ── */}
      <div className="rounded-2xl border border-border-primary bg-background-card p-4 sm:p-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">AI Context Strength</span>
            <span className="font-medium text-accent-primary">{completedCount}/{totalCount} sections complete</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-background-secondary overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.round((completedCount / totalCount) * 100)}%`, background: "var(--color-accent-primary)" }}
            />
          </div>
          <p className="text-xs text-text-muted">The more you fill in below, the more bespoke your social posts become.</p>
        </div>
      </div>

      {/* ── Deep Dive callout ── */}
      <div className="rounded-xl border border-accent-primary/20 bg-accent-primary/5 px-4 sm:px-5 py-4">
        <p className="text-sm font-semibold text-accent-primary mb-1">The more you put in, the more bespoke your posts become.</p>
        <p className="text-sm text-text-muted leading-relaxed">
          Each section below feeds the AI hyper-specific details about your personality, market, and clients that no generic tool will ever have. A half-filled answer still helps — but those who complete every section get posts that sound like <em>them</em>, not a template.
        </p>
      </div>

      {/* ── Accordion list ── */}
      <div className="space-y-3">
        {/* Brand Questionnaire row */}
        <AccordionRow
          icon={ClipboardList}
          title="Brand Questionnaire"
          subtitle="Your core brand settings — identity, story, industry, content preferences, and voice."
          color="#1E56D6"
          isCompleted={!!questionnaire}
        >
          {questionnaire ? (
            <div className="pt-4">
              {questionnaire.lastUpdated && (
                <div className="flex items-center gap-2 mb-4 text-xs text-text-muted">
                  <SettingsIcon className="h-3.5 w-3.5 text-accent-primary" />
                  <span>Last saved: <span className="text-text-primary font-medium">{questionnaire.lastUpdated}</span></span>
                </div>
              )}
              <SettingsForm questionnaireId={questionnaire.id} initialData={questionnaire.formData} />
            </div>
          ) : (
            <div className="pt-4 text-center py-8">
              <ClipboardList className="h-10 w-10 text-accent-primary/40 mx-auto mb-3" />
              <p className="text-sm text-text-muted mb-4">
                Complete the onboarding questionnaire first to set up your brand profile.
              </p>
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold bg-accent-primary text-white hover:bg-accent-primary/90 transition-colors"
              >
                <ClipboardList className="h-4 w-4" />
                Complete Onboarding
              </Link>
            </div>
          )}
        </AccordionRow>

        {/* Deep-dive rows */}
        {DEEP_DIVE_SURVEYS.map((survey) => {
          const existing = profileSurveys.find((s) => s.surveyType === survey.type);
          return (
            <AccordionRow
              key={survey.type}
              icon={survey.icon}
              title={survey.title}
              subtitle={resolveSubtitle(survey.type, survey.subtitle, industry)}
              color={survey.color}
              isCompleted={!!existing}
            >
              <DeepDivePanel survey={survey} existing={existing} industry={industry} />
            </AccordionRow>
          );
        })}

      </div>

      {/* ── Divider ── */}
      <div className="flex items-center gap-3 py-2">
        <div className="h-px flex-1 bg-border-primary" />
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Context Refreshers</span>
        <div className="h-px flex-1 bg-border-primary" />
      </div>

      {/* ── Timed context surveys ── */}
      <div className="space-y-3">
        {/* Timed context surveys (weekly + monthly) */}
        {getTimedSurveys().map((survey) => {
          const existing = profileSurveys.find((s) => s.surveyType === survey.type);
          const expired = survey.isExpired(existing?.updatedAt);
          const isCurrent = !!existing && !expired;
          return (
            <AccordionRow
              key={survey.type}
              icon={survey.icon}
              title={survey.title}
              subtitle={resolveSubtitle(survey.type, survey.subtitle, industry)}
              color={survey.color}
              isCompleted={isCurrent}
              badge={survey.resetLabel}
            >
              <TimedSurveyPanel survey={survey} existing={existing} industry={industry} />
            </AccordionRow>
          );
        })}

      </div>

      {/* ── Divider ── */}
      <div className="flex items-center gap-3 py-2">
        <div className="h-px flex-1 bg-border-primary" />
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">AI Memory</span>
        <div className="h-px flex-1 bg-border-primary" />
      </div>

      {/* ── Brand Brain section ── */}
      <div className="rounded-2xl border border-border-primary bg-background-card overflow-hidden">
        {/* Section header */}
        <div className="px-4 sm:px-6 py-5 border-b border-border-primary bg-accent-primary/5">
          <div className="flex items-center gap-3 mb-2">
            <div className="shrink-0 p-2.5 rounded-xl bg-accent-primary/15">
              <Brain className="h-5 w-5 text-accent-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>Brand Brain</h2>
              <p className="text-xs text-text-muted mt-0.5">AI-learned memories that shape your content</p>
            </div>
          </div>
          <p className="text-sm text-text-muted leading-relaxed">
            Every time you fill out a questionnaire, generate content, or give feedback, the AI picks up on patterns about who you are, how you speak, and what resonates with your audience. These memories are automatically injected into every content generation prompt — so the more the Brand Brain knows, the less generic your posts become. Think of it as the AI&apos;s long-term notebook about your brand.
          </p>
        </div>

        {/* Stats */}
        <div className="px-4 sm:px-6 py-4 border-b border-border-primary">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="bg-background-secondary rounded-lg p-3 border border-border-primary text-center">
              <p className="text-xl font-bold text-accent-primary">{memoryStats.total}</p>
              <p className="text-xs text-text-muted mt-0.5">Total Memories</p>
            </div>
            <div className="bg-background-secondary rounded-lg p-3 border border-border-primary text-center">
              <p className="text-xl font-bold text-accent-primary">{memoryStats.pinned}</p>
              <p className="text-xs text-text-muted mt-0.5">Pinned</p>
            </div>
            <div className="bg-background-secondary rounded-lg p-3 border border-border-primary text-center">
              <p className="text-xl font-bold text-accent-primary">{memoryStats.highConfidence}</p>
              <p className="text-xs text-text-muted mt-0.5">High Confidence</p>
            </div>
          </div>
        </div>

        {/* Memory categories */}
        <div className="px-4 sm:px-6 py-4">
          <BrandBrainClient
            groupedMemories={groupedMemories}
            typeLabels={typeLabels}
            typeDescriptions={typeDescriptions}
          />
        </div>
      </div>
    </div>
  );
}
