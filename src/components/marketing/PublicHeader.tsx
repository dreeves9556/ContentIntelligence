import Link from "next/link";
import { Newspaper, LogIn } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 bg-background-secondary/80 backdrop-blur-md border-b border-border-primary">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Newspaper className="h-6 w-6 text-accent-primary" />
          <span
            className="text-lg sm:text-xl font-bold text-text-primary"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            <span className="hidden sm:inline">The Local Post</span>
            <span className="sm:hidden">TLP</span>
          </span>
        </Link>

        <nav className="hidden sm:flex items-center gap-6">
          <a href="#features" className="text-sm text-text-muted hover:text-text-primary transition-colors">
            Features
          </a>
          <a href="#pricing" className="text-sm text-text-muted hover:text-text-primary transition-colors">
            Pricing
          </a>
          <a href="#faq" className="text-sm text-text-muted hover:text-text-primary transition-colors">
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            <LogIn className="h-4 w-4" />
            Login
          </Link>
        </div>
      </div>
    </header>
  );
}
