// app/api/invoice-pdf-url/route.ts
// يولّد رابطاً موقّعاً مؤقتاً (صالح ساعة واحدة) لملف فاتورة PDF مخزَّن في bucket خاص (invoices).
// يُستخدَم داخلياً (من إرسال واتساب) ولا يُكشَف للعميل مباشرة كرابط دائم.
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

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['owner', 'admin', 'accountant'].includes(profile.role)) {
      return NextResponse.json({ success: false, error: 'غير مصرّح' }, { status: 403 })
    }

    const { data, error } = await supabase.storage
      .from('invoices')
      .createSignedUrl(path, 3600)

    if (error || !data?.signedUrl) {
      return NextResponse.json({ success: false, error: error?.message || 'تعذّر إنشاء الرابط' }, { status: 500 })
    }

    return NextResponse.json({ success: true, url: data.signedUrl })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'خطأ غير معروف' },
      { status: 500 },
    )
  }
}
