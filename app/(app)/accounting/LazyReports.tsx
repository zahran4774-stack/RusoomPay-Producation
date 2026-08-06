'use client'
// app/(app)/accounting/LazyReports.tsx
// غلاف Client Component يؤجّل تحميل التقارير الثانوية بصفحة المحاسبة (Server Component)
// عبر next/dynamic — تبقى خارج الحزمة الأساسية للصفحة، وتُحمَّل فقط عند الوصول الفعلي.
// JournalForm يبقى استيراداً مباشراً في page.tsx (يظهر فوراً أعلى الصفحة، جزء أساسي من التفاعل الأول).
import dynamic from 'next/dynamic'

const LoadingCard = () => (
  <div style={{ background: '#fff', borderRadius: 14, padding: 24, textAlign: 'center', color: '#8A94A6', boxShadow: '0 1px 4px rgba(0,0,0,.08)', marginBottom: 16 }}>
    جارٍ التحميل…
  </div>
)

export const LazyDailyPaymentsReport = dynamic(() => import('./DailyPaymentsReport'), {
  loading: LoadingCard,
})

export const LazyPayrollYearlyReport = dynamic(() => import('./PayrollYearlyReport'), {
  loading: LoadingCard,
})

export const LazyJournalList = dynamic(() => import('./JournalList'), {
  loading: LoadingCard,
})

export const LazyPeriodReports = dynamic(() => import('./PeriodReports'), {
  loading: LoadingCard,
})

export const LazyForecastPanel = dynamic(() => import('./ForecastPanel'), {
  loading: LoadingCard,
})
