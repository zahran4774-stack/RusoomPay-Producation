// اختبارات webhook ثواني — أخطر مسار في النظام لأنه يسجّل دفعات مالية فعلية
// بلا مراجعة بشرية، بناءً على استدعاء API خارجي. نُحاكي استجابة ثواني هنا
// حتى لا تعتمد الاختبارات على اتصال إنترنت فعلي ببيئة UAT الخارجية.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { serviceClient, createTestFixture, type TestFixture } from './helpers'

const sb = serviceClient()
let fx: TestFixture

beforeEach(async () => { fx = await createTestFixture(sb, { feeTotal: 100 }) })
afterEach(async () => { await fx.cleanup() })

// نستورد المعالج مباشرة بدل تشغيل خادم Next.js كامل —
// أسرع وأكثر تحكّماً، ونُحاكي fetch لتفادي الاتصال الفعلي بثواني.
async function callWebhook(sessionId: string) {
  const { POST } = await import('../../app/api/thawani/webhook/route')
  const req = new Request('http://localhost/api/thawani/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any
  req.nextUrl = new URL(req.url)
  return POST(req)
}

describe('Thawani webhook — الحالة الناجحة', () => {
  it('دفعة مؤكَّدة (paid) من ثواني تُسجَّل عبر record_payment وتُحدَّث الفاتورة', async () => {
    const fakeSessionId = 'checkout_test_' + fx.feeId.slice(0, 8)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { session_id: fakeSessionId, payment_status: 'paid', client_reference_id: fx.feeId, total_amount: 50000 }, // 50 ر.ع بالبيسة
      }),
    }))

    const res = await callWebhook(fakeSessionId)
    const json = await res.json()
    expect(json.ok).toBe(true)

    const { data: fee } = await sb.from('student_fees').select('paid').eq('id', fx.feeId).single()
    expect(fee?.paid).toBeCloseTo(50, 3)

    const { data: payment } = await sb.from('payments').select('method').eq('fee_id', fx.feeId).single()
    expect(payment?.method).toBe('thawani')

    vi.unstubAllGlobals()
  })

  it('استدعاء الـwebhook مرّتين لنفس الجلسة لا يُسجّل الدفعة مرّتين (منع الازدواج)', async () => {
    const fakeSessionId = 'checkout_test_dup_' + fx.feeId.slice(0, 8)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { session_id: fakeSessionId, payment_status: 'paid', client_reference_id: fx.feeId, total_amount: 30000 },
      }),
    }))

    await callWebhook(fakeSessionId)
    await callWebhook(fakeSessionId) // نفس الجلسة مرّة أخرى — يحاكي إعادة إرسال ثواني للـwebhook

    const { data: fee } = await sb.from('student_fees').select('paid').eq('id', fx.feeId).single()
    expect(fee?.paid).toBeCloseTo(30, 3) // ليس 60 — لم يُسجَّل مرّتين

    vi.unstubAllGlobals()
  })
})

describe('Thawani webhook — الحالات غير المدفوعة', () => {
  it('حالة unpaid تُتجاهَل بصمت ولا تُسجّل أي دفعة', async () => {
    const fakeSessionId = 'checkout_test_unpaid'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { session_id: fakeSessionId, payment_status: 'unpaid', client_reference_id: fx.feeId, total_amount: 50000 },
      }),
    }))

    const res = await callWebhook(fakeSessionId)
    const json = await res.json()
    expect(json.ignored).toBe(true)

    const { data: fee } = await sb.from('student_fees').select('paid').eq('id', fx.feeId).single()
    expect(fee?.paid).toBeCloseTo(0, 3)

    vi.unstubAllGlobals()
  })

  it('session_id مفقود من جسم الطلب يُرفض بخطأ 400', async () => {
    const { POST } = await import('../../app/api/thawani/webhook/route')
    const req = new Request('http://localhost/api/thawani/webhook', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any
    req.nextUrl = new URL(req.url)
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('فشل الاتصال بثواني عند الاستعلام يُرجع 502 لا 200 (يمنع "نجاحاً" كاذباً)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const res = await callWebhook('checkout_network_fail')
    expect(res.status).toBe(502)
    vi.unstubAllGlobals()
  })
})
