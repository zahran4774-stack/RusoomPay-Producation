// نسخة قديمة مكررة من نموذج تسجيل الموظف — كانت تستدعي accept_staff_invite قبل تأكيد البريد
// (بلا جلسة → تفشل دائماً) ولا ترسل emailRedirectTo. المسار الوحيد المعتمد الآن: /staff-register
import { redirect } from 'next/navigation'

export default function LegacyStaffRegisterRedirect() {
  redirect('/staff-register')
}
