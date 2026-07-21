"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { RotatingTagline } from "@/components/RotatingTagline";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background-secondary pt-20 pb-24 sm:pt-28 sm:pb-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center animate-fade-in-up">
        {/* Tagline */}
        <div className="mb-6">
          <RotatingTagline />
        </div>

        {/* Headline */}
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary leading-tight mb-6"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Be the local authority your town reads first.
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-text-muted max-w-2xl mx-auto mb-8 leading-relaxed">
          The Local Post helps real estate agents, local professionals, and growing
          teams turn their expertise, stories, and community knowledge into weekly
          content that builds trust, drives conversations, and keeps them visible.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <a
            href="#pricing"
            className="flex items-center gap-2 px-6 py-3 bg-accent-primary hover:bg-accent-primary/90 text-white font-semibold rounded-lg transition-colors text-base"
          >
            Start Your Membership
            <ArrowRight className="h-5 w-5" />
          </a>
          <a
            href="#features"
            className="flex items-center gap-2 px-6 py-3 bg-background-card hover:bg-background-card/80 border border-border-primary text-text-primary font-semibold rounded-lg transition-colors text-base"
          >
            <Sparkles className="h-5 w-5 text-accent-primary" />
            Explore Features
          </a>
        </div>

        {/* Visual hint */}
        <div className="relative max-w-3xl mx-auto">
          <div className="bg-background-card rounded-xl border border-border-primary shadow-2xl p-6 text-left">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-400/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
              <div className="w-3 h-3 rounded-full bg-green-400/60" />
              <span className="ml-2 text-xs text-text-muted font-mono">thelocalpost.app/dashboard</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-accent-primary">AI</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">Weekly Content Calendar</p>
                  <p className="text-xs text-text-muted">7 posts shaped by your voice, offers, and local market</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-green-500">+</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">Brand Brain Memory</p>
                  <p className="text-xs text-text-muted">Learns your voice, offers, proof, and local context</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-purple-500">~</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">Social Analytics</p>
                  <p className="text-xs text-text-muted">Track engagement across Instagram, TikTok, YouTube, and LinkedIn</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
