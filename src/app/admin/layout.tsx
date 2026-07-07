"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Users,
  Settings,
  Crown,
  LogOut,
  Menu,
  X,
  BookOpen,
  Mail,
  Bug,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const adminNavItems = [
  { name: "Exit Admin Mode", href: "/dashboard", icon: LogOut },
  { name: "Client Roster", href: "/admin", icon: Users },
  { name: "Bulk Invites", href: "/admin/invites", icon: Mail },
  { name: "Resources", href: "/admin/resources", icon: BookOpen },
  { name: "Creator Memories", href: "/admin/memories", icon: Brain },
  { name: "Bug Reports", href: "/admin/bugs", icon: Bug },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="h-screen bg-background-secondary overflow-hidden flex flex-col">
      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile navigation drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-background-card transform transition-transform duration-200 ease-in-out lg:hidden border-r border-border-primary",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-border-primary">
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-accent-primary" />
            <span className="font-bold text-text-primary text-lg" style={{ fontFamily: "var(--font-serif)" }}>
              The Local Post
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-md text-text-muted hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-4 space-y-2">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent-primary/10 text-accent-primary"
                    : "text-text-muted hover:text-text-primary hover:bg-background-secondary"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border-primary">
          <Button variant="ghost" className="w-full justify-start text-text-muted hover:text-text-primary" onClick={handleLogout}>
            <LogOut className="h-5 w-5 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-64 flex-col bg-background-card border-r border-border-primary shrink-0 overflow-y-auto">
          <div className="flex items-center gap-2 p-6 border-b border-border-primary">
            <Crown className="h-6 w-6 text-accent-primary" />
            <div className="flex flex-col">
              <span className="font-bold text-lg text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
                The Local Post
              </span>
              <span className="text-xs text-accent-primary font-medium tracking-wider uppercase">Admin</span>
            </div>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent-primary/10 text-accent-primary"
                      : "text-text-muted hover:text-text-primary hover:bg-background-secondary"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-border-primary">
            <div className="px-3 py-2 mb-2">
              <p className="text-xs text-text-muted">Signed in as</p>
              <p className="text-sm font-medium text-text-primary">{session?.user?.name || session?.user?.email || "Admin"}</p>
            </div>
            <Button variant="ghost" className="w-full justify-start text-text-muted hover:text-text-primary" onClick={handleLogout}>
              <LogOut className="h-5 w-5 mr-2" />
              Sign Out
            </Button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-background-secondary">
          {/* Mobile header */}
          <header className="lg:hidden flex items-center justify-between p-4 border-b border-border-primary bg-background-card/95 backdrop-blur">
            <div className="flex items-center gap-2">
              <Crown className="h-6 w-6 text-accent-primary" />
              <div className="flex flex-col">
                <span className="font-bold text-text-primary text-lg" style={{ fontFamily: "var(--font-serif)" }}>
                  The Local Post
                </span>
                <span className="text-[10px] text-accent-primary font-medium tracking-wider uppercase">Admin</span>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-md text-text-muted hover:text-text-primary"
            >
              <Menu className="h-6 w-6" />
            </button>
          </header>

          {/* Page content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
