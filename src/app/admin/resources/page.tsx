import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { getResourcePosts, getAdminAuthorProfile } from "./actions";
import ResourcesAdminClient from "./ResourcesAdminClient";
import AuthorProfileForm from "./AuthorProfileForm";

export const dynamic = "force-dynamic";

export default async function AdminResourcesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/dashboard");

  const [posts, authorProfile] = await Promise.all([
    getResourcePosts(),
    getAdminAuthorProfile(),
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-bold text-[#e8e8e8]"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Resource Library
          </h1>
          <p className="text-[#787878] mt-1">
            Publish articles, tools, and insights for your clients
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[#111111] rounded-lg border border-[#1a1a1a] self-start">
          <BookOpen className="h-4 w-4 text-[#c8952a]" />
          <span className="text-sm text-[#e8e8e8] font-medium">
            {posts.filter((p) => p.published).length} published
          </span>
        </div>
      </div>

      {/* Author profile */}
      <AuthorProfileForm initial={authorProfile} />

      {/* Article management */}
      <div>
        <h2
          className="text-xs font-bold tracking-wider text-[#787878] uppercase mb-4"
        >
          Articles
        </h2>
        <ResourcesAdminClient initialPosts={posts} />
      </div>
    </div>
  );
}
