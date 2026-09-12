'use client'
// تبويبات صفحة المحاسبة — نفس نمط .module-tab (أزرار كحلية/ذهبية) المستخدم
// في بقية النظام (الإعدادات، تكلفة الوجبات)، بأيقونات lucide-react.
// حالة عميل بسيطة فقط — لا صلة له بـAppShell أو الشريط الجانبي إطلاقاً.
// كل تبويب يستقبل محتواه جاهزاً من الخادم (page.tsx) كـ React node.
import { useState } from 'react'
import { LayoutGrid, Scale, BookOpen, CalendarRange, TrendingUp, type LucideIcon } from 'lucide-react'

type TabKey = 'overview' | 'trial' | 'journal' | 'periods' | 'forecast'

const TABS: Array<[TabKey, LucideIcon, string]> = [
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
  const [tab, setTab] = useState<TabKey>('overview')

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
            onClick={() => setTab(k)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
          >
            <Icon size={16} strokeWidth={2} />
            {label}
          </button>
        ))}
      </div>

      <div hidden={tab !== 'overview'}>{overview}</div>
      <div hidden={tab !== 'trial'}>{trialBalance}</div>
      <div hidden={tab !== 'journal'}>{journal}</div>
      <div hidden={tab !== 'periods'}>{periodReports}</div>
      <div hidden={tab !== 'forecast'}>{forecast}</div>
    </div>
  )
}
