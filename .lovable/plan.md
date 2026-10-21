# Ramanujan Academy Connect — Review and SaaS Roadmap

Read-only review. Nothing was changed.

## 0. Biggest finding: the code and the live database don't match

- The repo has 41 files in `supabase/migrations/` (finance, fee structures, receipts, `user_profiles`, parent-portal RPCs, notification queues). They are **not in the live database**: it has 28 public tables, and both `user_profiles` and `fee_structures` are missing.
- Only the 3 Drizzle migrations (geofence, owner role, admin_staff) were actually applied.
- Code that depends on the missing objects breaks when it runs. Examples:
  - `manage-admin-staff` checks the owner against `user_profiles`, which doesn't exist. Creating an admin will fail.
  - The Parent Portal calls `parent_login_by_access_code` and `get_parent_portal_messages`.
  - FinanceCommandCentre, FinanceLedgerWorkspace and FinanceOwnerBooks need finance tables.
- **Unverified:** whether those 41 files were applied to some other database, and whether published finance screens currently work. Phase 0 settles this.

## 1. What exists and should be reused

- Routes: `/` (public site), `/enquiry`, `/admin` + `/admin/dashboard` (admin staff), `/owner` + `/owner/dashboard`, `/teacher`, `/parent`, `/ai` (online students), `/admin/ai-paper-checker`.
- Roles: `user_roles` with an `app_role` enum (owner/admin/user) and a `has_role()` security-definer function. This is the right pattern to extend.
- Modules worth keeping:
  - Enquiry intake with promotion to student.
  - Students (offline/online) and their access codes.
  - Teacher salary: 3 lates = half day, ESSL import, payroll.
  - Geofenced attendance for teachers and admins.
  - Student attendance, tests/results, online tests.
  - Announcements, Zoom links, RA points, AI study hub (`study-assistant`).
  - Finance UI components (backend not applied yet).
- Integrations:
  - Lovable AI (`LOVABLE_API_KEY`) and Lovable Cloud auth/storage.
  - `test-photos` bucket, which is public.
  - WhatsApp Meta API was planned but its credentials were never provided.
- Mobile:
  - Capacitor config with HashRouter on native.
  - GitHub Android build workflow.
  - Per-role web manifests and a basic service worker that caches the app shell. Fine for an installable app; no offline data.

## 2. Critical security and isolation issues (fix before any external institute)

Severity is for Ramanujan alone. For multi-tenant use, every one of these is a blocker.

1. **Anonymous read and write on sensitive tables.** The policies use `true` for the public role:
   - `tests` and `test_results`: anyone can insert, update or delete, so anyone can change marks.
   - `online_test_submissions` and `online_test_answers`: anyone can read and update them.
   - `ra_points`: anyone can update anyone's points.
   - `student_chat_messages`: anyone can read or delete any student's chats.
   - `student_complaints`, `student_attendance`, `teacher_attendance`, `class_logs`: anyone can read them.
   - `enquiries`: anyone can read them, which exposes parents' phone numbers and children's dates of birth.
   - `teachers`: anyone can read them, including **access codes**. That is effectively a public list of teacher passwords.
2. **Access-code logins rely on the browser.** Teacher and parent sessions are just codes and IDs stored in the browser. The AI function trusts a `teacherId` and code sent from the browser. Codes are 8 hex characters with no rate limit.
3. **Owner/admin split is incomplete.** Older policies check `has_role('admin')`. Owner accounts were backfilled from admin, so it's unclear whether owners still have the `admin` row. Owners may be locked out of older tables, or admins may have owner-level finance access. Needs a query to confirm.
4. **No tenant concept anywhere.** There's no `institute_id`. Names like "Ramanujan" and "RA points" are hardcoded, and one geofence row is assumed.
5. **The `test-photos` bucket is public**, so answer-sheet photos can be opened by anyone with the link.
6. **Edge functions** use the older client code pattern. `create-admin` needs a review to make sure anonymous callers can't use it to create an admin.

## 3. Phased roadmap and acceptance tests

### Phase 0: Reconcile the database (internal, about 1 session)
- Diff the 41 repo migrations against the live database. Decide for each file: apply, rewrite, or retire.
- Apply them additively through the migration tool. Regenerate types.
- Fix `manage-admin-staff` so it uses `user_roles`, or create `user_profiles`. One source of truth only.
- Acceptance:
  - Every table and function the code references exists.
  - The owner can create an admin.
  - The parent login function works.
  - Finance screens load without errors.

### Phase 1: Lock down Ramanujan (internal hardening)
- Replace every `true` write policy with role-scoped policies.
- Move teacher and parent access-code logins to a server-side function that issues a short-lived signed session, with rate limits. Hide access codes from SELECT.
- Normalise role checks: `is_staff()` = owner or admin, and owner-only for finance and staff control.
- Make the answer-sheet bucket private and serve photos through time-limited links.
- Acceptance tests (automated, one per rule):
  - Anonymous users can't read `enquiries`, `teachers.access_code`, chats or results.
  - Anonymous users can't update `ra_points` or `test_results`.
  - A parent sees only their own child.
  - A teacher sees only their assigned classes.
  - An admin can't open owner-only finance.
  - The security linter and scan come back clean.

### Phase 2: Tenant foundation (still single tenant: Ramanujan only)
- Add an `institutes` table and an `institute_members` table (user, institute, role).
- Add a nullable `institute_id` to every business table and backfill it with Ramanujan's ID (see section 5).
- Add `current_institute_ids()` and rewrite every policy as `institute_id IN (...) AND role check`.
- Make institute name, logo, colours, RA points label and monthly limits configurable instead of hardcoded.
- Acceptance:
  - Seed a dummy second institute.
  - Its users see zero Ramanujan rows in any table, function or storage path.
  - Ramanujan's numbers are unchanged before and after.

### Phase 3: Commercial MVP
- Self-serve institute signup by invite (no open signup at first). The owner onboards admins, teachers and students.
- Per-institute geofences, fee setups, receipt number sequences and AI credit budgets enforced on the server.
- Subdomain or slug routing (`/i/:slug/...`). One app, no per-customer deploys.
- Basic plan limits (students, AI credits). Billing is manual or invoice-based at first.
- Acceptance:
  - End-to-end onboarding of a pilot institute.
  - Isolation tests pass.
  - AI spend is capped per institute.

## 4. Minimal-cost architecture

- **One Lovable Cloud project, shared database, row-level tenancy** (`institute_id` + row-level access rules). Not one database per customer: that is too costly and too much work to run at this stage.
- **Lovable hosting for the web app and PWA.** `vercel.json` exists, but Vercel adds a second deploy target and separate environment settings for no clear gain. Use Vercel only if a custom domain or edge requirement demands it.
- **Server functions** for anything that needs trust: logins, finance writes, AI, WhatsApp.
- **Lovable AI** with per-institute budgets and the existing response cache.
- **Android:** keep the Capacitor + GitHub Actions build. Publish one white-label app first, and offer per-institute branded apps later as a paid add-on.

## 5. Migration and backfill that protects Ramanujan data

- Before anything changes, export the key tables to CSV (Cloud → Advanced settings → Export data).
- Only add things: new nullable columns, backfilled in the same migration. Add `NOT NULL` and constraints later with `NOT VALID` followed by `VALIDATE`.
- Never drop or rename. Mark retired columns as deprecated with a comment.
- Record row counts and fee/salary totals before and after each phase, and compare them.
- Roll out policy changes table by table, testing the Ramanujan flows after each one.
- Apply the reconciled repo migrations exactly as written. Rewrite only the ones that conflict with the live database, and record why.

## 6. What NOT to build yet

- Per-tenant databases or projects, or custom Android builds per institute.
- Automated payment gateway or subscription billing. Invoice manually until 3 to 5 paying institutes.
- Replacing Tally or full accounting (balance sheet, period close). Keep it as an export and reconciliation aid.
- AI that writes financial data or runs admin actions on its own.
- Offline-first sync, a public marketplace, and the WhatsApp automation until Meta credentials and message templates are approved.
- More AI study features. Harden what exists first.

## Uncertainty

- Not verified:
  - Whether finance features work in the published app.
  - Which owner/admin role rows each account actually has.
  - What is in the edge-function code beyond `manage-admin-staff`.
  - Whether the Android build currently passes. The GitHub sync has an ongoing incident.
  - Real data volumes.
- Phase 0 starts by confirming each of these with read-only queries.
