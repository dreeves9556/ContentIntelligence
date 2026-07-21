import { Users, TrendingUp, Globe } from "lucide-react";
import { Reveal } from "@/components/Reveal";

export function SocialProof() {
  return (
    <section className="py-16 bg-background-card border-y border-border-primary">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <Reveal className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div>
            <div className="flex items-center justify-center mb-3">
              <Users className="h-8 w-8 text-accent-primary" />
            </div>
            <p
              className="text-2xl font-bold text-text-primary"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Local Authority
            </p>
            <p className="text-sm text-text-muted mt-1">
              Built for professionals who want to be known, trusted, and remembered in their market.
            </p>
          </div>
          <div>
            <div className="flex items-center justify-center mb-3">
              <TrendingUp className="h-8 w-8 text-accent-primary" />
            </div>
            <p
              className="text-2xl font-bold text-text-primary"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              AI Content System
            </p>
            <p className="text-sm text-text-muted mt-1">
              Weekly content calendars shaped by your voice, offers, proof, and local context.
            </p>
          </div>
          <div>
            <div className="flex items-center justify-center mb-3">
              <Globe className="h-8 w-8 text-accent-primary" />
            </div>
            <p
              className="text-2xl font-bold text-text-primary"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Multi-Platform Ready
            </p>
            <p className="text-sm text-text-muted mt-1">
              Plan content for Instagram, TikTok, YouTube, LinkedIn, and more.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
