'use client'
// واجهة لوحة التحكم الموحّدة — تصميم احترافي يتكيّف حسب الدور
// تجمع: تنبيهات تحتاج إجراءً (تشغيلي) + مؤشرات الأداء (تحليلي) + روابط سريعة
import Link from 'next/link'
import {
  GraduationCap, Users, TrendingUp, Wallet, UserPlus, Banknote, ReceiptText,
  Bell, FileUp, BarChart3, ClipboardList, Gem, TriangleAlert, type LucideIcon,
} from 'lucide-react'

type Data = Record<string, number>

export default function DashboardClient({
  userName, roleLabel, role, schoolName, sym, canFinance, isStaff, data, analytics, recent,
}: {
  userName: string; roleLabel: string; role: string; schoolName: string
  currency?: string; sym: string; canFinance: boolean; isStaff: boolean; data: Data
  analytics?: { months?: { month: string; amount: number }[]; this_year?: number; last_year?: number }
  recent?: { action: string; details: string | null; created_at: string }[]
}) {
  const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  const int = (n: number) => (n ?? 0).toLocaleString('en-US')
  const collection = data.collection_rate ?? 100
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء الخير'

  // التنبيهات التشغيلية (تحتاج إجراءً الآن)
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
        @media(prefers-reduced-motion:reduce){.ep-quicklink,.ep-alert,.ep-kpi{transition:none}}
      `}</style>
      {/* الترويسة */}
      <div style={{ marginBottom: 26 }}>
        <div style={{ fontSize: 14, color: '#8A94A6' }}>{schoolName}</div>
        <h1 style={{ color: '#0F2744', fontSize: 26, margin: '4px 0 2px' }}>{greet}، {userName}</h1>
        <span style={{ fontSize: 13, color: '#fff', background: '#163B68', padding: '3px 12px', borderRadius: 99, fontWeight: 600 }}>{roleLabel}</span>
      </div>

      {/* تنبيهات تحتاج إجراءً (تشغيلي) */}
      {alerts.length > 0 && (
        <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
          {alerts.map((a, i) => (
            <Link key={i} href={a.href} className="ep-alert" style={{
              display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none',
              background: a.tone === 'red' ? '#FDECEA' : '#FBF3D5',
              border: `1px solid ${a.tone === 'red' ? '#F3C9C2' : '#EAD9A0'}`,
              borderRadius: 13, padding: '14px 18px',
            }}>
              {(() => { const AlertIcon = a.icon; return <AlertIcon size={20} strokeWidth={2} color={a.tone === 'red' ? '#A5331F' : '#7A5C0A'} /> })()}
              <span style={{ flex: 1, color: a.tone === 'red' ? '#A5331F' : '#7A5C0A', fontWeight: 600, fontSize: 14.5 }}>{a.text}</span>
              <span style={{ color: '#8A94A6', fontSize: 18 }}>‹</span>
            </Link>
          ))}
        </div>
      )}

      {/* مؤشرات الأداء (تحليلي) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14, marginBottom: 14 }}>
        <Kpi label="الطلاب النشطون" value={int(data.students)} icon={GraduationCap} />
        <Kpi label="الموظفون" value={int(data.employees)} icon={Users} />
        {canFinance && <Kpi label="صافي الربح" value={fmt(data.profit)} unit={sym} tone={(data.profit ?? 0) < 0 ? 'act' : 'quiet'} icon={TrendingUp} />}
        {canFinance && <Kpi label="المتبقّي للتحصيل" value={fmt(data.outstanding)} unit={sym} tone={(data.overdue_count ?? 0) > 0 ? 'act' : 'quiet'} icon={Wallet} />}
      </div>

      {/* نسبة التحصيل — مؤشر بصري */}
      {isStaff && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 22, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <b style={{ color: '#0F2744', fontSize: 15 }}>نسبة تحصيل الرسوم</b>
            <span style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: 22, color: collection >= 80 ? '#1A7A45' : collection >= 60 ? '#B8860B' : '#C0392B' }}>{collection}%</span>
          </div>
          <div style={{ height: 12, background: '#EEF1F5', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${collection}%`, height: '100%', borderRadius: 99, transition: 'width .6s', background: collection >= 80 ? 'linear-gradient(90deg,#1E8E5A,#27AE60)' : collection >= 60 ? 'linear-gradient(90deg,#D4A017,#E8BC45)' : 'linear-gradient(90deg,#C0392B,#E05545)' }} />
          </div>
          {canFinance && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 13, color: '#667' }}>
              <span>المحصّل: <b style={{ color: '#0F2744' }}>{fmt(data.fees_paid)} {sym}</b></span>
              <span>الإجمالي: <b style={{ color: '#0F2744' }}>{fmt(data.fees_total)} {sym}</b></span>
            </div>
          )}
        </div>
      )}

      {/* إجراءات سريعة */}
      {isStaff && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#8A94A6', marginBottom: 12 }}>إجراءات سريعة</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <QuickAction href="/students" icon={UserPlus} label="إضافة طالب" />
            <QuickAction href="/fees" icon={Banknote} label="تسجيل دفعة" />
            <QuickAction href="/fees" icon={ReceiptText} label="إنشاء فاتورة" />
            <QuickAction href="/fees" icon={Bell} label="إرسال تذكير" />
            {canFinance && <QuickAction href="/accounting" icon={FileUp} label="تصدير تقرير" />}
          </div>
        </div>
      )}

      {/* تحليلات التحصيل — رسم بياني شهري */}
      {canFinance && analytics?.months && analytics.months.length > 0 && (
        <CollectionChart months={analytics.months} thisYear={analytics.this_year ?? 0} lastYear={analytics.last_year ?? 0} sym={sym} />
      )}

      {/* آخر العمليات */}
      {role === 'owner' && recent && recent.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <b style={{ color: '#0F2744', fontSize: 15 }}>آخر العمليات</b>
            <Link href="/activity" style={{ fontSize: 13, color: '#2E5EA8', fontWeight: 600 }}>عرض الكل ‹</Link>
          </div>
          <div style={{ display: 'grid', gap: 2 }}>
            {recent.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderBottom: i < recent!.length - 1 ? '1px solid #F2F5F8' : 'none' }}>
                <span style={{ fontSize: 16 }}>{recentIcon(r.action)}</span>
                <span style={{ flex: 1, fontSize: 14, color: '#1A2530' }}>{r.action}{r.details ? <span style={{ color: '#8A94A6' }}> · {r.details}</span> : null}</span>
                <span style={{ fontSize: 12, color: '#9AA7B8' }}>{relTime(r.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* روابط سريعة حسب الدور */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#8A94A6', marginBottom: 12 }}>الوصول السريع</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
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
// 'quiet' = حبر عادي (الأغلب) · 'act' = كهرماني، يحتاج قرارك · 'good' = هدف تحقّق
function Kpi({ label, value, unit, tone = 'quiet', icon: Icon }: { label: string; value: string; unit?: string; tone?: 'quiet' | 'act' | 'good'; icon: LucideIcon }) {
  const ink = '#0F2744'
  const c = tone === 'act' ? '#7A4A00' : tone === 'good' ? '#2F5D50' : '#8A94A6'
  const border = tone === 'act' ? '#7A4A00' : tone === 'good' ? '#2F5D50' : '#E3E8EE'
  const bg = tone === 'act' ? '#FDFAF4' : '#fff'
  return (
    <div className="ep-kpi" style={{ background: bg, borderRadius: 16, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,.07)', borderTop: `3px solid ${border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#8A94A6', fontSize: 13 }}>{label}</span>
        <Icon size={20} strokeWidth={2} color={c} />
      </div>
      <div style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: 23, color: tone === 'act' ? '#7A4A00' : ink, marginTop: 8 }}>
        {value} {unit && <span style={{ fontSize: 13, color: '#8A94A6', fontWeight: 400 }}>{unit}</span>}
      </div>
    </div>
  )
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className="ep-quicklink" style={{ display: 'flex', alignItems: 'center', gap: 11, background: '#fff', border: '1px solid #EAEEF3', borderRadius: 13, padding: '15px 16px', textDecoration: 'none', color: '#0F2744', fontWeight: 600, fontSize: 14.5 }}>
      <Icon size={20} strokeWidth={2} color="#0F2744" /> {label}
    </Link>
  )
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className="ep-quicklink" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#0F2744', color: '#fff', borderRadius: 11, padding: '11px 16px', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
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
    <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
        <b style={{ color: '#0F2744', fontSize: 15 }}>تحليلات التحصيل الشهري</b>
        {growth !== null && (
          <span style={{ fontSize: 13, fontWeight: 700, color: growth >= 0 ? '#1A7A45' : '#C0392B' }}>
            {growth >= 0 ? '▲' : '▼'} {Math.abs(growth)}% مقارنة بالعام الماضي
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, paddingBottom: 22, position: 'relative' }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8, paddingTop: 14, borderTop: '1px solid #F2F5F8', fontSize: 13 }}>
        <span style={{ color: '#667' }}>هذا العام: <b style={{ color: '#0F2744' }}>{fmt(thisYear)} {sym}</b></span>
        <span style={{ color: '#667' }}>العام الماضي: <b style={{ color: '#0F2744' }}>{fmt(lastYear)} {sym}</b></span>
      </div>
    </div>
  )
}

// أيقونة العملية حسب نوعها
function recentIcon(action: string): string {
  if (action.includes('دفعة') || action.includes('دفع')) return '💵'
  if (action.includes('راتب')) return '💰'
  if (action.includes('اشتراك')) return '💎'
  if (action.includes('حساب') || action.includes('بنك')) return '🏦'
  if (action.includes('اعتماد') || action.includes('تفعيل')) return '✓'
  if (action.includes('رفض')) return '✕'
  return '•'
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
