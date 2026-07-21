import type { Metadata } from "next";
import { PublicHeader } from "@/components/marketing/PublicHeader";
import { Hero } from "@/components/marketing/Hero";
import { SocialProof } from "@/components/marketing/SocialProof";
import { DifferentiatorSection } from "@/components/marketing/DifferentiatorSection";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { PricingSection } from "@/components/marketing/PricingSection";
import { FAQ } from "@/components/marketing/FAQ";
import { PublicFooter } from "@/components/marketing/PublicFooter";

export const metadata: Metadata = {
  title: "The Local Post — AI Content System for Local Professionals",
  description:
    "The Local Post helps real estate agents, local professionals, and growing teams turn their expertise into weekly content that builds trust and keeps them visible in their market.",
  keywords: [
    "real estate marketing",
    "local business marketing",
    "AI content system",
    "local professional",
    "content calendar",
    "social media management",
    "local authority",
  ],
  openGraph: {
    title: "The Local Post — AI Content System for Local Professionals",
    description:
      "Turn your expertise, stories, and community knowledge into weekly content that builds trust and drives conversations.",
    type: "website",
  },
};

export default function Home() {
  return (
    <>
      <PublicHeader />
      <main>
        <Hero />
        <SocialProof />
        <DifferentiatorSection />
        <FeatureGrid />
        <PricingSection />
        <FAQ />
      </main>
      <PublicFooter />
    </>
  );
}
