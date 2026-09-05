create or replace function app_private.queue_purchase_receipt_line_accounting_source_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform app_private.try_post_accounting_source_internal(new.branch_id,'purchase_receipt',new.purchase_receipt_id);
 return new;
end $$;

create constraint trigger trg_queue_purchase_receipt_line_accounting_source
after insert on public.purchase_receipt_lines
deferrable initially deferred
for each row execute function app_private.queue_purchase_receipt_line_accounting_source_trigger();

revoke all on function app_private.queue_purchase_receipt_line_accounting_source_trigger() from public,anon,authenticated;
