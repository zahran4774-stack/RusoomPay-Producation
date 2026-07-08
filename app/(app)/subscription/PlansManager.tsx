'use client'
// مدير باقات الاشتراك — الحالة الحالية + اختيار الباقة + طرق الدفع
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

type Sub = {
  id: string; plan: string; status: string
  trial_ends_at: string | null; renews_at: string | null; pay_method: string | null
} | null

const PLANS = {
  monthly: { name: 'الباقة الشهرية', amount: 7, cycle: 'شهرياً', note: 'إجمالي 84 ر.ع سنوياً · تُدفع شهرياً' },
  yearly: { name: 'الباقة السنوية', amount: 72, cycle: 'سنوياً (دفعة واحدة)', note: 'توفّر 12 ر.ع · الأوفر' },
  lifetime: { name: 'اشتراك دائم', amount: 350, cycle: 'مرة واحدة', note: 'بلا تجديد · مدى الحياة' },
}

const BANK_ACCOUNT = '95476649'

export default function PlansManager({ sub, schoolId }: { sub: Sub; schoolId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [plan, setPlan] = useState<keyof typeof PLANS | null>(null)
  const [method, setMethod] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const planNames: Record<string, string> = { trial: 'تجريبي مجاني', monthly: 'الباقة الشهرية', yearly: 'الباقة السنوية', lifetime: 'اشتراك دائم' }
  const statusInfo: Record<string, { t: string; c: string; bg: string }> = {
    trial: { t: 'تجريبي', c: '#B8860B', bg: '#FBF3D5' },
    active: { t: 'فعّال', c: '#1A7A45', bg: '#E6F4EC' },
    pending: { t: 'بانتظار اعتماد التحويل', c: '#B8860B', bg: '#FBF3D5' },
    expired: { t: 'منتهٍ', c: '#C0392B', bg: '#FCE9E6' },
  }
  const si = statusInfo[sub?.status ?? 'trial'] ?? statusInfo.trial

  let trialDays = 0
  if (sub?.status === 'trial' && sub.trial_ends_at) {
    trialDays = Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000))
  }

  async function activate(payMethod: string) {
    if (!plan) return
    setBusy(true)
    const p = PLANS[plan]
    const renewsAt = plan === 'lifetime' ? null
      : new Date(Date.now() + (plan === 'monthly' ? 30 : 365) * 86400000).toISOString()

    await supabase.from('subscriptions').insert({
      school_id: schoolId, plan, status: 'active', pay_method: payMethod, renews_at: renewsAt,
    })
    setBusy(false)
    setMsg(`✓ تم تفعيل ${p.name} بنجاح`)
    router.refresh()
  }

  async function submitBankTransfer() {
    if (!plan) return
    setBusy(true)
    const renewsAt = plan === 'lifetime' ? null
      : new Date(Date.now() + (plan === 'monthly' ? 30 : 365) * 86400000).toISOString()

    // في الإنتاج: يُرفع الإيصال إلى Supabase Storage ويُحفظ رابطه في receipt_url
    await supabase.from('subscriptions').insert({
      school_id: schoolId, plan, status: 'pending', pay_method: 'bank', renews_at: renewsAt,
    })
    setBusy(false)
    setMsg('✓ تم استلام طلب التحويل — سيُفعّل الاشتراك بعد اعتماد الإدارة')
    router.refresh()
  }

  return (
    <div>
      {/* الحالة الحالية */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 22, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
        <span style={{ background: si.bg, color: si.c, padding: '5px 14px', borderRadius: 99, fontSize: 13, fontWeight: 700 }}>{si.t}</span>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#0F2744', fontFamily: 'Cairo', margin: '10px 0' }}>
          {planNames[sub?.plan ?? 'trial']}
        </div>
        {sub?.status === 'trial' && (
          <div style={{ background: '#FBF3D5', color: '#8A6D0F', borderRadius: 10, padding: 11, fontSize: 14 }}>
            🎁 فترة تجريبية — متبقٍ <b>{trialDays}</b> يوم. بعدها يلزم اختيار باقة.
          </div>
        )}
        {sub?.status === 'active' && sub.renews_at && (
          <div style={{ fontSize: 14, color: '#445' }}>يتجدّد في: <b>{sub.renews_at.slice(0, 10)}</b></div>
        )}
        {sub?.status === 'active' && !sub.renews_at && <div style={{ fontSize: 14, color: '#445' }}>اشتراك دائم — بلا تجديد</div>}
        {sub?.status === 'pending' && (
          <div style={{ background: '#FBF3D5', color: '#8A6D0F', borderRadius: 10, padding: 11, fontSize: 14 }}>
            ⏳ تم استلام إيصال التحويل البنكي — الاشتراك قيد الاعتماد.
          </div>
        )}
      </div>

      {msg && <div style={{ background: '#E6F4EC', color: '#1A7A45', padding: 12, borderRadius: 10, marginBottom: 16 }}>{msg}</div>}

      {/* بطاقات الباقات */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 13, marginBottom: 20 }}>
        {(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((k) => {
          const p = PLANS[k]
          const selected = plan === k
          return (
            <button key={k} onClick={() => { setPlan(k); setMethod(null) }}
              style={{
                textAlign: 'right', border: selected ? '2px solid #D4A017' : '2px solid #E5EAF2',
                background: selected ? '#FFFDF5' : '#fff', borderRadius: 14, padding: 18, cursor: 'pointer',
              }}>
              {k === 'yearly' && <div style={{ background: '#163B68', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99, display: 'inline-block', marginBottom: 6 }}>الأوفر</div>}
              <div style={{ fontWeight: 700, color: '#0F2744' }}>{p.name}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#0F2744', fontFamily: 'Cairo', margin: '6px 0' }}>
                {p.amount} <span style={{ fontSize: 14, color: '#667' }}>ر.ع</span>
              </div>
              <div style={{ fontSize: 12, color: '#667' }}>{p.cycle}</div>
              <div style={{ fontSize: 12, color: '#889', marginTop: 6 }}>{p.note}</div>
            </button>
          )
        })}
      </div>

      {/* طرق الدفع */}
      {plan && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
          <div style={{ fontWeight: 600, color: '#0F2744', marginBottom: 12 }}>
            اختر طريقة الدفع — {PLANS[plan].name} ({PLANS[plan].amount} ر.ع)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 14 }}>
            {[
              ['card', '💳 بطاقة بنكية', false],
              ['epay', '🟢 ePay', false],
              ['gpay', '📱 Google Pay', false],
              ['bank', '🏦 تحويل بنكي', true],
            ].map(([m, label, enabled]) => (
              <button key={m as string} onClick={() => (enabled ? setMethod(m as string) : null)}
                disabled={!enabled}
                title={enabled ? '' : 'الدفع الإلكتروني سيُفعّل قريباً'}
                style={{
                  position: 'relative',
                  background: method === m ? '#163B68' : enabled ? '#fff' : '#F4F6FA',
                  color: method === m ? '#fff' : enabled ? '#0F2744' : '#9AA7B8',
                  border: '1.5px solid #DDE3EC', borderRadius: 11, padding: 14,
                  cursor: enabled ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: 14,
                  opacity: enabled ? 1 : 0.65,
                }}>
                {label as string}
                {!enabled && (
                  <span style={{ display: 'block', fontSize: 10, color: '#B8860B', marginTop: 3, fontWeight: 700 }}>قريباً</span>
                )}
              </button>
            ))}
          </div>

          {method && method !== 'bank' && (
            <div style={{ background: '#F4F8F7', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, marginBottom: 10 }}>الدفع عبر بوابة آمنة بمبلغ <b>{PLANS[plan].amount} ر.ع</b></div>
              <button onClick={() => activate(method)} disabled={busy}
                style={{ width: '100%', padding: 13, background: '#163B68', color: '#fff', border: 'none', borderRadius: 11, fontWeight: 700, cursor: 'pointer' }}>
                {busy ? 'جارٍ المعالجة…' : `ادفع الآن ${PLANS[plan].amount} ر.ع`}
              </button>
              <div style={{ fontSize: 12, color: '#889', marginTop: 8 }}>🔒 في الإنتاج: تُربط ببوابة Thawani أو Stripe الحقيقية</div>
            </div>
          )}

          {method === 'bank' && (
            <div style={{ background: '#F4F8F7', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>حوّل مبلغ <b>{PLANS[plan].amount} ر.ع</b> إلى حساب RusoomPay:</div>
              <div style={{ background: '#fff', border: '1px dashed #2E5EA8', borderRadius: 9, padding: 10, textAlign: 'center', fontWeight: 700, direction: 'ltr', marginBottom: 12 }}>{BANK_ACCOUNT}</div>
              <label style={{ fontSize: 13, fontWeight: 600 }}>إرفاق إيصال التحويل</label>
              <input type="file" accept="image/*,.pdf" style={{ width: '100%', margin: '6px 0 12px' }} />
              <button onClick={submitBankTransfer} disabled={busy}
                style={{ width: '100%', padding: 13, background: '#163B68', color: '#fff', border: 'none', borderRadius: 11, fontWeight: 700, cursor: 'pointer' }}>
                {busy ? 'جارٍ الإرسال…' : 'إرسال الإيصال للاعتماد'}
              </button>
              <div style={{ fontSize: 12, color: '#889', marginTop: 8 }}>⏳ يُفعّل الاشتراك بعد اعتماد الإدارة للإيصال</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
