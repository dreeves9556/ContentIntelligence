"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";

interface ImpactMetricDrawerProps {
  title: string;
  value: string;
  description: string;
  formula: string;
  sample: string;
  exclusions: string;
}

export default function ImpactMetricDrawer({
  title,
  value,
  description,
  formula,
  sample,
  exclusions,
}: ImpactMetricDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex items-center gap-1 text-left"
        aria-label={`Explain ${title}`}
      >
        <span className="text-xl sm:text-2xl font-bold text-text-primary">{value}</span>
        <Info className="h-3.5 w-3.5 text-text-muted group-hover:text-accent-primary" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${title} details`}>
          <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-label="Close metric details" />
          <div className="relative w-full max-w-lg rounded-xl border border-border-primary bg-background-card p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Metric definition</p>
                <h3 className="mt-1 text-lg font-semibold text-text-primary">{title}</h3>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-text-muted hover:bg-background-secondary hover:text-text-primary" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 text-sm text-text-muted">{description}</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-medium text-text-primary">Formula</dt>
                <dd className="mt-1 text-text-muted">{formula}</dd>
              </div>
              <div>
                <dt className="font-medium text-text-primary">Valid sample</dt>
                <dd className="mt-1 text-text-muted">{sample}</dd>
              </div>
              <div>
                <dt className="font-medium text-text-primary">Exclusions and caveats</dt>
                <dd className="mt-1 text-text-muted">{exclusions}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </>
  );
}
