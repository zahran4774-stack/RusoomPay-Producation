'use client'
// زر إرسال تذكير عبر واتساب (يستبدل زر الاتصال tel:)
import { useState } from 'react'

export default function WhatsAppReminderButton({
  phone,
  guardianName,
  studentName,
}: {
  phone: string | null
  guardianName?: string
  studentName?: string
}) {
  const [sending, setSending] = useState(false)

  async function send() {
    if (!phone) {
      alert('لا يوجد رقم لولي الأمر')
      return
    }
    // تنسيق الرقم: نضيف + إن ما كان موجود
    const to = phone.startsWith('+') ? phone : `+${phone}`
    const body = `عزيزنا ${guardianName || 'ولي الأمر'}، نذكّركم بمتابعة رسوم الطالب ${studentName || ''} المستحقة. نشكر لكم تعاونكم — RusoomPay`

    setSending(true)
    try {
      const res = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, body }),
      })
      const data = await res.json()
      alert(data.success ? 'تم إرسال التذكير عبر واتساب ✅' : 'فشل الإرسال: ' + (data.error || 'خطأ'))
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

