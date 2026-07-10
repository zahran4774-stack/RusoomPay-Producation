import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Do NOT mutate request.cookies in middleware (it's read-only).
          // Only set cookies on the response.
          response = NextResponse.next()
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Safely get the user
  const getUserResult = await supabase.auth.getUser()
  const user = getUserResult?.data?.user ?? null

  // Protected paths
  const protectedPaths = ['/dashboard', '/students', '/employees', '/fees', '/subscription', '/accounting', '/platform', '/activity']
  const isProtected = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Platform-level role check — handle RPC result shape robustly
  if (request.nextUrl.pathname.startsWith('/platform') && user) {
    const { data: roleData, error: roleError } = await supabase.rpc('my_role')
    let myRole: string | null = null

    if (!roleError && roleData != null) {
      // RPC might return a scalar, an object, or an array of objects depending on the function.
      if (Array.isArray(roleData)) {
        // e.g. [{ my_role: 'platform_admin' }]
        myRole = roleData[0]?.my_role ?? (typeof roleData[0] === 'string' ? roleData[0] : null)
      } else if (typeof roleData === 'object') {
        myRole = (roleData as any).my_role ?? null
      } else {
        myRole = String(roleData)
      }
    }

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
