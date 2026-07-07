"use client";

import { useState } from "react";
import Image from "next/image";
import { BookOpen, Tag, Calendar, Search, ChevronDown, ChevronUp, Mail } from "lucide-react";
import type { ResourcePostData } from "@/app/admin/resources/actions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
      <Tag className="h-3 w-3" />
      {category}
    </span>
  );
}

function AuthorByline({ post }: { post: ResourcePostData }) {
  const name = post.authorDisplayName ?? post.authorName;
  if (!name) return null;
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-2">
      {post.authorImage ? (
        <div className="relative h-7 w-7 rounded-full overflow-hidden shrink-0 border border-border-primary">
          <Image src={post.authorImage} alt={name} fill className="object-cover" unoptimized />
        </div>
      ) : (
        <div className="h-7 w-7 rounded-full bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary text-[10px] font-bold shrink-0">
          {initials}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-text-primary leading-tight">{name}</p>
        {post.authorOrganization && (
          <p className="text-[10px] text-text-muted leading-tight">{post.authorOrganization}</p>
        )}
        {post.authorContactEmail && (
          <a
            href={`mailto:${post.authorContactEmail}`}
            className="text-[10px] text-accent-primary leading-tight mt-0.5 hover:underline inline-flex items-center gap-1"
          >
            <Mail className="h-2.5 w-2.5" />
            {post.authorContactEmail}
          </a>
        )}
      </div>
    </div>
  );
}

function ResourceCard({ post }: { post: ResourcePostData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-background-card rounded-xl border border-border-primary overflow-hidden transition-all duration-300 hover:border-accent-primary/20">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full p-5 flex items-start justify-between gap-4 text-left hover:bg-background-secondary/30 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {post.category && <CategoryBadge category={post.category} />}
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Calendar className="h-3 w-3" />
              {formatDate(post.publishedAt ?? post.createdAt)}
            </span>
          </div>
          <h3
            className="text-lg font-bold text-text-primary leading-snug mb-3"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {post.title}
          </h3>
          <AuthorByline post={post} />
        </div>
        <div className="shrink-0 text-text-muted mt-1">
          {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </button>

      {/* Expanded article content */}
      {expanded && (
        <div className="border-t border-border-primary px-5 py-5 space-y-5">
          <div
            className="tiptap-content"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
          {/* Author footer */}
          <div className="pt-4 border-t border-border-primary">
            <AuthorByline post={post} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResourcesTab({ posts }: { posts: ResourcePostData[] }) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = ["All", ...Array.from(new Set(posts.map((p) => p.category).filter(Boolean) as string[]))];

  const filtered = posts.filter((p) => {
    const catMatch = activeCategory === "All" || p.category === activeCategory;
    if (!catMatch) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q);
  });

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
        <div className="p-4 bg-accent-primary/10 rounded-full mb-4">
          <BookOpen className="h-8 w-8 text-accent-primary" />
        </div>
        <h2
          className="text-xl font-bold text-text-primary mb-2"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          No resources yet
        </h2>
        <p className="text-text-muted max-w-sm text-sm">
          Your coaching team will post helpful articles, tools, and insights here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search articles…"
          className="w-full pl-10 pr-4 py-2.5 bg-background-card border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 text-sm"
        />
      </div>

      {/* Category filters */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-accent-primary text-background-primary"
                  : "bg-background-secondary text-text-muted hover:text-text-primary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {search.trim() && (
        <p className="text-sm text-text-muted">
          {filtered.length === 0
            ? "No articles match your search."
            : `${filtered.length} article${filtered.length !== 1 ? "s" : ""} found`}
        </p>
      )}

      <div className="space-y-4">
        {filtered.map((post) => (
          <ResourceCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
