"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

export default function FacebookInfoAccordion() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-background-card rounded-xl border border-border-primary overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-background-secondary/50"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-blue-600/10 rounded-lg shrink-0">
            <HelpCircle className="h-5 w-5 text-blue-500" />
          </div>
          <span className="font-medium text-text-primary text-sm sm:text-base truncate">
            Why can&apos;t I link my personal Facebook profile?
          </span>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-text-muted shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 space-y-3 text-sm text-text-muted leading-relaxed">
          <p>
            Facebook&apos;s API only allows third-party tools like The Local Post to
            connect to <strong className="text-text-primary">Facebook Pages</strong>,
            not personal profiles. This is a restriction set by Meta (Facebook&apos;s
            parent company), not The Local Post or our analytics partner Zernio.
          </p>

          <p>
            <strong className="text-text-primary">What about Professional Mode?</strong>{" "}
            Turning on Professional Mode on your personal profile unlocks creator
            insights inside Facebook&apos;s own app, but it does{" "}
            <strong className="text-text-primary">not</strong> change how Meta treats
            your profile at the API level. Meta still sees it as a personal profile,
            so third-party tools cannot access its analytics.
          </p>

          <p>
            <strong className="text-text-primary">Why does Instagram work but not Facebook?</strong>{" "}
            Instagram offers Business and Creator account types that expose analytics
            through their API. Facebook does not have an equivalent for personal
            profiles &mdash; only Pages get API-accessible insights.
          </p>

          <p>
            <strong className="text-text-primary">What you can do:</strong> Create a
            Facebook Page for your brand or creator presence. A Page doesn&apos;t
            require a separate business entity &mdash; you can be the sole admin and
            post as yourself. Once connected, The Local Post can pull full analytics for that
            Page. Many creators run a Page alongside their personal profile for this
            reason.
          </p>

          <p>
            <strong className="text-text-primary">What about cross-posted content?</strong>{" "}
            If you post to both Instagram and a Facebook Page, each platform tracks
            its own views and engagement separately. Instagram analytics only reflect
            Instagram activity, and Facebook analytics only reflect Facebook activity.
          </p>
        </div>
      )}
    </div>
  );
}
