"use client";

import { useState } from "react";
import { Check, Loader2, User, Users, Minus, Plus } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import type { BillingInterval } from "@/lib/pricing";
import {
  calculateCommunityTotal,
  formatCurrency,
  COMMUNITY_MIN_SEATS,
  COMMUNITY_MAX_SEATS,
  SOLO_MONTHLY_CENTS,
  SOLO_ANNUAL_CENTS,
} from "@/lib/pricing";

const SOLO_FEATURES: (string | { text: string; emphasized?: boolean })[] = [
  "Full AI content calendar",
  "Weekly content generation",
  "Brand Brain memory system",
  "Deep-dive questionnaires",
  "Content library and resources",
  "Analytics dashboard",
  "Social media integrations",
  "Members-only community access",
  { text: "Bi-Weekly Coaching Calls", emphasized: true },
];

const COMMUNITY_FEATURES = [
  "Everything in Solo Membership",
  "Seat-based access for teams",
  "Team roster management",
  "Admin controls and roles",
  "Add or remove seats anytime",
  "Built for brokerages, offices, sales teams, and local groups",
];

export function PricingSection() {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [seats, setSeats] = useState(3);
  const [orgName, setOrgName] = useState("");
  const [soloLoading, setSoloLoading] = useState(false);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const communityTotal = calculateCommunityTotal(seats, billingInterval);
  const perSeat = seats > 0 ? communityTotal / seats : 0;

  async function handleSoloCheckout() {
    setError(null);
    setSoloLoading(true);
    try {
      const res = await fetch("/api/stripe/public-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseType: "solo", billingInterval }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start checkout");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSoloLoading(false);
    }
  }

  async function handleCommunityCheckout() {
    setError(null);
    if (seats < COMMUNITY_MIN_SEATS) {
      setError(`Communities membership requires at least ${COMMUNITY_MIN_SEATS} seats.`);
      return;
    }
    if (!orgName.trim()) {
      setError("Organization name is required.");
      return;
    }
    setCommunityLoading(true);
    try {
      const res = await fetch("/api/stripe/public-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseType: "community",
          billingInterval,
          seats,
          organizationName: orgName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start checkout");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCommunityLoading(false);
    }
  }

  return (
    <section id="pricing" className="py-20 bg-background-card border-y border-border-primary">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2
            className="text-3xl sm:text-4xl font-bold text-text-primary mb-4"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Choose Your Membership
          </h2>
          <p className="text-lg text-text-muted max-w-2xl mx-auto">
            Start with Solo for your own content, or bring your team with Communities.
          </p>
        </div>

        {/* Billing interval toggle */}
        <div className="flex items-center justify-center gap-2 p-1 bg-background-secondary border border-border-primary rounded-xl w-fit mx-auto mb-10">
          <button
            onClick={() => setBillingInterval("monthly")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              billingInterval === "monthly"
                ? "bg-accent-primary text-white"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval("annual")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              billingInterval === "annual"
                ? "bg-accent-primary text-white"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Annual
            <span className="ml-1 text-xs text-green-400">2 months free</span>
          </button>
        </div>

        {/* Pricing cards */}
        <Reveal className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Solo */}
          <div className="bg-background-secondary rounded-xl border border-border-primary p-6 sm:p-8 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-6 w-6 text-accent-primary" />
              <h3
                className="text-xl font-bold text-text-primary"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Solo Membership
              </h3>
            </div>

            <div className="mb-4">
              <span className="text-3xl font-bold text-text-primary">
                {billingInterval === "monthly"
                  ? formatCurrency(SOLO_MONTHLY_CENTS)
                  : formatCurrency(SOLO_ANNUAL_CENTS)}
              </span>
              <span className="text-sm text-text-muted">
                /{billingInterval === "monthly" ? "month" : "year"}
              </span>
              {billingInterval === "annual" && (
                <p className="text-xs text-green-400 mt-1">Two months free</p>
              )}
            </div>

            <ul className="space-y-2 mb-8 flex-1">
              {SOLO_FEATURES.map((feature) => {
                const text = typeof feature === "string" ? feature : feature.text;
                const emphasized = typeof feature === "object" && feature.emphasized;
                return (
                  <li
                    key={text}
                    className={`flex items-start gap-2 text-sm ${
                      emphasized ? "font-semibold text-text-primary" : "text-text-muted"
                    }`}
                  >
                    <Check className="h-4 w-4 text-accent-primary shrink-0 mt-0.5" />
                    {text}
                  </li>
                );
              })}
            </ul>

            <button
              onClick={handleSoloCheckout}
              disabled={soloLoading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              {soloLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting to checkout…
                </>
              ) : (
                "Start Solo Membership"
              )}
            </button>
          </div>

          {/* Communities */}
          <div className="bg-background-secondary rounded-xl border-2 border-accent-primary/30 p-6 sm:p-8 flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent-primary text-white text-xs font-semibold px-3 py-1 rounded-full">
              For Teams & Brokerages
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Users className="h-6 w-6 text-accent-primary" />
              <h3
                className="text-xl font-bold text-text-primary"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Communities Membership
              </h3>
            </div>

            {/* Seat slider */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-text-primary">Seats</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSeats((s) => Math.max(COMMUNITY_MIN_SEATS, s - 1))}
                    className="w-8 h-8 rounded-lg bg-background-card border border-border-primary flex items-center justify-center hover:border-accent-primary/30 transition-colors"
                  >
                    <Minus className="h-3.5 w-3.5 text-text-primary" />
                  </button>
                  <span className="text-lg font-bold text-text-primary w-8 text-center">
                    {seats}
                  </span>
                  <button
                    onClick={() => setSeats((s) => Math.min(COMMUNITY_MAX_SEATS, s + 1))}
                    className="w-8 h-8 rounded-lg bg-background-card border border-border-primary flex items-center justify-center hover:border-accent-primary/30 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5 text-text-primary" />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={COMMUNITY_MIN_SEATS}
                max={COMMUNITY_MAX_SEATS}
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                className="w-full accent-accent-primary"
              />
              <div className="flex justify-between text-xs text-text-muted mt-1">
                <span>{COMMUNITY_MIN_SEATS} seats</span>
                <span>{COMMUNITY_MAX_SEATS} seats</span>
              </div>
            </div>

            {/* Org name */}
            <div className="mb-4">
              <label className="text-sm font-medium text-text-primary block mb-1">
                Organization name
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Springfield Realty"
                className="w-full px-3 py-2 bg-background-card border border-border-primary rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50"
              />
            </div>

            {/* Price */}
            <div className="mb-4">
              <span className="text-3xl font-bold text-text-primary">
                {formatCurrency(communityTotal)}
              </span>
              <span className="text-sm text-text-muted">
                /{billingInterval === "monthly" ? "month" : "year"}
              </span>
              <p className="text-xs text-text-muted mt-1">
                {formatCurrency(perSeat)}/seat
              </p>
              {billingInterval === "annual" && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-green-400">Two months free</p>
                  <p className="text-xs text-text-muted">
                    Annual pricing equals monthly seat total × 10
                  </p>
                  <p className="text-xs text-text-muted">
                    Monthly equivalent: {formatCurrency(communityTotal / 12)}/mo
                  </p>
                </div>
              )}
            </div>

            <ul className="space-y-2 mb-8 flex-1">
              {COMMUNITY_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-text-muted">
                  <Check className="h-4 w-4 text-accent-primary shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={handleCommunityCheckout}
              disabled={communityLoading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              {communityLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting to checkout…
                </>
              ) : (
                "Start Communities Membership"
              )}
            </button>
          </div>
        </Reveal>

        {error && (
          <p className="text-center text-sm text-red-400 mt-6">{error}</p>
        )}

        <p className="text-center text-xs text-text-muted mt-6">
          Secure checkout powered by Stripe. Cancel anytime.
        </p>
      </div>
    </section>
  );
}
