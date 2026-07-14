// ═══════════════════════════════════════════════════════════════
// الصفوف والشُعب — مصدر واحد للحقيقة.
// أي نموذج يكتب grade/section (إضافة، تعديل، استيراد) يجب أن
// يستورد من هنا. الإدخال النصّي الحرّ هو ما سبّب تكرار الشُعب
// ("الصف الخامس" / "صف خامس" / "5" كلها صفوف مختلفة في القاعدة).
// ═══════════════════════════════════════════════════════════════

export const GRADES = [
  'روضة',
  'تمهيدي',
  'تجهيزي',
  'الأول',
  'الثاني',
  'الثالث',
  'الرابع',
  'الخامس',
  'السادس',
  'السابع',
  'الثامن',
  'التاسع',
  'العاشر',
  'الحادي عشر',
  'الثاني عشر',
] as const

// الترتيب الأبجدي (أبجد هوّز) — المستخدم في المدارس، لا الترتيب الهجائي
export const SECTIONS = [
  'أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي',
] as const

export type Grade = (typeof GRADES)[number]
export type Section = (typeof SECTIONS)[number]

// للاستيراد من ملف: تحقّق أن القيمة ضمن القائمة المسموحة
export function isValidGrade(v: string): v is Grade {
  return (GRADES as readonly string[]).includes(v)
}

export function isValidSection(v: string): v is Section {
  return (SECTIONS as readonly string[]).includes(v)
}

// ترتيب الصفوف للفرز (روضة أولاً، الثاني عشر أخيراً)
export function gradeOrder(v: string): number {
  const i = (GRADES as readonly string[]).indexOf(v)
  return i === -1 ? 999 : i
}
