import { existsSync, readFileSync } from 'node:fs'

function read(path) {
  if (!existsSync(path)) throw new Error(`Missing Batch 11 file: ${path}`)
  return readFileSync(path, 'utf8')
}

function requireMarkers(source, markers, label) {
  for (const marker of markers) {
    if (!source.includes(marker)) throw new Error(`${label} lost required marker: ${marker}`)
  }
}

const migration = read('supabase/migrations/20260906095717_product_media_storage_bucket.sql')
requireMarkers(migration, [
  "'product-media'",
  '5242880',
  "'image/jpeg'",
  "'image/png'",
  "'image/webp'",
  "'image/gif'",
  'product_media_catalog_manage_insert',
  'product_media_catalog_manage_update',
  'product_media_catalog_manage_delete',
  'storage.foldername(name)',
  'current_user_has_permission',
  "'catalog.manage'",
], 'Product-media migration')

const service = read('src/modules/catalog/catalog.service.ts')
requireMarkers(service, [
  "from('product-media')",
  'product.branch_id',
  'product.id',
  'crypto.randomUUID()',
  '5 * 1024 * 1024',
  "rpc('update_product_image_url'",
  '.remove([path])',
], 'Catalog media service')

const panel = read('src/modules/catalog/ProductMediaPanel.tsx')
requireMarkers(panel, [
  'type="file"',
  'image/jpeg,image/png,image/webp,image/gif',
  'uploadProductImage',
], 'Product media panel')

console.log('Batch 11 product-media storage regression: PASS')
