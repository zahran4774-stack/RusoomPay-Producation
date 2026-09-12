'use client'
// تبويبات صفحة المحاسبة — نفس نمط .module-tab المستخدم في بقية النظام،
// بأيقونات lucide-react. التبويب النشط يُقرأ من ?tab=... في الرابط (لا حالة
// محلية فقط) — هذا يسمح بروابط مباشرة من الشريط الجانبي لكل قسم تحديداً،
// ويبقى صحيحاً بعد تحديث الصفحة أو مشاركة الرابط.
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { LayoutGrid, Scale, BookOpen, CalendarRange, TrendingUp, type LucideIcon } from 'lucide-react'

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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const raw = searchParams.get('tab')
  const validKeys = TABS.map(([k]) => k)
  const tab: AccountingTabKey = validKeys.includes(raw as AccountingTabKey) ? (raw as AccountingTabKey) : 'overview'

  function goTo(k: AccountingTabKey) {
    const params = new URLSearchParams(searchParams.toString())
    if (k === 'overview') params.delete('tab') // الافتراضي — رابط أنظف بلا معامل
    else params.set('tab', k)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div>
      <div className="module-tabs" role="tablist" aria-label="أقسام المحاسبة" style={{ margin: '18px 0 22px' }}>
        {TABS.map(([k, Icon, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className={`module-tab ${tab === k ? 'active' : ''}`}
            onClick={() => goTo(k)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
          >
            <Icon size={16} strokeWidth={2} />
            {label}
          </button>
        ))}
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
