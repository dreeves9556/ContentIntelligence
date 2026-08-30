import {
  buildRealEstateLeadershipStrategyBlock,
  buildUserProfileXml,
} from "../prompt-builder";
import type { QuestionnaireFormData } from "../questionnaire-actions";

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

const answers = {
  name: "Morgan Leader",
  businessName: "North Star Realty",
  city: "Austin, TX",
  whatYouDo: "I lead a growing independent brokerage and develop agents.",
  industry: "Real Estate Leadership",
  brandType: "Business Brand",
  personalStory: "I became a broker after learning from an early leadership mistake.",
  industryAnswers: {
    leadershipRole: "Broker / Owner",
    brokerageScale: "42 agents, two offices, three markets, independent brokerage.",
    primaryLeadershipAudience: "Agents I want to recruit\nAgents already in my organization",
    leadershipFocus: "Recruiting\nTraining and coaching\nBrokerage culture",
    stillServingClients: "No, my content should primarily speak to agents and leaders",
    leadershipMisconception: "Leadership is not just being the top producer.",
  },
} as unknown as QuestionnaireFormData;

const strategy = buildRealEstateLeadershipStrategyBlock(answers);
assert(strategy.includes("Real Estate Leadership professional"), "leadership persona is present");
assert(strategy.includes("Agents I want to recruit"), "primary leadership audience is present");
assert(strategy.includes("No, my content should primarily speak to agents and leaders"), "consumer-service answer is present");
assert(strategy.includes("do not default to homebuyer or seller tips"), "leadership-only content avoids default consumer advice");
assert(strategy.includes("Never invent agents, testimonials, conversations, brokerage statistics"), "leadership strategy forbids fabricated proof");

const mixedStrategy = buildRealEstateLeadershipStrategyBlock({
  ...answers,
  industryAnswers: {
    ...answers.industryAnswers,
    primaryLeadershipAudience: "Buyers and sellers\nMy local community",
    stillServingClients: "Yes, regularly",
  },
} as unknown as QuestionnaireFormData);
assert(mixedStrategy.includes("create a deliberate mixed strategy"), "leaders who still serve consumers receive a mixed strategy");

const profile = buildUserProfileXml({
  answers,
  profileSurveys: [
    {
      surveyType: "CLIENT_AVATAR",
      answersJson: {
        favoriteClientType: "An accountable agent ready to grow.",
        beforeAfterStory: "Approved agent development story.",
      },
    },
    {
      surveyType: "OFFER_FUNNEL",
      answersJson: {
        mainOffer: "Confidential career conversations for agents evaluating brokerages.",
      },
    },
    {
      surveyType: "PROOF_BANK",
      answersJson: {
        clientWins: "Verified agent development win supplied by the leader.",
      },
    },
    {
      surveyType: "COMPLIANCE_GUARDRAILS",
      answersJson: {
        forbiddenClaims: "No unsupported income or production claims.",
        requiredDisclaimers: "Use our brokerage disclosure.",
      },
    },
  ],
});
assert(profile.includes("<industry_context>"), "onboarding industry answers reach the profile prompt");
assert(profile.includes("42 agents, two offices, three markets"), "brokerage scale reaches the profile prompt");
assert(profile.includes("<industry_content_strategy>"), "leadership content strategy reaches the profile prompt");
assert(profile.includes("<client_avatar>"), "Client Avatar keeps its CLIENT_AVATAR storage type");
assert(profile.includes("<compliance_guardrails>"), "compliance context reaches the profile prompt");
assert(profile.includes("No unsupported income or production claims."), "compliance answer remains in the prompt");
assert(profile.includes("NEVER fabricate testimonials, results, or case studies"), "proof context forbids fabricated results");
assert(profile.indexOf("<compliance_guardrails>") < profile.indexOf("<offer_funnel>"), "compliance guardrails precede offer context");

const existingRealEstate = { ...answers, industry: "Real Estate", industryAnswers: { yearsLicensed: "7 years", niche: "First-time buyers" } } as unknown as QuestionnaireFormData;
const existingProfile = buildUserProfileXml({ answers: existingRealEstate, profileSurveys: [] });
assert(!existingProfile.includes("<industry_content_strategy>"), "ordinary Real Estate does not receive leadership strategy");
assert(existingProfile.includes("Biggest misconception buyers/sellers have") === false, "existing Real Estate profile only includes supplied answers");
assert(existingProfile.includes("First-time buyers"), "existing Real Estate answers remain supported");
