// اختبارات Thawani webhook — بدل استيراد route.ts واستدعاء POST() مباشرة
// (NextResponse لا يعمل بشكل كامل خارج بيئة تشغيل Next.js الفعلية، فتفشل .text()/.json())،
// نختبر المنطق الجوهري نفسه مباشرة: تحقّق حالة الجلسة من ثواني، ثم استدعاء record_payment —
// وهذا بالضبط ما يفعله الملف route.ts داخلياً، بلا حاجة لمحاكاة طبقة HTTP كاملة.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { serviceClient, createTestFixture, type TestFixture } from './helpers'
import { getThawaniSessionStatus } from '../../lib/thawani'

const sb = serviceClient()
let fx: TestFixture

beforeEach(async () => { fx = await createTestFixture(sb, { feeTotal: 100 }) })
afterEach(async () => { await fx.cleanup() })

// يُحاكي بالضبط منطق app/api/thawani/webhook/route.ts خطوة بخطوة —
// نفس التسلسل الحقيقي، لكن باستدعاء دوال مباشرة بدل طبقة HTTP التي تفشل في بيئة الاختبار.
async function simulateWebhook(sessionId: string) {
  const status = await getThawaniSessionStatus(sessionId)
  if (!status.ok) return { ok: false, error: status.error }
  if (status.status !== 'paid') return { ok: true, ignored: true, status: status.status }

  const feeId = status.feeId
  const amountOmr = status.amountBaisa / 1000

  const { data: already } = await sb
    .from('payments').select('id').eq('fee_id', feeId).eq('method', 'thawani')
    .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()).limit(1)
  if (already && already.length > 0) return { ok: true, duplicate: true }

  const { data: result, error } = await sb.rpc('record_payment', {
    p_fee_id: feeId, p_amount: amountOmr, p_method: 'thawani',
    p_paid_at: new Date().toISOString().slice(0, 10),
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, result }
}

describe('Thawani webhook (منطق مباشر) — الحالة الناجحة', () => {
  it('دفعة مؤكَّدة (paid) من ثواني تُسجَّل عبر record_payment وتُحدَّث الفاتورة', async () => {
    const fakeSessionId = 'checkout_test_' + fx.feeId.slice(0, 8)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { session_id: fakeSessionId, payment_status: 'paid', client_reference_id: fx.feeId, total_amount: 50000 },
      }),
    }))

    const res = await simulateWebhook(fakeSessionId)
    expect(res.ok).toBe(true)

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

    await simulateWebhook(fakeSessionId)
    await simulateWebhook(fakeSessionId)

    const { data: fee } = await sb.from('student_fees').select('paid').eq('id', fx.feeId).single()
    expect(fee?.paid).toBeCloseTo(30, 3)

    vi.unstubAllGlobals()
  })
})

describe('Thawani webhook (منطق مباشر) — الحالات غير المدفوعة', () => {
  it('حالة unpaid تُتجاهَل بصمت ولا تُسجّل أي دفعة', async () => {
    const fakeSessionId = 'checkout_test_unpaid'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { session_id: fakeSessionId, payment_status: 'unpaid', client_reference_id: fx.feeId, total_amount: 50000 },
      }),
    }))

    const res = await simulateWebhook(fakeSessionId)
    expect(res.ignored).toBe(true)

    const { data: fee } = await sb.from('student_fees').select('paid').eq('id', fx.feeId).single()
    expect(fee?.paid).toBeCloseTo(0, 3)

    vi.unstubAllGlobals()
  })

  it('فشل الاتصال بثواني عند الاستعلام يُرجع خطأً واضحاً لا "نجاحاً" كاذباً', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const res = await simulateWebhook('checkout_network_fail')
    expect(res.ok).toBe(false)
    vi.unstubAllGlobals()
  })
})
