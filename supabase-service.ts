// lib/supabase-service.ts
// عميل Supabase بصلاحية الخدمة (service role) — للعامل/الـcron فقط، يتجاوز RLS.
// ⚠️ يُستخدم حصراً في مسارات الخادم المحميّة، لا يُرسل للمتصفّح أبداً.
import 'server-only' // درع: يُفشل البناء لو استُورد هذا الملف في كود عميل
import { createClient } from '@supabase/supabase-js'

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('متغيّرات Supabase (URL / SERVICE_ROLE_KEY) غير مُهيّأة')
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
