// tests/unit/validation.test.ts
// اختبارات وحدوية لطبقة التحقّق والتنظيف والصلاحيات
import { describe, it, expect } from 'vitest'
import { sanitizeText, sanitizePhone, validate, paymentSubmitSchema } from '@/lib/validation'
import { hasAccess, isOwner, isStaff, canAccessFinance, STAFF, FINANCE } from '@/lib/roles'

describe('sanitizeText — تنظيف المدخلات', () => {
  it('يزيل وسوم HTML (حماية XSS)', () => {
    expect(sanitizeText('<script>alert(1)</script>مرحبا')).toBe('alert(1)مرحبا')
  })
  it('يزيل محارف التحكّم', () => {
    expect(sanitizeText('نص\u0000\u001Fعادي')).toBe('نصعادي')
  })
  it('يقصّ المسافات ويحدّ الطول', () => {
    expect(sanitizeText('  abc  ', 2)).toBe('ab')
  })
})

describe('sanitizePhone', () => {
  it('يبقي الأرقام و + فقط', () => {
    expect(sanitizePhone('+968 9547-6649')).toBe('+96895476649')
  })
  it('يزيل الحروف', () => {
    expect(sanitizePhone('abc123')).toBe('123')
  })
})

describe('validate — مخطّط الدفع', () => {
  it('يقبل دفعة صحيحة', () => {
    const r = validate(paymentSubmitSchema, {
      feeId: '550e8400-e29b-41d4-a716-446655440000', amount: 100, method: 'card',
    })
    expect(r.ok).toBe(true)
  })
  it('يرفض مبلغاً سالباً', () => {
    const r = validate(paymentSubmitSchema, {
      feeId: '550e8400-e29b-41d4-a716-446655440000', amount: -5, method: 'card',
    })
    expect(r.ok).toBe(false)
  })
  it('يرفض معرّفاً غير صالح', () => {
    const r = validate(paymentSubmitSchema, { feeId: 'not-uuid', amount: 100, method: 'card' })
    expect(r.ok).toBe(false)
  })
  it('يرفض طريقة دفع غير مدعومة', () => {
    const r = validate(paymentSubmitSchema, {
      feeId: '550e8400-e29b-41d4-a716-446655440000', amount: 100, method: 'crypto',
    })
    expect(r.ok).toBe(false)
  })
})

describe('roles — الصلاحيات', () => {
  it('المدير ضمن الطاقم', () => expect(isStaff('owner')).toBe(true))
  it('ولي الأمر ليس من الطاقم', () => expect(isStaff('parent')).toBe(false))
  it('المحاسب يصل للمالية', () => expect(canAccessFinance('accountant')).toBe(true))
  it('الإداري لا يصل للمالية', () => expect(canAccessFinance('admin')).toBe(false))
  it('isOwner دقيق', () => {
    expect(isOwner('owner')).toBe(true)
    expect(isOwner('admin')).toBe(false)
  })
  it('hasAccess يرفض القيمة الفارغة', () => {
    expect(hasAccess(null, STAFF)).toBe(false)
    expect(hasAccess(undefined, FINANCE)).toBe(false)
  })
})
