import { readFileSync } from "node:fs";
import { getIndustryFeeds } from "../rss-trends";
import {
  INDUSTRY_OPTIONS,
  INDUSTRY_QUESTIONS,
  INDUSTRY_FIELD_OVERRIDES,
  INDUSTRY_SUBTITLE_OVERRIDES,
  INDUSTRY_TITLE_OVERRIDES,
  LEADERSHIP_FOCUS_OPTIONS,
  LEADERSHIP_ROLE_OPTIONS,
  PRIMARY_LEADERSHIP_AUDIENCE_OPTIONS,
  REAL_ESTATE_LEADERSHIP_INDUSTRY,
  STILL_SERVING_CLIENTS_OPTIONS,
  getPrimaryGoalDisplayLabel,
  parseIndustryMultiSelect,
  serializeIndustryMultiSelect,
} from "../industry-config";

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

const leadershipQuestions = INDUSTRY_QUESTIONS[REAL_ESTATE_LEADERSHIP_INDUSTRY];
const questionByKey = Object.fromEntries(leadershipQuestions.map((question) => [question.key, question]));

assert(INDUSTRY_OPTIONS.includes(REAL_ESTATE_LEADERSHIP_INDUSTRY), "leadership industry is an onboarding option");
assert(getIndustryFeeds(REAL_ESTATE_LEADERSHIP_INDUSTRY).length === 3, "leadership industry uses real-estate trend feeds");
assert(leadershipQuestions.length === 6, "leadership onboarding has six deep-dive fields");
assert(questionByKey.leadershipRole.kind === "single", "leadershipRole is single-select");
assert(questionByKey.brokerageScale.kind === undefined, "brokerageScale remains a text field");
assert(questionByKey.primaryLeadershipAudience.kind === "multi", "primaryLeadershipAudience is multi-select");
assert(questionByKey.leadershipFocus.kind === "multi", "leadershipFocus is multi-select");
assert(questionByKey.stillServingClients.kind === "single", "stillServingClients is single-select");
assert(questionByKey.leadershipMisconception.kind === undefined, "leadershipMisconception remains a text field");
assert(questionByKey.leadershipRole.options?.join("|") === LEADERSHIP_ROLE_OPTIONS.join("|"), "leadership role options match the product copy");
assert(questionByKey.primaryLeadershipAudience.options?.join("|") === PRIMARY_LEADERSHIP_AUDIENCE_OPTIONS.join("|"), "leadership audience options match the product copy");
assert(questionByKey.leadershipFocus.options?.join("|") === LEADERSHIP_FOCUS_OPTIONS.join("|"), "leadership focus options match the product copy");
assert(questionByKey.stillServingClients.options?.join("|") === STILL_SERVING_CLIENTS_OPTIONS.join("|"), "consumer-service options match the product copy");

const selectedAudience = [PRIMARY_LEADERSHIP_AUDIENCE_OPTIONS[0], PRIMARY_LEADERSHIP_AUDIENCE_OPTIONS[3]];
const serialized = serializeIndustryMultiSelect(selectedAudience);
assert(serialized === "Agents I want to recruit\nBuyers and sellers", "multi-select values use the existing string JSON convention");
assert(parseIndustryMultiSelect(serialized).join("|") === selectedAudience.join("|"), "multi-select values round-trip for reload and edit");

assert(getPrimaryGoalDisplayLabel(REAL_ESTATE_LEADERSHIP_INDUSTRY, "Recruitment/Partnerships") === "Agent Recruitment & Retention", "leadership goal has an industry-specific display label");
assert(getPrimaryGoalDisplayLabel("Real Estate", "Recruitment/Partnerships") === "Recruitment / Partnerships", "existing real estate goal label is unchanged");
assert(getPrimaryGoalDisplayLabel("Legacy Industry", "Recruitment/Partnerships") === "Recruitment / Partnerships", "unknown industry falls back safely");

assert(
  INDUSTRY_SUBTITLE_OVERRIDES.LOCAL_MAYOR[REAL_ESTATE_LEADERSHIP_INDUSTRY] ===
    "Hyper-local market and community insight that strengthens your leadership and brokerage brand.",
  "Local Mayor leadership subtitle is configured",
);
assert(
  INDUSTRY_FIELD_OVERRIDES.LOCAL_MAYOR[REAL_ESTATE_LEADERSHIP_INDUSTRY].fierceDebate.label ===
    "What is the most fiercely debated issue among real estate professionals in your market?",
  "Local Mayor fierce-debate leadership label is configured",
);
assert(
  INDUSTRY_FIELD_OVERRIDES.LOCAL_MAYOR[REAL_ESTATE_LEADERSHIP_INDUSTRY].underratedNeighborhood.label ===
    "What part of your market offers the biggest opportunity for agents over the next five years?",
  "Local Mayor opportunity leadership label is configured",
);
assert(
  INDUSTRY_SUBTITLE_OVERRIDES.CLIENT_AVATAR[REAL_ESTATE_LEADERSHIP_INDUSTRY] ===
    "Understand the agents and leaders you want to attract, develop, and serve.",
  "Client Avatar leadership subtitle is configured",
);
assert(INDUSTRY_TITLE_OVERRIDES.CLIENT_AVATAR[REAL_ESTATE_LEADERSHIP_INDUSTRY] === "Agent & Leadership Audience", "Client Avatar title override is configured");
assert(
  INDUSTRY_FIELD_OVERRIDES.CLIENT_AVATAR[REAL_ESTATE_LEADERSHIP_INDUSTRY].beforeAfterStory.label ===
    "Share a real agent or leadership before-and-after story you are allowed to use.",
  "Client Avatar leadership labels are configured",
);
assert(
  INDUSTRY_FIELD_OVERRIDES.COMPLIANCE_GUARDRAILS[REAL_ESTATE_LEADERSHIP_INDUSTRY].forbiddenClaims.placeholder?.includes("compensation") === true,
  "leadership compliance placeholder covers compensation claims",
);
assert(
  INDUSTRY_SUBTITLE_OVERRIDES.LOCAL_MAYOR["Real Estate"] ===
    "Hyper-local knowledge that sets you apart from every out-of-town agent.",
  "existing Real Estate subtitle fallback is unchanged",
);
assert(
  INDUSTRY_FIELD_OVERRIDES.TRENCH_WARFARE["Real Estate"].wildestStory.label ===
    "Wildest thing you've seen at an inspection or closing?",
  "existing Real Estate field fallback is unchanged",
);
assert(
  INDUSTRY_TITLE_OVERRIDES.CLIENT_AVATAR["Real Estate"] === undefined,
  "existing Real Estate Client Avatar title remains the default",
);

const questionnaireClientSource = readFileSync(
  new URL("../../app/dashboard/questionnaire/QuestionnaireClient.tsx", import.meta.url),
  "utf8",
);
assert(
  questionnaireClientSource.includes("INDUSTRY_FIELD_OVERRIDES") &&
    questionnaireClientSource.includes("INDUSTRY_SUBTITLE_OVERRIDES") &&
    questionnaireClientSource.includes("INDUSTRY_TITLE_OVERRIDES"),
  "questionnaire UI imports all shared override maps",
);
assert(
  !questionnaireClientSource.includes("const INDUSTRY_FIELD_OVERRIDES") &&
    !questionnaireClientSource.includes("const INDUSTRY_SUBTITLE_OVERRIDES") &&
    !questionnaireClientSource.includes("const INDUSTRY_TITLE_OVERRIDES"),
  "questionnaire UI has no duplicated local override maps",
);
const calendarActionsSource = readFileSync(
  new URL("../../app/dashboard/calendar/actions.ts", import.meta.url),
  "utf8",
);
assert(
  calendarActionsSource.includes("getPrimaryGoalDisplayLabel(answers.industry"),
  "calendar strategy uses the industry-aware primary-goal display value",
);
