'use client'
// لوحة "صحّة النظام" — مراقبة حيّة (polling كل 8 ثوانٍ) لكل الأدوات المشغّلة للمنصة.
// كل رقم هنا حقيقي من platform_system_health() — لا أرقام وهمية.
import { useEffect, useRef, useState } from 'react'

type Health = {
  connections: { total: number; active: number; idle: number; max_connections: number }
  queue: { pending: number; dead: number; oldest_pending_seconds: number }
  whatsapp: { sample_size: number; sent: number; failed: number; last_sent_at: string | null }
  email: { sample_size: number; sent: number; failed: number; last_sent_at: string | null }
  payments: { last_paid_at: string | null; last_failed_at: string | null; paid_24h: number; failed_24h: number }
  errors: { critical_24h: number; unresolved_total: number }
  quotas: { db_size_bytes: number; db_limit_bytes: number; storage_size_bytes: number; storage_limit_bytes: number }
  generated_at: string
  db_latency_ms: number
}

type Status = 'ok' | 'warn' | 'bad' | 'none'
const COLOR: Record<Status, string> = { ok: '#27AE60', warn: '#D4A017', bad: '#C0392B', none: '#B7C0CC' }
const LABEL: Record<Status, string> = { ok: 'طبيعي', warn: 'تنبيه', bad: 'حرج', none: 'لا بيانات' }

function Gauge({ title, sub, status, big }: { title: string; sub: string; status: Status; big: string }) {
  // نصف دائرة SVG بسيطة — القوس يمتلئ حسب الحالة (100 طبيعي / 60 تنبيه / 25 حرج)
  const pct = status === 'ok' ? 100 : status === 'warn' ? 60 : status === 'bad' ? 25 : 0
  const r = 40
  const circumference = Math.PI * r
  const offset = circumference - (pct / 100) * circumference
  const color = COLOR[status]

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.07)', textAlign: 'center' }}>
      <svg width="110" height="62" viewBox="0 0 110 62">
        <path d="M 5 55 A 40 40 0 0 1 105 55" fill="none" stroke="#EEF1F5" strokeWidth="9" strokeLinecap="round" />
        <path
          d="M 5 55 A 40 40 0 0 1 105 55"
          fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset .6s ease, stroke .6s ease' }}
        />
      </svg>
      <div style={{ marginTop: -6, fontFamily: 'Cairo', fontWeight: 800, fontSize: 18, color: '#0A1D33' }}>{big}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0A1D33', marginTop: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color, fontWeight: 700, marginTop: 2 }}>{LABEL[status]}</div>
      <div style={{ fontSize: 10.5, color: '#8A94A6', marginTop: 3, minHeight: 14 }}>{sub}</div>
    </div>
  )
}

function minsAgo(iso: string | null): number | null {
  if (!iso) return null
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
}
function fmtAgo(mins: number | null): string {
  if (mins === null) return 'لا سجلّ بعد'
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} د`
  const h = Math.round(mins / 60)
  if (h < 24) return `منذ ${h} س`
  return `منذ ${Math.round(h / 24)} يوم`
}

export default function SystemHealthPanel() {
  const [data, setData] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/platform/system-health', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'فشل الجلب'); return }
      setData(json)
      setError(null)
      setLastFetch(new Date())
    } catch {
      setError('تعذّر الاتصال بالخادم')
    }
  }

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, 8000) // مراقبة حيّة كل 8 ثوانٍ
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  if (error && !data) {
    return (
      <div style={{ background: '#FCE9E6', border: '1px solid #F0C4BC', borderRadius: 13, padding: 16, color: '#C0392B', fontSize: 13.5 }}>
        ⚠️ {error}
      </div>
    )
  }
  if (!data) {
    return <div style={{ color: '#8A94A6', fontSize: 13.5, padding: 20 }}>جارٍ التحميل…</div>
  }

  const connPct = data.connections.max_connections
    ? Math.round((data.connections.total / data.connections.max_connections) * 100)
    : 0
  const connStatus: Status = connPct < 60 ? 'ok' : connPct < 85 ? 'warn' : 'bad'
  const dbStatus: Status = data.db_latency_ms < 150 ? 'ok' : data.db_latency_ms < 400 ? 'warn' : 'bad'

  const oldestMin = Math.round(data.queue.oldest_pending_seconds / 60)
  const queueStatus: Status = data.queue.dead > 0 || oldestMin > 30 ? 'bad' : data.queue.pending > 20 || oldestMin > 5 ? 'warn' : 'ok'

  const waTotal = data.whatsapp.sent + data.whatsapp.failed
  const waRate = waTotal ? Math.round((data.whatsapp.sent / waTotal) * 100) : null
  const waStatus: Status = waRate === null ? 'none' : waRate >= 95 ? 'ok' : waRate >= 80 ? 'warn' : 'bad'

  const emTotal = data.email.sent + data.email.failed
  const emRate = emTotal ? Math.round((data.email.sent / emTotal) * 100) : null
  const emStatus: Status = emRate === null ? 'none' : emRate >= 95 ? 'ok' : emRate >= 80 ? 'warn' : 'bad'

  const paidAgoMin = minsAgo(data.payments.last_paid_at)
  const payStatus: Status =
    data.payments.paid_24h === 0 && data.payments.failed_24h === 0 ? 'none'
      : paidAgoMin !== null && paidAgoMin < 24 * 60 ? 'ok'
      : paidAgoMin !== null && paidAgoMin < 72 * 60 ? 'warn' : 'bad'

  const errStatus: Status = data.errors.critical_24h === 0 ? 'ok' : data.errors.critical_24h < 5 ? 'warn' : 'bad'

  const dbQuotaPct = Math.round((data.quotas.db_size_bytes / data.quotas.db_limit_bytes) * 100)
  const dbQuotaStatus: Status = dbQuotaPct < 70 ? 'ok' : dbQuotaPct < 90 ? 'warn' : 'bad'
  const storageQuotaPct = Math.round((data.quotas.storage_size_bytes / data.quotas.storage_limit_bytes) * 100)
  const storageQuotaStatus: Status = storageQuotaPct < 70 ? 'ok' : storageQuotaPct < 90 ? 'warn' : 'bad'
  const fmtMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#27AE60', animation: 'rp-pulse 1.6s infinite' }} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1A7A45' }}>مراقبة حيّة — تحديث كل 8 ثوانٍ</span>
        </div>
        {lastFetch && (
          <span style={{ fontSize: 11.5, color: '#8A94A6' }}>
            آخر تحديث: {lastFetch.toLocaleTimeString('ar-OM', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {error && (
        <div style={{ background: '#FBF3D5', border: '1px solid #EAD98A', borderRadius: 10, padding: '8px 12px', color: '#8A6D0F', fontSize: 12.5, marginBottom: 12 }}>
          ⚠️ آخر تحديث فشل ({error}) — يُعرض آخر بيانات معروفة.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        <Gauge title="قاعدة البيانات" sub={`${data.db_latency_ms} ms استجابة`} status={dbStatus} big={`${data.db_latency_ms}ms`} />
        <Gauge title="اتصالات القاعدة" sub={`${data.connections.total} من ${data.connections.max_connections}`} status={connStatus} big={`${connPct}%`} />
        <Gauge title="طابور الإشعارات" sub={data.queue.dead > 0 ? `${data.queue.dead} فشلت نهائياً` : `أقدمها منذ ${oldestMin} د`} status={queueStatus} big={`${data.queue.pending}`} />
        <Gauge title="واتساب (Twilio)" sub={waTotal ? `${data.whatsapp.sent}/${waTotal} آخر عيّنة` : 'لا إرسال حديث'} status={waStatus} big={waRate === null ? '—' : `${waRate}%`} />
        <Gauge title="البريد (Resend)" sub={emTotal ? `${data.email.sent}/${emTotal} آخر عيّنة` : 'لا إرسال حديث'} status={emStatus} big={emRate === null ? '—' : `${emRate}%`} />
        <Gauge title="بوابة الدفع (Thawani)" sub={fmtAgo(paidAgoMin)} status={payStatus} big={`${data.payments.paid_24h}`} />
        <Gauge title="الأخطاء الحرجة" sub={`${data.errors.unresolved_total} غير محلولة إجمالاً`} status={errStatus} big={`${data.errors.critical_24h}`} />
        <Gauge title="حجم قاعدة البيانات" sub={`${fmtMB(data.quotas.db_size_bytes)} / 500 MB`} status={dbQuotaStatus} big={`${dbQuotaPct}%`} />
        <Gauge title="مساحة التخزين" sub={`${fmtMB(data.quotas.storage_size_bytes)} / 1024 MB`} status={storageQuotaStatus} big={`${storageQuotaPct}%`} />
      </div>

      <div style={{ marginTop: 10, fontSize: 11.5, color: '#8A94A6' }}>
        Egress، المستخدمين الفعّالين شهرياً (MAU)، وRealtime ما تعرضها أي API متاحة حالياً — تابعها من{' '}
        <a href="https://supabase.com/dashboard/org/vercel_icfg_hq3lVvkMcf5Ob5KxZ1lk7bxh/usage" target="_blank" rel="noopener noreferrer" style={{ color: '#2E5EA8' }}>
          لوحة استهلاك Supabase
        </a>.
      </div>

      <style>{`@keyframes rp-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }`}</style>
    </div>
  )
}
