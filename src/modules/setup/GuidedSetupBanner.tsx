import { useEffect, useState } from 'react'
import { useBranch } from '../branches/useBranch'
import { usePermissions } from '../permissions/usePermissions'
import { hasOwnOpenShift, listPosProducts, listPosWarehouses } from '../pos/pos.service'

type Prerequisite = {
  key: 'shift' | 'warehouse' | 'products'
  title: string
  description: string
  href: string | null
  action: string | null
}

export function GuidedSetupBanner() {
  const { currentBranchId } = useBranch()
  const { can } = usePermissions()
  const [items, setItems] = useState<Prerequisite[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!currentBranchId || !can('pos.view')) { setItems([]); return }
    const branchId = currentBranchId
    setLoading(true)
    void Promise.all([hasOwnOpenShift(branchId), listPosWarehouses(branchId), listPosProducts(branchId)])
      .then(([hasShift, warehouses, products]) => {
        const next: Prerequisite[] = []
        if (!hasShift) next.push({
          key: 'shift',
          title: 'افتح وردية قبل البيع',
          description: can('shifts.open') || can('shifts.manage') ? 'البيع يحتاج وردية مفتوحة باسم المستخدم الحالي.' : 'لا توجد وردية مفتوحة ولا تملك صلاحية فتح وردية. اطلب من المسؤول منح الصلاحية المناسبة.',
          href: can('shifts.open') || can('shifts.manage') ? '#shifts-section' : null,
          action: can('shifts.open') || can('shifts.manage') ? 'فتح وردية' : null,
        })
        if (!warehouses.length) next.push({
          key: 'warehouse',
          title: 'أنشئ مخزنًا نشطًا',
          description: can('inventory.setup') ? 'الإرسال للمطبخ وخصم المخزون يحتاج مخزنًا حقيقيًا في الفرع.' : 'لا يوجد مخزن متاح، ولا تملك صلاحية إعداد المخازن. اطلب من المسؤول إكمال الإعداد.',
          href: can('inventory.setup') ? '#admin-section' : null,
          action: can('inventory.setup') ? 'إعداد المخزن' : null,
        })
        if (!products.length) next.push({
          key: 'products',
          title: 'أضف منتجات للبيع',
          description: can('catalog.manage') ? 'لا توجد منتجات نشطة متاحة في شاشة البيع لهذا الفرع.' : 'لا توجد منتجات متاحة، ولا تملك صلاحية إدارة المنتجات. اطلب من المسؤول إكمال الكتالوج.',
          href: can('catalog.manage') ? '#catalog-section' : null,
          action: can('catalog.manage') ? 'إعداد المنتجات' : null,
        })
        setItems(next)
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [currentBranchId, can])

  if (loading || items.length === 0) return null

  return (
    <section className="guided-setup" aria-label="خطوات مطلوبة قبل التشغيل">
      <div><p className="eyebrow">GUIDED SETUP</p><h2>أكمل الخطوات المطلوبة</h2><p>النظام يوجهك للخطوة الناقصة بدل ترك العملية تصل إلى خطأ قاعدة بيانات.</p></div>
      <div className="guided-setup-grid">
        {items.map((item) => (
          <article key={item.key} className="prerequisite-card">
            <strong>{item.title}</strong>
            <p>{item.description}</p>
            {item.href && item.action ? <a className="guided-setup-action" href={item.href}>{item.action}</a> : null}
          </article>
        ))}
      </div>
    </section>
  )
}
