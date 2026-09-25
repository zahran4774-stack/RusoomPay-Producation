import { describe, it, expect } from 'vitest'
import { translateText } from '@/lib/i18n'

describe('i18n — translateText (safe mode)', () => {
  it('Arabic mode never changes text', () => {
    expect(translateText('تسجيل الخروج', 'ar')).toBe('تسجيل الخروج')
  })
  it('translates known UI phrases', () => {
    expect(translateText('تسجيل الخروج', 'en')).toBe('Log out')
    expect(translateText('  حفظ  ', 'en')).toBe('  Save  ')
  })
  it('never replaces letters inside another word', () => {
    expect(translateText('بالتاريخ المحدد', 'en')).toBe('بالتاريخ المحدد')
  })
  it('all-or-nothing: names / school names stay intact', () => {
    expect(translateText('مدرسة النور الخاصة', 'en')).toBe('مدرسة النور الخاصة')
    expect(translateText('أحمد سالم', 'en')).toBe('أحمد سالم')
  })
  it('never outputs mixed Arabic/English', () => {
    const out = translateText('انتهى الاشتراك — يرجى التجديد', 'en')
    const mixed = /[\u0620-\u065F]/.test(out) && /[A-Za-z]/.test(out)
    expect(mixed).toBe(false)
  })
  it('keeps numeric values identical (digits normalised only)', () => {
    expect(translateText('١٬٢٣٤٫٥٠٠', 'en')).toBe('1,234.500')
    expect(translateText('125.500 OMR', 'en')).toBe('125.500 OMR')
  })
})

describe('i18n — context-sensitive guards', () => {
  it('no word-order errors from joining dictionary units', () => {
    expect(translateText('رسوم النقل المدرسي', 'en')).toBe('رسوم النقل المدرسي')
    expect(translateText('اسم الموظف مطلوب', 'en')).toBe('اسم الموظف مطلوب')
  })
  it('particles only translate when standalone', () => {
    expect(translateText('من', 'en')).toBe('From')
    expect(translateText('من 100', 'en')).toBe('من 100')
    expect(translateText(' من ', 'en')).toBe(' From ')
  })
  it('single-word labels are capitalised', () => {
    expect(translateText('المخزون', 'en')).toBe('Inventory')
  })
})
