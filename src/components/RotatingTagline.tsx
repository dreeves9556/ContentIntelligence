"use client";

import { useEffect, useState } from "react";

const TAGLINES = [
  "Your town. Your post.",
  "Be the local expert.",
  "The front page of your market.",
  "Every town needs a trusted voice. Become it.",
];

export function RotatingTagline({ intervalMs = 4000 }: { intervalMs?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % TAGLINES.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return (
    <p
      key={index}
      className="text-text-muted text-lg italic transition-opacity duration-500 animate-in fade-in"
      style={{ fontFamily: "var(--font-serif)" }}
    >
      {TAGLINES[index]}
    </p>
  );
}
