// مكتبة الأدوار والصلاحيات المشتركة
// مصدر واحد لتعريف الأدوار بدل تكرار التحقق في كل صفحة (مبدأ DRY)
// الأدوار مطابقة لـ user_role enum في قاعدة البيانات (01_schema + 04_platform_admin)

export type Role =
  | 'platform_admin' // مدير المنصة (فوق كل المدارس)
  | 'owner'          // مدير المدرسة
  | 'admin'          // إداري
  | 'accountant'     // محاسب
  // | 'teacher'      // معلّم — غير مُفعّل بعد (أضِفه لـ user_role enum أولاً عند الحاجة)
  | 'parent'         // ولي الأمر
  | 'student'        // الطالب

// أسماء الأدوار بالعربية (للعرض في الواجهة)
export const ROLE_LABEL: Record<Role, string> = {
  platform_admin: 'مدير المنصة',
  owner: 'مدير المدرسة',
  admin: 'إداري',
  accountant: 'محاسب',
  parent: 'ولي الأمر',
  student: 'الطالب',
}

// مجموعات صلاحيات شائعة (لتفادي تكرار القوائم في الصفحات)
export const STAFF: Role[] = ['owner', 'admin', 'accountant'] // طاقم المدرسة الإداري
export const FINANCE: Role[] = ['owner', 'accountant']        // من يصل للمحاسبة
export const OWNER_ONLY: Role[] = ['owner']                   // قرارات المدير وحده

// هل يملك هذا الدور صلاحية الوصول؟
export function hasAccess(role: Role | null | undefined, allowed: Role[]): boolean {
  return role != null && allowed.includes(role)
}

// اختصارات قابلة للقراءة تُستخدم في الصفحات
export const isOwner = (role?: Role | null) => role === 'owner'
export const isPlatformAdmin = (role?: Role | null) => role === 'platform_admin'
export const isStaff = (role?: Role | null) => hasAccess(role, STAFF)
export const canAccessFinance = (role?: Role | null) => hasAccess(role, FINANCE)
