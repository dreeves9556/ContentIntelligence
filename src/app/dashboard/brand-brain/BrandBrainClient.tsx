"use client";

import { useState, useTransition } from "react";
import {
  Brain,
  Pin,
  PinOff,
  Trash2,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { MemoryType, Importance } from "@prisma/client";
import type { CreatorMemoryData } from "@/lib/memory/memory-types";
import {
  deleteMyMemory,
  togglePinMemory,
  correctMemory,
} from "./actions";
import { cn } from "@/lib/utils";

const IMPORTANCE_COLORS: Record<Importance, string> = {
  LOW: "bg-gray-500/20 text-gray-400",
  MEDIUM: "bg-blue-500/20 text-blue-400",
  HIGH: "bg-amber-500/20 text-amber-400",
  CRITICAL: "bg-red-500/20 text-red-400",
};

const TYPE_ICONS: Record<MemoryType, string> = {
  IDENTITY: "🧬",
  VOICE: "🎙️",
  AUDIENCE: "👥",
  CONTENT: "📝",
  PERFORMANCE: "📊",
  STRATEGY: "🎯",
  PREFERENCE: "⚙️",
  WARNING: "⚠️",
};

interface Props {
  groupedMemories: Record<MemoryType, CreatorMemoryData[]>;
  typeLabels: Record<MemoryType, string>;
  typeDescriptions: Record<MemoryType, string>;
}

export default function BrandBrainClient({ groupedMemories, typeLabels, typeDescriptions }: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<MemoryType>>(
    new Set(["IDENTITY", "WARNING"])
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isPending, startTransition] = useTransition();

  const toggleSection = (type: MemoryType) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this memory? The AI will forget this insight.")) return;
    startTransition(() => {
      deleteMyMemory(id);
    });
  };

  const handlePin = (id: string) => {
    startTransition(() => {
      togglePinMemory(id);
    });
  };

  const handleEdit = (memory: CreatorMemoryData) => {
    setEditingId(memory.id);
    setEditText(memory.summary);
  };

  const handleSaveEdit = (id: string) => {
    startTransition(() => {
      correctMemory(id, editText);
      setEditingId(null);
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const types: MemoryType[] = ["IDENTITY", "VOICE", "AUDIENCE", "CONTENT", "PERFORMANCE", "STRATEGY", "PREFERENCE", "WARNING"];

  return (
    <div className="space-y-3">
      {types.map((type) => {
        const memories = groupedMemories[type] ?? [];
        const isExpanded = expandedSections.has(type);
        const hasMemories = memories.length > 0;

        return (
          <div
            key={type}
            className="bg-background-card rounded-lg border border-border-primary overflow-hidden"
          >
            <button
              onClick={() => toggleSection(type)}
              className="w-full flex items-center justify-between p-4 hover:bg-background-secondary transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-text-muted" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-text-muted" />
                )}
                <span className="text-lg">{TYPE_ICONS[type]}</span>
                <div className="text-left">
                  <p className="text-sm font-semibold text-text-primary">
                    {typeLabels[type]}
                  </p>
                  <p className="text-xs text-text-muted">
                    {typeDescriptions[type]}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "text-xs px-2 py-1 rounded-full font-medium",
                  hasMemories
                    ? "bg-accent-primary/10 text-accent-primary"
                    : "bg-background-secondary text-text-muted"
                )}
              >
                {memories.length}
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-border-primary">
                {hasMemories ? (
                  <div className="divide-y divide-border-primary">
                    {memories.map((memory) => (
                      <div key={memory.id} className="p-4 hover:bg-background-secondary/50 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium text-text-primary">
                                {memory.title}
                              </p>
                              {memory.pinned && (
                                <Pin className="h-3.5 w-3.5 text-accent-primary fill-accent-primary" />
                              )}
                            </div>
                            {editingId === memory.id ? (
                              <div className="mt-2 space-y-2">
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  className="w-full bg-background-secondary text-text-primary text-sm rounded-md p-2 border border-border-primary focus:border-accent-primary outline-none resize-none"
                                  rows={3}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleSaveEdit(memory.id)}
                                    disabled={isPending}
                                    className="flex items-center gap-1 text-xs bg-accent-primary text-white px-2 py-1 rounded-md font-medium hover:bg-accent-primary/90 disabled:opacity-50"
                                  >
                                    <Check className="h-3 w-3" />
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="flex items-center gap-1 text-xs text-text-muted px-2 py-1 rounded-md hover:text-text-primary"
                                  >
                                    <X className="h-3 w-3" />
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-text-muted leading-relaxed">
                                {memory.summary}
                              </p>
                            )}
                            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2">
                              <span
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide",
                                  IMPORTANCE_COLORS[memory.importance]
                                )}
                              >
                                {memory.importance}
                              </span>
                              <span className="text-[10px] text-text-muted">
                                Confidence: {memory.confidence}%
                              </span>
                              <span className="text-[10px] text-text-muted">
                                Updated {new Date(memory.updatedAt).toLocaleDateString()}
                              </span>
                              {memory.lastUsedAt && (
                                <span className="text-[10px] text-text-muted">
                                  Used {new Date(memory.lastUsedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          {editingId !== memory.id && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handlePin(memory.id)}
                                disabled={isPending}
                                title={memory.pinned ? "Unpin" : "Pin to always include in AI prompts"}
                                className="p-1.5 rounded-md text-text-muted hover:text-accent-primary hover:bg-background-secondary transition-colors"
                              >
                                {memory.pinned ? (
                                  <PinOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Pin className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => handleEdit(memory)}
                                disabled={isPending}
                                title="Correct this memory"
                                className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-background-secondary transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(memory.id)}
                                disabled={isPending}
                                title="Delete this memory"
                                className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-background-secondary transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <Brain className="h-8 w-8 text-text-muted/30 mx-auto mb-2" />
                    <p className="text-sm text-text-muted">
                      No memories in this category yet. The AI will learn these as you use The Local Post.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
