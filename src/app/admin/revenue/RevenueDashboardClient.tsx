"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  CreditCard,
  Calendar,
  Receipt,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/pricing";
import type { RevenueData } from "./actions";

interface Props {
  data: RevenueData;
}

function formatPercent(num: number, decimals = 1): string {
  const sign = num >= 0 ? "+" : "";
  return `${sign}${num.toFixed(decimals)}%`;
}

function formatCurrencyShort(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (Math.abs(dollars) >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  return `$${Math.round(dollars)}`;
}

export default function RevenueDashboardClient({ data }: Props) {
  const router = useRouter();
  const { monthly, mrr, generatedAt } = data;

  const sortedMonthly = useMemo(() => [...monthly].reverse(), [monthly]);

  const thisMonth = monthly[monthly.length - 1] ?? null;
  const lastMonth = monthly[monthly.length - 2] ?? null;

  const momDeltaCents = thisMonth && lastMonth ? thisMonth.totalCents - lastMonth.totalCents : 0;
  const momGrowthPercent =
    thisMonth && lastMonth && lastMonth.totalCents > 0
      ? ((thisMonth.totalCents - lastMonth.totalCents) / lastMonth.totalCents) * 100
      : null;

  const cards = [
    {
      name: "This Month Revenue",
      value: thisMonth ? formatCurrency(thisMonth.totalCents) : "—",
      sub: thisMonth ? thisMonth.monthLabel : "",
      icon: DollarSign,
    },
    {
      name: "Last Month Revenue",
      value: lastMonth ? formatCurrency(lastMonth.totalCents) : "—",
      sub: lastMonth ? lastMonth.monthLabel : "",
      icon: Calendar,
    },
    {
      name: "MoM Growth",
      value: momGrowthPercent !== null ? formatPercent(momGrowthPercent) : "—",
      sub: momDeltaCents !== 0 ? formatCurrency(Math.abs(momDeltaCents)) + (momDeltaCents >= 0 ? " up" : " down") : "",
      icon: momDeltaCents >= 0 ? TrendingUp : TrendingDown,
    },
    {
      name: "Current MRR",
      value: formatCurrency(mrr.mrrCents),
      sub: `${mrr.activeSubCount} active subs`,
      icon: CreditCard,
    },
  ];

  const tooltipStyle = {
    backgroundColor: "var(--color-background-card)",
    border: "1px solid var(--color-border-primary)",
    borderRadius: "8px",
    color: "var(--color-text-primary)",
  };

  const chartData = monthly.map((m) => ({
    label: m.monthLabel,
    totalCents: m.totalCents,
    invoiceCount: m.invoiceCount,
  }));

  const generatedLabel = new Date(generatedAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-3xl font-bold text-text-primary"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Revenue
          </h1>
          <p className="text-text-muted mt-1">
            Monthly collected revenue and current MRR, pulled live from Stripe. Comped users excluded.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">Updated {generatedLabel}</span>
          <button
            onClick={() => router.refresh()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-primary/20 text-accent-primary border border-accent-primary/30 hover:bg-accent-primary/30 transition-all shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.name}
              className="bg-background-card rounded-xl p-4 sm:p-6 border border-border-primary hover:border-accent-primary/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-text-muted">{s.name}</p>
                  <p className="text-xl sm:text-2xl font-bold text-text-primary mt-1">{s.value}</p>
                  {s.sub && <p className="text-xs text-text-muted mt-1">{s.sub}</p>}
                </div>
                <div className="p-2 sm:p-3 bg-accent-primary/10 rounded-xl">
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-accent-primary" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="bg-background-card rounded-xl p-4 sm:p-6 border border-border-primary">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-5 w-5 text-accent-primary shrink-0" />
          <h3
            className="text-base sm:text-lg font-semibold"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Collected Revenue — Last 12 Months
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-text-muted mb-4">
          Total paid-invoice revenue per month (excluding comped users)
        </p>
        {chartData.length > 0 ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-primary)" />
                <XAxis
                  dataKey="label"
                  stroke="var(--color-text-muted)"
                  tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
                  tickLine={false}
                  minTickGap={20}
                />
                <YAxis
                  stroke="var(--color-text-muted)"
                  tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
                  tickLine={false}
                  tickFormatter={(v) => formatCurrencyShort(Number(v))}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [formatCurrency(Number(v)), "Collected Revenue"]}
                />
                <Bar
                  dataKey="totalCents"
                  name="Collected Revenue"
                  fill="var(--color-accent-primary)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-72 flex items-center justify-center text-text-muted text-sm">
            No revenue data available yet
          </div>
        )}
      </div>

      {/* MRR Breakdown */}
      <div className="bg-background-card rounded-xl p-4 sm:p-6 border border-border-primary">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="h-5 w-5 text-accent-primary shrink-0" />
          <h3
            className="text-base sm:text-lg font-semibold"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Current MRR Breakdown
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-text-muted mb-4">
          Monthly recurring revenue from active subscriptions, normalized to a monthly figure
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg bg-accent-primary/10 border border-accent-primary/20 p-4">
            <p className="text-sm text-text-muted">Total MRR</p>
            <p className="text-2xl font-bold text-text-primary mt-1">
              {formatCurrency(mrr.mrrCents)}
            </p>
          </div>
          <div className="rounded-lg bg-background-secondary border border-border-primary p-4">
            <p className="text-sm text-text-muted">Active Subscriptions</p>
            <p className="text-2xl font-bold text-text-primary mt-1">{mrr.activeSubCount}</p>
          </div>
          <div className="rounded-lg bg-background-secondary border border-border-primary p-4">
            <p className="text-sm text-text-muted">Monthly Subs</p>
            <p className="text-2xl font-bold text-text-primary mt-1">{mrr.monthlySubs}</p>
          </div>
          <div className="rounded-lg bg-background-secondary border border-border-primary p-4">
            <p className="text-sm text-text-muted">Annual Subs</p>
            <p className="text-2xl font-bold text-text-primary mt-1">{mrr.annualSubs}</p>
          </div>
        </div>
      </div>

      {/* Month-by-Month Table */}
      <div className="bg-background-card rounded-xl p-4 sm:p-6 border border-border-primary">
        <div className="flex items-center gap-2 mb-1">
          <Receipt className="h-5 w-5 text-accent-primary shrink-0" />
          <h3
            className="text-base sm:text-lg font-semibold"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Month-by-Month Breakdown
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-text-muted mb-4">
          Collected revenue with month-over-month deltas and growth percentage
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-primary text-left text-text-muted">
                <th className="py-2 pr-4 font-medium">Month</th>
                <th className="py-2 pr-4 font-medium text-right">Collected</th>
                <th className="py-2 pr-4 font-medium text-right">Δ vs Prev</th>
                <th className="py-2 pr-4 font-medium text-right">Growth %</th>
                <th className="py-2 pr-4 font-medium text-right">Invoices</th>
                <th className="py-2 pr-4 font-medium text-right">Avg Invoice</th>
              </tr>
            </thead>
            <tbody>
              {sortedMonthly.map((m, idx) => {
                const prev = sortedMonthly[idx + 1] ?? null;
                const deltaCents = prev ? m.totalCents - prev.totalCents : null;
                const growthPercent =
                  prev && prev.totalCents > 0
                    ? ((m.totalCents - prev.totalCents) / prev.totalCents) * 100
                    : null;

                return (
                  <tr
                    key={m.monthKey}
                    className="border-b border-border-primary/50 last:border-0"
                  >
                    <td className="py-3 pr-4 text-text-primary font-medium">{m.monthLabel}</td>
                    <td className="py-3 pr-4 text-right text-text-primary font-medium">
                      {formatCurrency(m.totalCents)}
                    </td>
                    <td
                      className={`py-3 pr-4 text-right font-medium ${
                        deltaCents === null
                          ? "text-text-muted"
                          : deltaCents >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                      }`}
                    >
                      {deltaCents === null
                        ? "—"
                        : `${deltaCents >= 0 ? "+" : "−"}${formatCurrency(Math.abs(deltaCents))}`}
                    </td>
                    <td
                      className={`py-3 pr-4 text-right font-medium ${
                        growthPercent === null
                          ? "text-text-muted"
                          : growthPercent >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                      }`}
                    >
                      {growthPercent === null ? "—" : formatPercent(growthPercent)}
                    </td>
                    <td className="py-3 pr-4 text-right text-text-muted">{m.invoiceCount}</td>
                    <td className="py-3 pr-4 text-right text-text-muted">
                      {m.invoiceCount > 0 ? formatCurrency(m.avgInvoiceCents) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
