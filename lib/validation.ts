// lib/validation.ts
// التحقّق من المدخلات وتنظيفها — طبقة دفاع قبل أي معالجة.
// يُستخدم في مساري API ونماذج الخادم. RLS يحمي قاعدة البيانات،
// وهذه الطبقة تمنع المدخلات المشوّهة وتحقن الثقة في الشكل والحدود.
import { z } from 'zod'

// --- منظّفات أساسية ---
// إزالة محارف التحكّم ووسوم HTML الأساسية + قصّ المسافات
export function sanitizeText(input: string, maxLen = 500): string {
  return input
    .replace(/[\u0000-\u001F\u007F]/g, '') // محارف تحكّم
    .replace(/<[^>]*>/g, '')               // وسوم HTML
    .trim()
    .slice(0, maxLen)
}

// تطبيع رقم الهاتف (أرقام و + فقط)
export function sanitizePhone(input: string): string {
  return input.replace(/[^\d+]/g, '').slice(0, 20)
}

// --- مخطّطات zod القابلة لإعادة الاستخدام ---
export const schemas = {
  uuid: z.string().uuid('معرّف غير صالح'),

  email: z.string().email('بريد إلكتروني غير صالح').max(254),

  phone: z.string().transform(sanitizePhone).pipe(
    z.string().regex(/^\+?\d{7,15}$/, 'رقم هاتف غير صالح')
  ),

  amount: z.number().positive('المبلغ يجب أن يكون موجباً').max(1_000_000, 'مبلغ كبير جداً'),

  shortText: z.string().transform((s) => sanitizeText(s, 200)).pipe(z.string().min(1, 'مطلوب')),

  longText: z.string().transform((s) => sanitizeText(s, 2000)),

  paymentMethod: z.enum(['card', 'bank', 'applepay', 'googlepay', 'onsite'], {
    errorMap: () => ({ message: 'طريقة دفع غير مدعومة' }),
  }),

  channel: z.enum(['email', 'sms', 'whatsapp', 'push']),
}

// مخطّط دفعة (مثال تطبيقي)
export const paymentSubmitSchema = z.object({
  feeId: schemas.uuid,
  amount: schemas.amount,
  method: schemas.paymentMethod,
  bankRef: z.string().transform((s) => sanitizeText(s, 100)).optional(),
  idempotencyKey: z.string().max(100).optional(),
})

// مخطّط إضافة للطابور
export const enqueueSchema = z.object({
  channel: schemas.channel,
  recipient: z.string().max(254),
  body: schemas.longText,
  dedupeKey: z.string().max(200).optional(),
})

/**
 * يتحقّق من جسم الطلب مقابل مخطّط، ويُرجع نتيجة موحّدة.
 * لا يرمي استثناءً — يُرجع الأخطاء بشكل نظيف للتعامل الرشيق.
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown):
  | { ok: true; data: T }
  | { ok: false; errors: string[] } {
  const result = schema.safeParse(data)
  if (result.success) return { ok: true, data: result.data }
  return { ok: false, errors: result.error.issues.map((i) => i.message) }
}
