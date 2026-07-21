# Impact Dashboard — Formulas & Caveats

## Engagement Rate

**Formula:** `sum(likes + comments) / sum(views) * 100`

- Zero-view posts are excluded from the calculation
- This is a **weighted average** (not a simple mean of per-post rates)
- Weighted = total interactions across all posts / total views across all posts
- Returns `null` if all posts have 0 views or no posts exist

## Follower Growth

**Formula:** `currentFollowers - baselineFollowers`

- `growthPercent = gained / baselineFollowers * 100`
- Accounts with `null` or `0` baseline follower count are **excluded** from growth% averages (to avoid division by zero or infinity)
- Total followers gained includes all accounts with valid baselines

## Engagement Lift

**Formula:** `currentEngagementRate - baselineEngagementRate`

- Only computed when both baseline and current engagement rates are non-null
- Current engagement = weighted rate from posts in last 30 days
- Baseline engagement = weighted rate from first 30 days of posts after baseline date

## Baseline Date

- Set to the date of the earliest `FollowerStats` record for that user/platform
- If no follower stats exist, baseline is not created (returns `"missing_data"`)
- The 30-day window for engagement baseline starts from `baselineDate`

## Active User Definition

A user is "active" if **either**:
- They generated a calendar in the last 30 days (`Calendar.createdAt`)
- They synced analytics in the last 30 days (`ZernioAccount.lastSyncAt`)

## Stale Sync Definition

A sync is "stale" if `lastSyncAt` is more than 7 days ago, or `lastSyncAt` is null.

## Caveats

1. **No guaranteed attribution**: Growth may be influenced by factors outside The Local Post (seasonal trends, viral content, external marketing, algorithm changes)
2. **Baseline accuracy depends on data availability**: If a member connected their account after already having followers for months, the baseline captures their count at connection time, not at original account creation
3. **Engagement baselines require post data**: If no posts were published in the first 30 days after baseline, engagement baseline is null
4. **Backfill is create-only**: `ensureBaselineForUserPlatform` never overwrites existing baselines. Use "Recalculate Engagement Baselines" to overwrite engagement fields
5. **Per-account post analytics query**: `getMemberGrowthRows` queries post analytics per-account in a loop. Acceptable for admin-only page with limited accounts, but should be optimized if account count grows significantly
6. **Time series uses daily follower snapshots**: Gaps in daily data may cause stepped charts rather than smooth curves
