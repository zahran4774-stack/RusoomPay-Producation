'use client'
// واجهة لوحة التحكم الموحّدة — تصميم احترافي يتكيّف حسب الدور
// المرحلة 1: تسلسل بصري أوضح + فراغات أقل ~15% + Timeline ملوّن + KPIs أبرز
import Link from 'next/link'
import {
  GraduationCap, Users, TrendingUp, Wallet, UserPlus, Banknote, ReceiptText,
  Bell, FileUp, BarChart3, ClipboardList, Gem, TriangleAlert, Landmark,
  CheckCircle2, XCircle, CircleDot, type LucideIcon,
} from 'lucide-react'

type Data = Record<string, number>

export default function DashboardClient({
  roleLabel, role, sym, canFinance, isStaff, data, analytics, recent,
}: {
  userName: string; roleLabel: string; role: string; schoolName: string
  currency?: string; sym: string; canFinance: boolean; isStaff: boolean; data: Data
  analytics?: { months?: { month: string; amount: number }[]; this_year?: number; last_year?: number }
  recent?: { action: string; details: string | null; created_at: string }[]
}) {
  const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  const int = (n: number) => (n ?? 0).toLocaleString('en-US')
  const collection = data.collection_rate ?? 100

  // التنبيهات التشغيلية (تحتاج إجراءً الآن) — دائماً أول ما يُرى
  const alerts: { icon: LucideIcon; text: string; href: string; tone: 'amber' | 'red' }[] = []
  if (role === 'owner' && (data.pending_salary ?? 0) > 0)
    alerts.push({ icon: Bell, text: `${data.pending_salary} طلب تعديل راتب بانتظار اعتمادك`, href: '/employees', tone: 'amber' })
  if (isStaff && (data.overdue_count ?? 0) > 0)
    alerts.push({ icon: TriangleAlert, text: `${data.overdue_count} فاتورة متأخّرة عن موعد السداد`, href: '/fees', tone: 'red' })

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }} dir="rtl">

     <style>{`
  .ep-quicklink{transition:border-color .15s,transform .15s,box-shadow .15s}
  .ep-quicklink:hover{border-color:#163B68;transform:translateY(-2px);box-shadow:0 8px 20px -8px rgba(15,39,68,.25)}
  .ep-alert{transition:transform .15s,box-shadow .15s}
  .ep-alert:hover{transform:translateX(-3px);box-shadow:0 6px 18px -8px rgba(15,39,68,.18)}
  .ep-kpi{transition:transform .15s,box-shadow .15s}
  .ep-kpi:hover{transform:translateY(-3px);box-shadow:0 10px 26px -12px rgba(15,39,68,.2)}
  .ep-tl-item{transition:background .15s}
  .ep-tl-item:hover{background:#F8FAFC}

  /* نبضة للتنبيه العاجل فقط — لطيفة، تلفت النظر بلا إزعاج */
  .ep-alert-urgent{animation:epPulse 2s ease-in-out infinite}
  @keyframes epPulse{
    0%,100%{box-shadow:0 0 0 0 rgba(165,51,31,.30)}
    50%{box-shadow:0 0 0 6px rgba(165,51,31,0)}
  }
  .ep-alert-urgent .ep-alert-ico{animation:epIcoPulse 2s ease-in-out infinite}
  @keyframes epIcoPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}

  @media(prefers-reduced-motion:reduce){
    .ep-quicklink,.ep-alert,.ep-kpi,.ep-tl-item{transition:none}
    .ep-alert-urgent,.ep-alert-urgent .ep-alert-ico{animation:none}
  }
`}</style>

      {/* شارة الدور فقط — التحية واسم المدرسة يعرضهما Copilot أعلاه (تفادي التكرار) */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-start' }}>
        <span style={{ fontSize: 12.5, color: '#fff', background: '#163B68', padding: '3px 12px', borderRadius: 99, fontWeight: 600 }}>{roleLabel}</span>
      </div>

      {/* ═══ 1) تنبيهات تحتاج إجراءً — أعلى التسلسل دائماً ═══ */}
      {alerts.length > 0 && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
          {alerts.map((a, i) => {
            const AlertIcon = a.icon
            return (>
            )
          })}
        </div>
      )}
<Link key={i} href={a.href}
  className={`ep-alert${a.tone === 'red' ? ' ep-alert-urgent' : ''}`}
  style={{
    display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none',
    background: a.tone === 'red' ? '#FDECEA' : '#FBF3D5',
    border: `1px solid ${a.tone === 'red' ? '#F3C9C2' : '#EAD9A0'}`,
    borderRadius: 12, padding: '12px 16px',
  }}>
  <AlertIcon className="ep-alert-ico" size={20} strokeWidth={2}
    color={a.tone === 'red' ? '#A5331F' : '#7A5C0A'} />
  <span style={{ flex: 1, color: a.tone === 'red' ? '#A5331F' : '#7A5C0A', fontWeight: 600, fontSize: 14.5 }}>{a.text}</span>
  <span style={{ color: '#8A94A6', fontSize: 18 }}>‹</span>
</Link>

      {/* ═══ 2) مؤشرات الأداء — أرقام أكبر، هي مركز اللوحة ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 12 }}>
        <Kpi label="الطلاب النشطون" value={int(data.students)} icon={GraduationCap} />
        <Kpi label="الموظفون" value={int(data.employees)} icon={Users} />
        {canFinance && <Kpi label="صافي الربح" value={fmt(data.profit)} unit={sym} tone={(data.profit ?? 0) < 0 ? 'act' : 'quiet'} icon={TrendingUp} />}
        {canFinance && <Kpi label="المتبقّي للتحصيل" value={fmt(data.outstanding)} unit={sym} tone={(data.overdue_count ?? 0) > 0 ? 'act' : 'quiet'} icon={Wallet} />}
      </div>

      {/* ═══ 3) نسبة التحصيل — يلي المؤشرات مباشرة ═══ */}
      {isStaff && (
        <div style={{ background: '#fff', borderRadius: 15, padding: 18, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <b style={{ color: '#0F2744', fontSize: 15 }}>نسبة تحصيل الرسوم</b>
            <span style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: 24, color: collection >= 80 ? '#1A7A45' : collection >= 60 ? '#B8860B' : '#C0392B' }}>{collection}%</span>
          </div>
          <div style={{ height: 12, background: '#EEF1F5', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${collection}%`, height: '100%', borderRadius: 99, transition: 'width .6s', background: collection >= 80 ? 'linear-gradient(90deg,#1E8E5A,#27AE60)' : collection >= 60 ? 'linear-gradient(90deg,#D4A017,#E8BC45)' : 'linear-gradient(90deg,#C0392B,#E05545)' }} />
          </div>
          {canFinance && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 13, color: '#667' }}>
              <span>المحصّل: <b style={{ color: '#0F2744' }}>{fmt(data.fees_paid)} {sym}</b></span>
              <span>الإجمالي: <b style={{ color: '#0F2744' }}>{fmt(data.fees_total)} {sym}</b></span>
            </div>
          )}
        </div>
      )}

      {/* ═══ 4) إجراءات سريعة ═══ */}
      {isStaff && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#8A94A6', marginBottom: 10 }}>إجراءات سريعة</div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <QuickAction href="/students" icon={UserPlus} label="إضافة طالب" />
            <QuickAction href="/fees" icon={Banknote} label="تسجيل دفعة" />
            <QuickAction href="/fees" icon={ReceiptText} label="إنشاء فاتورة" />
            <QuickAction href="/fees" icon={Bell} label="إرسال تذكير" />
            {canFinance && <QuickAction href="/accounting" icon={FileUp} label="تصدير تقرير" />}
          </div>
        </div>
      )}

      {/* ═══ 5) تحليلات التحصيل ═══ */}
      {canFinance && analytics?.months && analytics.months.length > 0 && (
        <CollectionChart months={analytics.months} thisYear={analytics.this_year ?? 0} lastYear={analytics.last_year ?? 0} sym={sym} />
      )}

      {/* ═══ 6) آخر العمليات — Timeline ملوّن بأيقونات حسب النوع ═══ */}
      {role === 'owner' && recent && recent.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 15, padding: 18, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <b style={{ color: '#0F2744', fontSize: 15 }}>آخر العمليات</b>
            <Link href="/activity" style={{ fontSize: 13, color: '#2E5EA8', fontWeight: 600, textDecoration: 'none' }}>عرض الكل ‹</Link>
          </div>
          <div style={{ position: 'relative' }}>
            {/* خط الزمن العمودي — يمرّ خلف الأيقونات */}
            <div aria-hidden="true" style={{ position: 'absolute', top: 14, bottom: 14, right: 15, width: 2, background: '#EEF1F5', borderRadius: 2 }} />
            {recent.map((r, i) => {
              const ev = eventMeta(r.action)
              const EvIcon = ev.icon
              return (
                <div key={i} className="ep-tl-item" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0', borderRadius: 10, position: 'relative' }}>
                  <span style={{
                    flex: '0 0 auto', width: 32, height: 32, borderRadius: '50%',
                    display: 'grid', placeItems: 'center',
                    background: ev.bg, border: `1.5px solid ${ev.border}`, zIndex: 1,
                  }}>
                    <EvIcon size={15} strokeWidth={2.2} color={ev.color} />
                  </span>
                  <span style={{ flex: 1, fontSize: 14, color: '#1A2530', paddingTop: 6, lineHeight: 1.5 }}>
                    {r.action}{r.details ? <span style={{ color: '#8A94A6' }}> · {r.details}</span> : null}
                  </span>
                  <span style={{ fontSize: 12, color: '#9AA7B8', paddingTop: 8, flex: '0 0 auto' }}>{relTime(r.created_at)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ 7) الوصول السريع ═══ */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#8A94A6', marginBottom: 10 }}>الوصول السريع</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
          {isStaff && <QuickLink href="/students" icon={GraduationCap} label="الطلاب والرسوم" />}
          {isStaff && <QuickLink href="/fees" icon={ReceiptText} label="الفواتير" />}
          {isStaff && <QuickLink href="/employees" icon={Users} label="الموظفون والرواتب" />}
          {canFinance && <QuickLink href="/accounting" icon={BarChart3} label="المحاسبة" />}
          {role === 'owner' && <QuickLink href="/activity" icon={ClipboardList} label="سجل النشاط" />}
          {role === 'owner' && <QuickLink href="/subscription" icon={Gem} label="اشتراك المنصة" />}
        </div>
      </div>
    </div>
  )
}

// المبدأ: اللون يظهر فقط حيث يلزم قرار. البقية حبر هادئ.
function Kpi({ label, value, unit, tone = 'quiet', icon: Icon }: { label: string; value: string; unit?: string; tone?: 'quiet' | 'act' | 'good'; icon: LucideIcon }) {
  const ink = '#0F2744'
  const c = tone === 'act' ? '#7A4A00' : tone === 'good' ? '#2F5D50' : '#8A94A6'
  const border = tone === 'act' ? '#7A4A00' : tone === 'good' ? '#2F5D50' : '#E3E8EE'
  const bg = tone === 'act' ? '#FDFAF4' : '#fff'
  return (
    <div className="ep-kpi" style={{ background: bg, borderRadius: 15, padding: '15px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.07)', borderTop: `3px solid ${border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#8A94A6', fontSize: 12.5, fontWeight: 600 }}>{label}</span>
        <Icon size={19} strokeWidth={2} color={c} />
      </div>
      {/* الرقم أكبر — هو المعلومة، لا الإطار */}
      <div style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: 27, color: tone === 'act' ? '#7A4A00' : ink, marginTop: 6, lineHeight: 1.2 }}>
        {value} {unit && <span style={{ fontSize: 13, color: '#8A94A6', fontWeight: 400 }}>{unit}</span>}
      </div>
    </div>
  )
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className="ep-quicklink" style={{ display: 'flex', alignItems: 'center', gap: 11, background: '#fff', border: '1px solid #EAEEF3', borderRadius: 12, padding: '13px 15px', textDecoration: 'none', color: '#0F2744', fontWeight: 600, fontSize: 14.5 }}>
      <Icon size={20} strokeWidth={2} color="#0F2744" /> {label}
    </Link>
  )
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className="ep-quicklink" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#0F2744', color: '#fff', borderRadius: 11, padding: '10px 15px', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
      <Icon size={18} strokeWidth={2} color="#fff" /> {label}
    </Link>
  )
}

// رسم بياني للتحصيل الشهري (أعمدة) + مقارنة سنوية
function CollectionChart({ months, thisYear, lastYear, sym }: {
  months: { month: string; amount: number }[]; thisYear: number; lastYear: number; sym: string
}) {
  const max = Math.max(...months.map((m) => m.amount), 1)
  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  const growth = lastYear > 0 ? Math.round(((thisYear - lastYear) / lastYear) * 100) : null
  const monthLabel = (ym: string) => {
    const names = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    const mi = parseInt(ym.slice(5, 7), 10) - 1
    return names[mi] ?? ym.slice(5)
  }
  return (
    <div style={{ background: '#fff', borderRadius: 15, padding: 18, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 15, flexWrap: 'wrap', gap: 8 }}>
        <b style={{ color: '#0F2744', fontSize: 15 }}>تحليلات التحصيل الشهري</b>
        {growth !== null && (
          <span style={{ fontSize: 13, fontWeight: 700, color: growth >= 0 ? '#1A7A45' : '#C0392B' }}>
            {growth >= 0 ? '▲' : '▼'} {Math.abs(growth)}% مقارنة بالعام الماضي
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 130, paddingBottom: 22, position: 'relative' }}>
        {months.map((m, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
            <div title={`${fmt(m.amount)} ${sym}`} style={{
              width: '100%', maxWidth: 36, height: `${Math.max((m.amount / max) * 100, 3)}%`,
              background: 'linear-gradient(180deg,#2E5EA8,#163B68)', borderRadius: '6px 6px 0 0', transition: 'height .5s',
            }} />
            <span style={{ fontSize: 10.5, color: '#8A94A6', marginTop: 6, position: 'absolute', bottom: 0 }}>{monthLabel(m.month)}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 6, paddingTop: 12, borderTop: '1px solid #F2F5F8', fontSize: 13 }}>
        <span style={{ color: '#667' }}>هذا العام: <b style={{ color: '#0F2744' }}>{fmt(thisYear)} {sym}</b></span>
        <span style={{ color: '#667' }}>العام الماضي: <b style={{ color: '#0F2744' }}>{fmt(lastYear)} {sym}</b></span>
      </div>
    </div>
  )
}

// ═══ تصنيف العمليات: أيقونة + لون حسب النوع (بدل الإيموجي) ═══
function eventMeta(action: string): { icon: LucideIcon; color: string; bg: string; border: string } {
  if (action.includes('دفعة') || action.includes('دفع'))
    return { icon: Banknote, color: '#1A7A45', bg: '#EAF7F0', border: '#BFE5D0' }        // مالي وارد — أخضر
  if (action.includes('راتب'))
    return { icon: Wallet, color: '#7A5C0A', bg: '#FBF3D5', border: '#EAD9A0' }          // رواتب — كهرماني
  if (action.includes('طالب'))
    return { icon: GraduationCap, color: '#2E5EA8', bg: '#EAF0FA', border: '#C6D6EE' }   // طلاب — أزرق
  if (action.includes('اشتراك'))
    return { icon: Gem, color: '#6B4E9B', bg: '#F1EDF8', border: '#D8CCEC' }             // اشتراك — بنفسجي
  if (action.includes('حساب') || action.includes('بنك'))
    return { icon: Landmark, color: '#475569', bg: '#F1F5F9', border: '#DCE3EA' }        // بنكي — رمادي
  if (action.includes('اعتماد') || action.includes('تفعيل'))
    return { icon: CheckCircle2, color: '#1A7A45', bg: '#EAF7F0', border: '#BFE5D0' }    // موافقة — أخضر
  if (action.includes('رفض') || action.includes('حذف'))
    return { icon: XCircle, color: '#A5331F', bg: '#FDECEA', border: '#F3C9C2' }         // رفض/حذف — أحمر
  return { icon: CircleDot, color: '#8A94A6', bg: '#F5F7FA', border: '#E3E8EE' }         // افتراضي — محايد
}

// وقت نسبي بالعربية
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000)
  if (m < 1) return 'الآن'
  if (m < 60) return `قبل ${m} د`
  if (h < 24) return `قبل ${h} س`
  if (d < 30) return `قبل ${d} ي`
  return new Date(iso).toISOString().slice(0, 10)
}
