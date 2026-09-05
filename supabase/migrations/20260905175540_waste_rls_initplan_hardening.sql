drop policy if exists waste_documents_select on public.waste_documents;
create policy waste_documents_select on public.waste_documents for select to authenticated using(app_private.has_permission('inventory.waste',branch_id,(select auth.uid())));
drop policy if exists waste_document_lines_select on public.waste_document_lines;
create policy waste_document_lines_select on public.waste_document_lines for select to authenticated using(app_private.has_permission('inventory.waste',branch_id,(select auth.uid())));
