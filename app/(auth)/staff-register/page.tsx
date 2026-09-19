'use client'
// تسجيل الموظف (إداري/محاسب) — لا نموذج خاص هنا: الموظف المدعو (عبر
// StaffInvites) يُنشئ حسابه من صفحة تسجيل الدخول العادية بنفس بريد الدعوة،
// والنظام يربطه تلقائياً بدوره عند أول دخول. هذه الصفحة كانت تعرض بالخطأ
// نموذج تسجيل ولي الأمر (ParentRegisterPage) — استُبدلت بتحويل فوري.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function StaffRegisterRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/login')
  }, [router])

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', fontFamily: 'Cairo, sans-serif' }} dir="rtl">
      <p style={{ color: '#64748B', fontSize: 14 }}>جارٍ التحويل لتسجيل الدخول…</p>
    </div>
  )
}
