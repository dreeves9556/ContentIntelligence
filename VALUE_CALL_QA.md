# Value Call QA Checklist

## Admin

1. [ ] ADMIN can open `/admin/value-call`
2. [ ] USER cannot open `/admin/value-call` (redirected to `/dashboard`)
3. [ ] TEAM_ADMIN cannot open `/admin/value-call` (redirected to `/dashboard`)
4. [ ] Admin can enable/disable Value Call
5. [ ] Admin can set title
6. [ ] Admin can set description
7. [ ] Admin can set date/time
8. [ ] Admin can set timezone
9. [ ] Admin can set Zoom URL
10. [ ] Invalid Zoom URL (not starting with `https://`) is rejected
11. [ ] Empty date/time is rejected when enabled
12. [ ] Save persists after refresh
13. [ ] Live preview card updates as fields change

## User

1. [ ] Active PRO user sees `/dashboard/value-call` in sidebar
2. [ ] TEAM_ADMIN sees `/dashboard/value-call` in sidebar
3. [ ] CALENDAR_ONLY user sees locked nav item with lock icon
4. [ ] CALENDAR_ONLY user sees locked overlay if they navigate to the page directly
5. [ ] If no call scheduled, user sees "No Value Call is scheduled yet."
6. [ ] If future call scheduled, countdown displays
7. [ ] Countdown updates every second
8. [ ] Before call starts, Zoom link is hidden (locked button shown)
9. [ ] At call start, "Join Value Call" button appears with live indicator
10. [ ] Join button opens Zoom URL in new tab
11. [ ] After live window expires (2h), ended state appears
12. [ ] Page works on mobile
13. [ ] Page works in light and dark mode

## Navigation

1. [ ] Dashboard sidebar has Value Call tab after Billing
2. [ ] Admin sidebar has Value Call tab between Creator Memories and Bug Reports
3. [ ] Active nav state works (highlighted when on the page)
4. [ ] Login flow unaffected
5. [ ] Dashboard routes unaffected

## Build

1. [ ] Prisma migration created (`20260721040854_add_value_call_settings`)
2. [ ] `npx prisma generate` passes
3. [ ] `npm run build` passes
