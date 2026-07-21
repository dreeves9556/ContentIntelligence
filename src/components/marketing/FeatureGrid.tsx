import { Calendar, Brain, BarChart3, Library, Settings, Share2 } from "lucide-react";
import { Reveal } from "@/components/Reveal";

const FEATURES = [
  {
    icon: Calendar,
    title: "AI Content Calendar",
    description:
      "Generate a full week of platform-native content in seconds. Each post includes hooks, captions, and calls to action tailored to your local market.",
  },
  {
    icon: Brain,
    title: "Brand Brain Memory",
    description:
      "The system learns your voice, goals, offers, and audience through questionnaires and surveys. Every generation gets smarter over time.",
  },
  {
    icon: BarChart3,
    title: "Social Analytics",
    description:
      "Sync engagement data from Instagram, TikTok, YouTube, and LinkedIn. See what resonates and feed insights back into your calendar.",
  },
  {
    icon: Library,
    title: "Content Library",
    description:
      "Archive of all generated content, plus member-only resources. Search, filter, and repurpose your best-performing posts.",
  },
  {
    icon: Share2,
    title: "Multi-Platform Publishing",
    description:
      "Connect your social accounts in one place. Plan and schedule across all your platforms from a single dashboard.",
  },
  {
    icon: Settings,
    title: "Deep Brand Settings",
    description:
      "Configure your industry, tone, anti-brand words, and content goals. The system respects your guardrails on every generation.",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="py-20 bg-background-secondary">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2
            className="text-3xl sm:text-4xl font-bold text-text-primary mb-4"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Everything you need to show up like a local expert.
          </h2>
          <p className="text-lg text-text-muted max-w-2xl mx-auto">
            From content planning to analytics, The Local Post is your complete
            content system for building local authority.
          </p>
        </div>

        <Reveal className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="bg-background-card rounded-xl border border-border-primary p-6 hover:border-accent-primary/30 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-accent-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-accent-primary" />
              </div>
              <h3
                className="text-lg font-bold text-text-primary mb-2"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {feature.title}
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
