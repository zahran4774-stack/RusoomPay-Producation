// أنواع الموظفين وأسباب إنهاء الخدمة — مصدر واحد للقيم والتسميات
// القيم تطابق قيود قاعدة البيانات (employees_employee_type_check / employees_termination_reason_check)

export const EMPLOYEE_TYPES = [
  { value: 'official', label: 'موظف رسمي' },
  { value: 'contract', label: 'موظف متعاقد معه' },
  { value: 'driver', label: 'سائق' },
  { value: 'worker', label: 'عامل' },
] as const

export const TERMINATION_REASONS = [
  { value: 'resigned', label: 'مستقيل' },
  { value: 'other', label: 'أخرى' },
] as const

export function employeeTypeLabel(v?: string | null): string {
  return EMPLOYEE_TYPES.find((t) => t.value === (v ?? 'official'))?.label ?? '—'
}

export function terminationReasonLabel(v?: string | null): string {
  if (!v) return 'بدون سبب'
  return TERMINATION_REASONS.find((r) => r.value === v)?.label ?? '—'
}
