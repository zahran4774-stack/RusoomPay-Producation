// Middleware — يحدّث جلسة المستخدم ويحمي المسارات
// يعمل على الخادم قبل كل طلب — لا يمكن تجاوزه من المتصفح
//
// ⚠️ إصلاح أمني: الإصدار السابق استخدم قائمة "مسارات محمية" يدوية، ونسيت
// سبعة مسارات فعلية (cafeteria, feedback, inventory, parent, payroll,
// settings, transport) — كل صفحة فيها كانت تحمي نفسها داخلياً (طبقة دفاع
// ثانية سليمة)، لكن أي صفحة جديدة تُنسى فيها تلك السطور تبقى مكشوفة بلا أي
// حماية على مستوى middleware. الآن معكوسة: قائمة صريحة بالمسارات العامة
// فقط، وكل ما عداها محمي افتراضياً (deny-by-default).
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// المسارات العامة الوحيدة التي لا تتطلب تسجيل دخول
const PUBLIC_PATHS = [
  '/', '/login', '/register', '/parent-register', '/staff-register', '/reset-password',
  '/subscribe', '/privacy', '/terms', '/help', '/offline', '/payment-result',
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // تحديث الجلسة
  const { data: { user } } = await supabase.auth.getUser()

  // كل مسار API له حمايته الخاصة (توقيع Webhook، CRON_SECRET، إلخ) — يُستثنى هنا
  const isApi = request.nextUrl.pathname.startsWith('/api/')

  if (!isApi && !isPublicPath(request.nextUrl.pathname) && !user) {
    // غير مُصادَق ومسار غير عام → إعادة توجيه لتسجيل الدخول
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // حماية لوحة المنصة على مستوى الطبقة الوسطى — نستخدم my_role() (security definer، موثوقة)
  if (request.nextUrl.pathname.startsWith('/platform') && user) {
    const { data: myRole } = await supabase.rpc('my_role')
    if (myRole !== 'platform_admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
