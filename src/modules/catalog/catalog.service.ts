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
  const { data, error } = await supabase
    .from('categories')
    .select('id, branch_id, code, name_ar, name_en, sort_order, is_active')
    .eq('branch_id', branchId)
    .order('sort_order')
    .order('name_ar')

  if (error) throw error
  return (data ?? []) as Category[]
}

export async function listProducts(branchId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, branch_id, category_id, sku, barcode, name_ar, name_en, sale_price, image_url, is_active')
    .eq('branch_id', branchId)
    .order('name_ar')

  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, sale_price: Number(row.sale_price) })) as Product[]
}

export async function createCategory(input: {
  branchId: string
  code: string
  nameAr: string
  nameEn?: string
}): Promise<void> {
  const { error } = await supabase.from('categories').insert({
    branch_id: input.branchId,
    code: input.code.trim().toLowerCase(),
    name_ar: input.nameAr.trim(),
    name_en: input.nameEn?.trim() || null,
  })

  if (error) throw error
}

export async function createProduct(input: {
  branchId: string
  categoryId?: string | null
  sku?: string
  barcode?: string
  nameAr: string
  nameEn?: string
  salePrice: number
}): Promise<void> {
  const { error } = await supabase.from('products').insert({
    branch_id: input.branchId,
    category_id: input.categoryId || null,
    sku: input.sku?.trim() || null,
    barcode: input.barcode?.trim() || null,
    name_ar: input.nameAr.trim(),
    name_en: input.nameEn?.trim() || null,
    sale_price: input.salePrice,
  })

  if (error) throw error
}

export async function updateProductImageUrl(productId: string, imageUrl: string | null): Promise<void> {
  const { error } = await supabase.rpc('update_product_image_url', {
    p_product_id: productId,
    p_image_url: imageUrl?.trim() || null,
  })
  if (error) throw error
}
