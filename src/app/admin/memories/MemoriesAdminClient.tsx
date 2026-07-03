"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Search,
  Trash2,
  Pencil,
  Check,
  X,
  Merge,
  AlertCircle,
} from "lucide-react";
import type { MemoryType, Importance, MemorySource } from "@prisma/client";
import type { CreatorMemoryData } from "@/lib/memory/memory-types";
import {
  adminDeleteMemory,
  adminUpdateMemory,
  adminMergeDuplicateMemories,
} from "@/app/dashboard/brand-brain/actions";
import { cn } from "@/lib/utils";

const IMPORTANCE_COLORS: Record<Importance, string> = {
  LOW: "bg-gray-500/20 text-gray-400",
  MEDIUM: "bg-blue-500/20 text-blue-400",
  HIGH: "bg-amber-500/20 text-amber-400",
  CRITICAL: "bg-red-500/20 text-red-400",
};

const IMPORTANCE_ORDER: Importance[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

interface AdminMemory extends CreatorMemoryData {
  userEmail: string | null;
  userName: string | null;
}

interface Props {
  initialMemories: AdminMemory[];
  users: { id: string; email: string | null; name: string | null }[];
  typeLabels: Record<MemoryType, string>;
  importanceLabels: Record<Importance, string>;
  sourceLabels: Record<MemorySource, string>;
}

export default function MemoriesAdminClient({
  initialMemories,
  users,
  typeLabels,
  importanceLabels,
  sourceLabels,
}: Props) {
  const [memories, setMemories] = useState(initialMemories);
  const [search, setSearch] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterImportance, setFilterImportance] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", summary: "", confidence: 50, importance: "MEDIUM" as Importance });
  const [isPending, startTransition] = useTransition();
  const [mergeResult, setMergeResult] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return memories.filter((m) => {
      if (search) {
        const q = search.toLowerCase();
        if (!m.title.toLowerCase().includes(q) && !m.summary.toLowerCase().includes(q)) return false;
      }
      if (filterUser && m.userId !== filterUser) return false;
      if (filterType && m.memoryType !== filterType) return false;
      if (filterImportance && m.importance !== filterImportance) return false;
      return true;
    });
  }, [memories, search, filterUser, filterType, filterImportance]);

  const handleDelete = (id: string) => {
    if (!confirm("Delete this memory permanently?")) return;
    startTransition(async () => {
      await adminDeleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    });
  };

  const handleEdit = (m: AdminMemory) => {
    setEditingId(m.id);
    setEditForm({ title: m.title, summary: m.summary, confidence: m.confidence, importance: m.importance });
  };

  const handleSaveEdit = (id: string) => {
    startTransition(async () => {
      await adminUpdateMemory(id, editForm);
      setMemories((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, title: editForm.title, summary: editForm.summary, confidence: editForm.confidence, importance: editForm.importance }
            : m
        )
      );
      setEditingId(null);
    });
  };

  const handleMerge = () => {
    if (!filterUser) {
      setMergeResult("Select a user first to merge their duplicate memories.");
      return;
    }
    startTransition(async () => {
      const result = await adminMergeDuplicateMemories(filterUser);
      if (result.success) {
        setMergeResult(`Merged ${result.merged} duplicates, deleted ${result.deleted} obsolete memories.`);
      } else {
        setMergeResult(result.error || "Merge failed.");
      }
    });
  };

  const types: MemoryType[] = ["IDENTITY", "VOICE", "AUDIENCE", "CONTENT", "PERFORMANCE", "STRATEGY", "PREFERENCE", "WARNING"];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-background-secondary rounded-lg p-4 border border-background-primary space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search memories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background-primary text-text-primary text-sm rounded-md pl-10 pr-3 py-2 border border-background-card focus:border-accent-primary outline-none"
            />
          </div>
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="bg-background-primary text-text-primary text-sm rounded-md px-3 py-2 border border-background-card focus:border-accent-primary outline-none"
          >
            <option value="">All Users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-background-primary text-text-primary text-sm rounded-md px-3 py-2 border border-background-card focus:border-accent-primary outline-none"
          >
            <option value="">All Types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {typeLabels[t]}
              </option>
            ))}
          </select>
          <select
            value={filterImportance}
            onChange={(e) => setFilterImportance(e.target.value)}
            className="bg-background-primary text-text-primary text-sm rounded-md px-3 py-2 border border-background-card focus:border-accent-primary outline-none"
          >
            <option value="">All Importance</option>
            {IMPORTANCE_ORDER.map((i) => (
              <option key={i} value={i}>
                {importanceLabels[i]}
              </option>
            ))}
          </select>
          <button
            onClick={handleMerge}
            disabled={isPending}
            className="flex items-center gap-1.5 text-sm bg-accent-primary/10 text-accent-primary px-3 py-2 rounded-md font-medium hover:bg-accent-primary/20 disabled:opacity-50"
          >
            <Merge className="h-4 w-4" />
            Merge Duplicates
          </button>
        </div>
        {mergeResult && (
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <AlertCircle className="h-3.5 w-3.5" />
            {mergeResult}
          </div>
        )}
        <p className="text-xs text-text-muted">
          Showing {filtered.length} of {memories.length} memories
        </p>
      </div>

      {/* Memory list */}
      <div className="bg-background-secondary rounded-lg border border-background-primary overflow-hidden">
        <div className="divide-y divide-background-primary">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">
              No memories match the current filters.
            </div>
          ) : (
            filtered.map((memory) => (
              <div key={memory.id} className="p-4 hover:bg-background-card/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* User badge */}
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-1">
                      <span className="text-[10px] text-text-muted bg-background-card px-1.5 py-0.5 rounded">
                        {memory.userEmail || "Unknown"}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {typeLabels[memory.memoryType]}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {sourceLabels[memory.source]}
                      </span>
                    </div>

                    {editingId === memory.id ? (
                      <div className="space-y-2 mt-2">
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="w-full bg-background-primary text-text-primary text-sm rounded-md p-2 border border-background-card focus:border-accent-primary outline-none"
                        />
                        <textarea
                          value={editForm.summary}
                          onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                          className="w-full bg-background-primary text-text-primary text-sm rounded-md p-2 border border-background-card focus:border-accent-primary outline-none resize-none"
                          rows={3}
                        />
                        <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
                          <label className="text-xs text-text-muted flex items-center gap-1">
                            Confidence:
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={editForm.confidence}
                              onChange={(e) => setEditForm({ ...editForm, confidence: Number(e.target.value) })}
                              className="w-16 bg-background-primary text-text-primary text-xs rounded-md p-1 border border-background-card"
                            />
                          </label>
                          <select
                            value={editForm.importance}
                            onChange={(e) => setEditForm({ ...editForm, importance: e.target.value as Importance })}
                            className="bg-background-primary text-text-primary text-xs rounded-md px-2 py-1 border border-background-card"
                          >
                            {IMPORTANCE_ORDER.map((i) => (
                              <option key={i} value={i}>
                                {importanceLabels[i]}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleSaveEdit(memory.id)}
                            disabled={isPending}
                            className="flex items-center gap-1 text-xs bg-accent-primary text-black px-2 py-1 rounded-md font-medium"
                          >
                            <Check className="h-3 w-3" />
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex items-center gap-1 text-xs text-text-muted px-2 py-1"
                          >
                            <X className="h-3 w-3" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-text-primary">{memory.title}</p>
                        <p className="text-sm text-text-muted mt-0.5 leading-relaxed">{memory.summary}</p>
                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2">
                          <span
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide",
                              IMPORTANCE_COLORS[memory.importance]
                            )}
                          >
                            {importanceLabels[memory.importance]}
                          </span>
                          <span className="text-[10px] text-text-muted">Confidence: {memory.confidence}%</span>
                          {memory.pinned && (
                            <span className="text-[10px] text-accent-primary font-medium">PINNED</span>
                          )}
                          <span className="text-[10px] text-text-muted">
                            Updated {new Date(memory.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {editingId !== memory.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleEdit(memory)}
                        disabled={isPending}
                        title="Edit"
                        className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-background-card"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(memory.id)}
                        disabled={isPending}
                        title="Delete"
                        className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-background-card"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
