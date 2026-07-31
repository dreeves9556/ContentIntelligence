import type { Metadata } from "next";
import { PublicHeader } from "@/components/marketing/PublicHeader";
import { PublicFooter } from "@/components/marketing/PublicFooter";

export const metadata: Metadata = {
  title: "Privacy Policy — The Local Post",
  description:
    "Privacy Policy for The Local Post, detailing how we collect, use, store, and protect your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <PublicHeader />
      <main className="bg-background-primary">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <header className="mb-12">
            <p className="text-xs font-semibold text-accent-primary uppercase tracking-widest mb-3">
              Legal
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
              Privacy Policy
            </h1>
            <p className="text-sm text-text-muted">
              Last updated: July 28, 2026
            </p>
          </header>

          <div className="space-y-8 text-text-muted leading-relaxed">
            <section>
              <p>
                This Privacy Policy describes how <strong>The Local Post</strong> ("we," "us," "our," or "the Service")
                collects, uses, stores, shares, and protects your personal information when you use our website,
                application, and related services. The Local Post is owned and operated by{" "}
                <strong>Dylan Ballard</strong>. By creating an account or using any part of the Service, you acknowledge
                that you have read and understood this Privacy Policy and agree to the practices described herein.
              </p>
              <p className="mt-4">
                If you do not agree with the terms of this Privacy Policy, you must not access or use the Service.
              </p>
            </section>

            <section className="border border-border-primary rounded-lg p-6 bg-background-secondary">
              <h2 className="text-lg font-bold text-text-primary mb-3">Table of Contents</h2>
              <ol className="list-decimal list-inside space-y-1.5 text-sm">
                <li><a href="#information-we-collect" className="text-accent-primary hover:underline">Information We Collect</a></li>
                <li><a href="#how-we-use-information" className="text-accent-primary hover:underline">How We Use Your Information</a></li>
                <li><a href="#ai-processing" className="text-accent-primary hover:underline">AI Processing &amp; Content Generation</a></li>
                <li><a href="#social-media" className="text-accent-primary hover:underline">Social Media Analytics &amp; Integrations</a></li>
                <li><a href="#cookies" className="text-accent-primary hover:underline">Cookies, Tokens &amp; Session Management</a></li>
                <li><a href="#third-party" className="text-accent-primary hover:underline">Third-Party Service Providers</a></li>
                <li><a href="#data-sharing" className="text-accent-primary hover:underline">Data Sharing &amp; Disclosure</a></li>
                <li><a href="#data-retention" className="text-accent-primary hover:underline">Data Retention</a></li>
                <li><a href="#data-security" className="text-accent-primary hover:underline">Data Security</a></li>
                <li><a href="#your-rights" className="text-accent-primary hover:underline">Your Privacy Rights</a></li>
                <li><a href="#children" className="text-accent-primary hover:underline">Children&apos;s Privacy</a></li>
                <li><a href="#international" className="text-accent-primary hover:underline">International Data Transfers</a></li>
                <li><a href="#changes" className="text-accent-primary hover:underline">Changes to This Privacy Policy</a></li>
                <li><a href="#contact" className="text-accent-primary hover:underline">Contact Us</a></li>
              </ol>
            </section>

            <section id="information-we-collect">
              <h2 className="text-2xl font-bold text-text-primary mb-4">1. Information We Collect</h2>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">1.1 Information You Provide Directly</h3>
              <p className="mb-3">When you register for an account, complete onboarding, or interact with the Service, we collect:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li><strong>Account credentials:</strong> Your email address and a password (stored as a bcrypt hash — we never store passwords in plain text). Your display name.</li>
                <li><strong>Onboarding questionnaire data:</strong> Your name, business name, city, what you do, industry, brand type, personal story, on-camera personality, content you enjoy, days you want to post, primary goal, and anti-brand words (words or phrases to avoid in generated content).</li>
                <li><strong>Profile survey responses:</strong> Answers to optional surveys including Trench Warfare, Origin Story, Client Avatar, Local Mayor, Weekly Context, Monthly Context, Story Refresh, Offer Funnel, Proof Bank, and Compliance Guardrails. These surveys gather information about your business wins, client demographics, community involvement, offers, proof points, and content guardrails.</li>
                <li><strong>Content feedback:</strong> When you give a thumbs-up or thumbs-down on generated content, we store your feedback to improve future content recommendations.</li>
                <li><strong>Bug reports:</strong> If you submit a bug report, we collect your name, email, device type (mobile or browser), and a description of the issue.</li>
                <li><strong>Author profile (admin users only):</strong> If you are an admin who publishes resource articles, we store your display name, headshot URL, organization, and optional contact email for byline display.</li>
                <li><strong>Notification preferences:</strong> Your opt-in/opt-out choices for posting reminders, post published/failed alerts, new comment notifications, analytics milestones, streak warnings, weekly digests, account disconnection alerts, and admin broadcasts.</li>
              </ul>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">1.2 Information Collected Automatically</h3>
              <p className="mb-3">When you use the Service, we automatically collect:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li><strong>Authentication tokens:</strong> JSON Web Tokens (JWTs) used to maintain your session. If you select "Remember Me," the session token persists for up to 30 days; otherwise, it expires after 24 hours.</li>
                <li><strong>Push notification subscriptions:</strong> If you enable push notifications, we store the browser push subscription endpoint and encryption keys (p256dh and auth keys) to deliver notifications to your device.</li>
                <li><strong>Rate limiting data:</strong> We track request counts and timestamps associated with your account email or IP address to prevent abuse, brute-force login attempts, and excessive API calls.</li>
                <li><strong>Usage logs:</strong> Server logs may include IP addresses, request timestamps, and error messages generated by your use of the Service.</li>
                <li><strong>Calendar generation metadata:</strong> When AI content is generated for your calendar, we log success/failure status, number of days generated, freshness scores, diversity metrics, and whether staleness or audience-fatigue safeguards were triggered. We do <strong>not</strong> log the raw AI prompt or your private questionnaire text in these logs.</li>
                <li><strong>Login announcement dismissals:</strong> We record which announcements you have dismissed to avoid showing them again.</li>
              </ul>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">1.3 Social Media Analytics Data</h3>
              <p className="mb-3">When you connect a social media account through our integration partner, Zernio, we retrieve and store the following analytics data from your connected platforms (which may include Instagram, TikTok, LinkedIn, YouTube, and others as enabled):</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li><strong>Post performance metrics:</strong> Views/impressions, likes, comments, post titles (first 120 characters), post URLs, publication dates, and content format (e.g., Reel, Carousel, Static).</li>
                <li><strong>Follower statistics:</strong> Daily follower counts, growth deltas (net new followers per day), and growth percentages per platform.</li>
                <li><strong>Best time to post data:</strong> Heatmap data showing average engagement by day of week and hour, used to recommend optimal posting times.</li>
                <li><strong>Audience demographics:</strong> Age, gender, city, and country breakdowns of your audience where available from the platform.</li>
                <li><strong>Deep analytics:</strong> Account-level insights (reach, views, accounts engaged, total interactions), channel insights, content decay patterns, posting frequency vs. engagement correlations, and daily aggregated metrics.</li>
                <li><strong>Connected account information:</strong> Platform name, handle, Zernio profile ID, Zernio account ID, connection date, and last sync date.</li>
              </ul>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">1.4 AI Memory Data</h3>
              <p className="mb-3">The Service maintains an AI memory system ("Brand Brain") that automatically learns and stores strategic observations about you and your content performance. These memories may include:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Identity memories (business, industry, positioning, personal story)</li>
                <li>Voice memories (tone, language patterns, signature phrases)</li>
                <li>Audience memories (demographics, interests, pain points)</li>
                <li>Content memories (formats, topics, and structures that resonate)</li>
                <li>Performance memories (data-driven insights about what outperforms)</li>
                <li>Strategy memories (goals, CTAs, offers, seasonal rhythms)</li>
                <li>Preference memories (posting cadence, on-camera comfort, format preferences)</li>
                <li>Warning memories (banned words, rejected topics, anti-patterns)</li>
              </ul>
              <p className="mt-3 text-sm">These memories are derived from your questionnaire answers, survey responses, analytics data, and content feedback. You can view, pin, correct, or delete your AI memories at any time from the Brand Brain section of your dashboard. Only memories marked as high importance or pinned by you are included in AI content generation prompts.</p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">1.5 Billing &amp; Subscription Data</h3>
              <p className="text-sm">If you purchase a paid subscription, we store your subscription plan (Calendar Only or Pro), account status (active, trial, past due, canceled, etc.), trial start/end dates, Stripe customer ID, Stripe subscription ID, and Stripe subscription status. Payment card details are processed exclusively by Stripe — we never store full card numbers, CVCs, or other raw payment instrument data on our servers.</p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">1.6 Organization &amp; Team Data</h3>
              <p className="text-sm">If you participate in a team or organization, we store your organization name, slug, seat limit, seat plan, and the role assigned to you within the organization (User, Team Admin, or Admin).</p>
            </section>

            <section id="how-we-use-information">
              <h2 className="text-2xl font-bold text-text-primary mb-4">2. How We Use Your Information</h2>
              <p className="mb-3">We use the information we collect for the following purposes:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li><strong>Account management:</strong> To create and authenticate your account, manage sessions, enforce rate limits, and process password resets.</li>
                <li><strong>AI content generation:</strong> To generate personalized weekly content calendars, hooks, captions, and content recommendations tailored to your brand, industry, goals, and audience. Your questionnaire answers, survey responses, AI memories, and analytics data are used as context for the AI model.</li>
                <li><strong>Analytics &amp; insights:</strong> To retrieve, store, and display your social media performance metrics, follower growth, audience demographics, and best-time-to-post recommendations.</li>
                <li><strong>Content improvement:</strong> To learn from your feedback (thumbs-up/down) and analytics patterns, and to build AI memories that improve the relevance of future content generations.</li>
                <li><strong>Notifications:</strong> To send push notifications and emails about posting reminders, post status, analytics milestones, streak warnings, weekly digests, and account status changes, based on your notification preferences.</li>
                <li><strong>Email communications:</strong> To send transactional emails (account access expiring, account status changes, password resets), broadcast emails (admin-authored content), and service announcements via our email provider, Resend.</li>
                <li><strong>Billing &amp; subscriptions:</strong> To manage your subscription plan, process payments through Stripe, track trial periods, and enforce plan-based feature access.</li>
                <li><strong>Security &amp; abuse prevention:</strong> To detect and prevent unauthorized access, brute-force attacks, fraudulent registrations, and other abusive behavior.</li>
                <li><strong>Customer support:</strong> To respond to bug reports, support inquiries, and account management requests.</li>
                <li><strong>Service improvement:</strong> To analyze usage patterns, identify bugs, and improve features, performance, and user experience.</li>
                <li><strong>Legal compliance:</strong> To comply with applicable legal obligations and respond to lawful requests from authorities.</li>
              </ul>
            </section>

            <section id="ai-processing">
              <h2 className="text-2xl font-bold text-text-primary mb-4">3. AI Processing &amp; Content Generation</h2>
              <p className="mb-3">The Local Post uses artificial intelligence (powered by Anthropic&apos;s Claude models) to generate weekly content calendars and strategic insights. When you request content generation, the following occurs:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>We compile context from your questionnaire, surveys, AI memories (high-importance and pinned items only), analytics data, and content feedback into a structured prompt.</li>
                <li>This prompt is sent to Anthropic&apos;s API for processing. Anthropic processes the data as described in their privacy policy and terms of service.</li>
                <li>The generated content is returned to you in the form of a weekly calendar with day-by-day post recommendations including titles, hooks, body text, calls-to-action, captions, and music suggestions.</li>
                <li>We log metadata about the generation (success, duration, diversity scores) but do not log the raw prompt text or your private questionnaire content in generation logs.</li>
              </ul>
              <p className="mt-3 text-sm"><strong>Your control:</strong> You can influence what data is included in AI prompts by editing your questionnaire, updating or deleting survey responses, and managing (pinning, correcting, or deleting) your AI memories from the Brand Brain dashboard. You are never required to connect social media accounts or complete surveys to use the basic content calendar generation feature.</p>
            </section>

            <section id="social-media">
              <h2 className="text-2xl font-bold text-text-primary mb-4">4. Social Media Analytics &amp; Integrations</h2>
              <p className="mb-3">The Local Post does not directly access your social media accounts. Instead, we use Zernio, a third-party social media management API, to facilitate connections and retrieve analytics. When you connect a social media platform:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>You are redirected to Zernio&apos;s OAuth flow, where you authorize Zernio to access your social media account data. This authorization occurs between you and Zernio — The Local Post does not handle your social media credentials directly.</li>
                <li>Upon successful connection, we store the Zernio profile ID, Zernio account ID, platform name, and handle in our database. We do not store your social media access tokens or passwords.</li>
                <li>When you initiate an analytics sync, we request data from Zernio&apos;s API on your behalf and store the returned analytics (post metrics, follower stats, demographics, best-time data, deep analytics) in our database for display and AI processing.</li>
                <li>You can disconnect any social media account at any time from the Integrations page. Disconnection removes the Zernio account link from our database and prevents future data syncing, though previously synced analytics data will remain in our database until you request its deletion.</li>
              </ul>
              <p className="mt-3 text-sm">Zernio&apos;s access to your social media data is governed by Zernio&apos;s own privacy policy and the terms you agreed to during their OAuth flow. We encourage you to review Zernio&apos;s privacy practices.</p>
            </section>

            <section id="cookies">
              <h2 className="text-2xl font-bold text-text-primary mb-4">5. Cookies, Tokens &amp; Session Management</h2>
              <p className="mb-3">The Local Post uses a minimal cookie and token strategy. We do not use advertising cookies, tracking pixels, or third-party ad networks.</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li><strong>Session JWT:</strong> We issue a JSON Web Token stored as an HTTP-only cookie to authenticate your session. With "Remember Me," this token is valid for up to 30 days. Without it, the token expires after 24 hours. The token contains your user ID, email, role, subscription plan, and session expiry timestamp — but not your password.</li>
                <li><strong>Theme preference:</strong> A cookie or local storage entry may store your light/dark mode preference.</li>
                <li><strong>Service worker:</strong> If you enable push notifications, a service worker is registered in your browser to receive and display notifications. No personal data is stored in the service worker beyond what is necessary for push delivery.</li>
              </ul>
              <p className="mt-3 text-sm">You can clear cookies and local storage at any time through your browser settings. Doing so will log you out and require re-authentication.</p>
            </section>

            <section id="third-party">
              <h2 className="text-2xl font-bold text-text-primary mb-4">6. Third-Party Service Providers</h2>
              <p className="mb-3">We rely on the following third-party services to operate the Service. Each provider has its own privacy policy governing how they handle data:</p>
              <ul className="list-disc list-inside space-y-3 text-sm">
                <li><strong>Supabase (PostgreSQL):</strong> Hosts our primary database. All user data — account information, questionnaire responses, surveys, analytics, AI memories, content archives, and billing metadata — is stored in Supabase&apos;s PostgreSQL database. Data is encrypted in transit (TLS) and at rest.</li>
                <li><strong>Anthropic (Claude AI):</strong> Processes AI content generation requests. When you generate a content calendar or AI insight, structured context from your profile, surveys, memories, and analytics is sent to Anthropic&apos;s API. Anthropic&apos;s data retention and processing is governed by their privacy policy and enterprise terms.</li>
                <li><strong>Zernio:</strong> Facilitates social media account connections (OAuth) and retrieves analytics data from your connected platforms. Zernio handles the direct connection to your social media accounts; we store only the analytics data returned by Zernio&apos;s API.</li>
                <li><strong>Resend:</strong> Handles transactional and broadcast email delivery. When we send you an email, Resend processes the recipient email address, subject, and HTML content. Resend may track delivery status, opens, clicks, bounces, and complaints for email analytics.</li>
                <li><strong>Stripe:</strong> Processes subscription payments. Stripe collects and processes your payment card information directly — we never see or store your full card details. We receive and store Stripe customer IDs, subscription IDs, and subscription status for account management purposes.</li>
                <li><strong>Vercel:</strong> Hosts the web application and may collect usage analytics (page views, visitor geography, device type) as part of its platform infrastructure.</li>
                <li><strong>NextAuth.js / Auth.js:</strong> Provides the authentication framework that manages login, session tokens, and password verification. Authentication data is processed on our servers and stored in our database.</li>
              </ul>
              <p className="mt-3 text-sm">We do not sell your personal information to any third party. We do not share your data with advertising networks or data brokers.</p>
            </section>

            <section id="data-sharing">
              <h2 className="text-2xl font-bold text-text-primary mb-4">7. Data Sharing &amp; Disclosure</h2>
              <p className="mb-3">We may share your information in the following limited circumstances:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li><strong>Service providers:</strong> With the third-party providers listed above, solely to operate and improve the Service.</li>
                <li><strong>Organization members:</strong> If you are part of a team or organization, certain information (such as your name and role) may be visible to other members of the same organization, including team admins who manage seats.</li>
                <li><strong>Admin access:</strong> Our administrative team has access to user accounts for support, management, and platform operation purposes. Admins can view questionnaire data, survey responses, AI memories, analytics, bug reports, and account status information.</li>
                <li><strong>Legal compliance:</strong> If required by law, court order, or government regulation, we may disclose information to the extent necessary to comply with such obligations.</li>
                <li><strong>Business transfers:</strong> In the event of a merger, acquisition, asset sale, or similar transaction, user data may be transferred as part of that transaction. We would notify you via email before any such transfer.</li>
                <li><strong>Safety &amp; security:</strong> To protect the rights, safety, or security of our users, the Service, or the public, including to investigate fraud, security incidents, or violations of our terms.</li>
              </ul>
            </section>

            <section id="data-retention">
              <h2 className="text-2xl font-bold text-text-primary mb-4">8. Data Retention</h2>
              <p className="mb-3">We retain your data for as long as your account is active or as needed to provide the Service. Specifically:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li><strong>Account data:</strong> Retained for the lifetime of your account. If you request account deletion, we will remove your data within 30 days, except where retention is required by law.</li>
                <li><strong>Questionnaire &amp; survey data:</strong> Retained while your account is active. You can update or delete individual survey responses at any time from your profile settings.</li>
                <li><strong>Analytics data:</strong> Post analytics, follower stats, and deep analytics are retained while your account is active. Analytics data older than 90 days may be archived or summarized.</li>
                <li><strong>AI memories:</strong> Retained while your account is active. You can delete individual memories at any time from the Brand Brain dashboard.</li>
                <li><strong>Content archives &amp; feedback:</strong> Retained while your account is active to inform future content generation and avoid repetition.</li>
                <li><strong>Push notification subscriptions:</strong> Retained until you disable notifications or clear browser data. Stale subscriptions may be cleaned up periodically.</li>
                <li><strong>Email logs:</strong> Broadcast email delivery records (status, Resend ID, errors) are retained for delivery auditing purposes.</li>
                <li><strong>Rate limit data:</strong> Expired rate limit entries are automatically purged after their lockout window expires.</li>
                <li><strong>Billing records:</strong> Stripe-related metadata is retained for the lifetime of your account and for as long as required for tax and legal compliance after account closure.</li>
                <li><strong>Calendar generation logs:</strong> Metadata (not raw prompts) is retained for quality monitoring and may be aggregated or purged after 12 months.</li>
              </ul>
              <p className="mt-3 text-sm">To request early deletion of your data, see Section 10 (Your Privacy Rights) or contact us using the details in Section 14.</p>
            </section>

            <section id="data-security">
              <h2 className="text-2xl font-bold text-text-primary mb-4">9. Data Security</h2>
              <p className="mb-3">We implement industry-standard security measures to protect your data:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li><strong>Password hashing:</strong> All passwords are hashed using bcrypt before storage. We never store or transmit passwords in plain text.</li>
                <li><strong>Encryption in transit:</strong> All data transmitted between your browser and our servers uses HTTPS/TLS encryption. Database connections to Supabase are also encrypted in transit.</li>
                <li><strong>Encryption at rest:</strong> Data stored in Supabase&apos;s PostgreSQL database is encrypted at rest.</li>
                <li><strong>JWT-based authentication:</strong> Session tokens are signed with a server-side secret and stored as HTTP-only cookies, preventing cross-site scripting (XSS) theft. Token versioning allows immediate session invalidation on password reset.</li>
                <li><strong>Rate limiting &amp; brute-force protection:</strong> Login attempts are rate-limited (5 attempts before a 15-minute lockout). API actions are rate-limited to prevent abuse.</li>
                <li><strong>Role-based access control:</strong> Admin-only features are gated by server-side role checks. User data is scoped to the authenticated user — no user can access another user&apos;s data unless they share an organization.</li>
                <li><strong>Input validation &amp; sanitization:</strong> User-submitted content (including rich text in resource articles) is validated and sanitized server-side to prevent injection attacks.</li>
                <li><strong>Environment secrets management:</strong> API keys, database credentials, and authentication secrets are stored as environment variables and are never committed to source code or exposed to the client.</li>
              </ul>
              <p className="mt-3 text-sm">No method of transmission or storage is 100% secure. While we strive to protect your data, we cannot guarantee absolute security. In the event of a data breach, we will notify affected users and relevant authorities as required by applicable law.</p>
            </section>

            <section id="your-rights">
              <h2 className="text-2xl font-bold text-text-primary mb-4">10. Your Privacy Rights</h2>
              <p className="mb-3">Depending on your jurisdiction (e.g., California, the EU/EEA, the UK, or other regions with data protection laws), you may have the following rights regarding your personal information:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li><strong>Right to access:</strong> You can request a copy of the personal data we hold about you.</li>
                <li><strong>Right to rectification:</strong> You can correct inaccurate or incomplete information. Most profile data can be updated directly in your dashboard settings.</li>
                <li><strong>Right to deletion:</strong> You can request that we delete your personal data. You can also delete individual surveys, AI memories, and social media connections directly from the dashboard.</li>
                <li><strong>Right to restrict processing:</strong> You can request that we limit how we use your data, particularly if you dispute its accuracy or object to our processing.</li>
                <li><strong>Right to data portability:</strong> You can request a machine-readable copy of your personal data to transfer to another service.</li>
                <li><strong>Right to object:</strong> You can object to certain types of processing, including processing based on legitimate interests or for direct marketing.</li>
                <li><strong>Right to withdraw consent:</strong> Where processing is based on your consent, you can withdraw it at any time without affecting the lawfulness of prior processing.</li>
                <li><strong>Email unsubscribe:</strong> You can opt out of broadcast and marketing emails at any time using the unsubscribe link in any email or from your account settings. Transactional emails (account security, password resets) will continue to be sent.</li>
              </ul>
              <p className="mt-3 text-sm">To exercise any of these rights, contact us using the details in Section 14. We will respond to your request within 30 days. We may need to verify your identity before processing certain requests.</p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">10.1 California Privacy Rights (CCPA/CPRA)</h3>
              <p className="text-sm">If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA) and the California Privacy Rights Act (CPRA), including the right to know what personal information we collect, the right to delete your personal information, the right to correct inaccurate information, the right to opt out of the sale or sharing of your personal information, and the right to limit the use of your sensitive personal information. We do not sell or share your personal information as defined by California law. To exercise these rights, contact us as described in Section 14.</p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">10.2 EU/EEA/UK Rights (GDPR/UK GDPR)</h3>
              <p className="text-sm">If you are located in the European Economic Area, the United Kingdom, or Switzerland, you have rights under the General Data Protection Regulation (GDPR) or the UK GDPR, including the rights listed above. The legal bases we rely on for processing your data include: (a) <strong>contract</strong> — processing necessary to provide the Service you requested; (b) <strong>consent</strong> — for optional processing such as push notifications and marketing emails; (c) <strong>legitimate interests</strong> — for security, fraud prevention, and service improvement; and (d) <strong>legal obligation</strong> — where required by law. If you have a complaint about how we handle your data, you have the right to lodge a complaint with your local data protection authority.</p>
            </section>

            <section id="children">
              <h2 className="text-2xl font-bold text-text-primary mb-4">11. Children&apos;s Privacy</h2>
              <p className="text-sm">The Local Post is intended for use by adults, particularly local professionals, real estate agents, and business owners. The Service is not directed to children under the age of 16, and we do not knowingly collect personal information from children under 16. If you believe we have collected information from a child under 16, please contact us immediately using the details in Section 14, and we will take steps to delete such information.</p>
            </section>

            <section id="international">
              <h2 className="text-2xl font-bold text-text-primary mb-4">12. International Data Transfers</h2>
              <p className="text-sm">The Local Post and its third-party service providers (Supabase, Anthropic, Stripe, Resend, Vercel, Zernio) may process and store your data in the United States and other countries. If you are accessing the Service from outside the United States, your data will be transferred to and processed in the United States. By using the Service, you consent to these transfers. We take reasonable measures to ensure that your data is protected in accordance with this Privacy Policy and applicable data protection laws, including using providers that offer appropriate safeguards such as Standard Contractual Clauses (SCCs) where required.</p>
            </section>

            <section id="changes">
              <h2 className="text-2xl font-bold text-text-primary mb-4">13. Changes to This Privacy Policy</h2>
              <p className="text-sm">We may update this Privacy Policy from time to time to reflect changes in our practices, legal requirements, or the features of the Service. When we make material changes, we will notify you by email and/or by posting a prominent notice within the Service. We will also update the "Last updated" date at the top of this page. Your continued use of the Service after any changes indicates your acceptance of the updated Privacy Policy. We encourage you to review this page periodically.</p>
            </section>

            <section id="contact">
              <h2 className="text-2xl font-bold text-text-primary mb-4">14. Contact Us</h2>
              <p className="text-sm mb-3">If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li><strong>Owner:</strong> Dylan Ballard</li>
                <li><strong>Business:</strong> The Local Post</li>
                <li><strong>Email:</strong> Please use the in-app bug report feature or contact us at the email address provided in your account settings or on our website.</li>
                <li><strong>Postal address:</strong> Available upon request.</li>
              </ul>
              <p className="mt-4 text-sm">We are committed to working with you to resolve any concerns about your privacy and the handling of your personal information.</p>
            </section>

            <section className="border-t border-border-primary pt-8 mt-12">
              <p className="text-xs text-text-muted">
                This Privacy Policy is provided for informational purposes and does not constitute legal advice. While
                this document is designed to be comprehensive and compliant with major privacy frameworks, you should
                consult with a qualified attorney to ensure compliance with all applicable laws specific to your
                jurisdiction and business operations.
              </p>
            </section>
          </div>
        </article>
      </main>
      <PublicFooter />
    </>
  );
}
