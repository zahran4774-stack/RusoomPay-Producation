// Middleware — يحدّث جلسة المستخدم ويحمي المسارات
// يعمل على الخادم قبل كل طلب — لا يمكن تجاوزه من المتصفح
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
        setAll(cookiesToSet) {
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

  // المسارات المحمية — تتطلب تسجيل دخول
  const protectedPaths = ['/dashboard', '/students', '/employees', '/fees', '/subscription', '/accounting', '/platform', '/activity']
  const isProtected = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p))

  if (isProtected && !user) {
    // غير مُصادَق → إعادة توجيه لتسجيل الدخول
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // حماية لوحة المنصة على مستوى الطبقة الوسطى — قبل تحميل الصفحة
  // (نستعلم عن الدور فقط لمسار /platform، لا لكل طلب، حفاظاً على الأداء)
  if (request.nextUrl.pathname.startsWith('/platform') && user) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'platform_admin') {
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
