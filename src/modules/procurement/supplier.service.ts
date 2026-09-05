import { supabase } from '../../lib/supabase/client'

export type Supplier = {
  id: string
  branch_id: string
  code: string
  name_ar: string
  name_en: string | null
  phone: string | null
  email: string | null
  tax_number: string | null
  notes: string | null
  is_active: boolean
  updated_at: string
}

export type SupplierInput = {
  code: string
  nameAr: string
  nameEn?: string
  phone?: string
  email?: string
  taxNumber?: string
  notes?: string
  isActive?: boolean
}

export async function listSuppliers(branchId: string): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, branch_id, code, name_ar, name_en, phone, email, tax_number, notes, is_active, updated_at')
    .eq('branch_id', branchId)
    .order('is_active', { ascending: false })
    .order('name_ar')
  if (error) throw error
  return (data ?? []) as Supplier[]
}

export async function createSupplier(branchId: string, input: SupplierInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_supplier', {
    p_branch_id: branchId,
    p_code: input.code,
    p_name_ar: input.nameAr,
    p_name_en: input.nameEn || null,
    p_phone: input.phone || null,
    p_email: input.email || null,
    p_tax_number: input.taxNumber || null,
    p_notes: input.notes || null,
  })
  if (error) throw error
  return data as string
}

export async function updateSupplier(supplierId: string, input: SupplierInput): Promise<void> {
  const { error } = await supabase.rpc('update_supplier', {
    p_supplier_id: supplierId,
    p_code: input.code,
    p_name_ar: input.nameAr,
    p_name_en: input.nameEn || null,
    p_phone: input.phone || null,
    p_email: input.email || null,
    p_tax_number: input.taxNumber || null,
    p_notes: input.notes || null,
    p_is_active: input.isActive ?? true,
  })
  if (error) throw error
}
