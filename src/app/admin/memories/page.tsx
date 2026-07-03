import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAllMemoriesForAdmin } from "@/lib/memory/memory-service";
import { prisma } from "@/lib/prisma";
import { MEMORY_TYPE_LABELS, IMPORTANCE_LABELS, SOURCE_LABELS } from "@/lib/memory/memory-types";
import MemoriesAdminClient from "./MemoriesAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminMemoriesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const [memories, users] = await Promise.all([
    getAllMemoriesForAdmin(),
    prisma.user.findMany({
      select: { id: true, email: true, name: true },
      orderBy: { email: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: "var(--font-playfair)" }}>
          Creator Memories
        </h1>
        <p className="text-text-muted text-sm mt-1">
          View, search, edit, and manage AI memories across all clients.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-background-secondary rounded-lg p-4 border border-background-primary">
          <p className="text-2xl font-bold text-accent-primary">{memories.length}</p>
          <p className="text-xs text-text-muted mt-1">Total Memories</p>
        </div>
        <div className="bg-background-secondary rounded-lg p-4 border border-background-primary">
          <p className="text-2xl font-bold text-accent-primary">
            {memories.filter((m) => m.importance === "CRITICAL").length}
          </p>
          <p className="text-xs text-text-muted mt-1">Critical</p>
        </div>
        <div className="bg-background-secondary rounded-lg p-4 border border-background-primary">
          <p className="text-2xl font-bold text-accent-primary">
            {new Set(memories.map((m) => m.userId)).size}
          </p>
          <p className="text-xs text-text-muted mt-1">Users with Memories</p>
        </div>
      </div>

      <MemoriesAdminClient
        initialMemories={memories}
        users={users}
        typeLabels={MEMORY_TYPE_LABELS}
        importanceLabels={IMPORTANCE_LABELS}
        sourceLabels={SOURCE_LABELS}
      />
    </div>
  );
}
