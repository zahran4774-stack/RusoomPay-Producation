// tests/load/health-load.js
// اختبار حِمل بأداة k6 — يقيس تحمّل النظام تحت مستخدمين متزامنين.
// الهدف: /api/health (عام، يفحص الاتصال بقاعدة البيانات) — مؤشّر صحّة البنية تحت الضغط.
//
// التشغيل:
//   k6 run -e BASE_URL=https://your-app.vercel.app tests/load/health-load.js
//
// التثبيت: https://k6.io/docs/get-started/installation/

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const errorRate = new Rate('errors')
const healthLatency = new Trend('health_latency')

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// مراحل الحِمل: تصاعد تدريجي ثم ثبات ثم هبوط (نمط واقعي)
export const options = {
  stages: [
    { duration: '30s', target: 20 },   // تصاعد إلى 20 مستخدماً
    { duration: '1m', target: 50 },    // ثبات على 50
    { duration: '30s', target: 100 },  // ذروة 100 مستخدم متزامن
    { duration: '1m', target: 100 },   // صمود تحت الذروة
    { duration: '30s', target: 0 },    // هبوط
  ],
  thresholds: {
    // معايير القبول — يفشل الاختبار إن لم تتحقّق
    http_req_duration: ['p(95)<800'],  // 95% من الطلبات أسرع من 800ms
    errors: ['rate<0.05'],             // أقل من 5% أخطاء
    http_req_failed: ['rate<0.05'],
  },
}

export default function () {
  const res = http.get(`${BASE_URL}/api/health`)

  const ok = check(res, {
    'الحالة 200': (r) => r.status === 200,
    'الردّ يحوي status': (r) => r.body && r.body.includes('status'),
    'زمن الاستجابة < 1s': (r) => r.timings.duration < 1000,
  })

  errorRate.add(!ok)
  healthLatency.add(res.timings.duration)

  sleep(1) // محاكاة فترة تفكير المستخدم
}

// ملخّص مخصّص في نهاية الاختبار
export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(0) ?? '?'
  const errPct = ((data.metrics.errors?.values?.rate ?? 0) * 100).toFixed(2)
  const reqs = data.metrics.http_reqs?.values?.count ?? 0
  return {
    stdout: `
═══════════════════════════════════════
  نتيجة اختبار الحِمل — EduPay
═══════════════════════════════════════
  إجمالي الطلبات:      ${reqs}
  زمن الاستجابة p95:   ${p95}ms  (الهدف < 800ms)
  نسبة الأخطاء:        ${errPct}%  (الهدف < 5%)
═══════════════════════════════════════
`,
  }
}
