"use client";

import { useEffect, useRef, useState } from "react";
import type { ElementType, ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  as?: ElementType;
  className?: string;
}

export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) {
      const timeout = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(timeout);
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`${visible ? "animate-fade-in-up" : "opacity-0"} ${className}`}
      style={visible && delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
