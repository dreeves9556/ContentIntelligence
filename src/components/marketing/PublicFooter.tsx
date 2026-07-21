import { Crown } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="bg-background-card border-t border-border-primary py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-accent-primary" />
            <span
              className="text-lg font-bold text-text-primary"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              The Local Post
            </span>
          </div>

          <nav className="flex items-center gap-6">
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
        </div>

        <div className="mt-8 pt-8 border-t border-border-primary text-center">
          <p className="text-xs text-text-muted">
            © {new Date().getFullYear()} The Local Post. Your Town. Your Post.
          </p>
        </div>
      </div>
    </footer>
  );
}
