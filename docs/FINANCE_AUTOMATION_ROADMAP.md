# Ramanujan Academy — Finance & AI Automation Plan

## Implemented in Supabase
- Additive fee-structure table scoped by academic year, class, board, course, amount and effective dates.
- Student-specific concessions with typed calculation intent, a required reason, approving user, timestamp and optional expiry.
- Transaction-safe receipt-number sequence (RA/YYYY/000001) and trigger for fee payments that do not supply a receipt.
- Security-invoker receipt register view.
- RLS enabled for the new configuration and concession tables; owner/admin-only policies for editing fees and concessions.

## App rollout priorities
1. Fee setup: owner/admin create and update standard fees per class/board/course/year; preview impact before saving.
2. Student admission: load matching standard fee; permit a student-specific negotiated net fee/concession; require reason and owner/admin approval for exceptions.
3. Payments: always bind payment to a fee account, reject invalid/overpayment according to policy, use database-generated receipt number, show printable/downloadable receipt and optional WhatsApp delivery.
4. Finance centre: receipts register, student ledger, class/branch collection, outstanding dues, expenses, cash/bank movement, monthly MIS, CSV/PDF exports and correction audit trail.
5. Daily automation: due/overdue reminders, payment confirmation messages, daily collection digest, exception alerts, expense categorization suggestions.
6. AI Operations: keep rules/calculations deterministic; AI summarizes dashboard and proposes actions. Financial writes, fee concessions, refunds, reminders and accounting-period close require permission checks and human confirmation.
7. AI cost controls: retain shared TTL response cache, canonicalize prompts, log event metrics, enforce server-side rate/budget checks before provider calls, and fall back to cached/static guidance when budget is exhausted.

## Accounting and Tally
The app can become the daily system of record after opening balances, historical transactions, chart of accounts, payment/expense reconciliation, backups, audit trail and reports have been reconciled by the accountant. Keep exportable vouchers, ledgers, trial balance, profit/loss and balance sheet. Do not delete or abandon the existing Tally records until the transition has been reconciled and formally approved.

## Safety and security
- Never let the browser use the Supabase service-role key.
- Do not give public roles direct writes to fee configuration, concessions, receipt sequences, or financial totals.
- Financial APIs must verify the bearer token and the active role from user_profiles; owner/admin-only for configuration/concession approval.
- Do not allow the AI model to directly execute SQL or arbitrary admin commands.
- Use an immutable event/audit trail for edits, voids, refunds and receipt reprints.
- Run Supabase security/performance advisors after each migration and address pre-existing RLS/security-definer warnings intentionally.
- Stage and test against a preview deployment before production releases.
