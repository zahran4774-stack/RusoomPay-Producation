// lib/rate-limit.ts
// تحديد المعدّل (Rate Limiting) عبر قاعدة البيانات — يعمل عبر خوادم Vercel المتعدّدة
// (الذاكرة المحلية لا تكفي في serverless لأن كل طلب قد يصيب خادماً مختلفاً).
import { createServiceClient } from '@/lib/supabase-service'

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number }

/**
 * يتحقّق من تجاوز الحدّ لمفتاح معيّن خلال نافذة زمنية.
 * @param key   معرّف فريد (مثل "login:<ip>" أو "pay:<userId>")
 * @param limit عدد الطلبات المسموحة
 * @param windowSec طول النافذة بالثواني
 */
export async function checkRateLimit(
  key: string, limit: number, windowSec: number
): Promise<RateLimitResult> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: key, p_limit: limit, p_window_sec: windowSec,
    })
    if (error) {
      // فشل المحدّد لا يجب أن يمنع الخدمة (fail-open بحذر) — لكن يُسجّل
      console.error('rate-limit error:', error.message)
      return { allowed: true, remaining: limit, resetAt: Date.now() + windowSec * 1000 }
    }
    return {
      allowed: data.allowed,
      remaining: data.remaining,
      resetAt: new Date(data.reset_at).getTime(),
    }
  } catch {
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowSec * 1000 }
  }
}

// استخراج معرّف العميل (IP) من الطلب — مع احترام رؤوس البروكسي
export function clientId(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}
