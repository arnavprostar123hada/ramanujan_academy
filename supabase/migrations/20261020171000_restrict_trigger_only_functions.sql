-- These routines are trigger-only. Prevent direct PostgREST/RPC execution.
revoke execute on function public.next_finance_receipt_number(date) from public, anon, authenticated;
revoke execute on function public.notify_parents_of_approved_test() from public, anon, authenticated;
revoke execute on function public.notify_parents_of_published_online_test() from public, anon, authenticated;
