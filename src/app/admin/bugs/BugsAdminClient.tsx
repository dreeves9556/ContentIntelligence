"use client";

import { useState, useTransition } from "react";
import {
  Bug,
  Mail,
  User,
  Smartphone,
  Monitor,
  ChevronDown,
  ChevronUp,
  Save,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { BugReportData } from "@/app/dashboard/bug-report/actions";
import { updateBugReportStatus } from "@/app/dashboard/bug-report/actions";
import type { BugReportStatus } from "@prisma/client";

const STATUS_CONFIG: Record<
  BugReportStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  OPEN: {
    label: "Open",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
  INVESTIGATED: {
    label: "Investigated",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  SOLVED: {
    label: "Solved",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
};

const STATUS_ORDER: BugReportStatus[] = ["OPEN", "INVESTIGATED", "SOLVED"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function BugReportCard({ report }: { report: BugReportData }) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [notes, setNotes] = useState(report.adminNotes ?? "");
  const [currentStatus, setCurrentStatus] = useState(report.status);

  const cfg = STATUS_CONFIG[currentStatus];

  const handleStatusChange = (newStatus: BugReportStatus) => {
    setCurrentStatus(newStatus);
    startTransition(async () => {
      const result = await updateBugReportStatus(report.id, newStatus, notes);
      if (result.success) {
        setStatus("success");
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus("error");
      }
    });
  };

  const handleSaveNotes = () => {
    startTransition(async () => {
      const result = await updateBugReportStatus(report.id, currentStatus, notes);
      if (result.success) {
        setStatus("success");
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus("error");
      }
    });
  };

  return (
    <div className="bg-[#111111] rounded-lg border border-[#1a1a1a] overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className={`shrink-0 p-2 rounded-lg ${cfg.bg} ${cfg.border} border`}>
          <Bug className={`h-4 w-4 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
              {cfg.label}
            </span>
            <span className="text-sm font-medium text-[#e8e8e8] truncate">
              {report.name}
            </span>
          </div>
          <p className="text-xs text-[#787878] mt-1 truncate">
            {report.description.slice(0, 80)}
            {report.description.length > 80 && "…"}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:inline text-xs text-[#787878]">
            {formatDate(report.createdAt)}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-[#787878]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[#787878]" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#1a1a1a] p-4 space-y-4">
          {status === "success" && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Updated successfully.
            </div>
          )}
          {status === "error" && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Failed to update.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm text-[#787878]">
              <User className="h-4 w-4 shrink-0" />
              <span className="truncate">{report.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#787878]">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{report.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#787878]">
              {report.deviceInfo === "mobile" ? (
                <Smartphone className="h-4 w-4 shrink-0" />
              ) : (
                <Monitor className="h-4 w-4 shrink-0" />
              )}
              <span className="capitalize">{report.deviceInfo}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#787878]">
              <span className="text-xs">Reported:</span>
              <span>{formatDate(report.createdAt)}</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-[#787878] uppercase tracking-wider mb-1.5">
              Description
            </p>
            <p className="text-sm text-[#e8e8e8] leading-relaxed bg-[#0a0a0a] rounded-lg px-3 py-2.5 border border-white/5 whitespace-pre-wrap">
              {report.description}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#787878] uppercase tracking-wider mb-1.5">
              Status
            </p>
            <div className="flex gap-2">
              {STATUS_ORDER.map((s) => {
                const sc = STATUS_CONFIG[s];
                const active = currentStatus === s;
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    disabled={isPending}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all disabled:opacity-50 ${sc.bg} ${sc.color} ${sc.border} ${
                      active ? "ring-1 ring-current" : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    {sc.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-[#787878] uppercase tracking-wider mb-1.5">
              Admin Notes
            </p>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this bug…"
              className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-sm text-[#e8e8e8] placeholder:text-[#555] focus:outline-none focus:ring-2 focus:ring-[#c8952a]/40 resize-none"
            />
            <button
              onClick={handleSaveNotes}
              disabled={isPending}
              className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#c8952a] text-[#0a0a0a] disabled:opacity-60 hover:opacity-90 transition-opacity"
            >
              <Save className="h-3 w-3" />
              {isPending ? "Saving…" : "Save Notes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BugsAdminClient({
  initialReports,
}: {
  initialReports: BugReportData[];
}) {
  const [filter, setFilter] = useState<BugReportStatus | "ALL">("ALL");

  const filtered =
    filter === "ALL"
      ? initialReports
      : initialReports.filter((r) => r.status === filter);

  const filterTabs: { key: BugReportStatus | "ALL"; label: string; count: number }[] = [
    { key: "ALL", label: "All", count: initialReports.length },
    { key: "OPEN", label: "Open", count: initialReports.filter((r) => r.status === "OPEN").length },
    { key: "INVESTIGATED", label: "Investigated", count: initialReports.filter((r) => r.status === "INVESTIGATED").length },
    { key: "SOLVED", label: "Solved", count: initialReports.filter((r) => r.status === "SOLVED").length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
              filter === tab.key
                ? "bg-[#c8952a]/10 text-[#c8952a] border-[#c8952a]/30"
                : "text-[#787878] border-[#1a1a1a] hover:text-[#e8e8e8] hover:bg-[#111111]"
            }`}
          >
            {tab.label} <span className="text-xs opacity-60">({tab.count})</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Bug className="h-10 w-10 text-[#333] mx-auto mb-3" />
          <p className="text-[#787878] text-sm">No bug reports{filter !== "ALL" ? ` with status "${filter.toLowerCase()}"` : ""}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <BugReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
