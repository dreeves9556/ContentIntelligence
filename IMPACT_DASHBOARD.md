# Impact Dashboard — Formulas, Eligibility, and Data Safety

## Eligible Population

Impact metrics include connected accounts owned by `USER` or `TEAM_ADMIN`
members whose account status is `ACTIVE`, `TRIAL`, or `COMPED`.

- Global `ADMIN` accounts are excluded from customer impact metrics.
- Expired, past-due, canceled, archived, and locked accounts are excluded.
- Posts must belong to a currently eligible connected user/platform pair.
- Rows marked `isDemo = true` are excluded everywhere.

## Post Provenance

`PostAnalytics.platform` is the normalized social platform. It is separate from
`format`, which may describe a content format such as `REEL` or `CAROUSEL`.

New Zernio syncs prefer the provider's `views` value. `impressions` is used only
when views are unavailable. The two values are never combined with `max()`.

## Engagement Rate

**Formula:** `sum(likes + comments) / sum(views) * 100`

- The calculation is weighted by views.
- Zero-view posts are excluded from both numerator and denominator.
- Every baseline and current-period query is scoped to one user and platform.
- Current engagement uses platform-attributed posts from the last 30 days.
- Baseline engagement uses the first 30 days beginning at the valid follower baseline.
- Missing platform data returns `null`; another platform's posts are never substituted.

## Follower Growth

**Account formula:** `currentFollowers - baselineFollowers`

**Member growth percentage:**
`(sum(currentFollowers) - sum(baselineFollowers)) / sum(baselineFollowers) * 100`

- The overview averages member-level percentages, so members with multiple
  accounts do not receive extra weight.
- A baseline must be on or after the UTC day the account was connected.
- Accounts with a zero baseline are excluded from percentage averages.
- Histories are quarantined when two platforms for the same user have identical
  non-zero values for their three most recent overlapping snapshots.
- Quarantined histories are excluded until three fresh, divergent snapshots exist.

## Follower Time Series

The chart processes follower snapshots chronologically and carries each account's
latest known value forward. An account no longer disappears from the total merely
because it lacks a snapshot on a later date.

Only eligible, non-quarantined connected accounts are included.

## Active Member Definition

An eligible connected member is active when either condition is true:

- They generated a calendar in the last 30 days.
- At least one connected account completed both analytics and follower syncs in
  the last 30 days.

Calendar users without a connected eligible account are not included.

## Sync Freshness

A sync is stale when `lastSyncAt` is null or older than seven days.

`lastSyncAt` is updated per account only after both the post-analytics request and
the follower-history request succeed. Success on one account never refreshes a
different account's timestamp.

## Data Quality

The dashboard reports:

- Eligible users without connected accounts
- Accounts without valid post-connection baselines
- Accounts without recent successful syncs
- Accounts without platform-matching post analytics
- Suspicious duplicated follower histories
- Accounts with valid, usable baselines

## Attribution Caveat

All growth figures are observed changes for connected accounts. They do not prove
that The Local Post caused the result. Sales and AI copy must use terms such as
"tracked net change," "observed growth," and "correlation."
