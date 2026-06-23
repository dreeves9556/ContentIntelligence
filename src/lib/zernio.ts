const ZERNIO_BASE = "https://zernio.com/api/v1";

function apiKey() {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) throw new Error("ZERNIO_API_KEY is not set");
  return key;
}

async function zernioFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${ZERNIO_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
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
  accountId: string;
  platform: string;
  posts: Array<{
    _id: string;
    content: string;
    publishedAt: string;
    metrics: {
      impressions?: number;
      likes?: number;
      comments?: number;
      clicks?: number;
    };
  }>;
}

export const zernio = {
  profiles: {
    async create(name: string): Promise<ZernioProfile> {
      const data = await zernioFetch<{ profile: ZernioProfile }>("/profiles", {
        method: "POST",
        body: JSON.stringify({ name, description: "CoreOS user profile" }),
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
      const params = new URLSearchParams({ startDate, endDate });
      return zernioFetch<ZernioAccountAnalytics>(
        `/analytics/account/${zernioAccountId}?${params.toString()}`
      );
    },

    async getForPost(zernioPostId: string): Promise<ZernioPostAnalytics> {
      return zernioFetch<ZernioPostAnalytics>(`/analytics/${zernioPostId}`);
    },
  },
};
