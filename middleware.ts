// Middleware — يحدّث جلسة المستخدم ويحمي المسارات
// يعمل على الخادم قبل كل طلب — لا يمكن تجاوزه من المتصفح
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getAuthCookieName } from '@/lib/supabase/cookie-config'

export async function middleware(request: NextRequest) {
  const cookieName = getAuthCookieName(request.nextUrl.pathname)

  // نمرر نوع البوابة عبر هيدر داخلي — يقرأه lib/supabase-server.ts لاحقًا
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-portal-cookie', cookieName ?? 'default')

  let response = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: cookieName ? { name: cookieName } : undefined,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // تحديث الجلسة
  const { data: { user } } = await supabase.auth.getUser()

  // المسارات المحمية — تتطلب تسجيل دخول (بدون أي تغيير عن الأصل)
  const protectedPaths = ['/dashboard', '/students', '/employees', '/fees', '/subscription', '/accounting', '/platform', '/activity']
  const isProtected = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p))

  if (isProtected && !user) {
    // غير مُصادَق → إعادة توجيه لتسجيل الدخول
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
