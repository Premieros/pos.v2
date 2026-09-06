insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-media',
  'product-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_media_catalog_manage_insert on storage.objects;
create policy product_media_catalog_manage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-media'
  and (storage.foldername(name))[1] is not null
  and app_private.current_user_has_permission(
    'catalog.manage',
    ((storage.foldername(name))[1])::uuid
  )
);

drop policy if exists product_media_catalog_manage_update on storage.objects;
create policy product_media_catalog_manage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-media'
  and (storage.foldername(name))[1] is not null
  and app_private.current_user_has_permission(
    'catalog.manage',
    ((storage.foldername(name))[1])::uuid
  )
)
with check (
  bucket_id = 'product-media'
  and (storage.foldername(name))[1] is not null
  and app_private.current_user_has_permission(
    'catalog.manage',
    ((storage.foldername(name))[1])::uuid
  )
);

drop policy if exists product_media_catalog_manage_delete on storage.objects;
create policy product_media_catalog_manage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-media'
  and (storage.foldername(name))[1] is not null
  and app_private.current_user_has_permission(
    'catalog.manage',
    ((storage.foldername(name))[1])::uuid
  )
);
