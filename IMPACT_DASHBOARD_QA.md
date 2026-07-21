# Impact Dashboard QA Checklist

## Access Control
- [ ] `/admin/impact` redirects non-ADMIN users to `/dashboard`
- [ ] `/admin/impact` redirects unauthenticated users to `/login`
- [ ] `getImpactData()` returns `{ error: "Unauthorized" }` for non-ADMIN sessions
- [ ] `backfillBaselines()` returns `{ success: false, error: "Unauthorized" }` for non-ADMIN
- [ ] `recalculateEngagementBaselinesAction()` returns `{ success: false, error: "Unauthorized" }` for non-ADMIN
- [ ] Admin sidebar shows "Impact Dashboard" nav item with TrendingUp icon

## Overview Cards
- [ ] 8 cards render: Connected Members, Connected Accounts, Total Followers Gained, Avg Follower Growth, Avg Engagement Lift, Total Views Tracked, Total Posts Tracked, Active Users (30d)
- [ ] Numbers format correctly (K/M suffix for large numbers)
- [ ] Percentages show +/- sign prefix
- [ ] Cards display "0" or "—" when no data available

## Charts
- [ ] Total Follower Growth line chart renders when follower data exists
- [ ] Engagement Rate Trend line chart renders when post data exists
- [ ] Growth by Platform bar chart renders with platform labels
- [ ] Cohort Growth bar chart renders with YYYY-MM cohort labels
- [ ] Empty state messages show when no data for each chart
- [ ] Charts use CSS variables for theme compatibility (light/dark)
- [ ] Tooltips show formatted values

## Active vs Inactive Comparison
- [ ] Shows active member count and inactive member count
- [ ] Avg follower growth, engagement rate, and posts tracked display for both groups
- [ ] Section hidden when both active and inactive counts are 0

## Copyable Sales Stats
- [ ] 3 stat cards render: Follower Growth, Engagement Lift, Usage Correlation
- [ ] Copy button copies text to clipboard
- [ ] Check icon appears for 2 seconds after copy
- [ ] All text uses "tracked growth", "since joining" language
- [ ] No individual member names in copied text
- [ ] No guaranteed attribution claims

## Member Growth Table
- [ ] All connected accounts appear as rows
- [ ] Columns: Member, Platform, Baseline, Start, Current, Gained, Growth %, Base Eng., Current Eng., Eng. Lift, Last Sync, Status, Plan
- [ ] Sortable by: followersGained, growthPercent, engagementLift, lastSyncAt
- [ ] Sort arrows toggle asc/desc on click
- [ ] Platform filter dropdown works
- [ ] Status filter (All/Active/Inactive) works
- [ ] Plan filter works
- [ ] Stale syncs show "STALE" status
- [ ] Null values show "—" not "null" or "undefined"
- [ ] Positive growth shows green, negative shows red

## Data Quality Panel
- [ ] 6 metrics display: users without accounts, accounts without baselines, accounts without recent sync, accounts without post analytics, stale syncs, accounts with valid baselines
- [ ] Each shows value/total format
- [ ] Numbers match actual database state

## Baseline Management
- [ ] "Backfill Missing Baselines" button triggers `backfillBaselines()`
- [ ] Loading spinner shows during backfill
- [ ] Result message shows created/skipped/missing counts
- [ ] "Recalculate Engagement Baselines" shows confirmation dialog
- [ ] Confirm triggers recalculation, Cancel dismisses
- [ ] Result message shows updated/skipped counts
- [ ] Error messages display on failure

## Background Baseline Creation
- [ ] `syncSingleAccount` calls `ensureBaselineForUserPlatform` after follower stats sync
- [ ] Baseline creation failure does NOT block analytics sync
- [ ] Zernio callback calls `ensureBaselineForUserPlatform` after account upsert
- [ ] Baseline creation failure does NOT block account connection

## Edge Cases
- [ ] No connected accounts → overview shows zeros, table shows empty state, charts show empty state
- [ ] No follower stats → baselines missing, data quality panel reflects gap
- [ ] No post analytics → engagement baselines null, engagement lift shows "—"
- [ ] Baseline follower count is 0 → growth% excluded from averages (not infinity)
- [ ] All views are 0 → engagement rate is null (not NaN)

## Performance
- [ ] Page loads in reasonable time with 50+ connected accounts
- [ ] No N+1 query issues in `getMemberGrowthRows` (note: currently queries post analytics per-account in loop — acceptable for admin-only page with limited accounts, but monitor)
- [ ] `getImpactData` runs all independent queries in parallel via `Promise.all`

## Theme
- [ ] Light mode renders correctly
- [ ] Dark mode renders correctly
- [ ] All colors use CSS variables, no hardcoded hex values (except chart colors where appropriate)
