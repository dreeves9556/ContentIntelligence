"use client";

import { useState, useTransition } from "react";
import {
  Megaphone,
  Plus,
  X,
  AlertCircle,
  Loader2,
  Check,
  Trash2,
  Power,
  Edit3,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  createLoginAnnouncement,
  updateLoginAnnouncement,
  deleteLoginAnnouncement,
  toggleLoginAnnouncement,
  type LoginAnnouncementData,
  type LoginSegment,
} from "./login-actions";

const LOGIN_SEGMENTS: { value: LoginSegment; label: string }[] = [
  { value: "all", label: "All Users" },
  { value: "PRO", label: "Pro Plan" },
  { value: "CALENDAR_ONLY", label: "Calendar Only Plan" },
  { value: "connected", label: "Connected Social Accounts" },
  { value: "unconnected", label: "No Social Accounts Connected" },
];

const SEGMENT_LABELS: Record<string, string> = Object.fromEntries(
  LOGIN_SEGMENTS.map((s) => [s.value, s.label])
);

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LoginAnnouncementsManager({
  initialAnnouncements,
}: {
  initialAnnouncements: LoginAnnouncementData[];
}) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [showCompose, setShowCompose] = useState(false);
  const [editing, setEditing] = useState<LoginAnnouncementData | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSaved() {
    setShowCompose(false);
    setEditing(null);
    window.location.reload();
  }

  async function handleToggle(id: string, currentActive: boolean) {
    const res = await toggleLoginAnnouncement(id, !currentActive);
    if (res.success) {
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isActive: !currentActive } : a))
      );
    } else {
      setError(res.error ?? "Failed to toggle.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this login announcement? This cannot be undone.")) return;
    const res = await deleteLoginAnnouncement(id);
    if (res.success) {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } else {
      setError(res.error ?? "Failed to delete.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-2xl font-bold text-text-primary"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Login Messages
          </h2>
          <p className="text-text-muted mt-1 text-sm">
            Show a dismissable popup to users when they log in. Targets a specific group.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowCompose(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-white font-semibold rounded-lg transition-colors text-sm"
        >
          <Plus className="h-4 w-4" />
          New Message
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-border-primary rounded-xl bg-background-secondary/50">
          <div className="p-4 bg-accent-primary/10 rounded-full mb-4">
            <Megaphone className="h-8 w-8 text-accent-primary" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-1">No login messages yet</h3>
          <p className="text-text-muted text-sm max-w-xs mb-4">
            Create a message that users will see in a popup when they next log in.
          </p>
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            <Plus className="h-4 w-4" />
            New Message
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <LoginAnnouncementRow
              key={a.id}
              announcement={a}
              onToggle={() => handleToggle(a.id, a.isActive)}
              onEdit={() => {
                setEditing(a);
                setShowCompose(true);
              }}
              onDelete={() => handleDelete(a.id)}
            />
          ))}
        </div>
      )}

      {showCompose && (
        <LoginAnnouncementModal
          existing={editing}
          onClose={() => {
            setShowCompose(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function LoginAnnouncementRow({
  announcement,
  onToggle,
  onEdit,
  onDelete,
}: {
  announcement: LoginAnnouncementData;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-background-card rounded-lg border border-border-primary overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {announcement.isActive ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border bg-background-secondary text-text-muted border-border-primary">
                Paused
              </span>
            )}
            <p className="text-sm font-medium text-text-primary truncate">{announcement.title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 ml-0 text-xs text-text-muted">
            <span>{SEGMENT_LABELS[announcement.segment] ?? announcement.segment}</span>
            <span>{formatDate(announcement.createdAt)}</span>
            <span>{announcement.dismissalCount} dismissed</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggle}
            title={announcement.isActive ? "Pause" : "Activate"}
            className="p-1.5 text-text-muted hover:text-accent-primary rounded-md hover:bg-accent-primary/10 transition-colors"
          >
            {announcement.isActive ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={onEdit}
            title="Edit"
            className="p-1.5 text-text-muted hover:text-accent-primary rounded-md hover:bg-accent-primary/10 transition-colors"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            className="p-1.5 text-text-muted hover:text-red-400 rounded-md hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="border-t border-border-primary px-4 py-3 bg-background-secondary/20">
        <div
          className="text-sm text-text-muted prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: announcement.message }}
        />
      </div>
    </div>
  );
}

function LoginAnnouncementModal({
  existing,
  onClose,
  onSaved,
}: {
  existing: LoginAnnouncementData | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [message, setMessage] = useState(existing?.message ?? "");
  const [segment, setSegment] = useState<LoginSegment>(
    (existing?.segment as LoginSegment) ?? "all"
  );
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  function handleSave() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!message.trim()) {
      setError("Message is required.");
      return;
    }
    setError(null);
    startSave(async () => {
      if (existing) {
        const res = await updateLoginAnnouncement(existing.id, title, message, segment, isActive);
        if (res.success) {
          onSaved();
        } else {
          setError(res.error ?? "Failed to update.");
        }
      } else {
        const res = await createLoginAnnouncement(title, message, segment);
        if (res.success) {
          onSaved();
        } else {
          setError(res.error ?? "Failed to create.");
        }
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-background-primary rounded-xl border border-border-primary w-full max-w-2xl my-8 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border-primary">
          <h2 className="text-lg font-bold text-text-primary">
            {existing ? "Edit Login Message" : "New Login Message"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-background-secondary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New Feature Available"
              className="w-full px-4 py-2.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-primary/50 transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
              Message (HTML supported)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your announcement message. HTML tags are supported for formatting."
              rows={8}
              className="w-full px-4 py-3 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-primary/50 transition-colors text-sm leading-relaxed resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
              Target Group
            </label>
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value as LoginSegment)}
              className="w-full px-4 py-2.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-accent-primary/50 transition-colors text-sm appearance-none"
            >
              {LOGIN_SEGMENTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {existing && (
            <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-border-primary accent-accent-primary"
              />
              Active (visible to users)
            </label>
          )}

          <div className="border-t border-border-primary pt-5 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-text-muted hover:text-text-primary font-medium rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {existing ? "Update" : "Create"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
