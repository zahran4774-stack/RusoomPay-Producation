// ═══════════════════════════════════════════════════════════════
// الصفوف والشُعب ورموز دول الخليج — مصدر واحد للحقيقة.
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

export const SECTIONS = [
  'أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي',
] as const

export type Grade = (typeof GRADES)[number]
export type Section = (typeof SECTIONS)[number]

export function isValidGrade(v: string): v is Grade {
  return (GRADES as readonly string[]).includes(v)
}
export function isValidSection(v: string): v is Section {
  return (SECTIONS as readonly string[]).includes(v)
}
export function gradeOrder(v: string): number {
  const i = (GRADES as readonly string[]).indexOf(v)
  return i === -1 ? 999 : i
}

// ═══════════════════════════════════════════════════════════════
// رموز دول الخليج — الواجهة تعرضها كلها، عُمان الافتراضي.
// التحقّق الفعلي في القاعدة حالياً لعُمان فقط؛ نضيف بقية الدول لاحقاً.
// ═══════════════════════════════════════════════════════════════

export type CountryCode = {
  code: string
  name: string
  flag: string
  localLen: number
  starts: string[]
}

export const GULF_COUNTRIES: CountryCode[] = [
  { code: '968', name: 'عُمان',    flag: '🇴🇲', localLen: 8, starts: ['7', '9'] },
  { code: '966', name: 'السعودية', flag: '🇸🇦', localLen: 9, starts: ['5'] },
  { code: '971', name: 'الإمارات', flag: '🇦🇪', localLen: 9, starts: ['5'] },
  { code: '974', name: 'قطر',      flag: '🇶🇦', localLen: 8, starts: ['3', '5', '6', '7'] },
  { code: '965', name: 'الكويت',   flag: '🇰🇼', localLen: 8, starts: ['5', '6', '9'] },
  { code: '973', name: 'البحرين',  flag: '🇧🇭', localLen: 8, starts: ['3', '6'] },
]

export const DEFAULT_COUNTRY = '968'

export function cleanLocalNumber(raw: string): string {
  const arabicToLatin: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  }
  let v = (raw || '').trim()
  v = v.replace(/[٠-٩]/g, (d) => arabicToLatin[d] ?? d)
  v = v.replace(/[^0-9]/g, '')
  return v
}

export function isValidLocalNumber(local: string, countryCode: string): boolean {
  const country = GULF_COUNTRIES.find((c) => c.code === countryCode)
  if (!country) return false
  if (local.length !== country.localLen) return false
  return country.starts.includes(local[0])
}
