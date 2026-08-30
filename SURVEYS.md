# The Local Post Surveys

This document records the supported industries, survey keys, industry-aware copy, and prompt behavior. Survey types and field keys are stable. The onboarding `industryAnswers` value remains the existing JSON object of strings, so this change requires no schema migration and preserves existing user data.

## Supported industries

The exact industry values are:

- Real Estate
- Real Estate Leadership
- Car Sales
- Fitness / Personal Training
- Financial Services
- Coaching / Consulting
- Other

Real Estate Leadership helper text:

> For broker/owners, managing brokers, team leaders, recruiters, and brokerage executives.

The stored primary-goal value remains `Recruitment/Partnerships`. For Real Estate Leadership it is displayed as **Agent Recruitment & Retention**. Existing industries continue to display **Recruitment / Partnerships**.

## Onboarding foundation

The core questionnaire is stored in `Questionnaire.content`. Existing keys remain unchanged. Selecting Real Estate Leadership displays these fields under `industryAnswers`:

| Key | Question | Input |
|---|---|---|
| `leadershipRole` | What is your real estate leadership role? | Single select |
| `brokerageScale` | Tell us about the brokerage, team, or organization you lead. | Textarea |
| `primaryLeadershipAudience` | Who are you primarily trying to reach through content? | Multi-select |
| `leadershipFocus` | What areas of real estate leadership do you want to be known for? | Multi-select |
| `stillServingClients` | Are you still personally serving buyers and sellers? | Single select |
| `leadershipMisconception` | What do agents misunderstand about leadership, brokerage culture, or building a successful real estate career? | Textarea |

`leadershipRole` options: Broker / Owner; Managing Broker; Team Leader; Brokerage Executive or Regional Leader; Recruiter or Agent Development Leader; Other.

`primaryLeadershipAudience` options: Agents I want to recruit; Agents already in my organization; Team leaders and brokers; Buyers and sellers; My local community; A combination of these.

`leadershipFocus` options: Recruiting; Agent retention; Training and coaching; Brokerage culture; Sales systems; Operations; Team growth; Market leadership; Technology and innovation; Other.

`stillServingClients` options: Yes, regularly; Occasionally; No, my content should primarily speak to agents and leaders.

Multi-select values are stored as newline-delimited strings in the existing `industryAnswers` JSON structure. The onboarding and Brand Settings forms parse those strings back into selected options, so answers save, reload, and remain editable without changing the schema.

Existing industry branches are unchanged:

- Real Estate: `yearsLicensed`, `niche`, `biggestMisconception`
- Car Sales: `yearsInCarSales`, `dealershipNiche`, `biggestBuyerMisconception`, `carBrands`
- Fitness / Personal Training: `loveTrainingMost`, `biggestFitnessLie`
- Financial Services: `specialization`, `clientFear`
- Coaching / Consulting: `transformationDelivered`, `methodologyName`
- Other: `uniqueValue`

## Industry survey overrides

Overrides are selected by the existing survey type and industry maps. Unknown or legacy industry values fall back to the default survey title, subtitle, labels, and placeholders.

### The Local Mayor (`LOCAL_MAYOR`)

Subtitle:

> Hyper-local market and community insight that strengthens your leadership and brokerage brand.

Leadership labels:

- `fierceDebate`: What is the most fiercely debated issue among real estate professionals in your market?
- `underratedNeighborhood`: What part of your market offers the biggest opportunity for agents over the next five years?

The hidden-gem, restaurant, coffee, shop, park, gym, and ideal-Sunday questions remain unchanged and support Local content.

### Trench Warfare (`TRENCH_WARFARE`)

Subtitle:

> Battle-tested lessons from leading agents and running a brokerage.

Leadership labels and placeholder:

- `wildestStory`: Wildest situation you’ve handled while leading agents or running a brokerage?
- `negotiationStyle`: Describe your leadership style in three words.
- `mostCommonDM`: What is the number one question agents or leaders ask you?
- `trophyRoomWin` placeholder: The agent, team, recruiting, or brokerage win that once seemed impossible...
- `objectionCrusher`: What is the most common reason an agent hesitates to make a career or brokerage change, and how do you respond?

`disagreesWith` retains its existing field key and default question.

### Origin Story (`ORIGIN_STORY`)

Leadership overrides:

- `yearOneFailure` placeholder: The leadership decision, recruiting miss, or team failure that changed how you lead...
- `agentPetPeeve`: Your biggest pet peeve about real estate leadership or brokerage culture?

The hobby and alternative-career fields remain unchanged.

### Client Avatar (`CLIENT_AVATAR`)

The stored survey type remains `CLIENT_AVATAR`. For Real Estate Leadership only, the displayed title is:

> Agent & Leadership Audience

Subtitle:

> Understand the agents and leaders you want to attract, develop, and serve.

Visible leadership questions:

- `favoriteClientType`: Describe the type of agent or leader you most want to attract and develop.
- `clientBiggestFear`: What is the single biggest fear your ideal agent has about changing brokerages or advancing their career?
- `clientRedFlag`: What red flag tells you an agent may not be the right fit for your organization?
- `clientMisbeliefs`: What do agents wrongly believe they need to do first to grow their career?
- `clientDreamOutcome`: What does your ideal agent ultimately want from their career and brokerage?
- `beforeAfterStory`: Share a real agent or leadership before-and-after story you are allowed to use.

### Weekly Context (`WEEKLY_CONTEXT`)

`professionalUpdates` placeholder:

> Recruiting conversations, agent coaching, training sessions, team wins, company initiatives, leadership decisions, meetings, and market changes...

Other weekly fields, including personal highlights, new spots, wins, and what is on the creator’s mind, remain unchanged.

### Monthly Context (`MONTHLY_CONTEXT`)

Leadership labels:

- `businessChanges`: What is changing in your brokerage, team, or leadership role this month?
- `newGoals`: What recruiting, retention, growth, culture, or leadership priorities are you focused on this month?

The monthly theme, milestones, travel, and holiday field keys remain unchanged.

### Story Refresh (`STORY_REFRESH`)

Leadership labels:

- `recentWins`: Any new agent success stories, recruiting wins, or leadership wins since you last updated this?
- `newStories`: Any new recruiting conversations, leadership lessons, or brokerage culture moments?
- `newObservations`: What market or industry observations are shaping your leadership perspective?
- `newClientStories`: Any new agent, recruit, coaching, or leadership interactions worth sharing?
- `whatsChanging`: What is changing in your brokerage, team, or local real estate market right now?

### Offer & Funnel (`OFFER_FUNNEL`)

Subtitle:

> Recruiting, brokerage opportunities, training, coaching, and how content should start the right conversations.

Leadership examples cover brokerage affiliation, agent recruiting, confidential career conversations, training events, coaching or development programs, team opportunities, and leadership consulting or speaking when applicable. The UI examples also distinguish prospective recruits, current agents, team leaders, brokers, and the local community. They do not assume a buying or selling offer.

The prompt preserves `doNotPromise` as a hard guardrail and uses only the user’s supplied offer, CTA, objections, urgency, and proof.

### Proof Bank (`PROOF_BANK`)

Subtitle:

> Agent wins, recruiting results, testimonials, and brokerage growth that make your leadership credible.

Leadership examples cover agent development, production improvement, recruiting wins, retention, culture improvements, team growth, leadership testimonials, and brokerage milestones. Proof placeholders explicitly request verified, permitted material. The AI must never fabricate agent results, production numbers, testimonials, retention numbers, recruiting outcomes, or case studies.

### Compliance & Brand Safety (`COMPLIANCE_GUARDRAILS`)

Subtitle:

> Fair housing, recruiting claims, compensation and earnings claims, brokerage rules, and confidentiality.

Leadership placeholders ask about:

- Required brokerage or franchise disclosures and fair housing requirements
- Recruiting and employment-related claims
- Independent-contractor language
- Compensation, commission, and split claims
- Income, earnings, and production claims
- Agent and client confidentiality
- License and brokerage-affiliation requirements
- Company approval processes

Compliance remains the highest-priority prompt guardrail. It overrides Offer, Proof, calendar, refinement, and other content directives. The AI must soften or omit content when the safe interpretation is uncertain.

## Real Estate Leadership content strategy

The prompt builder adds an `industry_content_strategy` block only for Real Estate Leadership. It identifies the creator as a leader, operator, recruiter, coach, mentor, or brokerage executive and includes the submitted leadership role, brokerage scale, primary leadership audience, leadership focus, and whether the creator still serves consumers.

- **Personal:** The leader’s personal journey, leadership lessons and failures, values, convictions, why they chose leadership, the human side of running a brokerage, and permitted family, routines, hobbies, and life outside work. Personal stories should help agents trust and relate to the leader.
- **Expert:** Recruiting and retention, agent development, coaching and training, brokerage culture, leadership decisions, sales systems and accountability, operations and technology, industry opinions and myth-busting, team building, future leaders, and market changes from a brokerage leader’s perspective.
- **Local:** Local opportunities for agents, community involvement, local businesses and organizations, why the market is a strong place to build a real estate career, the brokerage’s local presence and service, community leadership, and supported local housing or economic changes.

`primaryLeadershipAudience` determines who each post addresses. The AI does not treat every agent as a recruit and does not make every post a recruiting pitch. When the audience includes buyers and sellers and `stillServingClients` indicates active consumer work, the calendar may use a deliberate mixed strategy. Otherwise it avoids default consumer transaction advice, listing promotion, showing stories, and buy-or-sell CTAs unless the user’s audience, offer, and supplied context support them.

Natural CTA directions may include evaluating a brokerage, confidential career conversations, a GROW comment resource, agent training, practical leadership, and asking whether an agent is getting the support they need. These are examples only. Preferred CTA, Offer, Proof, Compliance, Brand Brain, feedback, freshness, voice, and anti-brand settings still control the result.

The AI must never invent agents, testimonials, conversations, brokerage statistics, production results, recruiting outcomes, retention numbers, or success stories.

## Storage, compatibility, and expiry

- No database schema, migration, Prisma, Storage, environment, or external-service change is required.
- Existing Questionnaire JSON and ProfileSurvey rows continue to deserialize with their existing keys.
- Existing survey types remain unchanged.
- Timed survey expiry remains: Weekly after the most recent Sunday, Monthly after the first of the current month, and Story Refresh after 42 days.
- Legacy or unknown industries render generic deep-dive fields and default survey copy safely; they are not rejected by the existing permissive validation path.
