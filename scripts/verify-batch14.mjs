import { existsSync, readFileSync } from 'node:fs'

function read(path) {
  if (!existsSync(path)) throw new Error(`Missing Batch 14 file: ${path}`)
  return readFileSync(path, 'utf8')
}

function requireMarkers(source, markers, label) {
  for (const marker of markers) {
    if (!source.includes(marker)) throw new Error(`${label} lost required marker: ${marker}`)
  }
}

const migration = read('supabase/migrations/20260906102500_catalog_product_category_management.sql')
requireMarkers(migration, [
  'update_catalog_product_internal',
  'update_catalog_category_internal',
  "current_user_has_permission('catalog.manage'",
  'category must belong to product branch',
  'sale price must be non-negative',
  'grant execute on function public.update_catalog_product',
  'grant execute on function public.update_catalog_category',
], 'Catalog management migration')

const service = read('src/modules/catalog/catalog.service.ts')
requireMarkers(service, [
  "rpc('update_catalog_product'",
  "rpc('update_catalog_category'",
  'inventory_item_id',
], 'Catalog service')
if (/\.from\(['"]products['"]\)[\s\S]{0,180}\.update\(/.test(service)) throw new Error('Direct protected product update was introduced')
if (/\.from\(['"]categories['"]\)[\s\S]{0,180}\.update\(/.test(service)) throw new Error('Direct protected category update was introduced')

const panel = read('src/modules/catalog/CatalogManagementPanel.tsx')
requireMarkers(panel, [
  'updateCategory',
  'updateProduct',
  'sortOrder',
  'salePrice',
  'isActive',
  'اختيار تصنيف للتعديل',
  'اختيار منتج للتعديل',
], 'Catalog management panel')

const page = read('src/modules/catalog/CatalogPage.tsx')
requireMarkers(page, ['CatalogManagementPanel', 'category.sort_order', 'product.is_active'], 'Catalog page integration')

console.log('Batch 14 catalog management regression: PASS')
