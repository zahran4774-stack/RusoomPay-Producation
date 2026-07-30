'use client'
// إدارة باقة المدرسة — أربع باقات بسقوف طلاب + عرض التأسيس.
// السقف ليّن: ننبّه عند 90% ولا نقطع الخدمة.
// كل الباقات تشمل كل الميزات — الفرق في السعة فقط.
// عند تأكيد الدفع بتحويل بنكي (بعد إرفاق الإيصال): يُرفع الإيصال، يُسجَّل الاشتراك pending،
// وتُرسل رسالة واتساب فورية لمالك المنصة عبر /api/send-notify-admin.
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { Check, TriangleAlert, Users, GraduationCap, Building2, Upload, Copy, Check as CheckIcon } from 'lucide-react'

// بيانات الحساب البنكي الرسمي للمنصة — ثابتة، تُعرض للمدرسة عند اختيار التحويل البنكي
const BANK_ACCOUNT = {
  name: 'ZAHRAN ZAHIR HAMED AL DAGHARI',
  number: '0368 0016 6281 0033',
  swift: 'BMUSOMRXXXX',
  iban: 'OM670270368001662810033',
  phoneTransfer: '96895476649', // تحويل عبر رقم الهاتف (خدمة تحويل بنكي بالهاتف)
}

type Sub = {
  id: string; plan: string; status: string
  trial_ends_at: string | null; renews_at: string | null; pay_method: string | null
} | null

type Plan = {
  code: string; name: string; price: number
  price_regular: number | null; offer_ends_at: string | null; discount_pct: number | null
  max_students: number | null; max_staff: number | null; max_branches: number | null
  is_current: boolean
}

type Usage = {
  ok?: boolean
  plan_code?: string; plan_name?: string; price_omr?: number
  students_used?: number; students_max?: number | null; students_pct?: number
  staff_used?: number; staff_max?: number | null
  near_limit?: boolean; over_limit?: boolean; suggested_plan?: string | null
}

const STATUS: Record<string, { t: string; c: string; bg: string }> = {
  trial:   { t: 'تجريبي', c: '#B8860B', bg: '#FBF3D5' },
  active:  { t: 'نشط',    c: '#1A7A45', bg: '#EAF7F0' },
  pending: { t: 'بانتظار الاعتماد', c: '#8A6D0F', bg: '#FBF3D5' },
  expired: { t: 'منتهٍ',  c: '#C0392B', bg: '#FDECEA' },
}

export default function PlansManager({ sub, schoolId, schoolName }: { sub: Sub; schoolId?: string; schoolName?: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [plans, setPlans] = useState<Plan[]>([])
  const [usage, setUsage] = useState<Usage>({})
  const [picked, setPicked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // نافذة الدفع بالتحويل البنكي — تظهر بعد اختيار الباقة وقبل تسجيل الاشتراك
  const [showBankModal, setShowBankModal] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [{ data: p }, { data: u }] = await Promise.all([
        supabase.rpc('available_plans'),
        supabase.rpc('plan_usage'),
      ])
      if (!alive) return
      const pr = (p ?? {}) as { ok?: boolean; plans?: Plan[] }
      if (pr.ok && pr.plans) setPlans(pr.plans)
      setUsage((u ?? {}) as Usage)
    })()
    return () => { alive = false }
  }, [supabase])

  const st = STATUS[sub?.status ?? 'trial'] ?? STATUS.trial
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  // تاريخ انتهاء العرض بصيغة عربية مختصرة
  const offerDate = (iso: string) => {
    const d = new Date(iso)
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  }
  // أقرب تاريخ انتهاء عرض بين الباقات (لعرض شريط عام)
  const activeOffer = plans.find((p) => p.offer_ends_at)?.offer_ends_at ?? null

  // تنبيه مالك المنصة عبر واتساب — لا يُظهر أي خطأ للمستخدم لو فشل (تسجيل الاشتراك نفسه أهم وأولوية)
  async function notifyAdmin(planName: string) {
    try {
      await fetch('/api/send-notify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body:
            `🔔 اشتراك جديد بانتظار الاعتماد\n\n` +
            `المدرسة: ${schoolName || 'غير معروف'}\n` +
            `الباقة: ${planName}\n` +
            `طريقة الدفع: تحويل بنكي\n\n` +
            `راجع الإيصال واعتمد الاشتراك من لوحة تحكم المنصة.`,
        }),
      })
    } catch {
      // فشل التنبيه لا يعطّل تسجيل طلب الاشتراك نفسه
    }
  }

  async function subscribe(method: 'bank' | 'card') {
    if (!picked || !schoolId) return
    // تحويل بنكي: نفتح نافذة بيانات الحساب + رفع الإيصال، ولا نسجّل شيئاً بعد
    if (method === 'bank') { setShowBankModal(true); setMsg(null); return }

    // بطاقة/تفعيل فوري (مجاني): يسجَّل مباشرة كما كان
    setBusy(true); setMsg(null)
    const plan = plans.find((p) => p.code === picked)
    const renewsAt = new Date(Date.now() + 365 * 86400000).toISOString()
    const hasExisting = sub && ['active', 'trial', 'pending'].includes(sub.status)

    const { error } = hasExisting
      ? await supabase.from('subscriptions').update({
          plan: picked, status: 'active', pay_method: method, renews_at: renewsAt,
        }).eq('id', sub!.id)
      : await supabase.from('subscriptions').insert({
          school_id: schoolId, plan: picked, status: 'active', pay_method: method, renews_at: renewsAt,
        })
    setBusy(false)

    if (error) { setMsg({ ok: false, text: 'تعذّر إتمام الاشتراك: ' + error.message }); return }
    setMsg({ ok: true, text: `تم تفعيل باقة «${plan?.name}» بنجاح.` })
    setPicked(null)
    router.refresh()
  }

  // تأكيد التحويل البنكي — يرفع الإيصال أولاً، ثم يسجّل الاشتراك pending، ثم ينبّه مالك المنصة
  async function confirmBankTransfer() {
    if (!picked || !schoolId || !receiptFile) return
    setUploading(true); setMsg(null)

    const plan = plans.find((p) => p.code === picked)
    const renewsAt = new Date(Date.now() + 365 * 86400000).toISOString()
    const ext = receiptFile.name.split('.').pop() || 'jpg'
    const path = `${schoolId}/${Date.now()}.${ext}`

    // ١) رفع الإيصال إلى bucket خاص (subscription-receipts)
    const { error: uploadError } = await supabase.storage
      .from('subscription-receipts')
      .upload(path, receiptFile, { upsert: false })

    if (uploadError) {
      setUploading(false)
      setMsg({ ok: false, text: 'تعذّر رفع الإيصال: ' + uploadError.message })
      return
    }

    // ٢) تسجيل/تحديث الاشتراك بحالة pending + رابط الإيصال
    const hasExisting = sub && ['active', 'trial', 'pending'].includes(sub.status)
    const { error } = hasExisting
      ? await supabase.from('subscriptions').update({
          plan: picked, status: 'pending', pay_method: 'bank', renews_at: renewsAt, receipt_url: path,
        }).eq('id', sub!.id)
      : await supabase.from('subscriptions').insert({
          school_id: schoolId, plan: picked, status: 'pending', pay_method: 'bank', renews_at: renewsAt, receipt_url: path,
        })
    setUploading(false)

    if (error) { setMsg({ ok: false, text: 'تعذّر إتمام الاشتراك: ' + error.message }); return }

    setMsg({ ok: true, text: `تم إرسال إيصال التحويل لباقة «${plan?.name}» — بانتظار اعتماد الإدارة.` })
    notifyAdmin(plan?.name || picked)
    setShowBankModal(false)
    setReceiptFile(null)
    setPicked(null)
    router.refresh()
  }

  function copyText(label: string, text: string) {
    navigator.clipboard?.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div dir="rtl">
      {/* ── الحالة الراهنة ── */}
      <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 16, padding: 20, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12.5, color: '#8A94A6', marginBottom: 4 }}>باقتك الحالية</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0F2744' }}>
              {usage.plan_name ?? '—'}
              {usage.price_omr != null && usage.price_omr > 0 && (
                <span style={{ fontSize: 14, fontWeight: 600, color: '#667' }}> · {fmt(usage.price_omr)} ر.ع سنوياً</span>
              )}
              {usage.price_omr === 0 && <span style={{ fontSize: 14, fontWeight: 600, color: '#1A7A45' }}> · مجاناً</span>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ background: st.bg, color: st.c, fontWeight: 700, fontSize: 13, padding: '5px 14px', borderRadius: 99 }}>
              {st.t}
            </span>
            <button
              onClick={() => document.getElementById('plans-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              style={{
                background: '#163B68', color: '#fff', border: 0, padding: '9px 18px',
                borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}>
              ⬆ ترقية / تغيير الباقة
            </button>
          </div>
        </div>

        {/* شريط استخدام الطلاب */}
        {usage.students_max != null && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: '#667' }}>
                <GraduationCap size={14} style={{ display: 'inline', verticalAlign: -2 }} /> الطلاب النشطون
              </span>
              <span style={{ fontWeight: 700, color: usage.over_limit ? '#C0392B' : usage.near_limit ? '#B54708' : '#0F2744' }}>
                {usage.students_used} / {usage.students_max}
              </span>
            </div>
            <div style={{ height: 9, background: '#EEF1F5', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(usage.students_pct ?? 0, 100)}%`, height: '100%', borderRadius: 99,
                transition: 'width .5s',
                background: usage.over_limit ? '#C0392B' : usage.near_limit ? '#E8A33D' : '#1A7A45',
              }} />
            </div>
          </div>
        )}

        {/* تنبيه ليّن — لا قطع خدمة */}
        {(usage.near_limit || usage.over_limit) && (
          <div style={{
            marginTop: 14, display: 'flex', gap: 10, alignItems: 'flex-start',
            background: usage.over_limit ? '#FDECEA' : '#FBF3D5',
            border: `1px solid ${usage.over_limit ? '#F3C9C2' : '#EAD9A0'}`,
            borderRadius: 11, padding: '12px 14px',
          }}>
            <TriangleAlert size={18} color={usage.over_limit ? '#A5331F' : '#7A5C0A'} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, lineHeight: 1.8, color: usage.over_limit ? '#A5331F' : '#7A5C0A' }}>
              {usage.over_limit
                ? <>تجاوزت عدد الطلاب المتاح في باقتك ({usage.students_used} من {usage.students_max}). خدمتك مستمرّة — لكن يُنصح بالترقية{usage.suggested_plan ? ` إلى باقة «${usage.suggested_plan}»` : ''}.</>
                : <>اقتربت من حدّ باقتك ({usage.students_used} من {usage.students_max} طالباً). فكّر في الترقية قبل بداية العام الدراسي.</>}
            </div>
          </div>
        )}
      </div>
      {/* شريط عرض التأسيس */}
      {activeOffer && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: 'linear-gradient(135deg,#163B68,#0F2744)', color: '#fff',
          borderRadius: 14, padding: '13px 18px', marginBottom: 16,
        }}>
          <span style={{ fontSize: 20 }}>🎉</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <b style={{ fontSize: 15 }}>عرض التأسيس — لأوائل المدارس</b>
            <div style={{ fontSize: 12.5, opacity: .85, marginTop: 2 }}>
              خصومات تصل إلى 30% على جميع الباقات المدفوعة · ينتهي {offerDate(activeOffer)}
            </div>
          </div>
        </div>
      )}

      {/* ── الباقات ── */}
      <div id="plans-list" style={{ fontSize: 13, fontWeight: 700, color: '#8A94A6', marginBottom: 10, scrollMarginTop: 90 }}>الباقات المتاحة</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(215px,1fr))', gap: 12, marginBottom: 18 }}>
        {plans.map((p) => {
          const sel = picked === p.code
          return (
            <button key={p.code} onClick={() => setPicked(sel ? null : p.code)} disabled={p.is_current}
              style={{
                textAlign: 'right', fontFamily: 'inherit', cursor: p.is_current ? 'default' : 'pointer',
                background: p.is_current ? '#F7FAFC' : '#fff',
                border: `2px solid ${sel ? '#163B68' : p.is_current ? '#BFE5D0' : '#E3E8EE'}`,
                borderRadius: 15, padding: '18px 16px',
                boxShadow: sel ? '0 10px 26px -14px rgba(15,39,68,.35)' : 'none',
                transition: 'border-color .15s, box-shadow .15s',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <b style={{ fontSize: 16, color: '#0F2744' }}>{p.name}</b>
                {p.is_current ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1A7A45', background: '#EAF7F0', padding: '2px 9px', borderRadius: 99 }}>
                    باقتك
                  </span>
                ) : p.discount_pct ? (
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: '#C0392B', padding: '2px 9px', borderRadius: 99 }}>
                    خصم {p.discount_pct}%
                  </span>
                ) : null}
              </div>

              {/* السعر المشطوب — يظهر فقط أثناء العرض */}
              {p.price_regular != null && (
                <div style={{ fontSize: 14, color: '#B0B8C4', textDecoration: 'line-through', marginBottom: 1, fontFamily: 'Cairo, sans-serif' }}>
                  {fmt(p.price_regular)} ر.ع
                </div>
              )}

              <div style={{ fontSize: 25, fontWeight: 800, color: p.price === 0 ? '#1A7A45' : '#0F2744', fontFamily: 'Cairo, sans-serif', marginBottom: 2 }}>
                {p.price === 0 ? 'مجاناً' : <>{fmt(p.price)} <span style={{ fontSize: 13, fontWeight: 500, color: '#8A94A6' }}>ر.ع/سنة</span></>}
              </div>
              {p.price === 0 && <div style={{ fontSize: 12, color: '#667', marginBottom: 8 }}>دائماً — بلا انتهاء</div>}
              {p.offer_ends_at && (
                <div style={{ fontSize: 11.5, color: '#C0392B', fontWeight: 600, marginBottom: 8 }}>
                  ينتهي العرض {offerDate(p.offer_ends_at)}
                </div>
              )}

              <div style={{ display: 'grid', gap: 5, marginTop: 12, fontSize: 12.5, color: '#475569' }}>
                <Row icon={GraduationCap} text={p.max_students == null ? 'طلاب بلا حدّ' : `حتى ${fmt(p.max_students)} طالب`} />
                <Row icon={Users} text={p.max_staff == null ? 'طاقم بلا حدّ' : `${p.max_staff} حسابات للطاقم`} />
                <Row icon={Building2} text={p.max_branches == null ? 'فروع بلا حدّ' : p.max_branches === 1 ? 'فرع واحد' : `${p.max_branches} فروع`} />
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ fontSize: 12.5, color: '#8A94A6', marginBottom: 18, lineHeight: 1.9 }}>
        ✓ جميع الباقات تشمل كل الميزات — المحاسبة، الفواتير، بوابة ولي الأمر، الرواتب، التوصيات الذكية.
        الفرق في السعة فقط. لا رسوم تأسيس، ولا عقد ملزم.
      </div>

      {/* ── إتمام الاشتراك ── */}
      {picked && (
        <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 16, padding: 20, marginBottom: 18 }}>
          <b style={{ color: '#0F2744', fontSize: 15 }}>إتمام الاشتراك</b>
          <p style={{ color: '#667', fontSize: 13.5, margin: '6px 0 16px', lineHeight: 1.8 }}>
            باقة «{plans.find((p) => p.code === picked)?.name}» —{' '}
            {plans.find((p) => p.code === picked)?.price === 0
              ? 'مجانية، تُفعّل فوراً.'
              : `${fmt(plans.find((p) => p.code === picked)?.price ?? 0)} ر.ع سنوياً.`}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => subscribe('bank')} disabled={busy}
              style={{ background: busy ? '#8AA' : '#163B68', color: '#fff', border: 0, padding: '11px 22px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {busy ? 'جار…' : 'اشتراك بتحويل بنكي'}
            </button>
            <button onClick={() => setPicked(null)} disabled={busy}
              style={{ background: '#F2F5F8', color: '#0F2744', border: '1px solid #E3E8EE', padding: '11px 18px', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* ── نافذة الدفع بالتحويل البنكي ── */}
      {showBankModal && (
        <div
          onClick={() => !uploading && setShowBankModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,39,68,.55)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 18, padding: 24, maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <b style={{ color: '#0F2744', fontSize: 16 }}>الدفع بالتحويل البنكي</b>
            <p style={{ color: '#667', fontSize: 13, margin: '6px 0 16px', lineHeight: 1.8 }}>
              حوّل مبلغ الاشتراك لباقة «{plans.find((p) => p.code === picked)?.name}» بإحدى الطريقتين أدناه، ثم أرفق صورة أو ملف الإيصال لإتمام الطلب.
            </p>

            {/* الطريقة ١ — بيانات الحساب البنكي */}
            <div style={{ background: '#F7FAFC', border: '1px solid #EEF1F5', borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F2744', marginBottom: 8 }}>١ — التحويل إلى الحساب البنكي</div>
              <BankRow label="اسم الحساب" value={BANK_ACCOUNT.name} copied={copied} onCopy={copyText} />
              <BankRow label="رقم الحساب" value={BANK_ACCOUNT.number} copied={copied} onCopy={copyText} />
              <BankRow label="IBAN" value={BANK_ACCOUNT.iban} copied={copied} onCopy={copyText} />
              <BankRow label="SWIFT" value={BANK_ACCOUNT.swift} copied={copied} onCopy={copyText} last />
            </div>

            {/* الطريقة ٢ — التحويل برقم الهاتف */}
            <div style={{ background: '#F7FAFC', border: '1px solid #EEF1F5', borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F2744', marginBottom: 8 }}>٢ — أو التحويل عبر رقم الهاتف</div>
              <BankRow label="رقم الهاتف" value={BANK_ACCOUNT.phoneTransfer} copied={copied} onCopy={copyText} last />
            </div>

            {/* رفع الإيصال */}
            <label style={{ fontSize: 13, fontWeight: 700, color: '#0F2744', display: 'block', marginBottom: 8 }}>إرفاق إيصال التحويل</label>
            <label
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                border: `1.5px dashed ${receiptFile ? '#1A7A45' : '#DDE3EC'}`, borderRadius: 12,
                padding: '18px 14px', cursor: 'pointer', background: receiptFile ? '#EAF7F0' : '#fff',
                marginBottom: 14, fontSize: 13.5, color: receiptFile ? '#15803D' : '#667', fontWeight: 600,
              }}>
              <Upload size={17} strokeWidth={2} />
              {receiptFile ? receiptFile.name : 'اختر صورة أو PDF للإيصال'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                style={{ display: 'none' }}
              />
            </label>

            {msg && !msg.ok && (
              <div style={{ background: '#FDECEA', border: '1px solid #F3C9C2', color: '#A5331F', borderRadius: 10, padding: '10px 13px', fontSize: 13, marginBottom: 14 }}>
                {msg.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={confirmBankTransfer}
                disabled={!receiptFile || uploading}
                style={{
                  flex: 1, background: !receiptFile || uploading ? '#8AA' : '#163B68', color: '#fff', border: 0,
                  padding: '12px', borderRadius: 10, fontWeight: 700, fontSize: 14.5,
                  cursor: !receiptFile || uploading ? 'default' : 'pointer', fontFamily: 'inherit',
                }}>
                {uploading ? 'جارٍ الإرسال…' : 'تأكيد وإرسال الطلب'}
              </button>
              <button
                onClick={() => { setShowBankModal(false); setReceiptFile(null) }}
                disabled={uploading}
                style={{ background: '#F2F5F8', color: '#0F2744', border: '1px solid #E3E8EE', padding: '12px 18px', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div style={{
          borderRadius: 11, padding: '12px 15px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.8,
          background: msg.ok ? '#EAF7F0' : '#FDECEA',
          border: `1px solid ${msg.ok ? '#BFE5D0' : '#F3C9C2'}`,
          color: msg.ok ? '#15803D' : '#A5331F',
        }}>{msg.text}</div>
      )}
    </div>
  )
}

function Row({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <Icon size={14} strokeWidth={2} color="#8A94A6" style={{ flexShrink: 0 }} />
      <span>{text}</span>
    </div>
  )
}

function BankRow({ label, value, copied, onCopy, last }: {
  label: string; value: string; copied: string | null; onCopy: (label: string, text: string) => void; last?: boolean
}) {
  const isCopied = copied === label
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      paddingBottom: last ? 0 : 8, marginBottom: last ? 0 : 8,
      borderBottom: last ? 'none' : '1px dashed #E3E8EE',
    }}>
      <div>
        <div style={{ fontSize: 11, color: '#8A94A6' }}>{label}</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F2744', direction: 'ltr', textAlign: 'right' }}>{value}</div>
      </div>
      <button
        onClick={() => onCopy(label, value)}
        title="نسخ"
        style={{
          background: isCopied ? '#EAF7F0' : '#fff', border: `1px solid ${isCopied ? '#BFE5D0' : '#E3E8EE'}`,
          borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: isCopied ? '#15803D' : '#667',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
        {isCopied ? <CheckIcon size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={2} />}
      </button>
    </div>
  )
}
