'use client'
// صفحة عودة ولي الأمر بعد الدفع عبر ثواني — تعرض رسالة فقط.
// الحقيقة المالية مصدرها الـwebhook (record_payment)، لا هذه الصفحة —
// هذه الصفحة قد تظهر "نجاح" بينما الـwebhook لم يصل بعد (تأخير شبكة)، وهذا متوقّع وآمن.
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'

export default function PaymentResultPage() {
  const params = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const status = params.get('status')
  const feeId = params.get('fee')
  const [confirmed, setConfirmed] = useState(false)
  const [checking, setChecking] = useState(status === 'success')

  // نستطلع قاعدتنا لبضع ثوانٍ للتأكّد أن الـwebhook وصل وسجّل الدفعة فعلياً
  useEffect(() => {
    if (status !== 'success' || !feeId) { setChecking(false); return }
    let tries = 0
    const iv = setInterval(async () => {
      tries += 1
      const { data } = await supabase
        .from('payments').select('id').eq('fee_id', feeId).eq('method', 'thawani')
        .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()).limit(1)
      if (data && data.length > 0) { setConfirmed(true); setChecking(false); clearInterval(iv) }
      if (tries >= 8) { setChecking(false); clearInterval(iv) }
    }, 2000)
    return () => clearInterval(iv)
  }, [status, feeId, supabase])

  const isSuccess = status === 'success'

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#F4F6FA', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: '40px 32px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 20px 50px -20px rgba(15,39,68,.2)' }}>
        {isSuccess ? (
          checking ? (
            <>
              <Clock size={52} color="#B8860B" style={{ marginBottom: 16 }} />
              <h1 style={{ color: '#0F2744', fontSize: 20, marginBottom: 8 }}>جارٍ تأكيد الدفعة…</h1>
              <p style={{ color: '#667', fontSize: 14, lineHeight: 1.8 }}>لحظات ونؤكّد استلام دفعتك.</p>
            </>
          ) : (
            <>
              <CheckCircle2 size={52} color="#1A7A45" style={{ marginBottom: 16 }} />
              <h1 style={{ color: '#0F2744', fontSize: 20, marginBottom: 8 }}>
                {confirmed ? 'تم الدفع بنجاح' : 'استلمنا طلب الدفع'}
              </h1>
              <p style={{ color: '#667', fontSize: 14, lineHeight: 1.8 }}>
                {confirmed
                  ? 'حُدِّث رصيد الفاتورة فوراً. شكراً لك.'
                  : 'تأكيد ثواني وصل بنجاح — قد يستغرق تحديث الرصيد بضع لحظات إضافية.'}
              </p>
            </>
          )
        ) : (
          <>
            <XCircle size={52} color="#C0392B" style={{ marginBottom: 16 }} />
            <h1 style={{ color: '#0F2744', fontSize: 20, marginBottom: 8 }}>لم تكتمل عملية الدفع</h1>
            <p style={{ color: '#667', fontSize: 14, lineHeight: 1.8 }}>لم يُخصم أي مبلغ. يمكنك المحاولة مجدداً.</p>
          </>
        )}

        <button onClick={() => router.push('/parent')}
          style={{ marginTop: 24, background: '#163B68', color: '#fff', border: 0, padding: '11px 28px', borderRadius: 11, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
          العودة لبوابتي
        </button>
      </div>
    </div>
  )
}

