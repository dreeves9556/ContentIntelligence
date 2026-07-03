export interface RssFeedConfig {
  name: string;
  url: string;
  category: "social_media" | "content_marketing" | "creator_coaching" | "business";
}

export interface TrendHeadline {
  feed: string;
  title: string;
  category: RssFeedConfig["category"];
}

const TIER_1_FEEDS: RssFeedConfig[] = [
  { name: "Social Media Examiner", url: "https://www.socialmediaexaminer.com/feed/", category: "social_media" },
  { name: "Sprout Social", url: "https://sproutsocial.com/insights/feed/", category: "social_media" },
  { name: "Hootsuite Blog", url: "https://blog.hootsuite.com/feed/", category: "social_media" },
  { name: "Buffer Blog", url: "https://buffer.com/resources/feed/", category: "social_media" },
  { name: "Influencer Marketing Hub", url: "https://influencermarketinghub.com/feed/", category: "social_media" },
  { name: "HubSpot Marketing", url: "https://blog.hubspot.com/marketing/rss.xml", category: "content_marketing" },
  { name: "Copyblogger", url: "https://copyblogger.com/feed/", category: "content_marketing" },
  { name: "Convince & Convert", url: "https://www.convinceandconvert.com/feed/", category: "content_marketing" },
  { name: "Gary Vaynerchuk", url: "https://www.garyvaynerchuk.com/feed/", category: "creator_coaching" },
  { name: "Smart Passive Income", url: "https://www.smartpassiveincome.com/blog/feed/", category: "creator_coaching" },
  { name: "Neil Patel Blog", url: "https://neilpatel.com/blog/feed/", category: "creator_coaching" },
  { name: "Fast Company", url: "https://www.fastcompany.com/latest/rss", category: "business" },
];

const FETCH_TIMEOUT_MS = 4000;
const MAX_ENTRIES_PER_FEED = 3;
const MAX_TOTAL_HEADLINES = 10;

function extractItemTitles(xml: string, maxItems: number): string[] {
  const titles: string[] = [];
  const itemRegex = /<item[\s>][\s\S]*?<\/item>/gi;
  const titleRegex = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;

  const items = xml.match(itemRegex) ?? [];
  for (const item of items) {
    if (titles.length >= maxItems) break;
    const match = item.match(titleRegex);
    if (match) {
      const title = match[1].trim()
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
      if (title.length > 10) titles.push(title);
    }
  }
  return titles;
}

async function fetchFeedHeadlines(feed: RssFeedConfig): Promise<TrendHeadline[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: { "User-Agent": "CoreOS/1.0 RSS Reader", "Accept": "application/rss+xml, application/xml, text/xml" },
      next: { revalidate: 3600 },
    });

    clearTimeout(timer);

    if (!res.ok) return [];

    const xml = await res.text();
    const titles = extractItemTitles(xml, MAX_ENTRIES_PER_FEED);

    return titles.map((title) => ({ feed: feed.name, title, category: feed.category }));
  } catch {
    return [];
  }
}

export async function fetchTrendingHeadlines(): Promise<TrendHeadline[]> {
  const results = await Promise.allSettled(TIER_1_FEEDS.map(fetchFeedHeadlines));

  const all: TrendHeadline[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      all.push(...result.value);
    }
  }

  // Shuffle and cap to keep prompt concise
  const shuffled = all.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, MAX_TOTAL_HEADLINES);
}
