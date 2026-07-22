import {
  accountKey,
  computeWeightedEngagementRate,
  findDuplicatedFollowerSeries,
  type FollowerObservation,
} from "../impact-math";

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

const rate = computeWeightedEngagementRate([
  { views: 100, likes: 8, comments: 2 },
  { views: 0, likes: 999, comments: 999 },
]);
assert(rate === 10, "zero-view posts are fully excluded from engagement rate");

const observations: FollowerObservation[] = [];
for (const [index, count] of [100, 105, 110].entries()) {
  const date = new Date(Date.UTC(2026, 6, 20 + index));
  observations.push(
    { userId: "user-1", platform: "instagram", date, followerCount: count },
    { userId: "user-1", platform: "tiktok", date, followerCount: count }
  );
}

const duplicated = findDuplicatedFollowerSeries(observations);
assert(
  duplicated.has(accountKey("user-1", "instagram")) &&
    duplicated.has(accountKey("user-1", "tiktok")),
  "identical cross-platform follower histories are quarantined"
);

observations.push({
  userId: "user-1",
  platform: "instagram",
  date: new Date(Date.UTC(2026, 6, 23)),
  followerCount: 111,
});
observations.push({
  userId: "user-1",
  platform: "tiktok",
  date: new Date(Date.UTC(2026, 6, 23)),
  followerCount: 120,
});
observations.push({
  userId: "user-1",
  platform: "instagram",
  date: new Date(Date.UTC(2026, 6, 24)),
  followerCount: 112,
});
observations.push({
  userId: "user-1",
  platform: "tiktok",
  date: new Date(Date.UTC(2026, 6, 24)),
  followerCount: 130,
});
observations.push({
  userId: "user-1",
  platform: "instagram",
  date: new Date(Date.UTC(2026, 6, 25)),
  followerCount: 113,
});
observations.push({
  userId: "user-1",
  platform: "tiktok",
  date: new Date(Date.UTC(2026, 6, 25)),
  followerCount: 140,
});

const recovered = findDuplicatedFollowerSeries(observations);
assert(
  recovered.size === 0,
  "three fresh divergent snapshots release a quarantined account"
);
