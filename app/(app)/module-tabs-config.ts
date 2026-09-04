// تعريف مجموعتَي التبويب المعتمدتَين — تُستخدم نفس شروط الصلاحية المستخدمة في
// الشريط الجانبي (AppShell.tsx) بالضبط، دون تكرار منطق تفويض جديد.
import { isStaff, canAccessFinance, type Role } from '@/lib/roles'
import type { TabItem } from './ModuleTabs'

// المجموعة 1: الموظفون والرواتب
export function employeesPayrollTabs(role: Role): TabItem[] {
  const items: TabItem[] = []
  if (isStaff(role)) items.push({ label: 'الموظفون', href: '/employees' })
  if (canAccessFinance(role)) items.push({ label: 'دورات الرواتب', href: '/payroll' })
  return items
}

// المجموعة 2: الخدمات المدرسية
export function schoolServicesTabs(role: Role): TabItem[] {
  if (!isStaff(role)) return []
  return [
    { label: 'التغذية المدرسية', href: '/cafeteria' },
    { label: 'النقل المدرسي', href: '/transport' },
    { label: 'المخزون', href: '/inventory' },
  ]
}
