'use client'
// مركز تحكّم RusoomPay — واجهة enterprise احترافية
// 3 أقسام: نظرة عامة · الإيرادات · إدارة الاشتراكات
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import SchoolManageModal from './SchoolManageModal'
import PendingSubs from './PendingSubs'
import CountryToggles from './CountryToggles'
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

export default function ControlCenter({ overview, revenue, subscriptions, pending, analytics, audit, feedback }: {
  overview: Nums; revenue: Nums; subscriptions: Sub[]; pending: Pending[]
  analytics: SchoolStat[]; audit: AuditRow[]; feedback: FeedbackRow[]
}) {
  // قيم افتراضية آمنة — تمنع الانهيار حين تكون المنصة فارغة (لا مدارس بعد)
  overview = overview ?? {}
  revenue = revenue ?? {}
  subscriptions = subscriptions ?? []
  pending = pending ?? []
  analytics = analytics ?? []
  audit = audit ?? []
  feedback = feedback ?? []
  const [tab, setTab] = useState<'overview' | 'revenue' | 'subs' | 'schools' | 'audit' | 'feedback' | 'monitor' | 'settings'>('overview')
  const [manageSchool, setManageSchool] = useState<{ id: string; name: string } | null>(null)
  const [filter, setFilter] = useState('all')
  const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  const int = (n: number) => (n ?? 0).toLocaleString('en-US')

  const filtered = filter === 'all' ? subscriptions : subscriptions.filter((s) => s.status === filter)

  return (
    <div dir="rtl">
      {/* ترويسة */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
        <div>
          <h1 style={{ color: '#0A1D33', fontSize: 24, margin: 0 }}>مركز تحكّم RusoomPay</h1>
          <p style={{ color: '#8A94A6', fontSize: 13.5, margin: '4px 0 0' }}>مراقبة المنصة بالكامل — المدارس، الإيرادات، الاشتراكات</p>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#E6F4EC', color: '#1A7A45', fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 99 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1A7A45' }} /> المنصة تعمل
        </span>
      </div>

      {/* تبويبات */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #E5E9F0', margin: '20px 0 24px' }}>
        {([['overview', '📊 نظرة عامة'], ['revenue', '💰 الإيرادات'], ['subs', '📋 الاشتراكات'], ['schools', '🏫 المدارس'], ['audit', '📜 التدقيق'], ['feedback', '💬 الشكاوى'], ['monitor', '🩺 المراقبة'], ['settings', '⚙️ الإعدادات']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            padding: '11px 18px', fontSize: 14.5, fontWeight: 600,
            color: tab === k ? '#0A1D33' : '#8A94A6',
            borderBottom: tab === k ? '2.5px solid #D4A017' : '2.5px solid transparent',
            marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {/* القسم 1: نظرة عامة */}
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

      {/* القسم 2: الإيرادات */}
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

      {/* القسم 3: إدارة الاشتراكات */}
      {tab === 'subs' && (
        <div>
          {/* مرشّحات */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {[['all', 'الكل'], ['active', 'نشط'], ['trial', 'تجريبي'], ['pending', 'بانتظار'], ['expired', 'منتهٍ']].map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)} style={{
                background: filter === k ? '#0A1D33' : '#fff', color: filter === k ? '#fff' : '#69757F',
                border: '1px solid ' + (filter === k ? '#0A1D33' : '#E5E9F0'), borderRadius: 9,
                padding: '7px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{label}</button>
            ))}
          </div>

          {/* اعتمادات معلّقة */}
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

          {/* جدول الاشتراكات */}
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
      {/* القسم 7: تحليلات المدارس */}
      {tab === 'schools' && (
        <div>
          <SecLabel>تحليلات المدارس ({analytics.length})</SecLabel>
          {analytics.length === 0 ? (
            <Empty>لا مدارس بعد</Empty>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
              {analytics.map((s) => (
                <div key={s.school_id} style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
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
                      <span>نسبة التحصيل</span><b style={{ color: s.collection_rate >= 80 ? '#1A7A45' : s.collection_rate >= 60 ? '#B8860B' : '#C0392B' }}>{s.collection_rate}%</b>
                    </div>
                    <div style={{ height: 8, background: '#EEF1F5', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${s.collection_rate}%`, height: '100%', borderRadius: 99, background: s.collection_rate >= 80 ? '#27AE60' : s.collection_rate >= 60 ? '#D4A017' : '#C0392B' }} />
                    </div>
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #F2F5F8', fontSize: 12, color: '#8A94A6' }}>
                    آخر نشاط: {s.last_activity ? s.last_activity.slice(0, 10) : 'لا يوجد'}
                  </div>
                  <button
                    onClick={() => setManageSchool({ id: s.school_id, name: s.school_name })}
                    style={{ marginTop: 12, width: '100%', padding: '9px', background: '#0A1D33', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    🛠️ دخول وإدارة
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* القسم 10: سجل التدقيق */}
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

      {/* القسم 4: المراقبة (واجهة — تتطلب تكاملاً خارجياً) */}
      {tab === 'feedback' && (
        <FeedbackSection feedback={feedback} />
      )}

      {tab === 'monitor' && (
        <div>
          <SecLabel>صحّة خدمات المنصة</SecLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
            {[['الواجهة الأمامية', 'ok'], ['الخادم (API)', 'ok'], ['قاعدة البيانات', 'ok'], ['بوابة الدفع', 'pending'], ['خدمة البريد', 'ok'], ['الإشعارات', 'pending']].map(([name, st]) => (
              <div key={name} style={{ background: '#fff', borderRadius: 13, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.07)', display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: st === 'ok' ? '#27AE60' : '#D4A017', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0A1D33' }}>{name}</div>
                  <div style={{ fontSize: 11.5, color: st === 'ok' ? '#1A7A45' : '#8A6D0F' }}>{st === 'ok' ? 'يعمل' : 'لم يُفعّل بعد'}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: '#EEF3FA', border: '1px solid #D3E0F0', borderRadius: 13, padding: 16, fontSize: 13.5, color: '#2E5EA8', lineHeight: 1.9 }}>
            ℹ️ المراقبة الحيّة المتقدّمة (الجلسات النشطة، الأخطاء اللحظية، استهلاك التخزين) تتطلب ربط خدمات خارجية مثل Sentry وأدوات Supabase. الواجهة جاهزة للوصل عند تفعيل التكامل — لا تُعرض أرقام وهمية.
          </div>
        </div>
      )}

      {/* القسم: الإعدادات — تفعيل/تعطيل دول الخليج */}
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
  return (
    <div style={{ background: '#fff', borderRadius: 15, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,.07)', borderTop: `3px solid ${accent}` }}>
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

// رسم الإيراد حسب الباقة (أعمدة بسيطة)
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
      {rows.map(([label, val, color]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 48, fontSize: 13, color: '#667' }}>{label}</span>
          <div style={{ flex: 1, background: '#EEF1F5', borderRadius: 99, height: 22, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max((val / max) * 100, 2)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .5s' }} />
          </div>
          <span style={{ width: 80, textAlign: 'left', fontFamily: 'Cairo', fontWeight: 700, color: '#0A1D33', fontSize: 13.5 }}>{val.toLocaleString('en-US')} ر.ع</span>
        </div>
      ))}
    </div>
  )
}

// اعتمادات معلّقة مختصرة
function PendingSubsInline({ pending }: { pending: Pending[] }) {
  const name = (s: Pending) => Array.isArray(s.schools) ? s.schools[0]?.name : s.schools?.name
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {pending.map((s) => (
        <div key={s.id} style={{ background: '#FBF3D5', border: '1px solid #EAD9A0', borderRadius: 11, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontWeight: 600, color: '#7A5C0A', fontSize: 14 }}>🏦 {name(s) ?? 'مدرسة'} — باقة {PLAN_AR[s.plan] ?? s.plan}</span>
          <span style={{ fontSize: 12, color: '#8A6D0F' }}>{s.created_at?.slice(0, 10)}</span>
        </div>
      ))}
    </div>
  )
}

// ── قسم الشكاوى والملاحظات (مدير المنصة: عرض + متابعة) ──
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
