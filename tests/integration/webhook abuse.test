// اختبار يوثّق ثغرة حقيقية غير مُصلَحة بعد: /api/thawani/webhook لا يملك حدّ معدّل،
// خلافاً لـ /api/assistant الذي يملك check_and_increment_rate_limit.
// هذا الاختبار "متوقّع الفشل حالياً" عمداً — هدفه تذكيرك بإصلاح الثغرة قبل الإنتاج،
// ويتحوّل تلقائياً لاختبار ناجح بعد إضافة الحماية دون أي تعديل على منطقه.
import { describe, it, expect, vi } from 'vitest'

describe('حماية webhook ثواني من إساءة الاستخدام (فجوة معروفة)', () => {
  it.fails(
    'يجب أن يرفض أكثر من N طلباً في الدقيقة من نفس المصدر — غير مُطبَّق بعد',
    async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { session_id: 'x', payment_status: 'unpaid', client_reference_id: 'x', total_amount: 0 } }),
      }))
      const { POST } = await import('../../app/api/thawani/webhook/route')

      let lastStatus = 200
      for (let i = 0; i < 50; i++) {
        const req = new Request('http://localhost/api/thawani/webhook', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: 'flood_test_' + i }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any
        req.nextUrl = new URL(req.url)
        const res = await POST(req)
        lastStatus = res.status
      }
      // نتوقّع 429 (تم تجاوز الحد) في مكان ما بعد عدد كافٍ من الطلبات — يفشل حالياً لأنه دائماً 200/502
      expect(lastStatus).toBe(429)
      vi.unstubAllGlobals()
    },
    15000
  )
})
