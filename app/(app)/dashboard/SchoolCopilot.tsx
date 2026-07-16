'use client'
// app/(app)/dashboard/SchoolCopilot.tsx
// المساعد التنفيذي الذكي — يعرض فقط نتائج محرّك القواعد (school_copilot).
// لا منطق أعمال هنا؛ التصميم تنفيذي نظيف بأسلوب Stripe / Linear.
import Link from 'next/link'
import { useState } from 'react'

type Alert = { severity: 'high' | 'medium'; title: string; detail: string; action: string; action_label: string; href: string }
type Reco = { title: string; reason: string; benefit: string; action_label: string; href: string }
type CopilotData = {
  ok?: boolean
  summary: { today_collected: number; outstanding: number; collection_rate: number; pending_approvals: number; students: number; employees: number; revenue: number; expense: number }
  alerts: Alert[]
  recommendations: Reco[]
  kpis: { collection_rate: number; outstanding: number; overdue_count: number; pending_payments: number; low_stock: number }
  health: { score: number; status: string; breakdown: Record<string, number> }
}

const num = (n: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(n || 0)
const num3 = (n: number) => new Intl.NumberFormat('en', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n || 0)

export default function SchoolCopilot({ data, sym, firstName, schoolName }: { data: CopilotData; sym: string; firstName: string; schoolName?: string }) {
  const [greeting] = useState(() => {
    const h = new Date().getHours()
    return h < 12 ? 'صباح الخير' : h < 18 ? 'مساء الخير' : 'مساء الخير'
  })

  if (!data || data.ok === false) return null

  const summary = data.summary ?? { today_collected: 0, outstanding: 0, collection_rate: 0, pending_approvals: 0, students: 0, employees: 0, revenue: 0, expense: 0 }
  const alerts = data.alerts ?? []
  const recommendations = data.recommendations ?? []
  const kpis = data.kpis ?? { collection_rate: 0, outstanding: 0, overdue_count: 0, pending_payments: 0, low_stock: 0 }
  const health = data.health ?? { score: 0, status: '—', breakdown: {} }
  const nothingUrgent = alerts.length === 0 && recommendations.length === 0

  const healthColor = health.score >= 85 ? '#067647' : health.score >= 70 ? '#1E5C4E' : health.score >= 50 ? '#B54708' : '#B42318'

  return (
    <section
      style={{
        background: '#fff', border: '1px solid #E7EBF0', borderRadius: 18,
        padding: '24px 26px', marginBottom: 22, boxShadow: '0 1px 3px rgba(16,24,40,.04)',
      }}
      dir="rtl">
      {/* الترويسة */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: '#6B7A90', textTransform: 'uppercase' }}>School Copilot</span>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#067647' }} />
          </div>
          {schoolName && (
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E5C4E', marginBottom: 2 }}>{schoolName}</div>
          )}
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0F1B2D', margin: 0, letterSpacing: '-0.01em' }}>
            {greeting}{firstName ? `، ${firstName}` : ''}
          </h2>
          <p style={{ fontSize: 13.5, color: '#6B7A90', margin: '3px 0 0' }}>مساعدك التنفيذي — ملخّص اليوم التشغيلي</p>
        </div>
        {/* درجة صحّة المدرسة */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FAFBFC', border: '1px solid #EEF1F5', borderRadius: 14, padding: '10px 16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: healthColor, lineHeight: 1 }}>{health.score}</div>
            <div style={{ fontSize: 10, color: '#8A94A6', marginTop: 2 }}>من 100</div>
          </div>
          <div style={{ borderInlineStart: '1px solid #E7EBF0', paddingInlineStart: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: healthColor }}>{health.status}</div>
            <div style={{ fontSize: 11, color: '#8A94A6' }}>صحّة العمليات</div>
          </div>
        </div>
      </div>

      {/* الملخّص التنفيذي — أرقام مضغوطة */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 1, background: '#EEF1F5', border: '1px solid #EEF1F5', borderRadius: 12, overflow: 'hidden', marginBottom: nothingUrgent ? 0 : 22 }}>
        <SummaryCell label="حُصّل اليوم" value={`${num3(summary.today_collected)} ${sym}`} />
        <SummaryCell label="مستحقات قائمة" value={`${num3(summary.outstanding)} ${sym}`} />
        <SummaryCell label="نسبة التحصيل" value={`${summary.collection_rate}%`} />
        <SummaryCell label="بانتظار الاعتماد" value={num(summary.pending_approvals)} />
        <SummaryCell label="الطلاب" value={num(summary.students)} />
      </div>

      {/* حالة "كل شيء ممتاز" */}
      {nothingUrgent && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F0FAF4', border: '1px solid #CDECD9', borderRadius: 12, padding: '18px 20px', marginTop: 22 }}>
          <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#067647', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <div>
            <div style={{ fontWeight: 700, color: '#0F1B2D', fontSize: 15 }}>كل شيء ممتاز اليوم</div>
            <div style={{ fontSize: 13, color: '#5A6B7B' }}>لا توجد إجراءات عاجلة مطلوبة.</div>
          </div>
        </div>
      )}

      {/* يحتاج انتباهاً */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: recommendations.length > 0 ? 22 : 0 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#6B7A90', textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 10px' }}>يحتاج انتباهاً</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.slice(0, 5).map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', background: '#FAFBFC', border: '1px solid #EEF1F5', borderRadius: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: a.severity === 'high' ? '#D92D20' : '#F79009' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#0F1B2D' }}>{a.title}</div>
                  <div style={{ fontSize: 12.5, color: '#6B7A90' }}>{a.detail}</div>
                </div>
                <Link href={a.href} style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: '#fff', background: '#0F1B2D', borderRadius: 8, padding: '7px 14px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  {a.action_label}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* اقتراحات — الذكاء يقترح، والقرار لك */}
      {recommendations.length > 0 && (
        <div>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#6B7A90', textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 4px' }}>اقتراحات</h3>
          <div style={{ fontSize: 12, color: '#8A94A6', margin: '0 0 10px' }}>
            هذه اقتراحات للمراجعة — لا يُنفَّذ أي إجراء مالي إلا بقرارك.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
            {recommendations.slice(0, 4).map((r, i) => (
              <div key={i} style={{ padding: '15px 16px', background: '#fff', border: '1px solid #E7EBF0', borderRadius: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: '#0F1B2D', marginBottom: 4 }}>{r.title}</div>
                <div style={{ fontSize: 12.5, color: '#6B7A90', marginBottom: 2 }}>{r.reason}</div>
                <div style={{ fontSize: 12, color: '#8A94A6', marginBottom: 12 }}>{r.benefit}</div>
                <Link href={r.href} style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 600, color: '#0F1B2D', background: '#F2F4F7', borderRadius: 8, padding: '7px 14px', textDecoration: 'none' }}>
                  راجِع الاقتراح
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* مؤشرات اليوم المضغوطة */}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 22, paddingTop: 16, borderTop: '1px solid #EEF1F5' }}>
        <MiniKpi label="نسبة التحصيل" value={`${kpis.collection_rate}%`} />
        <MiniKpi label="فواتير متأخرة" value={num(kpis.overdue_count)} />
        <MiniKpi label="مدفوعات معلّقة" value={num(kpis.pending_payments)} />
        <MiniKpi label="مخزون منخفض" value={num(kpis.low_stock)} />
      </div>
    </section>
  )
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#fff', padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: '#8A94A6', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#0F1B2D', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ fontSize: 12, color: '#8A94A6' }}>{label}: </span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0F1B2D' }}>{value}</span>
    </div>
  )
}
