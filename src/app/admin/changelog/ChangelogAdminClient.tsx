"use client";

import { useState, useTransition } from "react";
import {
  PlusCircle,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  X,
  Loader2,
  ScrollText,
  Tag,
  Calendar,
  GitBranch,
  GitCommit,
  ExternalLink,
} from "lucide-react";
import type { ChangelogType } from "@prisma/client";
import type { ChangelogEntryData } from "./actions";
import {
  createChangelogEntry,
  updateChangelogEntry,
  deleteChangelogEntry,
  backfillFromGithub,
} from "./actions";

const TYPE_OPTIONS: { value: ChangelogType; label: string; color: string }[] = [
  { value: "FEATURE", label: "Feature", color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" },
  { value: "IMPROVEMENT", label: "Improvement", color: "text-blue-400 border-blue-500/20 bg-blue-500/10" },
  { value: "BUGFIX", label: "Bug Fix", color: "text-amber-400 border-amber-500/20 bg-amber-500/10" },
  { value: "SECURITY", label: "Security", color: "text-red-400 border-red-500/20 bg-red-500/10" },
  { value: "ANNOUNCEMENT", label: "Announcement", color: "text-purple-400 border-purple-500/20 bg-purple-500/10" },
];

function getTypeStyle(type: ChangelogType) {
  return TYPE_OPTIONS.find((t) => t.value === type) ?? TYPE_OPTIONS[0];
}

interface EditorState {
  mode: "create" | "edit";
  id?: string;
  version: string;
  title: string;
  type: ChangelogType;
  content: string;
  published: boolean;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function EntryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: ChangelogEntryData;
  onEdit: (entry: ChangelogEntryData) => void;
  onDelete: (id: string) => void;
}) {
  const [deleting, startDelete] = useTransition();
  const typeStyle = getTypeStyle(entry.type);

  return (
    <div className="bg-background-card rounded-lg border border-border-primary p-5 flex flex-col sm:flex-row sm:items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          {entry.published ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Eye className="h-3 w-3" /> Published
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-background-secondary text-text-muted border border-border-primary">
              <EyeOff className="h-3 w-3" /> Draft
            </span>
          )}
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border ${typeStyle.color}`}>
            <Tag className="h-3 w-3" /> {typeStyle.label}
          </span>
          {entry.version && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-accent-primary/10 text-accent-primary border border-[#c8952a]/20">
              <GitBranch className="h-3 w-3" /> {entry.version}
            </span>
          )}
        </div>
        <h3 className="text-base font-semibold text-text-primary leading-snug mb-1" style={{ fontFamily: "var(--font-serif)" }}>
          {entry.title}
        </h3>
        {entry.content && (
          <p className="text-sm text-text-muted line-clamp-2 mb-2 whitespace-pre-wrap">
            {entry.content}
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {entry.published && entry.publishedAt
              ? `Published ${formatDate(entry.publishedAt)}`
              : `Created ${formatDate(entry.createdAt)}`}
          </span>
          {entry.gitAuthor && (
            <span className="flex items-center gap-1">
              <GitCommit className="h-3 w-3" />
              {entry.gitAuthor}
            </span>
          )}
          {entry.gitUrl && (
            <a
              href={entry.gitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-accent-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View commit
            </a>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onEdit(entry)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-background-secondary text-text-muted hover:text-text-primary hover:bg-background-secondary transition-colors border border-border-primary"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          onClick={() => {
            if (!confirm(`Delete "${entry.title}"? This cannot be undone.`)) return;
            startDelete(async () => {
              await deleteChangelogEntry(entry.id);
              onDelete(entry.id);
            });
          }}
          disabled={deleting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/20 disabled:opacity-50"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Delete
        </button>
      </div>
    </div>
  );
}

function EditorModal({
  state,
  onChange,
  onClose,
  onSave,
  saving,
}: {
  state: EditorState;
  onChange: (patch: Partial<EditorState>) => void;
  onClose: () => void;
  onSave: (publish: boolean) => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
      <div className="bg-background-card border border-border-primary rounded-xl w-full max-w-2xl shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between p-5 border-b border-border-primary">
          <h2 className="text-lg font-bold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
            {state.mode === "create" ? "New Changelog Entry" : "Edit Entry"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-background-secondary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal body */}
        <div className="p-5 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold tracking-wider text-text-muted uppercase mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={state.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="e.g. New analytics dashboard"
              className="w-full px-3 py-2.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-[#c8952a]/40 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Type */}
            <div>
              <label className="block text-xs font-bold tracking-wider text-text-muted uppercase mb-1.5">
                Type
              </label>
              <select
                value={state.type}
                onChange={(e) => onChange({ type: e.target.value as ChangelogType })}
                className="w-full px-3 py-2.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-[#c8952a]/40 text-sm appearance-none"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Version */}
            <div>
              <label className="block text-xs font-bold tracking-wider text-text-muted uppercase mb-1.5">
                Version <span className="text-text-muted/50 normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={state.version}
                onChange={(e) => onChange({ version: e.target.value })}
                placeholder="e.g. v2.4.0"
                className="w-full px-3 py-2.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-[#c8952a]/40 text-sm"
              />
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-bold tracking-wider text-text-muted uppercase mb-1.5">
              Description
            </label>
            <textarea
              value={state.content}
              onChange={(e) => onChange({ content: e.target.value })}
              placeholder="Describe what changed…"
              rows={6}
              className="w-full px-3 py-2.5 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-[#c8952a]/40 text-sm resize-y"
            />
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-border-primary">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg text-text-muted hover:text-text-primary hover:bg-background-secondary transition-colors border border-border-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(false)}
            disabled={saving || !state.title.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-background-secondary text-text-muted hover:text-text-primary border border-border-primary transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
            Save as Draft
          </button>
          <button
            onClick={() => onSave(true)}
            disabled={saving || !state.title.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-primary text-white hover:bg-accent-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            {state.mode === "create" ? "Publish" : "Save & Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

const EMPTY_EDITOR: EditorState = {
  mode: "create",
  version: "",
  title: "",
  type: "FEATURE",
  content: "",
  published: false,
};

export default function ChangelogAdminClient({ initialEntries }: { initialEntries: ChangelogEntryData[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, startSave] = useTransition();
  const [backfilling, startBackfill] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  function openCreate() {
    setEditor({ ...EMPTY_EDITOR });
    setError(null);
  }

  function openEdit(entry: ChangelogEntryData) {
    setEditor({
      mode: "edit",
      id: entry.id,
      version: entry.version ?? "",
      title: entry.title,
      type: entry.type,
      content: entry.content,
      published: entry.published,
    });
    setError(null);
  }

  function closeEditor() {
    setEditor(null);
    setError(null);
  }

  function handleSave(publish: boolean) {
    if (!editor) return;
    startSave(async () => {
      const data = {
        version: editor.version || undefined,
        title: editor.title,
        type: editor.type,
        content: editor.content,
        published: publish,
      };

      let result: { success: boolean; error?: string; id?: string };
      if (editor.mode === "create") {
        result = await createChangelogEntry(data);
      } else {
        result = await updateChangelogEntry(editor.id!, data);
      }

      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }

      closeEditor();
      window.location.reload();
    });
  }

  function handleDelete(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function handleBackfill() {
    setBackfillResult(null);
    startBackfill(async () => {
      const result = await backfillFromGithub();
      if (!result.success) {
        setError(result.error ?? "Backfill failed.");
        return;
      }
      setBackfillResult(`Imported ${result.created} new entries, skipped ${result.skipped} existing.`);
      window.location.reload();
    });
  }

  const published = entries.filter((e) => e.published);
  const drafts = entries.filter((e) => !e.published);

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
            Changelog
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Track and publish product updates, new features, and fixes.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleBackfill}
            disabled={backfilling}
            className="flex items-center gap-2 px-4 py-2 bg-background-secondary text-text-primary font-semibold text-sm rounded-lg hover:bg-background-card transition-colors border border-border-primary disabled:opacity-50"
          >
            {backfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCommit className="h-4 w-4" />}
            Backfill from GitHub
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-accent-primary text-white font-semibold text-sm rounded-lg hover:bg-accent-primary/90 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            New Entry
          </button>
        </div>
      </div>

      {backfillResult && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {backfillResult}
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="p-4 bg-accent-primary/10 rounded-full mb-4">
            <ScrollText className="h-8 w-8 text-accent-primary" />
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-2" style={{ fontFamily: "var(--font-serif)" }}>
            No changelog entries yet
          </h3>
          <p className="text-text-muted text-sm max-w-xs">
            Create your first entry to start tracking product updates and releases.
          </p>
        </div>
      )}

      {/* Published */}
      {published.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-bold tracking-wider text-text-muted uppercase mb-3">
            Published ({published.length})
          </h2>
          <div className="space-y-3">
            {published.map((e) => (
              <EntryCard key={e.id} entry={e} onEdit={openEdit} onDelete={handleDelete} />
            ))}
          </div>
        </section>
      )}

      {/* Drafts */}
      {drafts.length > 0 && (
        <section>
          <h2 className="text-xs font-bold tracking-wider text-text-muted uppercase mb-3">
            Drafts ({drafts.length})
          </h2>
          <div className="space-y-3">
            {drafts.map((e) => (
              <EntryCard key={e.id} entry={e} onEdit={openEdit} onDelete={handleDelete} />
            ))}
          </div>
        </section>
      )}

      {/* Editor modal */}
      {editor && (
        <EditorModal
          state={editor}
          onChange={(patch) => setEditor((prev) => (prev ? { ...prev, ...patch } : prev))}
          onClose={closeEditor}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-6 right-6 z-50 bg-red-900/80 text-red-200 border border-red-700 rounded-lg px-4 py-3 text-sm max-w-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-red-200">
            ✕
          </button>
        </div>
      )}
    </>
  );
}
