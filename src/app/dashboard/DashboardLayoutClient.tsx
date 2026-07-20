"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Calendar,
  Library,
  Plug,
  User,
  Sparkles,
  Menu,
  X,
  LogOut,
  Shield,
  Lock,
  ClipboardList,
  UserCog,
} from "lucide-react";
import { canAccessAnalytics, canAccessIntegrations, type UserPlan } from "@/lib/tiers";
import { cn } from "@/lib/utils";
import BugReportButton from "./bug-report/BugReportButton";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationPrompt } from "@/components/NotificationPrompt";

const ALL_NAV_ITEMS = [
  { name: "Content Calendar", href: "/dashboard/calendar", icon: Calendar, alwaysUnlocked: true },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3, alwaysUnlocked: false },
  { name: "Content Library", href: "/dashboard/library", icon: Library, alwaysUnlocked: true },
  { name: "Questionnaires", href: "/dashboard/questionnaire", icon: ClipboardList, alwaysUnlocked: true },
  { name: "Integrations", href: "/dashboard/integrations", icon: Plug, alwaysUnlocked: false },
  { name: "Profile", href: "/dashboard/profile", icon: User, alwaysUnlocked: true },
];

function getNavItems(plan: UserPlan) {
  return ALL_NAV_ITEMS.map((item) => {
    if (item.alwaysUnlocked) return { ...item, locked: false };
    if (item.href === "/dashboard/analytics" && !canAccessAnalytics(plan)) return { ...item, locked: true };
    if (item.href === "/dashboard/integrations" && !canAccessIntegrations(plan)) return { ...item, locked: true };
    return { ...item, locked: false };
  });
}

const adminNavItem = { name: "Admin", href: "/admin", icon: Shield };
const teamAdminNavItem = { name: "Team Roster", href: "/dashboard/team", icon: UserCog };

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const sessionInvalidated = status === "authenticated" && !session?.user?.id;

  useEffect(() => {
    if (sessionInvalidated) {
      signOut({ redirect: false }).then(() => {
        window.location.href = "/login";
      });
    }
  }, [sessionInvalidated]);

  const plan = (session?.user?.plan ?? "CALENDAR_ONLY") as UserPlan;
  const navItems = getNavItems(plan);

  const handleLogout = () => {
    signOut({ redirect: false }).then(() => {
      window.location.href = "/login";
    });
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
          "fixed inset-y-0 left-0 z-50 w-64 bg-background-secondary transform transition-transform duration-200 ease-in-out lg:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-background-primary">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-accent-primary" />
            <span className="font-bold text-lg" style={{ fontFamily: "var(--font-serif)" }}>
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
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            if (item.locked) {
              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium text-text-muted/50 cursor-not-allowed select-none"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    {item.name}
                  </div>
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                </div>
              );
            }
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent-primary/10 text-accent-primary"
                    : "text-text-muted hover:text-text-primary hover:bg-background-card"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
          {session?.user?.role === "TEAM_ADMIN" && (
            <Link
              href={teamAdminNavItem.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                pathname === teamAdminNavItem.href
                  ? "bg-accent-primary/10 text-accent-primary"
                  : "text-text-primary hover:text-accent-primary hover:bg-accent-primary/10"
              )}
            >
              <UserCog className="h-5 w-5" />
              {teamAdminNavItem.name}
            </Link>
          )}
          {session?.user?.role === "ADMIN" && (
            <Link
              href={adminNavItem.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                pathname === adminNavItem.href
                  ? "bg-accent-primary/10 text-accent-primary"
                  : "text-accent-primary hover:text-accent-primary hover:bg-accent-primary/10"
              )}
            >
              <Shield className="h-5 w-5" />
              {adminNavItem.name}
            </Link>
          )}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-background-primary space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-muted">Plan</p>
              <p className="text-sm font-medium text-accent-primary">{plan.replace("_", " ")}</p>
            </div>
            <ThemeToggle />
          </div>
          <BugReportButton />
          <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
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
            <Sparkles className="h-6 w-6 text-accent-primary" />
            <span className="font-bold text-lg" style={{ fontFamily: "var(--font-serif)" }}>
              The Local Post
            </span>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              if (item.locked) {
                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium text-text-muted/50 cursor-not-allowed select-none"
                    title="Upgrade your plan to unlock"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5" />
                      {item.name}
                    </div>
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                  </div>
                );
              }
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent-primary/10 text-accent-primary"
                      : "text-text-muted hover:text-text-primary hover:bg-background-card"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
            {session?.user?.role === "TEAM_ADMIN" && (
              <Link
                href={teamAdminNavItem.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  pathname === teamAdminNavItem.href
                    ? "bg-accent-primary/10 text-accent-primary"
                    : "text-text-primary hover:text-accent-primary hover:bg-accent-primary/10"
                )}
              >
                <UserCog className="h-5 w-5" />
                {teamAdminNavItem.name}
              </Link>
            )}
            {session?.user?.role === "ADMIN" && (
              <Link
                href={adminNavItem.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  pathname === adminNavItem.href
                    ? "bg-accent-primary/10 text-accent-primary"
                    : "text-accent-primary hover:text-accent-primary hover:bg-accent-primary/10"
                )}
              >
                <Shield className="h-5 w-5" />
                {adminNavItem.name}
              </Link>
            )}
          </nav>
          <div className="p-4 border-t border-background-primary space-y-3">
            <div className="flex items-center justify-between">
              <div className="px-1">
                <p className="text-xs text-text-muted">Plan</p>
                <p className="text-sm font-medium text-accent-primary">{plan.replace("_", " ")}</p>
              </div>
              <ThemeToggle />
            </div>
            <BugReportButton />
            <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
              <LogOut className="h-5 w-5 mr-2" />
              Sign Out
            </Button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden overflow-y-auto bg-background-secondary">
          {/* Mobile header */}
          <header className="lg:hidden flex items-center justify-between p-4 border-b border-border-primary bg-background-card/95 backdrop-blur">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-accent-primary" />
              <span className="font-bold text-lg" style={{ fontFamily: "var(--font-serif)" }}>
                The Local Post
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">{session?.user?.role}</span>
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 rounded-md text-text-muted hover:text-text-primary"
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </header>

          {/* Notification opt-in banner */}
          <NotificationPrompt />

          {/* Page content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">{children}</main>
        </div>
      </div>

      <InstallPrompt />
    </div>
  );
}
