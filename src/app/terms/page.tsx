import type { Metadata } from "next";
import { PublicHeader } from "@/components/marketing/PublicHeader";
import { PublicFooter } from "@/components/marketing/PublicFooter";

export const metadata: Metadata = {
  title: "Terms of Service — The Local Post",
  description:
    "Terms of Service for The Local Post, governing your access to and use of our website, application, and all related services.",
};

export default function TermsOfServicePage() {
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
              Terms of Service
            </h1>
            <p className="text-sm text-text-muted">
              Last updated: July 28, 2026
            </p>
          </header>

          <div className="space-y-8 text-text-muted leading-relaxed">
            <section>
              <p>
                These Terms of Service (&quot;Terms,&quot; &quot;Agreement&quot;) constitute a legally binding
                agreement between you (&quot;you,&quot; &quot;your,&quot; or &quot;User&quot;) and{" "}
                <strong>The Local Post</strong> (&quot;we,&quot; &quot;us,&quot; &quot;our,&quot; or &quot;the
                Service&quot;), governing your access to and use of the The Local Post website, application, and
                all related services. The Local Post is owned by Core Coaching and Investments LLC and operated
                by Dylan Ballard. The Local Post app and all community resources are owned by Core Coaching and
                Investments LLC.
              </p>
              <p className="mt-4">
                By creating an account, logging in, or using any part of the Service, you acknowledge that you
                have read, understood, and agree to be bound by these Terms. If you do not agree to these Terms,
                you must not access or use the Service.
              </p>
              <p className="mt-4">
                You accept these Terms by clicking &quot;Create Account,&quot; &quot;Start Trial,&quot; or
                &quot;Subscribe&quot; during the registration process, or by otherwise accessing or using the
                Service. If you are using the Service on behalf of a business or organization, you represent and
                warrant that you have the authority to bind that entity to these Terms.
              </p>
            </section>

            <section className="border border-border-primary rounded-lg p-6 bg-background-secondary">
              <h2 className="text-lg font-bold text-text-primary mb-3">Table of Contents</h2>
              <ol className="list-decimal list-inside space-y-1.5 text-sm">
                <li><a href="#eligibility" className="text-accent-primary hover:underline">Eligibility &amp; Account Registration</a></li>
                <li><a href="#service-description" className="text-accent-primary hover:underline">Description of the Service</a></li>
                <li><a href="#subscription" className="text-accent-primary hover:underline">Subscription Plans, Billing &amp; Trials</a></li>
                <li><a href="#acceptable-use" className="text-accent-primary hover:underline">Acceptable Use Policy</a></li>
                <li><a href="#user-content" className="text-accent-primary hover:underline">User Content &amp; AI-Generated Content</a></li>
                <li><a href="#social-media" className="text-accent-primary hover:underline">Social Media Integrations</a></li>
                <li><a href="#intellectual-property" className="text-accent-primary hover:underline">Intellectual Property Rights</a></li>
                <li><a href="#privacy" className="text-accent-primary hover:underline">Privacy &amp; Data Processing</a></li>
                <li><a href="#disclaimers" className="text-accent-primary hover:underline">Disclaimers</a></li>
                <li><a href="#liability" className="text-accent-primary hover:underline">Limitation of Liability</a></li>
                <li><a href="#indemnification" className="text-accent-primary hover:underline">Indemnification</a></li>
                <li><a href="#termination" className="text-accent-primary hover:underline">Termination &amp; Account Suspension</a></li>
                <li><a href="#modifications" className="text-accent-primary hover:underline">Modifications to These Terms</a></li>
                <li><a href="#dispute-resolution" className="text-accent-primary hover:underline">Dispute Resolution &amp; Governing Law</a></li>
                <li><a href="#miscellaneous" className="text-accent-primary hover:underline">Miscellaneous Provisions</a></li>
                <li><a href="#contact" className="text-accent-primary hover:underline">Contact Us</a></li>
              </ol>
            </section>

            <section id="eligibility">
              <h2 className="text-2xl font-bold text-text-primary mb-4">1. Eligibility &amp; Account Registration</h2>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">1.1 Eligibility</h3>
              <p className="mb-3">
                You must be at least 16 years of age to use the Service. By registering, you represent and warrant
                that you are at least 16 years old, that all information you provide is accurate and truthful, and
                that you have the legal capacity to enter into this Agreement. If you are using the Service on
                behalf of a business or organization, you represent and warrant that you have the authority to bind
                that entity to these Terms.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">1.2 Registration</h3>
              <p className="mb-3">
                The Local Post may operate as an invite-only or open-registration platform at its discretion.
                Account registration requires a valid email address and a password. You are responsible for
                maintaining the confidentiality of your login credentials and for all activities that occur under
                your account. You agree to notify us immediately of any unauthorized use of your account or any
                other security breach.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">1.3 Account Types</h3>
              <p className="mb-3">The Service supports the following roles:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li><strong>User:</strong> A standard account holder with access to dashboard features based on their subscription plan.</li>
                <li><strong>Team Admin:</strong> A user with administrative privileges over an organization, including seat management and team invitations.</li>
                <li><strong>Admin:</strong> A platform administrator with full access to all accounts, content, and system configuration.</li>
              </ul>
              <p className="mt-3 text-sm">We reserve the right to assign, modify, or revoke roles at our discretion.</p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">1.4 One Person, One Account</h3>
              <p className="text-sm">
                Each user may maintain only one account. Sharing accounts, transferring accounts, or creating
                multiple accounts to circumvent plan limitations is prohibited.
              </p>
            </section>

            <section id="service-description">
              <h2 className="text-2xl font-bold text-text-primary mb-4">2. Description of the Service</h2>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">2.1 Overview</h3>
              <p className="mb-3">
                The Local Post is an AI-powered content strategy and social media intelligence platform designed
                for local professionals, real estate agents, and growing teams. The Service provides:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>AI-generated weekly content calendars tailored to your brand, industry, and goals</li>
                <li>Social media analytics aggregation across connected platforms</li>
                <li>Audience demographics and performance insights</li>
                <li>AI memory system (&quot;Brand Brain&quot;) that learns your preferences and content patterns</li>
                <li>Content library with archived posts and admin-authored educational resources</li>
                <li>Profile surveys for deep brand context</li>
                <li>Push notifications and email communications</li>
                <li>Team and organization management (for eligible plans)</li>
              </ul>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">2.2 Service Availability</h3>
              <p className="text-sm">
                We strive to maintain high availability but do not guarantee uninterrupted access. The Service may
                be temporarily unavailable due to scheduled maintenance, system updates, third-party provider
                outages, or events beyond our control. We are not liable for any downtime, data loss, or service
                interruptions.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">2.3 Feature Changes</h3>
              <p className="text-sm">
                We may add, modify, or remove features at any time without prior notice. We will make reasonable
                efforts to notify users of significant feature changes that affect their subscription or workflow.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">2.4 Beta &amp; Experimental Features</h3>
              <p className="text-sm">
                Some features may be offered in beta or experimental form. These features may be unstable, may
                change frequently, and may be discontinued at any time. You use beta features at your own risk.
              </p>
            </section>

            <section id="subscription">
              <h2 className="text-2xl font-bold text-text-primary mb-4">3. Subscription Plans, Billing &amp; Trials</h2>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">3.1 Plans</h3>
              <p className="mb-3">The Service offers the following subscription plans (subject to change):</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li><strong>Calendar Only:</strong> Access to AI content calendar generation. Does not include analytics, social media integrations, or other premium features.</li>
                <li><strong>Pro:</strong> Full access to all features including analytics, social media integrations, unlimited connected accounts, deep analytics, and all premium capabilities.</li>
              </ul>
              <p className="mt-3 text-sm">
                Plan features and pricing are displayed on our pricing page and may be updated at any time. Changes
                to pricing apply to new subscriptions and renewals, not to active billing cycles unless otherwise
                stated.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">3.2 Billing</h3>
              <p className="text-sm">
                Paid subscriptions are billed through Stripe, our payment processor. Depending on your plan, billing
                may be monthly or annual. By subscribing, you authorize us to charge your payment method for the
                subscription fees and any applicable taxes until you cancel. If a payment fails, we may retry the
                charge, downgrade your account, or suspend access. Past-due accounts may be restricted from using
                premium features until payment is resolved.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">3.3 Free Trial</h3>
              <p className="mb-3 text-sm">The Service may offer a 7-day free trial on eligible plans. Trial terms:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>A valid payment method is required to start a trial.</li>
                <li>You will not be charged during the trial period.</li>
                <li>If you cancel within the first 7 days, you will not be charged.</li>
                <li>If you do not cancel before the trial ends, your payment method will be charged for the next billing cycle.</li>
                <li>Free trials are limited to one per user. Users who have previously used a trial are not eligible for additional trials.</li>
              </ul>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">3.4 Plan Downgrades &amp; Cancellations</h3>
              <p className="text-sm">
                You may cancel your subscription at any time. Cancellations take effect at the end of your current
                billing cycle — you will retain access until then. Refunds for partial billing periods are not
                provided unless required by law. Downgrading from Pro to Calendar Only will result in the loss of
                access to analytics, integrations, and other premium features. Previously synced analytics data and
                AI memories will be retained but may not be accessible until you upgrade again.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">3.5 Auto-Renewal</h3>
              <p className="text-sm">
                Paid subscriptions automatically renew at the end of each billing cycle (monthly or annual) unless
                you cancel before the renewal date. You can cancel auto-renewal at any time from your account
                settings. Upon cancellation, you will receive a confirmation email. Annual subscribers will be
                notified at least 30 days before each renewal with the current pricing and instructions for
                cancellation. If you do not cancel before the renewal date, your payment method will be charged for
                the next billing cycle.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">3.6 Price Changes</h3>
              <p className="text-sm">
                We may change subscription fees with reasonable advance notice. If you do not agree to a price
                change, you may cancel your subscription before the change takes effect. Continued use after the
                effective date constitutes acceptance of the new pricing.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">3.7 Taxes</h3>
              <p className="text-sm">
                You are responsible for any applicable sales, use, or value-added taxes associated with your
                subscription, except where we are legally required to collect and remit them.
              </p>
            </section>

            <section id="acceptable-use">
              <h2 className="text-2xl font-bold text-text-primary mb-4">4. Acceptable Use Policy</h2>
              <p className="mb-3">You agree not to use the Service to:</p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">4.1 Violate Laws or Rights</h3>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Violate any applicable local, state, national, or international law or regulation.</li>
                <li>Infringe upon the intellectual property rights, privacy rights, or other rights of any person or entity.</li>
                <li>Use the Service for any illegal, fraudulent, or deceptive purpose.</li>
              </ul>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">4.2 Abuse the Platform</h3>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Attempt to gain unauthorized access to any part of the Service, other accounts, or our systems.</li>
                <li>Use bots, scrapers, or automated tools to access the Service except through officially supported APIs.</li>
                <li>Circumvent rate limits, security measures, or authentication mechanisms.</li>
                <li>Interfere with or disrupt the Service, servers, or networks connected to the Service.</li>
                <li>Attempt to reverse engineer, decompile, or disassemble any part of the Service.</li>
              </ul>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">4.3 Harm Others</h3>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Upload, post, or transmit content that is defamatory, obscene, hateful, discriminatory, threatening, or harassing.</li>
                <li>Impersonate any person or entity or falsely represent your affiliation.</li>
                <li>Distribute viruses, malware, or any other malicious code.</li>
                <li>Collect or store personal information about other users without their consent.</li>
              </ul>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">4.4 Misuse of AI Features</h3>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Use AI-generated content to deceive, defraud, or mislead audiences.</li>
                <li>Generate content that promotes illegal activities, violence, or harm.</li>
                <li>Use the Service to generate content for platforms or audiences in violation of those platforms&apos; own terms of service.</li>
                <li>Attempt to extract, replicate, or redistribute the Service&apos;s AI models, prompts, or proprietary algorithms.</li>
              </ul>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">4.5 Violate Social Media Platform Terms</h3>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Use the Service in a manner that violates the terms of service of any social media platform you connect (e.g., Instagram, TikTok, LinkedIn, YouTube).</li>
                <li>Use analytics data obtained through the Service to circumvent platform restrictions or engage in prohibited automated activity.</li>
              </ul>

              <p className="mt-4 text-sm">
                We reserve the right to investigate violations and take appropriate action, including warning users,
                suspending accounts, terminating access, reporting to authorities, and pursuing legal remedies.
              </p>
            </section>

            <section id="user-content">
              <h2 className="text-2xl font-bold text-text-primary mb-4">5. User Content &amp; AI-Generated Content</h2>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">5.1 Your Content</h3>
              <p className="mb-3">
                You retain ownership of all content you submit to the Service, including questionnaire responses,
                survey answers, profile information, bug reports, and any content you upload. By submitting content,
                you grant us a non-exclusive, worldwide, royalty-free license to use, process, store, and display
                your content solely for the purpose of operating and improving the Service for you.
              </p>
              <p className="mb-3 text-sm">You represent and warrant that:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>You own or have the necessary rights to all content you submit.</li>
                <li>Your content does not violate any law or third-party rights.</li>
                <li>Your content does not contain malicious code or harmful elements.</li>
              </ul>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">5.2 AI-Generated Content</h3>
              <p className="mb-3 text-sm">
                The Service generates content using artificial intelligence (Anthropic&apos;s Claude models) based on
                your inputs. The Service uses large language models to generate draft content recommendations. You
                are interacting with an AI system when using content generation features. You acknowledge that:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>AI-generated content may contain inaccuracies, errors, or inappropriate suggestions.</li>
                <li>AI-generated content is provided for informational and creative inspiration purposes only.</li>
                <li>You are solely responsible for reviewing, editing, and approving all AI-generated content before publishing it on any platform.</li>
                <li>We do not guarantee that AI-generated content will be accurate, appropriate, effective, or free from bias.</li>
                <li>You bear full responsibility for the consequences of publishing AI-generated content.</li>
                <li>AI-generated content may not be eligible for copyright protection under U.S. law, as works generated entirely by AI without meaningful human authorship may not be registrable.</li>
              </ul>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">5.3 Ownership of AI-Generated Outputs</h3>
              <p className="mb-3 text-sm">
                You own the content you create based on AI-generated outputs, to the extent permitted by applicable
                law. We grant you a license to use, edit, modify, and publish AI-generated content for your personal
                or business purposes. We do not claim ownership of AI-generated outputs. However, you acknowledge
                that:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>AI-generated content is probabilistic and the Service may generate similar or substantially similar content for other users.</li>
                <li>We do not guarantee that AI-generated outputs are unique to you.</li>
                <li>We retain the right to use anonymized, aggregated patterns from content generation to improve the Service.</li>
                <li>This license terminates upon cancellation or termination of your account.</li>
              </ul>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">5.4 AI Model Training Data Disclosure</h3>
              <p className="text-sm">
                We do <strong>NOT</strong> use your personal data, questionnaire responses, survey answers, AI
                memories, content feedback, or AI-generated outputs to train, fine-tune, or improve any AI models.
                Your data is sent to Anthropic&apos;s API solely for generating your content. Anthropic&apos;s
                commercial API terms prohibit the use of customer data for model training. We may use anonymized,
                aggregated usage patterns to improve our own Service features (e.g., content diversity algorithms),
                but this aggregated data is not linked to your identity.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">5.5 Content Feedback</h3>
              <p className="text-sm">
                When you provide thumbs-up or thumbs-down feedback on generated content, you grant us permission to
                use that feedback to improve the Service&apos;s content generation for your account and to aggregate
                anonymized feedback for service-wide improvement.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">5.6 Content Removal</h3>
              <p className="text-sm">
                You can delete your content, surveys, AI memories, and content archives at any time from your
                dashboard. Deleted content is removed from active display but may persist in backups for a limited
                period as described in our Privacy Policy.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">5.7 No Monitoring Obligation</h3>
              <p className="text-sm">
                We do not actively monitor user content or AI-generated content. However, we reserve the right to
                review, modify, or remove content that we believe violates these Terms or is otherwise harmful.
              </p>
            </section>

            <section id="social-media">
              <h2 className="text-2xl font-bold text-text-primary mb-4">6. Social Media Integrations</h2>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">6.1 Third-Party Platform Connections</h3>
              <p className="mb-3 text-sm">
                The Service integrates with social media platforms (including but not limited to Instagram, TikTok,
                LinkedIn, and YouTube) through our integration partner, Zernio. When you connect a social media
                account:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>You authorize Zernio to access your social media data through the platform&apos;s OAuth process.</li>
                <li>The connection and data access are governed by the respective platform&apos;s terms of service and API policies.</li>
                <li>We are not responsible for any actions taken by social media platforms in response to your use of their data.</li>
              </ul>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">6.2 Analytics Data</h3>
              <p className="text-sm">
                Analytics data displayed in the Service is retrieved from social media platforms via Zernio&apos;s
                API. We do not guarantee the accuracy, completeness, or timeliness of analytics data. Analytics data
                may be delayed, cached, or subject to limitations imposed by the underlying platforms.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">6.3 Platform Changes</h3>
              <p className="text-sm">
                Social media platforms may change their APIs, data access policies, or terms of service at any time,
                which may affect our ability to retrieve analytics or maintain integrations. We are not liable for
                any loss of functionality resulting from third-party platform changes.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">6.4 Disconnection</h3>
              <p className="text-sm">
                You may disconnect any social media account at any time. Disconnection prevents future data syncing
                but does not automatically delete previously synced data. You may request deletion of synced data by
                contacting us.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">6.5 Compliance with Platform Terms</h3>
              <p className="text-sm">
                You are solely responsible for ensuring that your use of the Service complies with the terms of
                service of each social media platform you connect. We are not responsible for any penalties,
                suspensions, or account actions imposed by social media platforms.
              </p>
            </section>

            <section id="intellectual-property">
              <h2 className="text-2xl font-bold text-text-primary mb-4">7. Intellectual Property Rights</h2>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">7.1 Our Intellectual Property</h3>
              <p className="text-sm">
                The Service, including its design, features, functionality, code, AI prompts, algorithms, branding,
                content (excluding user-submitted content), and all related intellectual property, is owned by Core
                Coaching and Investments LLC and operated by Dylan Ballard. The Local Post app and all community
                resources are owned by Core Coaching and Investments LLC. All intellectual property is protected by
                applicable copyright, trademark, patent, and other intellectual property laws.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">7.2 Trademarks</h3>
              <p className="text-sm">
                &quot;The Local Post,&quot; the The Local Post logo, and other marks associated with the Service are
                our trademarks. You may not use our trademarks without our prior written consent, except as necessary
                to refer to the Service for its intended purpose.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">7.3 License to Use</h3>
              <p className="text-sm">
                We grant you a limited, non-exclusive, non-transferable, revocable license to access and use the
                Service for your personal or business use during the term of your active subscription, subject to
                these Terms. This license terminates automatically upon cancellation, expiration, or termination of
                your account.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">7.4 No Reverse Engineering</h3>
              <p className="text-sm">
                You may not copy, modify, distribute, sell, lease, lend, or otherwise exploit the Service or any part
                of it. You may not reverse engineer, decompile, disassemble, or attempt to derive the source code of
                the Service, except to the extent permitted by applicable law.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">7.5 Feedback</h3>
              <p className="text-sm">
                If you provide feedback, suggestions, or ideas about the Service (&quot;Feedback&quot;), you grant us
                a perpetual, irrevocable, worldwide, royalty-free license to use, implement, and commercialize that
                Feedback without any obligation or compensation to you.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">7.6 Resource Library Content</h3>
              <p className="text-sm">
                Educational articles and resources published in the Service&apos;s Content Library are authored by our
                admin team and are provided for your personal, non-commercial use. You may not reproduce, distribute,
                or commercially exploit these resources without our written consent.
              </p>
            </section>

            <section id="privacy">
              <h2 className="text-2xl font-bold text-text-primary mb-4">8. Privacy &amp; Data Processing</h2>
              <p className="mb-3 text-sm">
                Your use of the Service is also governed by our Privacy Policy, which describes how we collect, use,
                store, and protect your personal information. The Privacy Policy is incorporated into these Terms by
                reference. You acknowledge that you have reviewed and agree to the practices described in our Privacy
                Policy.
              </p>
              <p className="mb-3 text-sm">Key points:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>We do not sell your personal information.</li>
                <li>We use third-party providers (Supabase, Anthropic, Zernio, Resend, Stripe, Vercel) to operate the Service.</li>
                <li>AI content generation sends structured context from your profile to Anthropic&apos;s API. We do not use your data to train AI models.</li>
                <li>You can manage and delete your data, including AI memories and social media connections, from your dashboard.</li>
                <li>A Data Processing Agreement (DPA) is available for enterprise and business customers subject to GDPR. Contact us to request a copy.</li>
              </ul>
            </section>

            <section id="disclaimers">
              <h2 className="text-2xl font-bold text-text-primary mb-4">9. Disclaimers</h2>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">9.1 &quot;As Is&quot; Basis</h3>
              <p className="mb-3 text-sm">
                THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS, WITHOUT
                WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW,
                WE DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Implied warranties of merchantability and fitness for a particular purpose.</li>
                <li>Warranties that the Service will be uninterrupted, error-free, secure, or compatible with your device.</li>
                <li>Warranties regarding the accuracy, reliability, or completeness of AI-generated content or analytics data.</li>
                <li>Warranties that the Service will meet your specific requirements or expectations.</li>
              </ul>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">9.2 AI Content Disclaimer</h3>
              <p className="text-sm">
                AI-generated content may contain errors, biases, or inappropriate suggestions. You must independently
                review and verify all AI-generated content before use. We are not responsible for any damages or
                consequences arising from your use of AI-generated content.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">9.3 Analytics Disclaimer</h3>
              <p className="text-sm">
                Social media analytics data is retrieved from third-party platforms and may be incomplete, delayed,
                or inaccurate. We do not guarantee the accuracy of analytics data and are not liable for decisions
                made based on such data.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">9.4 Third-Party Services</h3>
              <p className="text-sm">
                The Service relies on third-party providers (Supabase, Anthropic, Zernio, Resend, Stripe, Vercel).
                We are not responsible for the actions, omissions, or failures of these third parties. Your use of
                third-party services may be subject to their own terms and policies.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">9.5 No Professional Advice</h3>
              <p className="text-sm">
                The Service provides content strategy tools and educational resources. This is not professional
                advice (legal, financial, tax, marketing, or otherwise). You should consult qualified professionals
                before making decisions based on content or insights from the Service.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">9.6 Third-Party Links</h3>
              <p className="text-sm">
                The Service may contain links to third-party websites, including post URLs and resource article
                references. We are not responsible for the content, privacy practices, or terms of third-party
                websites. You access third-party websites at your own risk.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">9.7 Force Majeure</h3>
              <p className="text-sm">
                We are not liable for any delay or failure to perform our obligations under these Terms when such
                delay or failure is caused by events beyond our reasonable control, including but not limited to
                natural disasters, war, terrorism, civil unrest, pandemics, government actions, labor disputes,
                power outages, internet or network failures, or third-party service outages.
              </p>
            </section>

            <section id="liability">
              <h2 className="text-2xl font-bold text-text-primary mb-4">10. Limitation of Liability</h2>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">10.1 General Limitation</h3>
              <p className="mb-3 text-sm">
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL CORE COACHING AND INVESTMENTS
                LLC, THE LOCAL POST, DYLAN BALLARD, OR ANY OF OUR AFFILIATES, OFFICERS, EMPLOYEES, AGENTS, OR
                PARTNERS BE LIABLE FOR:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Indirect, incidental, special, consequential, or punitive damages.</li>
                <li>Loss of profits, revenue, business, data, or goodwill.</li>
                <li>Damages resulting from your inability to use the Service.</li>
                <li>Damages resulting from the accuracy or inaccuracy of AI-generated content or analytics data.</li>
                <li>Damages resulting from third-party actions, including social media platform changes or outages.</li>
              </ul>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">10.2 Liability Cap</h3>
              <p className="text-sm">
                OUR TOTAL AGGREGATE LIABILITY ARISING FROM OR RELATED TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED
                THE GREATER OF (A) THE TOTAL AMOUNT YOU HAVE PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE
                CLAIM, OR (B) FIFTY U.S. DOLLARS ($50).
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">10.3 Exclusions</h3>
              <p className="text-sm">
                Some jurisdictions do not allow the exclusion or limitation of certain damages or warranties. In
                such cases, the above limitations apply to the fullest extent permitted by law.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">10.4 User Responsibility</h3>
              <p className="text-sm">
                You acknowledge that you are responsible for your use of the Service, including any content you
                publish based on AI-generated recommendations, and that you bear the risk of using the Service.
              </p>
            </section>

            <section id="indemnification">
              <h2 className="text-2xl font-bold text-text-primary mb-4">11. Indemnification</h2>
              <p className="mb-3 text-sm">
                You agree to indemnify, defend, and hold harmless Core Coaching and Investments LLC, The Local Post,
                Dylan Ballard, and our affiliates, officers, employees, agents, and partners from and against any and
                all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys&apos;
                fees) arising from:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Your use of or inability to use the Service.</li>
                <li>Your violation of these Terms or any applicable law.</li>
                <li>Your violation of any third-party rights, including intellectual property or privacy rights.</li>
                <li>Content you submit, publish, or distribute through or in connection with the Service.</li>
                <li>Your use of AI-generated content, including publishing it on social media platforms.</li>
                <li>Your connection to or use of social media platforms through the Service.</li>
                <li>Any inaccurate or misleading information you provide.</li>
                <li>Your breach of any social media platform&apos;s terms of service.</li>
              </ul>
              <p className="mt-4 text-sm">
                We reserve the right to assume the exclusive defense and control of any matter subject to
                indemnification. We will use reasonable efforts to notify you of any such claim.
              </p>
            </section>

            <section id="termination">
              <h2 className="text-2xl font-bold text-text-primary mb-4">12. Termination &amp; Account Suspension</h2>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">12.1 Termination by You</h3>
              <p className="mb-3 text-sm">
                You may cancel your account at any time by contacting us or through your account settings. Upon
                cancellation:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Your subscription will remain active until the end of your current billing cycle.</li>
                <li>Your data will be retained for 30 days after cancellation, after which it may be permanently deleted.</li>
                <li>You may request earlier data deletion by contacting us.</li>
              </ul>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">12.2 Termination by Us</h3>
              <p className="mb-3 text-sm">
                We may suspend, restrict, or terminate your account and access to the Service at any time, with or
                without cause and with or without notice, including if:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>You violate these Terms or any applicable law.</li>
                <li>You engage in fraudulent, abusive, or harmful behavior.</li>
                <li>Your account is inactive for an extended period.</li>
                <li>We are required to do so by law or legal process.</li>
                <li>We discontinue the Service or a particular feature.</li>
              </ul>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">12.3 Effect of Termination</h3>
              <p className="mb-3 text-sm">Upon termination:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Your right to use the Service ceases immediately.</li>
                <li>All licenses granted to you under these Terms terminate.</li>
                <li>We may delete your data in accordance with our Privacy Policy and data retention policy.</li>
                <li>Provisions of these Terms that by their nature should survive termination shall survive, including intellectual property, disclaimers, limitation of liability, and indemnification.</li>
              </ul>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">12.4 Account Status Management</h3>
              <p className="text-sm">
                We may manage account statuses (active, trial, past due, canceled, expired, archived) based on
                payment status, trial expiration, or administrative decisions. Account access may be downgraded or
                restricted based on your subscription status. We will make reasonable efforts to notify you of
                significant status changes via email.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">12.5 Survival of Obligations</h3>
              <p className="text-sm">
                Sections regarding intellectual property, disclaimers, limitation of liability, indemnification, and
                dispute resolution survive termination of your account.
              </p>
            </section>

            <section id="modifications">
              <h2 className="text-2xl font-bold text-text-primary mb-4">13. Modifications to These Terms</h2>
              <p className="text-sm">
                We may modify these Terms at any time. When we make material changes, we will provide at least 30
                days&apos; advance notice by email and/or by posting a prominent notice within the Service. We will
                also update the &quot;Last updated&quot; date at the top of this document. Your continued use of the
                Service after the effective date of any changes constitutes your acceptance of the revised Terms. If
                you do not agree to the modified Terms, you must stop using the Service and cancel your account. For
                material changes to arbitration, pricing, or data use provisions, we may require you to affirmatively
                accept the revised Terms by clicking an acceptance button.
              </p>
              <p className="mt-4 text-sm">
                Prior versions of these Terms are archived and available upon request. We encourage you to review
                these Terms periodically to stay informed of any changes.
              </p>
            </section>

            <section id="dispute-resolution">
              <h2 className="text-2xl font-bold text-text-primary mb-4">14. Dispute Resolution &amp; Governing Law</h2>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">14.1 Governing Law</h3>
              <p className="text-sm">
                These Terms and any dispute arising from or relating to them or the Service shall be governed by and
                construed in accordance with the laws of the Commonwealth of Kentucky, United States of America,
                without regard to conflict of law principles. Disputes shall be resolved in the state or federal
                courts located in Kentucky.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">14.2 Informal Resolution</h3>
              <p className="text-sm">
                Before filing any formal dispute, we encourage you to contact us first to seek an informal resolution.
                We will make good-faith efforts to resolve your concern promptly.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">14.3 Binding Arbitration</h3>
              <p className="text-sm">
                If we cannot resolve a dispute informally, any dispute, claim, or controversy arising from or
                relating to these Terms or the Service shall be resolved by binding arbitration rather than in court,
                except that you may bring claims in small claims court if they qualify. Arbitration shall be
                conducted by a single arbitrator under the rules of a mutually agreed arbitration association. The
                arbitrator&apos;s decision shall be final and binding, and judgment may be entered on it in any court
                of competent jurisdiction.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">14.4 Class Action Waiver</h3>
              <p className="text-sm">
                You and we agree that each may bring claims against the other only in an individual capacity, and not
                as a plaintiff or class member in any class, consolidated, or representative proceeding.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">14.5 Equitable Relief</h3>
              <p className="text-sm">
                Notwithstanding the arbitration provision, either party may seek injunctive or other equitable relief
                in a court of competent jurisdiction to protect intellectual property rights or confidential
                information.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">14.6 Severability</h3>
              <p className="text-sm">
                If any provision of these Terms is found to be unenforceable or invalid, that provision will be
                limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in
                full force and effect.
              </p>
            </section>

            <section id="miscellaneous">
              <h2 className="text-2xl font-bold text-text-primary mb-4">15. Miscellaneous Provisions</h2>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">15.1 Entire Agreement</h3>
              <p className="text-sm">
                These Terms, together with the Privacy Policy, constitute the entire agreement between you and Core
                Coaching and Investments LLC regarding the Service, and supersede all prior or contemporaneous
                agreements, communications, and understandings, whether written or oral, regarding the subject matter
                herein.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">15.2 Assignment</h3>
              <p className="text-sm">
                You may not assign, transfer, or sublicense these Terms or your rights hereunder without our prior
                written consent. We may assign or transfer these Terms freely, in whole or in part, without
                restriction. Any attempted assignment by you in violation of this section is void.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">15.3 No Waiver</h3>
              <p className="text-sm">
                Our failure to exercise or enforce any right or provision of these Terms is not a waiver of that
                right or provision. No waiver is effective unless in writing and signed by us.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">15.4 Relationship of the Parties</h3>
              <p className="text-sm">
                You and Core Coaching and Investments LLC are independent contractors. No partnership, joint venture,
                agency, fiduciary, or employment relationship is created by these Terms or your use of the Service.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">15.5 DMCA / Copyright Takedown Policy</h3>
              <p className="text-sm">
                We respect the intellectual property rights of others. If you believe that content on the Service
                infringes your copyright, please contact us with the following information: (a) identification of the
                copyrighted work claimed to have been infringed, (b) identification of the infringing material and
                its location on the Service, (c) your contact information, (d) a statement that you have a good-faith
                belief that the use is not authorized by the copyright owner, and (e) a statement under penalty of
                perjury that the information is accurate and that you are authorized to act on the copyright
                owner&apos;s behalf. We will remove infringing content upon verification.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">15.6 Notices</h3>
              <p className="text-sm">
                Legal notices to Core Coaching and Investments LLC should be sent to the postal address listed in
                Section 16. For legal notices, please include &quot;Legal Notice — The Local Post&quot; in the
                subject line.
              </p>
            </section>

            <section id="contact">
              <h2 className="text-2xl font-bold text-text-primary mb-4">16. Contact Us</h2>
              <p className="text-sm mb-3">
                If you have any questions, concerns, or notices regarding these Terms of Service, please contact us:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li><strong>Legal Entity:</strong> Core Coaching and Investments LLC</li>
                <li><strong>Operator:</strong> Dylan Ballard</li>
                <li><strong>Business:</strong> The Local Post</li>
                <li><strong>Email:</strong> Dylanballard@kw.com</li>
                <li><strong>Postal address:</strong> 1110 Kirksville Road, Richmond, KY 40475</li>
              </ul>
            </section>

            <section className="border-t border-border-primary pt-8 mt-12">
              <p className="text-xs text-text-muted">
                This Terms of Service is provided for informational purposes and does not constitute legal advice.
                While this document is designed to be comprehensive and address common legal considerations for SaaS
                platforms, you should consult with a qualified attorney to ensure compliance with all applicable laws
                specific to your jurisdiction and business operations.
              </p>
            </section>
          </div>
        </article>
      </main>
      <PublicFooter />
    </>
  );
}
