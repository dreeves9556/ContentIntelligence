"use server";

import { auth } from "@/auth";
import {
  getImpactOverview,
  getImpactTimeSeries,
  getEngagementTimeSeries,
  getMemberGrowthRows,
  getPlatformGrowthBreakdown,
  getCohortGrowthBreakdown,
  getUsageCorrelationStats,
  getDataQualityStats,
  type ImpactOverview,
  type ImpactTimeSeriesPoint,
  type EngagementTimeSeriesPoint,
  type MemberGrowthRow,
  type PlatformGrowthBreakdownRow,
  type CohortGrowthRow,
  type UsageCorrelationStats,
  type DataQualityStats,
} from "@/lib/impact-analytics";
import {
  ensureMemberGrowthBaselines,
  recalculateEngagementBaselines,
} from "@/lib/impact-baselines";

export interface ImpactData {
  overview: ImpactOverview;
  timeSeries: ImpactTimeSeriesPoint[];
  engagementTimeSeries: EngagementTimeSeriesPoint[];
  memberRows: MemberGrowthRow[];
  platformBreakdown: PlatformGrowthBreakdownRow[];
  cohortBreakdown: CohortGrowthRow[];
  usageCorrelation: UsageCorrelationStats;
  dataQuality: DataQualityStats;
}

export async function getImpactData(): Promise<ImpactData | { error: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { error: "Unauthorized" };
  }

  const [
    overview,
    timeSeries,
    engagementTimeSeries,
    memberRows,
    platformBreakdown,
    cohortBreakdown,
    usageCorrelation,
    dataQuality,
  ] = await Promise.all([
    getImpactOverview(),
    getImpactTimeSeries(),
    getEngagementTimeSeries(),
    getMemberGrowthRows(),
    getPlatformGrowthBreakdown(),
    getCohortGrowthBreakdown(),
    getUsageCorrelationStats(),
    getDataQualityStats(),
  ]);

  return {
    overview,
    timeSeries,
    engagementTimeSeries,
    memberRows,
    platformBreakdown,
    cohortBreakdown,
    usageCorrelation,
    dataQuality,
  };
}

export async function backfillBaselines(): Promise<{
  success: boolean;
  created?: number;
  skipped?: number;
  missingFollowerStats?: number;
  errors?: string[];
  error?: string;
}> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const result = await ensureMemberGrowthBaselines();
    return {
      success: true,
      created: result.created,
      skipped: result.skipped,
      missingFollowerStats: result.missingFollowerStats,
      errors: result.errors,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to backfill baselines",
    };
  }
}

export async function recalculateEngagementBaselinesAction(): Promise<{
  success: boolean;
  updated?: number;
  skipped?: number;
  errors?: string[];
  error?: string;
}> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const result = await recalculateEngagementBaselines();
    return {
      success: true,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to recalculate engagement baselines",
    };
  }
}
