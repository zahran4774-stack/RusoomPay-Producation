'use client'
// شريط تبويب علوي للصفحة — تنقّل واعٍ بالمسار بين صفحات وحدة واحدة (مثال: الموظفون/الرواتب).
// ليس حالة عميل مؤقتة: كل تبويب رابط <Link> حقيقي لمسار فعلي، والتبويب النشط
// يُحدَّد من pathname الفعلي فقط — يبقى صحيحاً بعد تحديث المتصفح أو التنقّل المباشر.
// إن بقي عنصر واحد ظاهر بعد فلترة الصلاحيات (تتم في الصفحة المستدعية)، لا يُعرض
// أي شريط — تبويب بعنصر واحد بلا فائدة.
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type TabItem = { label: string; href: string }

export default function ModuleTabs({ items }: { items: TabItem[] }) {
  const pathname = usePathname()
  if (items.length < 2) return null

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="module-tabs" role="tablist" aria-label="تنقّل الوحدة">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          role="tab"
          aria-selected={isActive(it.href)}
          className={`module-tab ${isActive(it.href) ? 'active' : ''}`}
        >
          {it.label}
        </Link>
      ))}
    </div>
  )
}
