'use client'
// الشريط الأحمر — يظهر في كل الصفحات أثناء دخول الدعم الفني لمدرسة
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function ImpersonationBar({ schoolName }: { schoolName: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function stop() {
    setBusy(true)
    const supabase = createClient()
    await supabase.rpc('stop_impersonation')
    router.push('/platform')
    router.refresh()
  }

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 9999,
      background: 'linear-gradient(90deg,#B42318,#C0392B)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
      padding: '10px 16px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
      boxShadow: '0 2px 10px rgba(180,35,24,.4)', flexWrap: 'wrap',
    }} dir="rtl">
      <span>🔧 أنت داخل حساب «{schoolName}» كدعم فني — كل عملية تُسجَّل في سجل التدقيق</span>
      <button onClick={stop} disabled={busy}
        style={{ background: '#fff', color: '#B42318', border: 0, borderRadius: 8,
                 padding: '6px 16px', fontWeight: 800, fontSize: 13, cursor: busy ? 'default' : 'pointer',
                 fontFamily: 'inherit' }}>
        {busy ? 'جارٍ الخروج…' : 'إنهاء الدخول والعودة للمنصة'}
      </button>
    </div>
  )
}
