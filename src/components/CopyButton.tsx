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
        flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold tracking-wider uppercase
        transition-all duration-200 ease-out
        ${
          copied
            ? "text-green-400 bg-green-400/10 border border-green-400/30"
            : "text-text-muted/60 hover:text-text-primary hover:bg-background-secondary border border-transparent hover:border-background-secondary"
        }
      `}
      aria-label={copied ? "Copied" : `Copy ${displayLabel.toLowerCase()}`}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" />
          {copiedLabel}
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          {displayLabel}
        </>
      )}
    </button>
  );
}
