import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  User,
  Calendar,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Layers,
  Eye,
  TrendingUp,
  Sparkles,
  FileWarning,
} from "lucide-react";
import { getFreshnessDebugData } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FreshnessDebugPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getFreshnessDebugData(id);

  if (!data) {
    notFound();
  }

  const score = data.freshnessScore;
  const scoreColor =
    score === null ? "text-text-muted" :
    score.score >= 70 ? "text-emerald-400" :
    score.score >= 50 ? "text-amber-400" :
    "text-red-400";

  return (
    <div className="min-h-screen bg-background-primary text-text-primary">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <Link
            href={`/admin/clients/${data.user.id}/questionnaires`}
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Client
          </Link>
          <div className="flex items-center gap-3">
            <Activity className="h-7 w-7 text-accent-primary" />
            <h1
              className="text-2xl font-bold text-text-primary"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Freshness Debug
            </h1>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-text-muted">
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              {data.user.email}
            </span>
            <span className="text-[#2a2a2a]">|</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Joined {format(data.user.createdAt, "MMM d, yyyy")}
            </span>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-background-card rounded-lg p-4 border border-border-primary">
            <p className="text-sm text-text-muted">Archived Posts</p>
            <p className="text-2xl font-bold text-text-primary mt-1">{data.totalPosts}</p>
          </div>
          <div className="bg-background-card rounded-lg p-4 border border-border-primary">
            <p className="text-sm text-text-muted">Generations</p>
            <p className="text-2xl font-bold text-text-primary mt-1">{data.generationCount}</p>
          </div>
          <div className="bg-background-card rounded-lg p-4 border border-border-primary">
            <p className="text-sm text-text-muted">Freshness Score</p>
            <p className={`text-2xl font-bold mt-1 ${scoreColor}`}>
              {score ? score.score : "N/A"}
            </p>
          </div>
          <div className="bg-background-card rounded-lg p-4 border border-border-primary">
            <p className="text-sm text-text-muted">Staleness Warning</p>
            <p className={`text-2xl font-bold mt-1 ${data.stalenessTriggered ? "text-red-400" : "text-emerald-400"}`}>
              {data.stalenessTriggered ? "Triggered" : "OK"}
            </p>
          </div>
        </div>

        {/* Freshness Score Breakdown */}
        {score && (
          <div className="bg-background-card rounded-lg p-6 border border-border-primary space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent-primary" />
              <h2 className="text-lg font-semibold text-text-primary">Freshness Score Breakdown</h2>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider">Archetype Diversity</p>
                <p className="text-xl font-bold text-text-primary mt-1">
                  {(score.archetypeDiversity * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-text-muted mt-1">Weight: 40%</p>
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider">Theme Diversity</p>
                <p className="text-xl font-bold text-text-primary mt-1">
                  {(score.themeDiversity * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-text-muted mt-1">Weight: 30%</p>
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider">Hook Similarity</p>
                <p className="text-xl font-bold text-text-primary mt-1">
                  {(score.hookSimilarity * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-text-muted mt-1">Weight: 30% (lower = better)</p>
              </div>
            </div>
            {data.stalenessTriggered && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">Staleness Warning Active</p>
                  <p className="text-xs text-text-muted mt-1">
                    Score below 50/100. The AI prompt now includes a proactive staleness warning block
                    to push the model toward more diverse content before engagement declines.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Archetype Distribution */}
        <div className="bg-background-card rounded-lg p-6 border border-border-primary space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-accent-primary" />
            <h2 className="text-lg font-semibold text-text-primary">Archetype Distribution</h2>
          </div>
          {data.archetypes.length === 0 ? (
            <p className="text-text-muted text-sm">No archived posts to analyze.</p>
          ) : (
            <div className="space-y-2">
              {data.archetypes.map((a) => (
                <div key={a.archetype} className="flex items-center gap-3">
                  <span className="text-sm text-text-primary w-40 flex-shrink-0">{a.archetype}</span>
                  <div className="flex-1 bg-background-secondary rounded-full h-6 overflow-hidden">
                    <div
                      className="bg-accent-primary h-full rounded-full flex items-center justify-end pr-2"
                      style={{ width: `${Math.max(a.percentage, 2)}%` }}
                    >
                      <span className="text-xs text-white font-medium">{a.percentage}%</span>
                    </div>
                  </div>
                  <span className="text-xs text-text-muted w-8 text-right">{a.count}</span>
                </div>
              ))}
            </div>
          )}
          {data.overusedArchetypes.length > 0 && (
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-400">Overused Archetypes</p>
                <p className="text-xs text-text-muted mt-1">
                  {data.overusedArchetypes.map(([a, c]) => `${a} (${c})`).join(", ")}
                  {" — each exceeds 35% of total posts. The AI is directed to rotate away from these."}
                </p>
              </div>
            </div>
          )}
          {data.underusedArchetypes.length > 0 && (
            <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
              <Sparkles className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-400">Underused Archetypes</p>
                <p className="text-xs text-text-muted mt-1">
                  {data.underusedArchetypes.join(", ")}
                  {" — each appears in less than 10% of posts. The AI is directed to explore these."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Recent Hooks */}
        <div className="bg-background-card rounded-lg p-6 border border-border-primary space-y-4">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-accent-primary" />
            <h2 className="text-lg font-semibold text-text-primary">Recent Hooks (Last 15)</h2>
          </div>
          {data.recentHooks.length === 0 ? (
            <p className="text-text-muted text-sm">No archived posts.</p>
          ) : (
            <div className="space-y-2">
              {data.recentHooks.map((h, i) => (
                <div
                  key={i}
                  className="bg-background-secondary rounded-lg p-3 border border-border-primary"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-text-primary">{h.title}</span>
                    {h.weekStarting && (
                      <span className="text-xs text-text-muted">{h.weekStarting}</span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted">{h.hook}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Repeated Themes */}
        <div className="bg-background-card rounded-lg p-6 border border-border-primary space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-accent-primary" />
            <h2 className="text-lg font-semibold text-text-primary">Repeated Themes</h2>
          </div>
          {data.repeatedThemes.length === 0 ? (
            <p className="text-text-muted text-sm">No repeated themes detected (needs 5+ posts).</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.repeatedThemes.map((theme, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 bg-background-secondary border border-border-primary rounded-full text-sm text-text-primary"
                >
                  {theme}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Untapped Material */}
        <div className="bg-background-card rounded-lg p-6 border border-border-primary space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent-primary" />
            <h2 className="text-lg font-semibold text-text-primary">Untapped Questionnaire Material</h2>
          </div>
          {data.untappedMaterial.length === 0 ? (
            <p className="text-text-muted text-sm">
              {data.materialUsage.length === 0
                ? "No questionnaire data or insufficient posts for analysis."
                : "All questionnaire material has been explored in posts."}
            </p>
          ) : (
            <div className="space-y-2">
              {data.untappedMaterial.map((m, i) => (
                <div
                  key={i}
                  className="bg-background-secondary rounded-lg p-3 border border-border-primary"
                >
                  <span className="text-sm font-medium text-emerald-400">{m.label}</span>
                  <p className="text-xs text-text-muted mt-1">{m.snippet}...</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Context Survey Status */}
        <div className="bg-background-card rounded-lg p-6 border border-border-primary space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-accent-primary" />
            <h2 className="text-lg font-semibold text-text-primary">Context Survey Status</h2>
          </div>
          <div className="space-y-2">
            {data.contextStatus.map((ctx) => (
              <div
                key={ctx.surveyType}
                className="flex items-center justify-between bg-background-secondary rounded-lg p-3 border border-border-primary"
              >
                <div>
                  <span className="text-sm font-medium text-text-primary">{ctx.title}</span>
                  {ctx.updatedAt && (
                    <span className="text-xs text-text-muted ml-2">
                      Updated {format(new Date(ctx.updatedAt), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
                {ctx.status === "current" ? (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    Current
                  </span>
                ) : ctx.status === "expired" ? (
                  <span className="flex items-center gap-1.5 text-sm text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    Expired
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-red-400">
                    <XCircle className="h-4 w-4" />
                    Missing
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Generation Logs */}
        <div className="bg-background-card rounded-lg p-6 border border-border-primary space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-accent-primary" />
            <h2 className="text-lg font-semibold text-text-primary">Recent Generation Logs</h2>
          </div>
          {data.recentLogs.length === 0 ? (
            <p className="text-text-muted text-sm">No generation logs yet.</p>
          ) : (
            <div className="space-y-3">
              {data.recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-background-secondary rounded-lg p-4 border border-border-primary space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {log.success ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
                      <span className="text-sm font-medium text-text-primary">
                        {log.success ? "Success" : "Failed"}
                      </span>
                      {log.daysGenerated && (
                        <span className="text-xs text-text-muted">
                          {log.daysGenerated} days
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-text-muted">
                      {format(new Date(log.createdAt), "MMM d, yyyy h:mm a")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {log.freshnessScore !== null && (
                      <div>
                        <span className="text-text-muted">Score: </span>
                        <span className="text-text-primary">{log.freshnessScore}</span>
                      </div>
                    )}
                    {log.dynamicConstraintsMode && (
                      <div>
                        <span className="text-text-muted">Constraints: </span>
                        <span className="text-text-primary">{log.dynamicConstraintsMode}</span>
                        {log.dynamicConstraintsFallback && (
                          <span className="text-amber-400 ml-1">(fallback)</span>
                        )}
                      </div>
                    )}
                    {log.stalenessTriggered && (
                      <div>
                        <span className="text-amber-400">Staleness triggered</span>
                      </div>
                    )}
                    {log.audienceFatigueTriggered && (
                      <div>
                        <span className="text-amber-400">Fatigue triggered</span>
                      </div>
                    )}
                    {log.durationMs !== null && (
                      <div>
                        <span className="text-text-muted">Duration: </span>
                        <span className="text-text-primary">{(log.durationMs / 1000).toFixed(1)}s</span>
                      </div>
                    )}
                  </div>
                  {log.errorMessage && (
                    <div className="flex items-start gap-2 text-xs text-red-400">
                      <FileWarning className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span>{log.errorMessage}</span>
                    </div>
                  )}
                  {log.blockMetadata && (
                    <PromptBlockAudit
                      metadata={log.blockMetadata as {
                        included: BlockMeta[];
                        trimmed: BlockMeta[];
                        omitted: BlockMeta[];
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface BlockMeta {
  id: string;
  priority: string;
  originalChars: number;
  finalChars: number;
  trimmed: boolean;
  omitted: boolean;
}

function PromptBlockAudit({
  metadata,
}: {
  metadata: {
    included: BlockMeta[];
    trimmed: BlockMeta[];
    omitted: BlockMeta[];
  };
}) {
  const { included, trimmed, omitted } = metadata;
  if (included.length === 0 && omitted.length === 0) return null;

  const priorityColor: Record<string, string> = {
    CRITICAL: "text-red-400",
    HIGH: "text-amber-400",
    MEDIUM: "text-blue-400",
    LOW: "text-text-muted",
  };

  return (
    <div className="mt-2 pt-2 border-t border-border-primary">
      <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Prompt Block Audit</p>
      <div className="flex flex-wrap gap-2">
        {included.map((b) => (
          <span
            key={b.id}
            className={`text-xs px-2 py-1 rounded border border-border-primary bg-background-primary ${
              b.trimmed ? "text-amber-400" : "text-text-primary"
            }`}
            title={`${b.originalChars} → ${b.finalChars} chars`}
          >
            <span className={priorityColor[b.priority] ?? ""}>{b.priority[0] ?? "?"}</span>
            {" "}
            {b.id}
            {b.trimmed && " ✂"}
          </span>
        ))}
        {omitted.map((b) => (
          <span
            key={b.id}
            className="text-xs px-2 py-1 rounded border border-border-primary bg-background-primary text-red-400 line-through"
            title={`${b.originalChars} chars — omitted due to budget`}
          >
            {b.priority[0] ?? "?"} {b.id} (omitted)
          </span>
        ))}
      </div>
    </div>
  );
}
