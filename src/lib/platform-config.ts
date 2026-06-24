import { prisma } from "@/lib/prisma";
import type { PlatformConfig } from "@prisma/client";

export type PlatformConfigData = Pick<
  PlatformConfig,
  | "zernioApiKey"
  | "zernioEnabledPlatforms"
  | "analyticsSyncFrequencyMinutes"
  | "anthropicModel"
  | "anthropicApiKey"
  | "insightPromptTemplate"
  | "calendarPromptTemplate"
  | "calendarStrategyPromptTemplate"
>;

const DEFAULT_CONFIG: PlatformConfigData = {
  zernioApiKey: null,
  zernioEnabledPlatforms: ["instagram", "tiktok", "facebook", "youtube"],
  analyticsSyncFrequencyMinutes: 60,
  anthropicModel: "claude-opus-4-8",
  anthropicApiKey: null,
  insightPromptTemplate: null,
  calendarPromptTemplate: null,
  calendarStrategyPromptTemplate: null,
};

export async function getPlatformConfig(): Promise<PlatformConfigData> {
  const row = await prisma.platformConfig.findUnique({
    where: { id: "default" },
  });

  if (!row) return DEFAULT_CONFIG;

  return {
    zernioApiKey: row.zernioApiKey,
    zernioEnabledPlatforms: row.zernioEnabledPlatforms,
    analyticsSyncFrequencyMinutes: row.analyticsSyncFrequencyMinutes,
    anthropicModel: row.anthropicModel,
    anthropicApiKey: row.anthropicApiKey,
    insightPromptTemplate: row.insightPromptTemplate,
    calendarPromptTemplate: row.calendarPromptTemplate,
    calendarStrategyPromptTemplate: row.calendarStrategyPromptTemplate,
  };
}

export async function getZernioApiKey(): Promise<string | null> {
  const config = await getPlatformConfig();
  return config.zernioApiKey ?? process.env.ZERNIO_API_KEY ?? null;
}

export async function getAnthropicApiKey(): Promise<string | null> {
  const config = await getPlatformConfig();
  return config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ?? null;
}

export async function getAnthropicModel(): Promise<string> {
  const config = await getPlatformConfig();
  return config.anthropicModel || "claude-opus-4-8";
}

export async function getEnabledPlatforms(): Promise<string[]> {
  const config = await getPlatformConfig();
  return config.zernioEnabledPlatforms;
}

export async function getSyncFrequencyMinutes(): Promise<number> {
  const config = await getPlatformConfig();
  return config.analyticsSyncFrequencyMinutes;
}
