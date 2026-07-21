"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Night", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timeout);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-1 p-1 rounded-lg bg-background-card border border-border-primary">
        {options.map((opt) => (
          <div
            key={opt.value}
            className="h-8 w-8 rounded-md"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-background-card border border-border-primary">
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = theme === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={cn(
              "flex items-center justify-center h-8 w-8 rounded-md transition-colors",
              isActive
                ? "bg-accent-primary text-white"
                : "text-text-muted hover:text-text-primary hover:bg-background-secondary"
            )}
            aria-label={`${opt.label} theme`}
            title={`${opt.label} theme`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
