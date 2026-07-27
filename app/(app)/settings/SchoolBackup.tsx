'use client'
// نسخة احتياطية لبيانات المدرسة — تحميل كل البيانات كملف JSON.
// للمالك فقط. قراءة فقط — لا يعدّل شيئاً.
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Download, ShieldCheck, Clock } from 'lucide-react'

export default function SchoolBackup({ schoolName }: { schoolName?: string }) {
  const supabase = createClient()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [reminder, setReminder] = useState<{ text: string; days: number | null } | null>(null)
  const [lastBackup, setLastBackup] = useState<string | null>(null)

  // جلب حالة النسخة الاحتياطية (هل نُذكّر؟)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await supabase.rpc('backup_status')
      if (!alive) return
      const st = (data ?? {}) as { ok?: boolean; should_remind?: boolean; message?: string; days_since?: number | null; last_backup?: string; ever?: boolean }
      if (st.ok && st.should_remind && st.message) {
        setReminder({ text: st.message, days: st.days_since ?? null })
      }
      if (st.ok && st.ever && st.last_backup) setLastBackup(st.last_backup)
    })()
    return () => { alive = false }
  }, [supabase])

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

      // سجّل النسخة — يُصفّر التنبيه ويحدّث آخر تاريخ
      try {
        await supabase.rpc('record_backup')
        setReminder(null)
        setLastBackup(new Date().toISOString())
      } catch { /* التسجيل ثانوي — لا يوقف النجاح */ }
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

      {/* تنبيه: مضى وقت على آخر نسخة */}
      {reminder && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: '#FBF3D5', border: '1px solid #EAD9A0', borderRadius: 11,
          padding: '12px 14px', marginBottom: 16,
        }}>
          <Clock size={18} color="#7A5C0A" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, lineHeight: 1.75, color: '#7A5C0A', fontWeight: 600 }}>{reminder.text}</div>
        </div>
      )}

      {/* تاريخ آخر نسخة (إن وُجد ولا تنبيه) */}
      {lastBackup && !reminder && (
        <div style={{ fontSize: 12.5, color: '#15803D', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={14} strokeWidth={2} />
          آخر نسخة: {new Date(lastBackup).toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      )}

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
