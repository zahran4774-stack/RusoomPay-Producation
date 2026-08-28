// اختبار تشخيصي مؤقت — يُحذف بعد حلّ المشكلة
import { describe, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'

describe('تشخيص نهائي', () => {
  it('يكشف الدور الفعلي عبر current_setting', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

    console.log('=== معلومات المفتاح ===')
    console.log('موجود؟', !!key)
    console.log('الطول:', key?.length)
    console.log('يبدأ بـ:', key?.slice(0, 30))

    const sb = createClient(url, key, { auth: { persistSession: false } })

    // نستدعي دالة SQL بسيطة تعيد current_user و current_setting مباشرة
    const { data, error } = await sb.rpc('exec_sql_diagnostic')
    console.log('=== نتيجة الدور من قاعدة البيانات ===')
    console.log('data:', JSON.stringify(data))
    console.log('error:', error?.message)
  })
})
