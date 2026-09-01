// app/api/platform/supabase-org/route.ts
// خطة Supabase الحيّة (من Management API الرسمي)، بدل الاعتماد على رقم مسجَّل يدوياً.
// PAT يحمل صلاحيات الحساب الكاملة — يُستخدم هنا للقراءة فقط ولا يُعاد إرساله للعميل.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const ORG_ID = 'vercel_icfg_hq3lVvkMcf5Ob5KxZ1lk7bxh'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: isAdmin } = await supabase.rpc('is_platform_admin')
  if (!isAdmin) return NextResponse.json({ error: 'غير مصرّح: لمدير المنصة فقط' }, { status: 403 })

  const pat = process.env.SUPABASE_MANAGEMENT_PAT_V2
  if (!pat) {
    return NextResponse.json({ error: 'SUPABASE_MANAGEMENT_PAT_V2 غير مضبوط' }, { status: 500 })
  }

  try {
    const res = await fetch(`https://api.supabase.com/v1/organizations/${ORG_ID}`, {
      headers: { Authorization: `Bearer ${pat}` },
      // بيانات الخطة تتغيّر نادراً — تخزين مؤقت قصير يكفي ويقلّل الاستدعاءات
      next: { revalidate: 300 },
    })
    if (!res.ok) {
      const body = await res.text()
      return NextResponse.json({ error: `Supabase Management API: ${res.status} ${body}` }, { status: 502 })
    }
    const org = await res.json()
    return NextResponse.json({
      plan: org.plan as string,
      name: org.name as string,
      billing_url: `https://supabase.com/dashboard/org/${ORG_ID}/billing`,
    })
  } catch (e) {
    return NextResponse.json({ error: `تعذّر الاتصال بـSupabase Management API: ${(e as Error).message}` }, { status: 502 })
  }
}
