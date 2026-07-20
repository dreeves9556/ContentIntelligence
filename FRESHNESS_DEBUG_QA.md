# Freshness Debug Panel — Manual QA Checklist

## Prerequisites
- [ ] Admin account exists with ADMIN role
- [ ] At least one client user exists with archived posts (ContentArchive records)
- [ ] At least one client user exists with NO archived posts (new user edge case)
- [ ] Database migration `20260720042809_add_calendar_generation_log` applied

## 1. Admin Roster Link
- [ ] Navigate to `/admin` (admin roster page)
- [ ] Verify Activity icon (pulse/heartbeat) appears next to each user in the Manage column
- [ ] Verify Activity icon appears in mobile card view (sm:hidden layout)
- [ ] Click the Activity icon for a user with archived posts → should navigate to `/admin/clients/[id]/freshness`
- [ ] Click the Activity icon for a user with NO posts → should load page with "N/A" and empty states

## 2. Freshness Debug Page — Overview Stats
- [ ] Page header shows "Freshness Debug" with user email and join date
- [ ] "Back to Client" link navigates to `/admin/clients/[id]/questionnaires`
- [ ] "Archived Posts" count matches ContentArchive count for this user
- [ ] "Generations" count shows number of unique weekStarting values
- [ ] "Freshness Score" shows numeric score (0-100) or "N/A" if <8 posts
- [ ] "Staleness Warning" shows "Triggered" (red) if score < 50, "OK" (green) otherwise

## 3. Freshness Score Breakdown
- [ ] Three sub-scores visible: Archetype Diversity, Theme Diversity, Hook Similarity
- [ ] Each shows percentage value and weight description
- [ ] If staleness triggered, red warning banner appears with explanation

## 4. Archetype Distribution
- [ ] Bar chart shows each archetype with percentage bar and count
- [ ] Overused archetypes (>35%) show amber warning callout
- [ ] Underused archetypes (<10%) show emerald suggestion callout
- [ ] For users with 0 posts, shows "No archived posts to analyze"

## 5. Recent Hooks
- [ ] Shows up to 15 most recent post titles + hooks
- [ ] Each entry shows title, hook text, and week starting date
- [ ] For users with 0 posts, shows "No archived posts"

## 6. Repeated Themes
- [ ] Theme tags appear as pill/badge elements
- [ ] For users with <5 posts, shows "No repeated themes detected (needs 5+ posts)"

## 7. Untapped Questionnaire Material
- [ ] Lists questionnaire items not yet used in posts (status: "fresh")
- [ ] Each shows label and snippet (first 80 chars)
- [ ] If all material used, shows "All questionnaire material has been explored in posts"
- [ ] If no questionnaire data, shows "No questionnaire data or insufficient posts for analysis"

## 8. Context Survey Status
- [ ] Three survey types shown: Weekly Context, Monthly Context, Story Refresh
- [ ] Each shows status: Current (green check), Expired (amber warning), or Missing (red X)
- [ ] Updated date shown for existing surveys
- [ ] Weekly Context: expired if updated before last Sunday
- [ ] Monthly Context: expired if updated before 1st of current month
- [ ] Story Refresh: expired if updated >42 days ago

## 9. Generation Logs
- [ ] Shows up to 10 most recent generation log entries
- [ ] Each entry shows success/failure icon, days generated, timestamp
- [ ] Freshness score, constraints mode, staleness/fatigue triggers shown when available
- [ ] Duration shown in seconds
- [ ] Error message shown in red for failed generations
- [ ] Prompt Block Audit section shows included blocks (with priority letter), trimmed blocks (with ✂), omitted blocks (strikethrough)
- [ ] For users with no generations, shows "No generation logs yet"

## 10. Access Control
- [ ] Non-admin user navigating directly to `/admin/clients/[id]/freshness` → 404 (notFound)
- [ ] `getFreshnessDebugData()` returns null for non-ADMIN sessions
- [ ] Non-existent user ID → 404

## 11. Generation Logging (requires calendar generation)
- [ ] Generate a calendar for a test user
- [ ] Verify a `CalendarGenerationLog` record was created with `success: true`
- [ ] Verify `daysGenerated` matches the calendar day count
- [ ] Verify `freshnessScore` is populated (if ≥8 posts) or null
- [ ] Verify `blockMetadata` contains `included`, `trimmed`, `omitted` arrays
- [ ] Verify `durationMs` is a positive number
- [ ] Trigger a failed generation (e.g., invalid API key temporarily) → verify log with `success: false` and `errorMessage`

## 12. Prompt Budget Manager
- [ ] Verify `buildBudgetedPrompt()` with small blocks returns all blocks included, none trimmed/omitted
- [ ] Verify with blocks exceeding maxChars: LOW priority blocks omitted first
- [ ] Verify CRITICAL blocks are always included even if total exceeds budget
- [ ] Verify trimmed blocks have `trimmed: true` in metadata and reduced `finalChars`
- [ ] Verify `omit_if_over` strategy drops block entirely when over budget

## 13. TypeScript Compilation
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] No runtime errors in browser console when navigating to debug page
