export const REAL_ESTATE_LEADERSHIP_INDUSTRY = "Real Estate Leadership" as const;

export const INDUSTRY_OPTIONS = [
  "Real Estate",
  REAL_ESTATE_LEADERSHIP_INDUSTRY,
  "Car Sales",
  "Fitness / Personal Training",
  "Financial Services",
  "Coaching / Consulting",
  "Other",
] as const;

export type IndustryQuestionKind = "text" | "single" | "multi";

export interface IndustryQuestion {
  key: string;
  label: string;
  placeholder?: string;
  kind?: IndustryQuestionKind;
  options?: readonly string[];
}

export const LEADERSHIP_ROLE_OPTIONS = [
  "Broker / Owner",
  "Managing Broker",
  "Team Leader",
  "Brokerage Executive or Regional Leader",
  "Recruiter or Agent Development Leader",
  "Other",
] as const;

export const PRIMARY_LEADERSHIP_AUDIENCE_OPTIONS = [
  "Agents I want to recruit",
  "Agents already in my organization",
  "Team leaders and brokers",
  "Buyers and sellers",
  "My local community",
  "A combination of these",
] as const;

export const LEADERSHIP_FOCUS_OPTIONS = [
  "Recruiting",
  "Agent retention",
  "Training and coaching",
  "Brokerage culture",
  "Sales systems",
  "Operations",
  "Team growth",
  "Market leadership",
  "Technology and innovation",
  "Other",
] as const;

export const STILL_SERVING_CLIENTS_OPTIONS = [
  "Yes, regularly",
  "Occasionally",
  "No, my content should primarily speak to agents and leaders",
] as const;

export const INDUSTRY_HELPER_TEXT: Record<string, string> = {
  [REAL_ESTATE_LEADERSHIP_INDUSTRY]:
    "For broker/owners, managing brokers, team leaders, recruiters, and brokerage executives.",
};

export const INDUSTRY_QUESTIONS: Record<string, IndustryQuestion[]> = {
  "Real Estate": [
    { key: "yearsLicensed", label: "How long have you been licensed?", placeholder: "e.g. 7 years" },
    { key: "niche", label: "What is your niche?", placeholder: "e.g. Luxury condos, first-time buyers..." },
    {
      key: "biggestMisconception",
      label: "Biggest misconception buyers/sellers have?",
      placeholder: "What do clients get wrong most often?",
    },
  ],
  [REAL_ESTATE_LEADERSHIP_INDUSTRY]: [
    {
      key: "leadershipRole",
      label: "What is your real estate leadership role?",
      kind: "single",
      options: LEADERSHIP_ROLE_OPTIONS,
    },
    {
      key: "brokerageScale",
      label: "Tell us about the brokerage, team, or organization you lead.",
      placeholder:
        "Number of agents, offices, markets served, company structure, franchise or independent status, and anything else that gives useful context.",
    },
    {
      key: "primaryLeadershipAudience",
      label: "Who are you primarily trying to reach through content?",
      kind: "multi",
      options: PRIMARY_LEADERSHIP_AUDIENCE_OPTIONS,
    },
    {
      key: "leadershipFocus",
      label: "What areas of real estate leadership do you want to be known for?",
      kind: "multi",
      options: LEADERSHIP_FOCUS_OPTIONS,
    },
    {
      key: "stillServingClients",
      label: "Are you still personally serving buyers and sellers?",
      kind: "single",
      options: STILL_SERVING_CLIENTS_OPTIONS,
    },
    {
      key: "leadershipMisconception",
      label: "What do agents misunderstand about leadership, brokerage culture, or building a successful real estate career?",
      placeholder: "The leadership or culture myth you most want to challenge...",
    },
  ],
  "Fitness / Personal Training": [
    { key: "loveTrainingMost", label: "Who do you love training most?", placeholder: "Describe your ideal training client..." },
    {
      key: "biggestFitnessLie",
      label: "Biggest lie people believe about fitness?",
      placeholder: "What myth drives you crazy?",
    },
  ],
  "Financial Services": [
    { key: "specialization", label: "What is your financial specialization?", placeholder: "e.g. Retirement planning, tax strategy..." },
    { key: "clientFear", label: "What is your clients' biggest financial fear?", placeholder: "What keeps them up at night?" },
  ],
  "Car Sales": [
    { key: "yearsInCarSales", label: "How long have you been selling cars?", placeholder: "e.g. 6 years" },
    { key: "dealershipNiche", label: "What do you sell?", placeholder: "e.g. New Toyota, used luxury, lease returns, fleet..." },
    {
      key: "biggestBuyerMisconception",
      label: "Biggest misconception car buyers have?",
      placeholder: "What do customers get wrong most often?",
    },
    {
      key: "carBrands",
      label: "Which car brands do you focus on? (optional)",
      placeholder: "e.g. Toyota, Honda, BMW, Ford...",
    },
  ],
  "Coaching / Consulting": [
    { key: "transformationDelivered", label: "What transformation do you deliver?", placeholder: "Before → after for your clients..." },
    { key: "methodologyName", label: "Do you have a named methodology or framework?", placeholder: "e.g. The 3-Phase System..." },
  ],
  Other: [
    { key: "uniqueValue", label: "What makes your business uniquely valuable?", placeholder: "Your differentiator..." },
  ],
};

export function isRealEstateLeadershipIndustry(industry: unknown): boolean {
  return industry === REAL_ESTATE_LEADERSHIP_INDUSTRY;
}

export function serializeIndustryMultiSelect(values: readonly string[]): string {
  return values.join("\n");
}

export function parseIndustryMultiSelect(value: string | undefined): string[] {
  return value ? value.split("\n").filter(Boolean) : [];
}

export function getPrimaryGoalDisplayLabel(industry: unknown, storedGoal: string): string {
  if (isRealEstateLeadershipIndustry(industry) && storedGoal === "Recruitment/Partnerships") {
    return "Agent Recruitment & Retention";
  }
  return storedGoal === "Recruitment/Partnerships" ? "Recruitment / Partnerships" : storedGoal;
}

export type IndustryFieldOverride = { label?: string; placeholder?: string };

export const INDUSTRY_SUBTITLE_OVERRIDES: Record<string, Record<string, string>> = {
  LOCAL_MAYOR: {
    "Real Estate": "Hyper-local knowledge that sets you apart from every out-of-town agent.",
    [REAL_ESTATE_LEADERSHIP_INDUSTRY]:
      "Hyper-local market and community insight that strengthens your leadership and brokerage brand.",
    "Car Sales": "Hyper-local knowledge that sets you apart from every out-of-town dealer.",
    "Fitness / Personal Training": "Hyper-local knowledge that sets you apart from every out-of-town trainer.",
    "Financial Services": "Hyper-local knowledge that sets you apart from every out-of-town advisor.",
    "Coaching / Consulting": "Hyper-local knowledge that sets you apart from every out-of-town competitor.",
    Other: "Hyper-local knowledge that sets you apart from every out-of-town competitor.",
  },
  CLIENT_AVATAR: {
    [REAL_ESTATE_LEADERSHIP_INDUSTRY]:
      "Understand the agents and leaders you want to attract, develop, and serve.",
  },
  TRENCH_WARFARE: {
    "Real Estate": "Battle-tested wisdom from the deals only real agents survive.",
    [REAL_ESTATE_LEADERSHIP_INDUSTRY]: "Battle-tested lessons from leading agents and running a brokerage.",
    "Car Sales": "Battle-tested wisdom from the deals only real car salesmen survive.",
    "Fitness / Personal Training": "Battle-tested wisdom from the trenches only real trainers survive.",
    "Financial Services": "Battle-tested wisdom from the trenches only real advisors survive.",
    "Coaching / Consulting": "Battle-tested wisdom from the trenches only real practitioners survive.",
    Other: "Battle-tested wisdom from the trenches only real pros survive.",
  },
  OFFER_FUNNEL: {
    "Real Estate": "Tell the AI what you're selling — listings, consultations, buyer services — and how content should drive leads.",
    [REAL_ESTATE_LEADERSHIP_INDUSTRY]:
      "Recruiting, brokerage opportunities, training, coaching, and how content should start the right conversations.",
    "Car Sales": "Tell the AI what you're selling — vehicles, financing, trade-ins — and how content should drive floor traffic.",
    "Fitness / Personal Training": "Tell the AI what you're selling — programs, coaching, memberships — and how content should drive signups.",
    "Financial Services": "Tell the AI what you're offering — reviews, planning, consultations — and how content should drive appointments.",
    "Coaching / Consulting": "Tell the AI what you're selling — coaching, programs, courses — and how content should drive leads.",
    Other: "Tell the AI what you are selling, who it is for, and how content should move people toward action.",
  },
  PROOF_BANK: {
    "Real Estate": "Give the AI real wins, testimonials, and deal results it can use to build trust.",
    [REAL_ESTATE_LEADERSHIP_INDUSTRY]:
      "Agent wins, recruiting results, testimonials, and brokerage growth that make your leadership credible.",
    "Car Sales": "Give the AI real wins, testimonials, and sales results it can use to build trust.",
    "Fitness / Personal Training": "Give the AI real transformations, testimonials, and client wins it can use to build trust.",
    "Financial Services": "Give the AI real outcomes, testimonials, and client results it can use to build trust.",
    "Coaching / Consulting": "Give the AI real breakthroughs, testimonials, and client wins it can use to build trust.",
    Other: "Give the AI real proof it can use to make your content more specific and credible.",
  },
  COMPLIANCE_GUARDRAILS: {
    "Real Estate": "Fair housing, brokerage rules, license disclosure — set the guardrails the AI must follow.",
    [REAL_ESTATE_LEADERSHIP_INDUSTRY]:
      "Fair housing, recruiting claims, compensation and earnings claims, brokerage rules, and confidentiality.",
    "Car Sales": "Financing claims, approval claims, dealership rules — set the guardrails the AI must follow.",
    "Fitness / Personal Training": "Medical claims, injury claims, supplement rules — set the guardrails the AI must follow.",
    "Financial Services": "Investment claims, compliance rules, fiduciary language — set the guardrails the AI must follow.",
    "Coaching / Consulting": "Income claims, guaranteed results, testimonial rules — set the guardrails the AI must follow.",
    Other: "Set the rules for what the AI should avoid, soften, disclose, or never claim.",
  },
};

export const INDUSTRY_TITLE_OVERRIDES: Record<string, Record<string, string>> = {
  CLIENT_AVATAR: {
    [REAL_ESTATE_LEADERSHIP_INDUSTRY]: "Agent & Leadership Audience",
  },
};

export const INDUSTRY_FIELD_OVERRIDES: Record<
  string,
  Record<string, Record<string, IndustryFieldOverride>>
> = {
  LOCAL_MAYOR: {
    [REAL_ESTATE_LEADERSHIP_INDUSTRY]: {
      fierceDebate: {
        label: "What is the most fiercely debated issue among real estate professionals in your market?",
      },
      underratedNeighborhood: {
        label: "What part of your market offers the biggest opportunity for agents over the next five years?",
      },
    },
  },
  TRENCH_WARFARE: {
    "Real Estate": {
      wildestStory: { label: "Wildest thing you've seen at an inspection or closing?" },
      negotiationStyle: { label: "Your negotiation style in 3 words?" },
      trophyRoomWin: { placeholder: "The deal everyone said couldn't be done..." },
    },
    [REAL_ESTATE_LEADERSHIP_INDUSTRY]: {
      wildestStory: { label: "Wildest situation you’ve handled while leading agents or running a brokerage?" },
      negotiationStyle: { label: "Describe your leadership style in three words." },
      mostCommonDM: { label: "What is the number one question agents or leaders ask you?" },
      trophyRoomWin: { placeholder: "The agent, team, recruiting, or brokerage win that once seemed impossible..." },
      objectionCrusher: {
        label: "What is the most common reason an agent hesitates to make a career or brokerage change, and how do you respond?",
      },
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
    [REAL_ESTATE_LEADERSHIP_INDUSTRY]: {
      agentPetPeeve: { label: "Your biggest pet peeve about real estate leadership or brokerage culture?" },
      yearOneFailure: {
        placeholder: "The leadership decision, recruiting miss, or team failure that changed how you lead...",
      },
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
    [REAL_ESTATE_LEADERSHIP_INDUSTRY]: {
      favoriteClientType: { label: "Describe the type of agent or leader you most want to attract and develop." },
      clientBiggestFear: {
        label: "What is the single biggest fear your ideal agent has about changing brokerages or advancing their career?",
      },
      clientRedFlag: { label: "What red flag tells you an agent may not be the right fit for your organization?" },
      clientMisbeliefs: { label: "What do agents wrongly believe they need to do first to grow their career?" },
      clientDreamOutcome: { label: "What does your ideal agent ultimately want from their career and brokerage?" },
      beforeAfterStory: { label: "Share a real agent or leadership before-and-after story you are allowed to use." },
    },
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
    [REAL_ESTATE_LEADERSHIP_INDUSTRY]: {
      professionalUpdates: {
        placeholder:
          "Recruiting conversations, agent coaching, training sessions, team wins, company initiatives, leadership decisions, meetings, and market changes...",
      },
    },
    "Real Estate": { professionalUpdates: { placeholder: "Deals in motion, client meetings, showings, deadlines..." } },
    "Car Sales": { professionalUpdates: { placeholder: "Deals in motion, test drives, deliveries, month-end push, deadlines..." } },
    "Fitness / Personal Training": { professionalUpdates: { placeholder: "Clients in progress, training sessions, program launches, deadlines..." } },
    "Financial Services": { professionalUpdates: { placeholder: "Clients in motion, portfolio reviews, meetings, deadlines..." } },
    "Coaching / Consulting": { professionalUpdates: { placeholder: "Client engagements in motion, sessions, projects, launches, deadlines..." } },
  },
  MONTHLY_CONTEXT: {
    [REAL_ESTATE_LEADERSHIP_INDUSTRY]: {
      businessChanges: { label: "What is changing in your brokerage, team, or leadership role this month?" },
      newGoals: { label: "What recruiting, retention, growth, culture, or leadership priorities are you focused on this month?" },
    },
  },
  STORY_REFRESH: {
    [REAL_ESTATE_LEADERSHIP_INDUSTRY]: {
      recentWins: { label: "Any new agent success stories, recruiting wins, or leadership wins since you last updated this?" },
      newStories: { label: "Any new recruiting conversations, leadership lessons, or brokerage culture moments?" },
      newObservations: { label: "What market or industry observations are shaping your leadership perspective?" },
      newClientStories: { label: "Any new agent, recruit, coaching, or leadership interactions worth sharing?" },
      whatsChanging: { label: "What is changing in your brokerage, team, or local real estate market right now?" },
    },
  },
  OFFER_FUNNEL: {
    [REAL_ESTATE_LEADERSHIP_INDUSTRY]: {
      mainOffer: {
        placeholder:
          "Brokerage affiliation, agent recruiting, confidential career conversations, training events, coaching or development programs, team opportunities, leadership consulting, or speaking...",
      },
      offerForWho: {
        placeholder:
          "Agents you want to recruit, agents already in your organization, team leaders, brokers, or your local community...",
      },
      leadMagnet: {
        placeholder:
          "A recruiting resource, training event, coaching workshop, agent development guide, or leadership resource...",
      },
      commonObjections: {
        placeholder:
          "Why might an agent hesitate to evaluate a brokerage, join a team, attend training, or begin coaching?",
      },
    },
  },
  PROOF_BANK: {
    [REAL_ESTATE_LEADERSHIP_INDUSTRY]: {
      bestTestimonials: { placeholder: "Agent wins, recruiting conversations, leadership testimonials, or culture feedback you have permission to share..." },
      clientWins: { label: "List agent development, production improvement, recruiting, retention, culture, or team-growth wins you helped create." },
      beforeAfterStories: { placeholder: "An agent, team, or culture before-and-after story you are allowed to share..." },
      numbersAndStats: { placeholder: "Verified agent development, recruiting, retention, team growth, brokerage milestones, or other experience markers..." },
      caseStudyDetails: { placeholder: "Describe one verified agent, recruiting, coaching, culture, or brokerage growth story. Do not include unapproved claims." },
    },
  },
  COMPLIANCE_GUARDRAILS: {
    [REAL_ESTATE_LEADERSHIP_INDUSTRY]: {
      requiredDisclaimers: { placeholder: "Required brokerage or franchise disclosures, fair housing language, recruiting disclosures, and license or affiliation notices..." },
      forbiddenClaims: { placeholder: "Unverified recruiting, employment, compensation, commission, split, income, earnings, production, or guaranteed-result claims..." },
      regulatedTopics: { placeholder: "Fair housing, recruiting and employment-related claims, independent-contractor language, compensation or split claims, income and production claims..." },
      companyRules: { placeholder: "Brokerage or franchise rules, required approval processes, recruiting guidelines, confidentiality requirements, and license-affiliation rules..." },
      approvalProcess: { placeholder: "Who must approve recruiting, compensation, earnings, agent-result, brokerage, or client-confidentiality content before posting?" },
      wordsToAvoidForCompliance: { placeholder: "Words that create risk around recruiting, employment, compensation, earnings, production, fair housing, or confidentiality..." },
      sensitiveTopics: { placeholder: "Agent or client confidentiality, private recruiting conversations, internal disputes, protected information, or topics your company requires you to avoid..." },
      licenseOrCredentialRules: { placeholder: "License and brokerage-affiliation requirements, franchise disclosures, independent-contractor language, or company approval language..." },
    },
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
