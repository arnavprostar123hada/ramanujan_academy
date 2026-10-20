-- Also queue WhatsApp result notifications if an already-approved result is inserted.
drop trigger if exists trg_queue_test_result on public.test_results;
create trigger trg_queue_test_result
after insert or update of approval_status on public.test_results
for each row execute function public.queue_test_result_whatsapp();
