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
// ═══════════════════════════════════════════════════════════════
// أنماط ترميز الشُّعب — المدرسة تختار نمطاً أو أكثر من الإعدادات.
// ═══════════════════════════════════════════════════════════════

export type SectionStyle = 'ar_letters' | 'numbers' | 'en_letters' | 'en_numbers'

export const SECTION_STYLE_META: Record<
  SectionStyle,
  { label: string; sample: string }
> = {
  ar_letters: { label: 'حروف عربية (أ، ب، ج)', sample: 'أ ب ج' },
  numbers:    { label: 'أرقام عربية (١، ٢، ٣)', sample: '١ ٢ ٣' },
  en_letters: { label: 'حروف لاتينية (A, B, C)', sample: 'A B C' },
  en_numbers: { label: 'أرقام لاتينية (1, 2, 3)', sample: '1 2 3' },
}

const AR_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي']
const AR_NUMBERS = ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '١٠']
const EN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
const EN_NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']

const STYLE_VALUES: Record<SectionStyle, string[]> = {
  ar_letters: AR_LETTERS,
  numbers: AR_NUMBERS,
  en_letters: EN_LETTERS,
  en_numbers: EN_NUMBERS,
}

// يبني قائمة خيارات الشُّعب من الأنماط المختارة، بلا تكرار.
export function buildSectionOptions(styles: string[] | null | undefined): string[] {
  const active = (styles && styles.length ? styles : ['ar_letters']) as SectionStyle[]
  const out: string[] = []
  for (const style of active) {
    const vals = STYLE_VALUES[style]
    if (!vals) continue
    for (const v of vals) if (!out.includes(v)) out.push(v)
  }
  return out
}

export const DEFAULT_SECTION_STYLES: SectionStyle[] = ['ar_letters']

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
