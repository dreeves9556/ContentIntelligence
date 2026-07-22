import { normalizeFollowerStatsResponse } from "../follower-stats";

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

const multiAccountResponse = {
  stats: {
    instagramAccount: [
      { date: "2026-07-20", followers: 900 },
      { date: "2026-07-21", followers: 901 },
    ],
    tiktokAccount: [
      { date: "2026-07-20", followers: 2600 },
      { date: "2026-07-21", followers: 2610 },
    ],
  },
};

const instagram = normalizeFollowerStatsResponse(
  multiAccountResponse,
  "instagramAccount"
);
assert(
  instagram.points.map((point) => point.followerCount).join(",") === "900,901",
  "requested account receives only its own follower series"
);

const missing = normalizeFollowerStatsResponse(
  multiAccountResponse,
  "unknownAccount"
);
assert(
  missing.points.length === 0,
  "missing account id never falls back to a multi-account response"
);

const singleAccountFallback = normalizeFollowerStatsResponse(
  { stats: { providerAlias: [{ date: "2026-07-21", followers: 42 }] } },
  "requestedAccount"
);
assert(
  singleAccountFallback.points[0]?.followerCount === 42,
  "single-account responses tolerate a provider alias key"
);

const invalid = normalizeFollowerStatsResponse(
  { points: [{ date: "2026-07-21", followers: "not-a-number" }] },
  "requestedAccount"
);
assert(invalid.points.length === 0, "invalid numeric values are rejected");
