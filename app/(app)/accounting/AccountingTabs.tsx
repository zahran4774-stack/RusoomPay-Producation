'use client'
// تبويبات صفحة المحاسبة — نفس نمط .module-tab المستخدم في بقية النظام،
// بأيقونات lucide-react. التبويب النشط يُقرأ من ?tab=... في الرابط —
// هذا ضروري لأن روابط الشريط الجانبي (AppShell) تشير إلى
// /accounting?tab=trial ، /accounting?tab=journal إلخ. بلا هذه القراءة،
// كل الروابط تصل للصفحة لكن يبقى المعروض دائماً "نظرة عامة" افتراضياً —
// وهذا العطل الذي أدّى لظهور القائمة المنسدلة بلا أي تأثير فعلي عند النقر.
import { useSearchParams } from 'next/navigation'
import { LayoutGrid, Scale, BookOpen, CalendarRange, TrendingUp, type LucideIcon } from 'lucide-react'
import Link from 'next/link'

export type AccountingTabKey = 'overview' | 'trial' | 'journal' | 'periods' | 'forecast'

const TABS: Array<[AccountingTabKey, LucideIcon, string]> = [
  ['overview', LayoutGrid, 'نظرة عامة'],
  ['trial', Scale, 'ميزان المراجعة'],
  ['journal', BookOpen, 'القيود'],
  ['periods', CalendarRange, 'التقارير الدورية'],
  ['forecast', TrendingUp, 'التوقعات'],
]

export default function AccountingTabs({
  overview, trialBalance, journal, periodReports, forecast,
}: {
  overview: React.ReactNode
  trialBalance: React.ReactNode
  journal: React.ReactNode
  periodReports: React.ReactNode
  forecast: React.ReactNode
}) {
  const searchParams = useSearchParams()
  const raw = searchParams.get('tab')
  const validKeys = TABS.map(([k]) => k)
  const tab: AccountingTabKey = validKeys.includes(raw as AccountingTabKey) ? (raw as AccountingTabKey) : 'overview'

  return (
    <div>
      <div className="module-tabs" role="tablist" aria-label="أقسام المحاسبة" style={{ margin: '18px 0 22px' }}>
        {TABS.map(([k, Icon, label]) => {
          const href = k === 'overview' ? '/accounting' : `/accounting?tab=${k}`
          return (
            <Link
              key={k}
              href={href}
              role="tab"
              aria-selected={tab === k}
              className={`module-tab ${tab === k ? 'active' : ''}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
            >
              <Icon size={16} strokeWidth={2} />
              {label}
            </Link>
          )
        })}
      </div>

      {/* كل الأقسام تبقى في الـDOM (hidden) بدل إزالتها — يحافظ على أي حالة
          داخلية (مثل نموذج القيد المفتوح) عند التنقّل بين التبويبات والعودة. */}
      <div hidden={tab !== 'overview'}>{overview}</div>
      <div hidden={tab !== 'trial'}>{trialBalance}</div>
      <div hidden={tab !== 'journal'}>{journal}</div>
      <div hidden={tab !== 'periods'}>{periodReports}</div>
      <div hidden={tab !== 'forecast'}>{forecast}</div>
    </div>
  )
}
