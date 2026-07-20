# Team Admin / Organization QA Checklist

Manual test checklist for the Organization / Team Admin system.
Run these against a staging environment before deploying to production.

## 1. Admin: Organization CRUD

### 1.1 Create Organization (New Team Admin)
- [ ] Go to `/admin/organizations` as ADMIN
- [ ] Click "Create Organization"
- [ ] Fill in name, seat limit (e.g. 5), seat plan (e.g. Creator), team admin email (new user)
- [ ] Submit — org should be created, invite email sent
- [ ] Verify org appears in list with 0 active users, 1 pending invite, 1 used seat
- [ ] Verify the team admin email received an invite

### 1.2 Create Organization (Existing User)
- [ ] Create org with team admin email of an existing USER
- [ ] Verify user is promoted to TEAM_ADMIN, plan updated to seat plan
- [ ] Verify user's `organizationId` is set to the new org
- [ ] Verify no invite email is sent (user already has an account)

### 1.3 Create Organization (Validation)
- [ ] Try creating org with empty name — should error
- [ ] Try creating org with seat limit 0 — should error
- [ ] Try creating org with invalid email — should error
- [ ] Try creating org with an ADMIN user's email — should error "Cannot assign a global admin"
- [ ] Try creating org with a TEAM_ADMIN who already has an org — should error

### 1.4 Update Organization
- [ ] Edit org name — verify name and slug update
- [ ] Edit seat limit — verify new limit is enforced on invites
- [ ] Edit seat plan — verify all non-ADMIN members' plans are updated
- [ ] Edit seat plan — verify ADMIN members' plans are NOT changed

### 1.5 Delete Organization
- [ ] Delete an org with members — verify members' `organizationId` is set to null
- [ ] Verify members keep their accounts (not deleted)
- [ ] Verify pending invites for the org are deleted
- [ ] Verify the org no longer appears in the list
- [ ] Verify a deleted org's former TEAM_ADMIN can no longer access `/dashboard/team`

## 2. Team Admin: Access Control

### 2.1 Route Protection
- [ ] As TEAM_ADMIN, try navigating to `/admin` — should be redirected
- [ ] As TEAM_ADMIN, try navigating to `/admin/organizations` — should be redirected
- [ ] As USER, try navigating to `/dashboard/team` — should be redirected
- [ ] As USER without org, try navigating to `/dashboard/team` — should be redirected
- [ ] As ADMIN, verify `/dashboard/team` is NOT in nav (only "Admin" link)

### 2.2 Navigation
- [ ] As TEAM_ADMIN, verify "Team Roster" appears in dashboard nav
- [ ] As TEAM_ADMIN, verify "Admin" does NOT appear in dashboard nav
- [ ] As USER, verify neither "Team Roster" nor "Admin" appears in nav
- [ ] As ADMIN, verify "Admin" appears in nav but not "Team Roster"

## 3. Team Admin: Roster Management

### 3.1 Invite Team Member
- [ ] As TEAM_ADMIN, go to `/dashboard/team`
- [ ] Invite a new member with valid email
- [ ] Verify invite appears in "Pending Invites" list
- [ ] Verify seat usage count increases by 1
- [ ] Verify invite email is sent
- [ ] Verify "Pending invites reserve a seat" helper text is shown

### 3.2 Seat Limit Enforcement
- [ ] Set org seat limit to 2 (1 team admin + 1 seat)
- [ ] Invite a member — should succeed
- [ ] Invite another member — should fail with "seat limit" error
- [ ] Cancel the pending invite — should free a seat
- [ ] Invite again — should succeed

### 3.3 Cancel Invite
- [ ] Cancel a pending invite — verify it disappears from list
- [ ] Verify seat usage decreases by 1
- [ ] Try visiting the cancelled invite's registration link — should be invalid

### 3.4 Resend Invite
- [ ] Resend a pending invite — verify a new email is sent
- [ ] Verify the old token is invalidated (old link should not work)

### 3.5 Remove Team Member
- [ ] Remove a team member — verify they disappear from roster
- [ ] Verify removed user's `organizationId` is set to null
- [ ] Try removing yourself (TEAM_ADMIN) — should error
- [ ] Try removing an ADMIN — should error

### 3.6 Cross-Org Protection
- [ ] As TEAM_ADMIN of org A, try to cancel an invite from org B — should fail
- [ ] As TEAM_ADMIN of org A, try to remove a member of org B — should fail
- [ ] As TEAM_ADMIN of org A, try to resend an invite from org B — should fail

## 4. Registration via Invite

### 4.1 Normal Registration
- [ ] Click registration link from invite email
- [ ] Set password, submit — should redirect to onboarding
- [ ] Verify user is created with correct role (USER) and plan (org's seat plan)
- [ ] Verify user's `organizationId` is set to the org
- [ ] Verify invite token is deleted (single-use)
- [ ] Try visiting the same registration link again — should be invalid

### 4.2 Expired Invite
- [ ] Wait for invite to expire (or manually set `expiresAt` to past)
- [ ] Visit registration link — should show "expired" message

### 4.3 Team Admin Registration
- [ ] Use a team admin invite link (from org creation)
- [ ] Register — verify user is created with role TEAM_ADMIN
- [ ] Verify user can access `/dashboard/team`

### 4.4 ADMIN Role Blocking
- [ ] Manually create an invite token with `inviteRole: ADMIN`
- [ ] Visit the registration link — should show "invalid" error
- [ ] Verify no user is created

### 4.5 Deleted Org Registration
- [ ] Create an org, generate an invite, then delete the org
- [ ] Visit the registration link — should show "organization no longer exists" error

## 5. Admin: Role Management

### 5.1 Promote USER to TEAM_ADMIN
- [ ] As ADMIN, go to client roster
- [ ] Try to promote a USER with no org to TEAM_ADMIN — should error
- [ ] Assign user to an org first, then promote to TEAM_ADMIN — should succeed

### 5.2 Promote TEAM_ADMIN to ADMIN
- [ ] As ADMIN, promote a TEAM_ADMIN to ADMIN
- [ ] Verify user's `organizationId` is cleared (set to null)
- [ ] Verify user can now access `/admin`
- [ ] Verify user can no longer access `/dashboard/team`

### 5.3 Demote TEAM_ADMIN to USER
- [ ] As ADMIN, demote a TEAM_ADMIN to USER
- [ ] Verify user's `organizationId` is kept (still in org)
- [ ] Verify user can no longer access `/dashboard/team`
- [ ] Verify user appears as a regular member in the org's roster

## 6. Plan Inheritance

### 6.1 Seat Plan Propagation
- [ ] Create org with seat plan CALENDAR_ONLY
- [ ] Invite a member — verify their plan is CALENDAR_ONLY
- [ ] Change org seat plan to PRO
- [ ] Verify all non-ADMIN members' plans are updated to PRO
- [ ] Verify ADMIN members' plans are NOT changed

### 6.2 Plan Gating
- [ ] As a USER with CALENDAR_ONLY plan in an org, verify Analytics is locked
- [ ] Change org seat plan to PRO
- [ ] Verify the user can now access Analytics (after session refresh)

## 7. Edge Cases

### 7.1 Over-Limit Organizations
- [ ] Create org with seat limit 2, invite 1 member (2 seats used)
- [ ] Reduce seat limit to 1
- [ ] Verify org shows "over limit" warning in admin
- [ ] Verify team admin cannot invite new members
- [ ] Verify existing members are NOT removed

### 7.2 Duplicate Email Invites
- [ ] Invite user@x.com to org A
- [ ] Try inviting user@x.com to org B — should replace org A's invite
- [ ] Verify org A's invite is deleted
- [ ] Verify org B now has the pending invite

### 7.3 Session Refresh
- [ ] As TEAM_ADMIN, have someone change your role to USER via admin
- [ ] Refresh the page — verify you can no longer see Team Roster
- [ ] Verify the JWT callback picked up the role change from DB

## 8. Email Delivery

### 8.1 Team Invite Email
- [ ] Verify invite email shows "The Local Post" branding
- [ ] Verify registration link works
- [ ] Verify email mentions the organization name

### 8.2 Team Admin Invite Email
- [ ] Verify team admin invite email shows "The Local Post" branding
- [ ] Verify email mentions team admin role
- [ ] Verify registration link works

### 8.3 Email Failure Handling
- [ ] Temporarily break Resend API key
- [ ] Create an org with a new team admin — org should still be created
- [ ] Verify success message includes "email failed to send" warning
- [ ] Restore Resend API key
