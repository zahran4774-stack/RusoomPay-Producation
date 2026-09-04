'use client'
// مركز تحكّم RusoomPay — واجهة enterprise احترافية
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import SchoolManageModal from './SchoolManageModal'
import PendingSubs from './PendingSubs'
import CountryToggles from './CountryToggles'
import SystemHealthPanel from './SystemHealthPanel'
import OpsSubscriptionsPanel from './OpsSubscriptionsPanel'
import type { Sub, SchoolStat, AuditRow, FeedbackRow } from './types'

type Nums = Record<string, number>
type Pending = { id: string; plan: string; status: string; created_at: string; schools: { name: string } | { name: string }[] | null }

const PLAN_AR: Record<string, string> = { monthly: 'شهري', annual: 'سنوي', lifetime: 'دائم', trial: 'تجريبي' }
const STATUS_AR: Record<string, string> = { active: 'نشط', trial: 'تجريبي', pending: 'بانتظار', expired: 'منتهٍ', suspended: 'موقوف', cancelled: 'ملغى' }
const STATUS_COLOR: Record<string, { bg: string; c: string }> = {
  active: { bg: '#E6F4EC', c: '#1A7A45' }, trial: { bg: '#E8EEF8', c: '#2E5EA8' },
  pending: { bg: '#FBF3D5', c: '#8A6D0F' }, expired: { bg: '#FCE9E6', c: '#C0392B' },
  suspended: { bg: '#F2E8E6', c: '#8A4B3F' }, cancelled: { bg: '#EEF1F5', c: '#69757F' },
}

export default function ControlCenter(props: {
  overview: Nums; revenue: Nums; subscriptions: Sub[]; pending: Pending[]
  analytics: SchoolStat[]; audit: AuditRow[]; feedback: FeedbackRow[]
}) {
  const overview = props.overview ?? {}
  const revenue = props.revenue ?? {}
  const subscriptions = props.subscriptions ?? []
  const pending = props.pending ?? []
  const analytics = props.analytics ?? []
  const audit = props.audit ?? []
  const feedback = props.feedback ?? []

  const [tab, setTab] = useState<'overview' | 'revenue' | 'subs' | 'schools' | 'audit' | 'feedback' | 'monitor' | 'errors' | 'settings'>('overview')
  const [manageSchool, setManageSchool] = useState<{ id: string; name: string } | null>(null)
  const [filter, setFilter] = useState('all')
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }
  const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  const int = (n: number) => (n ?? 0).toLocaleString('en-US')

  const filtered = filter === 'all' ? subscriptions : subscriptions.filter((s) => s.status === filter)

  const TABS: Array<[typeof tab, string]> = [
    ['overview', '📊 نظرة عامة'],
    ['revenue', '💰 الإيرادات'],
    ['subs', '📋 الاشتراكات'],
    ['schools', '🏫 المدارس'],
    ['audit', '📜 التدقيق'],
    ['feedback', '💬 الشكاوى'],
    ['monitor', '🩺 المراقبة'],
    ['errors', '🐞 سجل الأخطاء'],
    ['settings', '⚙️ الإعدادات'],
  ]

  return (
    <div dir="rtl">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
        <div>
          <h1 style={{ color: '#0A1D33', fontSize: 24, margin: 0 }}>مركز تحكّم RusoomPay</h1>
          <p style={{ color: '#8A94A6', fontSize: 13.5, margin: '4px 0 0' }}>مراقبة المنصة بالكامل — المدارس، الإيرادات، الاشتراكات</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#E6F4EC', color: '#1A7A45', fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 99 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1A7A45' }} /> المنصة تعمل
          </span>
          <button onClick={handleLogout}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1.5px solid #E3E8EE', color: '#0A1D33', fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit' }}>
            <span>⎋</span> تسجيل الخروج
          </button>
        </div>
      </div>

      <div className="module-tabs" role="tablist" aria-label="أقسام مركز التحكّم" style={{ margin: '20px 0 24px' }}>
        {TABS.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={`module-tab ${tab === k ? 'active' : ''}`}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gap: 22 }}>
          <div>
            <SecLabel>المدارس</SecLabel>
            <Grid>
              <Kpi label="إجمالي المدارس" value={int(overview.schools)} icon="🏫" accent="#2E5EA8" />
              <Kpi label="نشطة" value={int(overview.active)} icon="✅" accent="#1A7A45" />
              <Kpi label="تجريبية" value={int(overview.trial)} icon="🎁" accent="#8A6D0F" />
              <Kpi label="موقوفة" value={int(overview.suspended)} icon="⏸️" accent="#8A4B3F" />
              <Kpi label="اشتراكات منتهية" value={int(overview.expired)} icon="⌛" accent="#C0392B" />
            </Grid>
          </div>
          <div>
            <SecLabel>المستخدمون</SecLabel>
            <Grid>
              <Kpi label="الطلاب" value={int(overview.students)} icon="🎓" accent="#2E5EA8" />
              <Kpi label="أولياء الأمور" value={int(overview.parents)} icon="👨‍👩‍👧" accent="#0E5C5C" />
              <Kpi label="الموظفون" value={int(overview.employees)} icon="👥" accent="#7A2E8F" />
              <Kpi label="إجمالي المستخدمين" value={int(overview.users)} icon="👤" accent="#163B68" />
            </Grid>
          </div>
        </div>
      )}

      {tab === 'revenue' && (
        <div style={{ display: 'grid', gap: 22 }}>
          <Grid>
            <Kpi label="الإيراد الشهري المتكرر (MRR)" value={fmt(revenue.mrr)} unit="ر.ع" icon="🔁" accent="#1A7A45" />
            <Kpi label="الإيراد السنوي" value={fmt(revenue.annual)} unit="ر.ع" icon="📈" accent="#2E5EA8" />
            <Kpi label="مدفوعات معلّقة" value={int(revenue.pending)} icon="⏳" accent="#8A6D0F" />
            <Kpi label="تجديدات خلال 30 يوم" value={int(revenue.renewals_due)} icon="🔔" accent="#C0392B" />
          </Grid>
          <div style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
            <b style={{ color: '#0A1D33', fontSize: 15 }}>الإيراد حسب الباقة</b>
            <RevenueByPlan subs={subscriptions} />
          </div>
        </div>
      )}

      {tab === 'subs' && (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {[['all', 'الكل'], ['active', 'نشط'], ['trial', 'تجريبي'], ['pending', 'بانتظار'], ['expired', 'منتهٍ']].map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)} style={{
                background: filter === k ? '#0A1D33' : '#fff', color: filter === k ? '#fff' : '#69757F',
                border: '1px solid ' + (filter === k ? '#0A1D33' : '#E5E9F0'), borderRadius: 9,
                padding: '7px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{label}</button>
            ))}
          </div>

          {pending.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <SecLabel>تحويلات بنكية بانتظار الاعتماد ({pending.length})</SecLabel>
              <PendingSubs items={pending.map((s) => ({
               id: s.id,
               plan: s.plan,
               pay_method: (s as any).pay_method ?? null,
               receipt_url: (s as any).receipt_url ?? null,
               schoolName: (Array.isArray(s.schools) ? s.schools[0]?.name : (s.schools as any)?.name) ?? 'مدرسة',
               created_at: s.created_at ?? '',
             }))} />
            </div>
          )}

          <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr style={{ background: '#F7F9FC', textAlign: 'right' }}>
                  {['المدرسة', 'الدولة', 'الباقة', 'الحالة', 'التجديد', 'المبلغ'].map((h) => (
                    <th key={h} style={{ padding: '12px 14px', fontSize: 12.5, color: '#69757F', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: '#9AA7B8' }}>لا اشتراكات مطابقة</td></tr>
                ) : filtered.map((s) => {
                  const sc = STATUS_COLOR[s.status ?? ''] ?? STATUS_COLOR.cancelled
                  return (
                    <tr key={s.school_id} style={{ borderTop: '1px solid #F2F5F8' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0A1D33', fontSize: 14 }}>{s.school_name}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#667' }}>{s.country ?? '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13 }}>{PLAN_AR[s.plan ?? ''] ?? '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: sc.bg, color: sc.c, fontSize: 12, fontWeight: 700, padding: '4px 11px', borderRadius: 99 }}>
                          {STATUS_AR[s.status ?? ''] ?? '—'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12.5, color: '#667' }}>{s.renews_at ? s.renews_at.slice(0, 10) : '—'}</td>
                      <td style={{ padding: '12px 14px', fontFamily: 'Cairo', fontWeight: 700, color: '#0A1D33', fontSize: 14 }}>{s.amount ? s.amount + ' ر.ع' : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'schools' && (
        <div>
          <SecLabel>تحليلات المدارس ({analytics.length})</SecLabel>
          {analytics.length === 0 ? (
            <Empty>لا مدارس بعد</Empty>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
              {analytics.map((s) => (
                <SchoolCard key={s.school_id} s={s} onManage={() => setManageSchool({ id: s.school_id, name: s.school_name })} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div>
          <SecLabel>سجل التدقيق عبر كل المدارس ({audit.length})</SecLabel>
          {audit.length === 0 ? (
            <Empty>لا عمليات مسجّلة بعد</Empty>
          ) : (
            <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
                <thead>
                  <tr style={{ background: '#F7F9FC', textAlign: 'right' }}>
                    {['التاريخ', 'المدرسة', 'المنفّذ', 'الإجراء', 'التفاصيل'].map((h) => (
                      <th key={h} style={{ padding: '12px 14px', fontSize: 12.5, color: '#69757F', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id} style={{ borderTop: '1px solid #F2F5F8' }}>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: '#8A94A6', whiteSpace: 'nowrap' }}>{a.created_at.slice(0, 16).replace('T', ' ')}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: '#0A1D33', fontWeight: 600 }}>{a.school_name ?? '—'}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: '#667' }}>{a.actor_name}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13 }}>{a.action}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12.5, color: '#8A94A6' }}>{a.details ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'feedback' && <FeedbackSection feedback={feedback} />}

      {tab === 'monitor' && (
        <div>
          <SecLabel>صحّة خدمات المنصة (حيّة)</SecLabel>
          <SystemHealthPanel />
          <div style={{ height: 28 }} />
          <SecLabel>اشتراكات التشغيل</SecLabel>
          <OpsSubscriptionsPanel />
        </div>
      )}

      {tab === 'errors' && <ErrorLogSection />}

      {tab === 'settings' && (
        <div>
          <CountryToggles />
        </div>
      )}

      {manageSchool && (
        <SchoolManageModal
          schoolId={manageSchool.id}
          schoolName={manageSchool.name}
          onClose={() => setManageSchool(null)}
        />
      )}
    </div>
  )
}

function SchoolCard({ s, onManage }: { s: SchoolStat; onManage: () => void }) {
  const barColor = s.collection_rate >= 80 ? '#27AE60' : s.collection_rate >= 60 ? '#D4A017' : '#C0392B'
  const pctColor = s.collection_rate >= 80 ? '#1A7A45' : s.collection_rate >= 60 ? '#B8860B' : '#C0392B'
  const widthStyle: React.CSSProperties = { width: s.collection_rate + '%', height: '100%', borderRadius: 99, background: barColor }
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <b style={{ color: '#0A1D33', fontSize: 15 }}>{s.school_name}</b>
        <span style={{ fontSize: 11.5, color: '#8A94A6' }}>{s.country ?? '—'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
        <Mini label="الطلاب" v={s.students} />
        <Mini label="الموظفون" v={s.employees} />
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#667', marginBottom: 5 }}>
          <span>نسبة التحصيل</span><b style={{ color: pctColor }}>{s.collection_rate}%</b>
        </div>
        <div style={{ height: 8, background: '#EEF1F5', borderRadius: 99, overflow: 'hidden' }}>
          <div style={widthStyle} />
        </div>
      </div>
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #F2F5F8', fontSize: 12, color: '#8A94A6' }}>
        آخر نشاط: {s.last_activity ? s.last_activity.slice(0, 10) : 'لا يوجد'}
      </div>
      <button
        onClick={onManage}
        style={{ marginTop: 12, width: '100%', padding: '9px', background: '#0A1D33', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
        🛠️ دخول وإدارة
      </button>
    </div>
  )
}

function Mini({ label, v }: { label: string; v: number }) {
  return (
    <div style={{ background: '#F7F9FC', borderRadius: 9, padding: '9px 11px' }}>
      <div style={{ fontSize: 11, color: '#8A94A6' }}>{label}</div>
      <div style={{ fontFamily: 'Cairo', fontWeight: 700, color: '#0A1D33', fontSize: 17 }}>{v.toLocaleString('en-US')}</div>
    </div>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', color: '#9AA7B8', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>{children}</div>
}
function SecLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: '#8A94A6', marginBottom: 12 }}>{children}</div>
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(165px,1fr))', gap: 14 }}>{children}</div>
}
function Kpi({ label, value, unit, icon, accent }: { label: string; value: string; unit?: string; icon: string; accent: string }) {
  const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 15, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,.07)', borderTop: '3px solid ' + accent }
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#8A94A6', fontSize: 12.5 }}>{label}</span>
        <span style={{ fontSize: 16 }}>{icon}</span>
      </div>
      <div style={{ fontFamily: 'Cairo', fontWeight: 700, fontSize: 22, color: '#0A1D33', marginTop: 8 }}>
        {value} {unit && <span style={{ fontSize: 12, color: '#8A94A6', fontWeight: 400 }}>{unit}</span>}
      </div>
    </div>
  )
}

function RevenueByPlan({ subs }: { subs: Sub[] }) {
  const active = subs.filter((s) => s.status === 'active')
  const byPlan = { monthly: 0, annual: 0, lifetime: 0 }
  active.forEach((s) => {
    if (s.plan === 'monthly') byPlan.monthly += 84
    else if (s.plan === 'annual') byPlan.annual += 72
    else if (s.plan === 'lifetime') byPlan.lifetime += 350
  })
  const max = Math.max(byPlan.monthly, byPlan.annual, byPlan.lifetime, 1)
  const rows = [['شهري', byPlan.monthly, '#2E5EA8'], ['سنوي', byPlan.annual, '#1A7A45'], ['دائم', byPlan.lifetime, '#D4A017']] as const
  return (
    <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
      {rows.map(([label, val, color]) => {
        const pct = Math.max((val / max) * 100, 2)
        const barStyle: React.CSSProperties = { width: pct + '%', height: '100%', background: color, borderRadius: 99, transition: 'width .5s' }
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 48, fontSize: 13, color: '#667' }}>{label}</span>
            <div style={{ flex: 1, background: '#EEF1F5', borderRadius: 99, height: 22, overflow: 'hidden' }}>
              <div style={barStyle} />
            </div>
            <span style={{ width: 80, textAlign: 'left', fontFamily: 'Cairo', fontWeight: 700, color: '#0A1D33', fontSize: 13.5 }}>{val.toLocaleString('en-US')} ر.ع</span>
          </div>
        )
      })}
    </div>
  )
}

function FeedbackSection({ feedback }: { feedback: FeedbackRow[] }) {
  const supabase = createClient()
  const [items, setItems] = useState<FeedbackRow[]>(feedback)
  const [busy, setBusy] = useState<string | null>(null)

  const KIND: Record<string, string> = { complaint: 'شكوى', bug: 'مشكلة تقنية', suggestion: 'اقتراح', question: 'استفسار' }
  const PRIO: Record<string, { t: string; bg: string; c: string }> = {
    urgent: { t: 'عاجلة', bg: '#FCE9E6', c: '#C0392B' },
    important: { t: 'مهمة', bg: '#FBF3D5', c: '#8A6D0F' },
    normal: { t: 'عادية', bg: '#EEF1F5', c: '#69757F' },
  }
  const openCount = items.filter((f) => f.status !== 'closed').length

  async function resolve(id: string, status: string) {
    setBusy(id)
    const { error } = await supabase.rpc('resolve_feedback', { p_id: id, p_status: status, p_reply: null })
    if (!error) setItems((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)))
    setBusy(null)
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#8A94A6', margin: '4px 0 12px' }}>
        💬 الشكاوى والملاحظات من المستخدمين{' '}
        {openCount > 0 && (
          <span style={{ background: '#FCE9E6', color: '#C0392B', padding: '2px 9px', borderRadius: 99, fontSize: 12 }}>
            {openCount} مفتوح
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: 30, textAlign: 'center', color: '#8A94A6' }}>
          لا توجد شكاوى أو ملاحظات بعد
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#F7F9FC', textAlign: 'right' }}>
                {['المدرسة', 'النوع', 'الأولوية', 'التفاصيل', 'الحالة', ''].map((h) => (
                  <th key={h} style={{ padding: '11px 14px', fontSize: 12.5, color: '#69757F', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((f) => {
                const pr = PRIO[f.priority] || PRIO.normal
                return (
                  <tr key={f.id} style={{ borderTop: '1px solid #F2F5F8' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#0A1D33', fontSize: 13.5 }}>{f.school_name || '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13 }}>{KIND[f.kind] || f.kind}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ background: pr.bg, color: pr.c, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99 }}>{pr.t}</span>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 12.5, color: '#556', maxWidth: 280 }}>{f.body}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{
                        background: f.status === 'closed' ? '#E6F4EC' : '#FBF3D5',
                        color: f.status === 'closed' ? '#1A7A45' : '#8A6D0F',
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                      }}>{f.status === 'closed' ? 'مغلق' : 'مفتوح'}</span>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {f.status !== 'closed' ? (
                        <button onClick={() => resolve(f.id, 'closed')} disabled={busy === f.id}
                          style={{ background: '#E6F4EC', color: '#1A7A45', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {busy === f.id ? '...' : 'إغلاق'}
                        </button>
                      ) : (
                        <button onClick={() => resolve(f.id, 'open')} disabled={busy === f.id}
                          style={{ background: '#EEF1F5', color: '#69757F', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          إعادة فتح
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ErrorLogSection() {
  const supabase = createClient()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sev, setSev] = useState<string>('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function load(severity: string) {
    setLoading(true)
    const { data } = await supabase.rpc('platform_error_log', {
      p_limit: 200,
      p_severity: severity || null,
    })
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load(sev)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sev])

  async function resolve(id: string) {
    setBusy(id)
    const { error } = await supabase.rpc('resolve_error', { p_id: id })
    if (!error) setRows((prev) => prev.map((r) => (r.id === id ? { ...r, resolved: true } : r)))
    setBusy(null)
  }

  function copyMarkdown(r: any) {
    const fence = String.fromCharCode(96, 96, 96)
    const lines = [
      '**المصدر:** ' + r.source,
      '**الخطورة:** ' + r.severity,
      '**المدرسة:** ' + r.school_name,
      '**الوقت:** ' + r.created_at,
      '**الرسالة:** ' + r.message,
    ]
    if (r.context) {
      lines.push('**السياق:**')
      lines.push(fence + 'json')
      lines.push(JSON.stringify(r.context, null, 2))
      lines.push(fence)
    }
    navigator.clipboard?.writeText(lines.join('\n'))
  }

  const SEV: Record<string, { label: string; bg: string; c: string }> = {
    error: { label: 'خطأ', bg: '#FCE9E6', c: '#C0392B' },
    warning: { label: 'تحذير', bg: '#FBF3D5', c: '#8A6D0F' },
    info: { label: 'معلومة', bg: '#E8EEF8', c: '#2E5EA8' },
  }
  const counts: Record<string, number> = {}
  rows.forEach((r) => { counts[r.severity] = (counts[r.severity] ?? 0) + 1 })

  const filterOptions: Array<[string, string]> = [
    ['', 'الكل (' + rows.length + ')'],
    ['error', 'خطأ' + (counts.error ? ' (' + counts.error + ')' : '')],
    ['warning', 'تحذير' + (counts.warning ? ' (' + counts.warning + ')' : '')],
    ['info', 'معلومة' + (counts.info ? ' (' + counts.info + ')' : '')],
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {filterOptions.map(([k, label]) => (
          <button key={k} onClick={() => setSev(k)} style={{
            background: sev === k ? '#0A1D33' : '#fff', color: sev === k ? '#fff' : '#69757F',
            border: '1px solid ' + (sev === k ? '#0A1D33' : '#E5E9F0'), borderRadius: 9,
            padding: '7px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>{label}</button>
        ))}
        <button onClick={() => load(sev)} style={{
          background: '#fff', color: '#2E5EA8', border: '1px solid #E5E9F0', borderRadius: 9,
          padding: '7px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginInlineStart: 'auto',
        }}>↻ تحديث</button>
      </div>

      {loading ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: 30, textAlign: 'center', color: '#8A94A6' }}>جارٍ التحميل…</div>
      ) : rows.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', color: '#8A94A6' }}>
          لا أخطاء مسجّلة{sev ? ' بهذا التصنيف' : ''} — النظام يعمل بسلاسة ✓
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          {rows.map((r, i) => {
            const sc = SEV[r.severity] ?? SEV.error
            const isOpen = expanded === r.id
            return (
              <div key={r.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #F2F5F8', opacity: r.resolved ? 0.55 : 1 }}>
                <div onClick={() => setExpanded(isOpen ? null : r.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', flexWrap: 'wrap' }}>
                  <span style={{ background: sc.bg, color: sc.c, fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20, flexShrink: 0 }}>{sc.label}</span>
                  <span style={{ flex: 1, minWidth: 200, fontSize: 13.5, color: '#0A1D33', fontWeight: 600 }}>{r.message}</span>
                  <span style={{ fontSize: 12, color: '#8A94A6' }}>{r.school_name}</span>
                  <span style={{ fontSize: 11.5, color: '#9AA7B8', whiteSpace: 'nowrap' }}>{r.created_at ? String(r.created_at).slice(0, 16).replace('T', ' ') : ''}</span>
                  {r.resolved && <span style={{ fontSize: 11, color: '#1A7A45', fontWeight: 700 }}>✓ حُلّ</span>}
                </div>
                {isOpen && (
                  <div style={{ padding: '0 16px 16px', background: '#F9FAFC' }}>
                    <div style={{ fontSize: 12.5, color: '#556', margin: '8px 0' }}>
                      <b>المصدر:</b> {r.source} · <b>معرّف:</b> <span dir="ltr">{r.id ? String(r.id).slice(0, 8) : ''}</span>
                    </div>
                    {r.context && (
                      <pre style={{ background: '#0A1D33', color: '#DCE3EA', padding: 12, borderRadius: 8, fontSize: 11.5, overflowX: 'auto', direction: 'ltr', textAlign: 'left' }}>
                        {JSON.stringify(r.context, null, 2)}
                      </pre>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <button onClick={() => copyMarkdown(r)}
                        style={{ background: '#EEF3FA', color: '#2E5EA8', border: 0, borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        📋 نسخ Markdown
                      </button>
                      {!r.resolved && (
                        <button onClick={() => resolve(r.id)} disabled={busy === r.id}
                          style={{ background: '#E6F4EC', color: '#1A7A45', border: 0, borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {busy === r.id ? '…' : '✓ تعليم كمحلول'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
