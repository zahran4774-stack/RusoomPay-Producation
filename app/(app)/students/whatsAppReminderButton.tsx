'use client'
// زر إرسال تذكير عبر واتساب (يستبدل زر الاتصال tel:)
// تحديث: يستخدم قالب معتمد من Twilio (fee_reminder إذا توفرت التفاصيل، وإلا general_reminder)
// بدل النص الحر — النص الحر يفشل خارج نافذة 24 ساعة من رسالة المستلم.
import { useState } from 'react'

export default function WhatsAppReminderButton({
  phone,
  guardianName,
  studentName,
  schoolName,
  amountDue,
}: {
  phone: string | null
  guardianName?: string
  studentName?: string
  schoolName?: string
  amountDue?: string | number
}) {
  const [sending, setSending] = useState(false)

  async function send() {
    if (!phone) {
      alert('لا يوجد رقم لولي الأمر')
      return
    }
    // تنسيق الرقم: نضيف + إن ما كان موجود
    const to = phone.startsWith('+') ? phone : `+${phone}`

    // إذا توفر اسم المدرسة والمبلغ واسم الطالب، نستخدم قالب التذكير التفصيلي (fee_reminder)
    // وإلا نرجع للقالب العام (general_reminder) اللي يحتاج اسم المدرسة فقط
    const useDetailedTemplate = Boolean(schoolName && studentName && amountDue)

    const requestBody = useDetailedTemplate
      ? {
          to,
          template: 'fee_reminder',
          variables: {
            '1': schoolName,
            '2': guardianName || 'ولي الأمر',
            '3': studentName,
            '4': String(amountDue),
          },
        }
      : {
          to,
          template: 'general_reminder',
          variables: {
            '1': schoolName || 'المدرسة',
          },
        }

    setSending(true)
    try {
      const res = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      const data = await res.json()
      alert(
        data.success
          ? `تم قبول الطلب من Twilio ✅\nSID: ${data.sid}\nالحالة الأولية: ${data.status}\n\nتحقق من التسليم الفعلي بـ Twilio → Monitor → Logs → Messages`
          : 'فشل الإرسال: ' + (data.error || 'خطأ')
      )
    } catch (e: any) {
      alert('خطأ في الإرسال: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <button
      onClick={send}
      disabled={sending}
      style={{
        background: 'none',
        border: 'none',
        color: '#0F9D74',
        fontWeight: 700,
        fontSize: 13,
        cursor: sending ? 'default' : 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        opacity: sending ? 0.6 : 1,
      }}
    >
      💬 {sending ? 'جارٍ الإرسال...' : 'إرسال تذكير ودي'}
    </button>
  )
}
