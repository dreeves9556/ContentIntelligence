import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserMemories } from "@/lib/memory/memory-service";
import { MEMORY_TYPE_LABELS, MEMORY_TYPE_DESCRIPTIONS } from "@/lib/memory/memory-types";
import type { MemoryType } from "@prisma/client";
import BrandBrainClient from "./BrandBrainClient";

export const dynamic = "force-dynamic";

export default async function BrandBrainPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const memories = await getUserMemories(session.user.id);

  const grouped = {} as Record<MemoryType, typeof memories>;
  const types: MemoryType[] = ["IDENTITY", "VOICE", "AUDIENCE", "CONTENT", "PERFORMANCE", "STRATEGY", "PREFERENCE", "WARNING"];
  for (const type of types) {
    grouped[type] = memories.filter((m) => m.memoryType === type);
  }

  const totalCount = memories.length;
  const pinnedCount = memories.filter((m) => m.pinned).length;
  const highConfidenceCount = memories.filter((m) => m.confidence >= 70).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: "var(--font-playfair)" }}>
          Brand Brain
        </h1>
        <p className="text-text-muted text-sm mt-1">
          What the AI has learned about you over time. These memories shape every content generation.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-background-secondary rounded-lg p-4 border border-background-primary">
          <p className="text-2xl font-bold text-accent-primary">{totalCount}</p>
          <p className="text-xs text-text-muted mt-1">Total Memories</p>
        </div>
        <div className="bg-background-secondary rounded-lg p-4 border border-background-primary">
          <p className="text-2xl font-bold text-accent-primary">{pinnedCount}</p>
          <p className="text-xs text-text-muted mt-1">Pinned</p>
        </div>
        <div className="bg-background-secondary rounded-lg p-4 border border-background-primary">
          <p className="text-2xl font-bold text-accent-primary">{highConfidenceCount}</p>
          <p className="text-xs text-text-muted mt-1">High Confidence</p>
        </div>
      </div>

      <BrandBrainClient groupedMemories={grouped} typeLabels={MEMORY_TYPE_LABELS} typeDescriptions={MEMORY_TYPE_DESCRIPTIONS} />
    </div>
  );
}
