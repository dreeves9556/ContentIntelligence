"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import {
  PlusCircle,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  X,
  Loader2,
  BookOpen,
  Tag,
  Calendar,
} from "lucide-react";
import type { ResourcePostData } from "./actions";
import {
  createResourcePost,
  updateResourcePost,
  deleteResourcePost,
} from "./actions";

const TiptapEditor = dynamic(() => import("@/components/TiptapEditor"), { ssr: false });

const CATEGORIES = ["Strategy", "Tools", "Mindset", "Content Ideas", "Analytics", "Branding", "General"];

interface EditorState {
  mode: "create" | "edit";
  id?: string;
  title: string;
  content: string;
  category: string;
  published: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function PostCard({
  post,
  onEdit,
  onDelete,
}: {
  post: ResourcePostData;
  onEdit: (post: ResourcePostData) => void;
  onDelete: (id: string) => void;
}) {
  const [deleting, startDelete] = useTransition();

  return (
    <div className="bg-[#111111] rounded-lg border border-[#1a1a1a] p-5 flex flex-col sm:flex-row sm:items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          {post.published ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Eye className="h-3 w-3" /> Published
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#2a2a2a] text-[#787878] border border-[#2a2a2a]">
              <EyeOff className="h-3 w-3" /> Draft
            </span>
          )}
          {post.category && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#c8952a]/10 text-[#c8952a] border border-[#c8952a]/20">
              <Tag className="h-3 w-3" /> {post.category}
            </span>
          )}
        </div>
        <h3 className="text-base font-semibold text-[#e8e8e8] leading-snug mb-1" style={{ fontFamily: "var(--font-playfair)" }}>
          {post.title}
        </h3>
        <div className="flex items-center gap-3 text-xs text-[#787878]">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {post.published && post.publishedAt
              ? `Published ${formatDate(post.publishedAt)}`
              : `Created ${formatDate(post.createdAt)}`}
          </span>
          {post.authorName && <span>by {post.authorName}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onEdit(post)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#1a1a1a] text-[#787878] hover:text-[#e8e8e8] hover:bg-[#2a2a2a] transition-colors border border-[#2a2a2a]"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          onClick={() => {
            if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
            startDelete(async () => {
              await deleteResourcePost(post.id);
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
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl w-full max-w-4xl shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1a1a1a]">
          <h2 className="text-lg font-bold text-[#e8e8e8]" style={{ fontFamily: "var(--font-playfair)" }}>
            {state.mode === "create" ? "New Article" : "Edit Article"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#787878] hover:text-[#e8e8e8] hover:bg-[#1a1a1a] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal body */}
        <div className="p-5 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold tracking-wider text-[#787878] uppercase mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={state.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Article title…"
              className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-[#e8e8e8] placeholder:text-[#3a3a3a] focus:outline-none focus:ring-2 focus:ring-[#c8952a]/40 text-sm"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold tracking-wider text-[#787878] uppercase mb-1.5">
              Category
            </label>
            <select
              value={state.category}
              onChange={(e) => onChange({ category: e.target.value })}
              className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-[#e8e8e8] focus:outline-none focus:ring-2 focus:ring-[#c8952a]/40 text-sm appearance-none"
            >
              <option value="">No category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Rich text editor */}
          <div>
            <label className="block text-xs font-bold tracking-wider text-[#787878] uppercase mb-1.5">
              Content
            </label>
            <TiptapEditor
              content={state.content}
              onChange={(html) => onChange({ content: html })}
              placeholder="Write something helpful…"
            />
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-[#1a1a1a]">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg text-[#787878] hover:text-[#e8e8e8] hover:bg-[#1a1a1a] transition-colors border border-[#2a2a2a] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(false)}
            disabled={saving || !state.title.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[#1a1a1a] text-[#787878] hover:text-[#e8e8e8] border border-[#2a2a2a] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
            Save as Draft
          </button>
          <button
            onClick={() => onSave(true)}
            disabled={saving || !state.title.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[#c8952a] text-[#0a0a0a] hover:bg-[#c8952a]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
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
  title: "",
  content: "",
  category: "",
  published: false,
};

export default function ResourcesAdminClient({ initialPosts }: { initialPosts: ResourcePostData[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditor({ ...EMPTY_EDITOR });
    setError(null);
  }

  function openEdit(post: ResourcePostData) {
    setEditor({
      mode: "edit",
      id: post.id,
      title: post.title,
      content: post.content,
      category: post.category ?? "",
      published: post.published,
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
        title: editor.title,
        content: editor.content,
        category: editor.category || undefined,
        published: publish,
      };

      let result: { success: boolean; error?: string; id?: string };
      if (editor.mode === "create") {
        result = await createResourcePost(data);
      } else {
        result = await updateResourcePost(editor.id!, data);
      }

      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }

      const refreshed = await fetch("/admin/resources?json=1").catch(() => null);
      if (refreshed?.ok) {
        const json = await refreshed.json().catch(() => null);
        if (json?.posts) setPosts(json.posts);
      }

      closeEditor();
      window.location.reload();
    });
  }

  const published = posts.filter((p) => p.published);
  const drafts = posts.filter((p) => !p.published);

  return (
    <>
      {/* Page header actions */}
      <div className="flex justify-end mb-6">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#c8952a] text-[#0a0a0a] font-semibold text-sm rounded-lg hover:bg-[#c8952a]/90 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          New Article
        </button>
      </div>

      {/* Empty state */}
      {posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="p-4 bg-[#c8952a]/10 rounded-full mb-4">
            <BookOpen className="h-8 w-8 text-[#c8952a]" />
          </div>
          <h3 className="text-lg font-bold text-[#e8e8e8] mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
            No articles yet
          </h3>
          <p className="text-[#787878] text-sm max-w-xs">
            Create your first resource article to share insights and tools with your clients.
          </p>
        </div>
      )}

      {/* Published */}
      {published.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-bold tracking-wider text-[#787878] uppercase mb-3">
            Published ({published.length})
          </h2>
          <div className="space-y-3">
            {published.map((p) => (
              <PostCard key={p.id} post={p} onEdit={openEdit} onDelete={() => window.location.reload()} />
            ))}
          </div>
        </section>
      )}

      {/* Drafts */}
      {drafts.length > 0 && (
        <section>
          <h2 className="text-xs font-bold tracking-wider text-[#787878] uppercase mb-3">
            Drafts ({drafts.length})
          </h2>
          <div className="space-y-3">
            {drafts.map((p) => (
              <PostCard key={p.id} post={p} onEdit={openEdit} onDelete={() => window.location.reload()} />
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
