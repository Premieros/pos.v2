import { supabase } from '../../lib/supabase/client'

export type Category = {
  id: string
  branch_id: string
  code: string
  name_ar: string
  name_en: string | null
  sort_order: number
  is_active: boolean
}

export type Product = {
  id: string
  branch_id: string
  category_id: string | null
  sku: string | null
  barcode: string | null
  name_ar: string
  name_en: string | null
  sale_price: number
  image_url: string | null
  is_active: boolean
}

export async function listCategories(branchId: string): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('id, branch_id, code, name_ar, name_en, sort_order, is_active').eq('branch_id', branchId).order('sort_order').order('name_ar')
  if (error) throw error
  return (data ?? []) as Category[]
}

export async function listProducts(branchId: string): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('id, branch_id, category_id, sku, barcode, name_ar, name_en, sale_price, image_url, is_active').eq('branch_id', branchId).order('name_ar')
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, sale_price: Number(row.sale_price) })) as Product[]
}

export async function createCategory(input: { branchId: string; code: string; nameAr: string; nameEn?: string }): Promise<void> {
  const { error } = await supabase.from('categories').insert({ branch_id: input.branchId, code: input.code.trim().toLowerCase(), name_ar: input.nameAr.trim(), name_en: input.nameEn?.trim() || null })
  if (error) throw error
}

export async function createProduct(input: { branchId: string; categoryId?: string | null; sku?: string; barcode?: string; nameAr: string; nameEn?: string; salePrice: number }): Promise<void> {
  const { error } = await supabase.from('products').insert({ branch_id: input.branchId, category_id: input.categoryId || null, sku: input.sku?.trim() || null, barcode: input.barcode?.trim() || null, name_ar: input.nameAr.trim(), name_en: input.nameEn?.trim() || null, sale_price: input.salePrice })
  if (error) throw error
}

export async function updateProductImageUrl(productId: string, imageUrl: string | null): Promise<void> {
  const { error } = await supabase.rpc('update_product_image_url', { p_product_id: productId, p_image_url: imageUrl?.trim() || null })
  if (error) throw error
}

export async function uploadProductImage(product: Product, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('الملف المختار ليس صورة')
  if (file.size > 5 * 1024 * 1024) throw new Error('حجم الصورة يجب ألا يتجاوز 5MB')
  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${product.branch_id}/${product.id}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('product-media').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from('product-media').getPublicUrl(path)
  try {
    await updateProductImageUrl(product.id, data.publicUrl)
  } catch (cause) {
    await supabase.storage.from('product-media').remove([path])
    throw cause
  }
  return data.publicUrl
}
