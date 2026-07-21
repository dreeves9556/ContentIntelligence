"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    question: "What is The Local Post?",
    answer:
      "The Local Post is a content system that helps local professionals — real estate agents, business owners, salespeople, and teams — turn their expertise and community knowledge into weekly content that builds trust and visibility in their market.",
  },
  {
    question: "Is this just an AI caption generator?",
    answer:
      "No. Generic AI tools write captions. The Local Post builds a full content system around your voice, your local market, your proof, your offers, your guardrails, and what you have already posted. Every week you get a complete calendar shaped by everything the system knows about you.",
  },
  {
    question: "Who is this built for?",
    answer:
      "Real estate agents, local business owners, salespeople, and community-facing professionals who want to become the trusted local voice in their market. It also works for teams — brokerages, offices, and local groups who need multiple people contributing content.",
  },
  {
    question: "What is the difference between Solo and Communities?",
    answer:
      "Solo Membership is for one person — full access to the content system, calendar, analytics, and integrations. Communities Membership is for teams — seat-based access with team roster management, admin controls, and the ability to add or remove seats. You get volume pricing as you add seats.",
  },
  {
    question: "Do I need an existing account to purchase?",
    answer:
      "No. You can purchase first. After checkout, you'll receive a setup link to create your Local Post account and complete onboarding.",
  },
  {
    question: "Can I change Community seats later?",
    answer:
      "Yes. You can add or remove seats anytime from your billing dashboard. Seat changes are prorated automatically through Stripe.",
  },
  {
    question: "Can I pay annually?",
    answer:
      "Yes. Both Solo and Communities memberships offer annual billing at a discount — you get two months free compared to monthly pricing. Annual pricing equals the monthly seat total multiplied by ten.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. Your subscription is managed through Stripe and can be cancelled anytime from your billing dashboard. You'll keep access until the end of your billing period.",
  },
  {
    question: "Which social platforms are supported?",
    answer:
      "We support Instagram, TikTok, YouTube, and LinkedIn. Connect your accounts once and sync engagement analytics directly into your dashboard.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 bg-background-secondary">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2
            className="text-3xl sm:text-4xl font-bold text-text-primary mb-4"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, index) => (
            <div
              key={faq.question}
              className="bg-background-card rounded-xl border border-border-primary overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="text-sm font-semibold text-text-primary">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`h-5 w-5 text-text-muted shrink-0 transition-transform ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openIndex === index && (
                <div className="px-5 pb-5">
                  <p className="text-sm text-text-muted leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
