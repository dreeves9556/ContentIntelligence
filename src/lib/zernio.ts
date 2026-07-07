import { getZernioApiKey } from "@/lib/platform-config";

const ZERNIO_BASE = "https://zernio.com/api/v1";

async function apiKey() {
  const key = await getZernioApiKey();
  if (!key) throw new Error("Zernio API key is not configured");
  return key;
}

async function zernioFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${ZERNIO_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${await apiKey()}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zernio ${options.method ?? "GET"} ${path} → ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export interface ZernioProfile {
  _id: string;
  name: string;
}

export interface ZernioConnectUrlResponse {
  authUrl: string;
}

export interface ZernioSocialAccount {
  _id: string;
  platform: string;
  handle?: string;
  profileId: string;
}

export interface ZernioAccountsResponse {
  accounts: ZernioSocialAccount[];
}

export interface ZernioPostAnalytics {
  postId: string;
  platforms: Record<
    string,
    {
      impressions?: number;
      likes?: number;
      comments?: number;
      clicks?: number;
      shares?: number;
    }
  >;
}

export interface ZernioAccountAnalytics {
  posts: Array<{
    _id: string;
    content: string;
    publishedAt: string;
    platform: string;
    platformPostUrl?: string;
    analytics: {
      impressions?: number;
      likes?: number;
      comments?: number;
      clicks?: number;
      shares?: number;
      views?: number;
      reach?: number;
    };
  }>;
}

export interface ZernioFollowerStats {
  points: Array<{
    date: string;
    followerCount: number;
    growthDelta: number;
    growthPercent: number;
  }>;
}

export type DeepAnalyticsEndpoint =
  | "instagram/demographics"
  | "instagram/follower-history"
  | "instagram/account-insights"
  | "youtube/channel-insights"
  | "youtube/demographics"
  | "tiktok/account-insights"
  | "linkedin/org-aggregate-analytics"
  | "facebook/page-insights";

export type ProfileAnalyticsEndpoint =
  | "content-decay"
  | "daily-metrics"
  | "posting-frequency";

export type AccountLevelEndpoint =
  | DeepAnalyticsEndpoint
  | "linkedin-aggregate-analytics";

export const zernio = {
  profiles: {
    async create(name: string): Promise<ZernioProfile> {
      const data = await zernioFetch<{ profile: ZernioProfile }>("/profiles", {
        method: "POST",
        body: JSON.stringify({ name, description: "The Local Post user profile" }),
      });
      return data.profile;
    },
  },

  connect: {
    async getConnectUrl(
      platform: string,
      profileId: string,
      redirectUrl: string
    ): Promise<ZernioConnectUrlResponse> {
      const params = new URLSearchParams({ profileId, redirect_url: redirectUrl });
      return zernioFetch<ZernioConnectUrlResponse>(
        `/connect/${platform}?${params.toString()}`
      );
    },
  },

  accounts: {
    async list(profileId?: string): Promise<ZernioSocialAccount[]> {
      const params = profileId ? `?profileId=${profileId}` : "";
      const data = await zernioFetch<ZernioAccountsResponse>(`/accounts${params}`);
      return data.accounts;
    },

    async delete(zernioAccountId: string): Promise<void> {
      await zernioFetch(`/accounts/${zernioAccountId}`, { method: "DELETE" });
    },
  },

  analytics: {
    async getForAccount(
      zernioAccountId: string,
      startDate: string,
      endDate: string
    ): Promise<ZernioAccountAnalytics> {
      const params = new URLSearchParams({ accountId: zernioAccountId, startDate, endDate });
      return zernioFetch<ZernioAccountAnalytics>(`/analytics?${params.toString()}`);
    },

    async getBestTime(zernioAccountId: string): Promise<unknown> {
      const params = new URLSearchParams({ accountId: zernioAccountId });
      return zernioFetch<unknown>(`/analytics/best-time?${params.toString()}`);
    },

    async getFollowerStats(zernioAccountId: string): Promise<unknown> {
      const params = new URLSearchParams({ accountId: zernioAccountId });
      return zernioFetch<unknown>(`/accounts/follower-stats?${params.toString()}`);
    },

    async getDeepAnalytics(
      zernioAccountId: string,
      endpoint: DeepAnalyticsEndpoint
    ): Promise<unknown> {
      const params = new URLSearchParams({ accountId: zernioAccountId });
      return zernioFetch<unknown>(`/analytics/${endpoint}?${params.toString()}`);
    },

    async getAccountAnalytics(
      zernioAccountId: string,
      path: string
    ): Promise<unknown> {
      return zernioFetch<unknown>(`/accounts/${zernioAccountId}/${path}`);
    },

    async getProfileAnalytics(
      profileId: string,
      endpoint: ProfileAnalyticsEndpoint,
      params?: Record<string, string>
    ): Promise<unknown> {
      const searchParams = new URLSearchParams({ profileId, ...params });
      return zernioFetch<unknown>(`/analytics/${endpoint}?${searchParams.toString()}`);
    },
  },
};
