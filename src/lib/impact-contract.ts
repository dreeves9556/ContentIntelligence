export const IMPACT_DEFINITION_VERSION = "connection-period-v1";
export const IMPACT_STALE_SYNC_DAYS = 7;

export interface ImpactScopeMetadata {
  definitionVersion: string;
  generatedAt: string;
  dataThroughAt: string | null;
  scopeLabel: "Since connection";
  eligibleUsers: number;
  eligibleAccounts: number;
  validFollowerAccounts: number;
  validEngagementAccounts: number;
  accountsWithoutBaselines: number;
  accountsWithoutRecentSync: number;
  accountsWithoutPostAnalytics: number;
  suspiciousFollowerAccounts: number;
  sourceFingerprint: string;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(",")}}`;
}

export function impactSourceFingerprint(value: unknown): string {
  let hash = 2166136261;
  for (const char of stableJson(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
