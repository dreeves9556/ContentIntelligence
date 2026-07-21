import { Mic, MapPin, Trophy, ShieldCheck, RefreshCw, CalendarClock } from "lucide-react";
import { Reveal } from "@/components/Reveal";

const DIFFERENTIATORS = [
  {
    icon: Mic,
    title: "Learns your brand voice",
    description:
      "Your tone, personality, and style preferences are captured during onboarding and refined with every post.",
  },
  {
    icon: MapPin,
    title: "Uses your local knowledge",
    description:
      "Your city, neighborhood expertise, and community context shape every piece of content the system generates.",
  },
  {
    icon: Trophy,
    title: "Pulls from your offers and proof",
    description:
      "Your services, wins, testimonials, and case studies are woven into content naturally — not as ads, but as stories.",
  },
  {
    icon: ShieldCheck,
    title: "Respects brand and compliance guardrails",
    description:
      "Set banned words, required disclaimers, and tone rules. The system follows your guardrails on every generation.",
  },
  {
    icon: RefreshCw,
    title: "Avoids stale, repetitive content",
    description:
      "A built-in freshness system tracks what you've already posted and actively prevents repetitive themes and hooks.",
  },
  {
    icon: CalendarClock,
    title: "Refreshes with weekly, monthly, and story updates",
    description:
      "New surveys and questionnaires feed the system over time, so your content evolves as your business grows.",
  },
];

export function DifferentiatorSection() {
  return (
    <section className="py-20 bg-background-card border-b border-border-primary">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <Reveal className="text-center mb-12">
          <h2
            className="text-3xl sm:text-4xl font-bold text-text-primary mb-4"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Not another generic AI caption tool.
          </h2>
          <p className="text-lg text-text-muted max-w-2xl mx-auto leading-relaxed">
            Generic AI tools write captions. The Local Post builds a content system around
            your voice, your local market, your proof, your offers, your guardrails, and what
            you have already posted.
          </p>
        </Reveal>

        <Reveal delay={100} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {DIFFERENTIATORS.map((item) => (
            <div
              key={item.title}
              className="bg-background-secondary rounded-xl border border-border-primary p-6"
            >
              <div className="w-10 h-10 rounded-lg bg-accent-primary/10 flex items-center justify-center mb-4">
                <item.icon className="h-5 w-5 text-accent-primary" />
              </div>
              <h3
                className="text-base font-bold text-text-primary mb-2"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {item.title}
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
