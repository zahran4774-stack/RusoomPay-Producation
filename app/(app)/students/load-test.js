// ============================================================================
// EduPay — سكربت اختبار الحمل (k6)
// شغّله على نسختك الإنتاجية بعد نشرها على Supabase/Vercel
//
// التثبيت: https://k6.io/docs/get-started/installation/
// التشغيل: k6 run load-test.js
// ============================================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// مقاييس مخصّصة
const errorRate = new Rate('errors');
const loginTime = new Trend('login_duration');

// إعدادات السيناريو — يحاكي حملاً متزايداً
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // تصاعد لـ10 مستخدمين
    { duration: '1m',  target: 50 },   // 50 مستخدماً متزامناً
    { duration: '1m',  target: 100 },  // ذروة: 100 مستخدم
    { duration: '30s', target: 200 },  // اختبار الإجهاد: 200
    { duration: '30s', target: 0 },    // تهدئة
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],  // 95% من الطلبات أقل من 800ms
    errors: ['rate<0.05'],             // أقل من 5% أخطاء
  },
};

// ⚠️ استبدل هذه القيم بقيم مشروعك الفعلي
const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://your-project.supabase.co';
const ANON_KEY = __ENV.ANON_KEY || 'your-anon-key';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'test@school.om';
const TEST_PW = __ENV.TEST_PW || 'TestPass@2026';

export default function () {
  const headers = {
    'apikey': ANON_KEY,
    'Content-Type': 'application/json',
  };

  // 1) تسجيل الدخول
  const t0 = Date.now();
  const loginRes = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PW }),
    { headers }
  );
  loginTime.add(Date.now() - t0);

  const ok = check(loginRes, {
    'تسجيل الدخول نجح': (r) => r.status === 200,
  });
  errorRate.add(!ok);

  if (loginRes.status !== 200) { sleep(1); return; }

  const token = loginRes.json('access_token');
  const authHeaders = { ...headers, 'Authorization': `Bearer ${token}` };

  // 2) جلب الطلاب (يمرّ عبر RLS)
  const studentsRes = http.get(
    `${SUPABASE_URL}/rest/v1/students?select=id,code,full_name,grade`,
    { headers: authHeaders }
  );
  check(studentsRes, { 'جلب الطلاب نجح': (r) => r.status === 200 });
  errorRate.add(studentsRes.status !== 200);

  // 3) جلب القيود المحاسبية (الأثقل — اختبار الأداء الحقيقي)
  const journalsRes = http.get(
    `${SUPABASE_URL}/rest/v1/journal_entries?select=id,entry_date,journal_lines(debit,credit)`,
    { headers: authHeaders }
  );
  check(journalsRes, {
    'جلب القيود نجح': (r) => r.status === 200,
    'القيود سريعة (<500ms)': (r) => r.timings.duration < 500,
  });
  errorRate.add(journalsRes.status !== 200);

  // 4) جلب الموظفين
  const empRes = http.get(
    `${SUPABASE_URL}/rest/v1/employees?select=id,full_name,basic,allowance`,
    { headers: authHeaders }
  );
  check(empRes, { 'جلب الموظفين نجح': (r) => r.status === 200 });
  errorRate.add(empRes.status !== 200);

  sleep(Math.random() * 2 + 1); // محاكاة وقت تفكير المستخدم
}

// ============================================================================
// تفسير النتائج:
// - http_req_duration p(95) < 800ms  → الأداء جيد
// - errors rate < 5%                  → الاستقرار جيد
// - إن ارتفع زمن الاستجابة فجأة عند عدد معيّن من المستخدمين = نقطة الانهيار
//   (الحل غالباً: ترقية باقة Supabase أو إضافة فهارس أو تخزين مؤقت)
// ============================================================================
