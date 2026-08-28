// اختبار تشخيصي — نسخة v2 بـsecurity invoker
import { describe, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'

describe('تشخيص v2', () => {
  it('يكشف rolbypassrls الفعلي عبر عميل API حقيقي', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const sb = createClient(url, key, { auth: { persistSession: false } })

    const { data, error } = await sb.rpc('exec_sql_diagnostic_v2')
    console.log('=== v2 عبر عميل API حقيقي ===')
    console.log('data:', JSON.stringify(data))
    console.log('error:', error?.message)

    // اختبار مباشر: هل يستطيع هذا العميل فعلياً إدراج صف تجريبي في schools؟
    const { data: insertTest, error: insertErr } = await sb
      .from('schools')
      .insert({ name: 'DIAG_TEST_DELETE_ME', country: 'OM', currency: 'OMR' })
      .select('id')
      .single()

    console.log('=== محاولة إدراج مباشرة ===')
    console.log('نجح؟', !!insertTest)
    console.log('خطأ الإدراج:', insertErr?.message)
    console.log('كود الخطأ:', insertErr?.code)
    console.log('تفاصيل:', insertErr?.details)
    console.log('hint:', insertErr?.hint)

    // نظّف فوراً لو نجح
    if (insertTest?.id) {
      await sb.from('schools').delete().eq('id', insertTest.id)
    }
  })
})
