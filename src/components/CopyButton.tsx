"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyButtonProps {
  text: string;
  label?: string;
}

export function CopyButton({ text, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const displayLabel = label ?? "Copy";
  const copiedLabel = label ? `Copied ${label.replace(/^Copy /, "").toLowerCase()}` : "Copied";

  return (
    <button
      onClick={handleCopy}
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold tracking-wider uppercase
        transition-all duration-200 ease-out
        ${
          copied
            ? "text-green-400 bg-green-400/10 border border-green-400/30"
            : "text-text-muted/60 hover:text-text-primary hover:bg-background-secondary border border-transparent hover:border-border-primary"
        }
      `}
      aria-label={copied ? "Copied" : `Copy ${displayLabel.toLowerCase()}`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          {copiedLabel}
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          {displayLabel}
        </>
      )}
    </button>
  );
}
