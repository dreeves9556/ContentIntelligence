# Account Status QA Checklist

## Prerequisites
- [ ] Database migration applied (`npx prisma migrate dev`)
- [ ] Prisma client regenerated (`npx prisma generate`)
- [ ] Dev server running without errors

## 1. Admin Roster — Account Badges Display

### Per-user badges
- [ ] **Tag badge** appears next to user name when `internalTag` is set (e.g. "KWLG", "OWNER", "BETA")
- [ ] **Tag badge** does NOT appear when `internalTag` is null
- [ ] **Status badge** shows correct color/label for each `AccountStatus`:
  - [ ] `ACTIVE` — green
  - [ ] `TRIAL` — blue
  - [ ] `EXPIRED` — amber/orange
  - [ ] `DISABLED` — red
  - [ ] `GRACE_PERIOD` — yellow
- [ ] **Comped badge** appears when `isComped` is true
- [ ] **Comped badge** does NOT appear when `isComped` is false

### Filters
- [ ] Filter by internal tag works (dropdown)
- [ ] Filter by account status works (dropdown)
- [ ] Filter by role works (dropdown)
- [ ] Filter by plan works (dropdown)
- [ ] Clearing a filter resets the roster
- [ ] Multiple filters can be combined

## 2. Admin Roster — Account Manager Modal

### Open & display
- [ ] Clicking "Manage" opens the modal
- [ ] Modal shows current values for: role, plan, accountStatus, internalTag, isComped, compReason, accessExpiresAt, expirationAction

### Edit & save
- [ ] Changing accountStatus and saving updates the DB
- [ ] Changing internalTag and saving updates the DB
- [ ] Toggling isComped and saving updates the DB
- [ ] Setting compReason and saving updates the DB
- [ ] Setting accessExpiresAt and saving updates the DB
- [ ] Changing expirationAction and saving updates the DB
- [ ] Changing plan and saving updates the DB
- [ ] Changing role and saving updates the DB
- [ ] Saved changes are reflected immediately in the roster

### Validation
- [ ] Cannot set expirationAction without accessExpiresAt (or shows warning)
- [ ] Cannot disable an ADMIN user
- [ ] Error messages display for failed updates

## 3. Admin Roster — Bulk Actions

### Selection
- [ ] Selecting individual users via checkbox works
- [ ] Select all checkbox selects/deselects all
- [ ] Bulk action bar appears when ≥1 user selected
- [ ] Selected count displays correctly

### Bulk updates
- [ ] Bulk set internal tag applies to all selected
- [ ] Bulk set account status applies to all selected
- [ ] Bulk toggle comped applies to all selected
- [ ] Bulk set expiration date applies to all selected
- [ ] Bulk set expiration action applies to all selected
- [ ] Bulk set plan applies to all selected
- [ ] Admin override checkbox allows changing ADMIN users
- [ ] Without admin override, ADMIN users are skipped with a warning

## 4. Admin Invite — Preset Selector

- [ ] Preset dropdown appears in invite modal
- [ ] Selecting "KWLG" sets internalTag=KWLG, accountStatus=ACTIVE
- [ ] Selecting "OWNER" sets internalTag=OWNER, accountStatus=ACTIVE, isComped=true
- [ ] Selecting "BETA" sets internalTag=BETA, accountStatus=TRIAL, accessExpiresAt=+30d, expirationAction=DOWNGRADE
- [ ] Selecting "None" clears all preset fields
- [ ] Invited user appears in roster with correct preset values

## 5. Dashboard — Locked State

### Active users
- [ ] Users with `ACTIVE` status see normal dashboard
- [ ] Users with `TRIAL` status see normal dashboard

### Expired/Disabled users
- [ ] Users with `EXPIRED` status see locked dashboard with message
- [ ] Users with `DISABLED` status see locked dashboard with message
- [ ] Locked state shows sign-out button
- [ ] Locked state does NOT show navigation sidebar
- [ ] Locked state does NOT allow access to any dashboard sub-routes

### Grace period
- [ ] Users with `GRACE_PERIOD` status see normal dashboard (not locked)

## 6. /account-expired Page

- [ ] Page renders at `/account-expired`
- [ ] Shows expiration message
- [ ] Sign-out button works
- [ ] Page is accessible without authentication

## 7. Team Roster — Read-Only Status

### Member display
- [ ] Tag badge appears next to team member name when `internalTag` is set
- [ ] Status badge appears next to team member name
- [ ] Comped badge appears when `isComped` is true
- [ ] Badges are read-only (no edit controls)
- [ ] Badges appear in both mobile and desktop views

## 8. Admin Organizations — Account Badges

### Member display
- [ ] Tag badge appears next to org member name when `internalTag` is set
- [ ] Status badge appears next to org member name
- [ ] Comped badge appears when `isComped` is true
- [ ] Badges appear in expanded org member list

## 9. Session — accountStatus in JWT

- [ ] After login, `session.user.accountStatus` is populated
- [ ] Changing accountStatus in admin is reflected on user's next page load (JWT refresh)
- [ ] Disabling a user causes their next page load to show locked state

## 10. Expiration Processing

### Preview
- [ ] `adminPreviewExpirations` returns list of users with upcoming/past expirations
- [ ] Preview shows correct user, expiration date, and planned action

### Process
- [ ] `adminProcessExpirations` processes all expired users
- [ ] Users with `expirationAction=DOWNGRADE` get plan set to `CALENDAR_ONLY` and status set to `EXPIRED`
- [ ] Users with `expirationAction=DISABLE` get status set to `DISABLED`
- [ ] Email stubs are called (check console logs)
- [ ] `lastAccessCheckAt` is updated after processing

## 11. Edge Cases

- [ ] User with no `accessExpiresAt` is never expired
- [ ] User with `accessExpiresAt` in the future is not expired
- [ ] User with `accountStatus=ACTIVE` and `accessExpiresAt` in the past but `expirationAction=null` is not auto-processed
- [ ] ADMIN users are never blocked by dashboard access check
- [ ] Organization seat count is unaffected by account status changes
