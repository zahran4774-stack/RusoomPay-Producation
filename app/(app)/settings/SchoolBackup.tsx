'use client'
// نسخة احتياطية لبيانات المدرسة — تحميل كل البيانات كملف JSON.
// للمالك فقط. قراءة فقط — لا يعدّل شيئاً.
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Download, ShieldCheck } from 'lucide-react'

export default function SchoolBackup({ schoolName }: { schoolName?: string }) {
  const supabase = createClient()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function download() {
    setBusy(true); setMsg(null)
    try {
      const { data, error } = await supabase.rpc('export_school_backup')
      if (error) throw error

      const res = (data ?? {}) as { ok?: boolean; reason?: string; detail?: string }
      if (!res.ok) {
        setMsg({ ok: false, text: res.reason === 'unauthorized' ? 'هذه الميزة للمالك فقط.' : `تعذّر التصدير: ${res.detail ?? res.reason ?? ''}` })
        setBusy(false)
        return
      }

      // حوّل لملف JSON ونزّله
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const date = new Date().toISOString().slice(0, 10)
      const safeName = (schoolName ?? 'مدرسة').replace(/[^\p{L}\p{N}_-]+/gu, '_')
      const a = document.createElement('a')
      a.href = url
      a.download = `RusoomPay_backup_${safeName}_${date}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // إحصاء سريع للطمأنة
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any
      const counts = `${d.students?.length ?? 0} طالب · ${d.student_fees?.length ?? 0} فاتورة · ${d.journal_entries?.length ?? 0} قيد`
      setMsg({ ok: true, text: `تم تنزيل النسخة بنجاح (${counts}). احفظها في مكان آمن.` })
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMsg({ ok: false, text: `حدث خطأ: ${(e as any)?.message ?? 'غير معروف'}` })
    }
    setBusy(false)
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 16, padding: 22 }} dir="rtl">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <ShieldCheck size={20} color="#15803D" strokeWidth={2} />
        <b style={{ color: '#0F2744', fontSize: 16 }}>النسخة الاحتياطية</b>
      </div>
      <p style={{ color: '#667', fontSize: 13.5, margin: '0 0 16px', lineHeight: 1.85 }}>
        نزّل نسخة كاملة من بيانات مدرستك (الطلاب، الرسوم، أولياء الأمور، الموظفون، القيود المحاسبية)
        كملف واحد تحتفظ به لديك. ننصح بأخذ نسخة دورياً — بداية كل شهر مثلاً.
      </p>

      <button onClick={download} disabled={busy}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: busy ? '#8AA' : '#163B68', color: '#fff', border: 0,
          padding: '11px 22px', borderRadius: 11, fontWeight: 700, fontSize: 14.5,
          cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
        }}>
        <Download size={17} strokeWidth={2} />
        {busy ? 'جارٍ التحضير…' : 'تحميل نسخة احتياطية'}
      </button>

      {msg && (
        <div style={{
          marginTop: 14, borderRadius: 10, padding: '11px 14px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.7,
          background: msg.ok ? '#EAF7F0' : '#FDECEA',
          border: `1px solid ${msg.ok ? '#BFE5D0' : '#F3C9C2'}`,
          color: msg.ok ? '#15803D' : '#A5331F',
        }}>{msg.text}</div>
      )}

      <div style={{ fontSize: 12, color: '#8A94A6', marginTop: 14, lineHeight: 1.8 }}>
        🔒 نظامنا يحتفظ أيضاً بنسخ احتياطية يومية تلقائية على الخادم. هذه النسخة الإضافية تمنحك سيطرة كاملة على بياناتك.
      </div>
    </div>
  )
}
