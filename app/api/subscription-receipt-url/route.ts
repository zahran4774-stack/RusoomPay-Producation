// app/api/subscription-receipt-url/route.ts
// يولّد رابطاً موقّعاً مؤقتاً (صالح 5 دقائق) لعرض إيصال تحويل بنكي مرفوع في bucket خاص.
// مقيّد بمالك المنصة (platform_admin) فقط — التحقق يصير عبر جلسة Supabase للمستخدم الحالي.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const { path } = await req.json()
    if (!path || typeof path !== 'string') {
      return NextResponse.json({ success: false, error: 'مسار الملف مطلوب' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'غير مصادَق' }, { status: 401 })

    // التحقق من الدور عبر نفس دالة القاعدة المستخدَمة في RLS (my_role) — يمنع أي التفاف
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'platform_admin') {
      return NextResponse.json({ success: false, error: 'غير مصرّح — لمالك المنصة فقط' }, { status: 403 })
    }

    const { data, error } = await supabase.storage
      .from('subscription-receipts')
      .createSignedUrl(path, 300) // صالح 5 دقائق

    if (error || !data?.signedUrl) {
      return NextResponse.json({ success: false, error: error?.message || 'تعذّر إنشاء الرابط' }, { status: 500 })
    }

    return NextResponse.json({ success: true, url: data.signedUrl })
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'خطأ غير معروف' }, { status: 500 })
  }
}
