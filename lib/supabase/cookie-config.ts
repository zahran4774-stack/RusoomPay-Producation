export function getAuthCookieName(pathname: string): string | undefined {
  if (pathname.startsWith('/parent')) {
    return 'sb-parent-auth-token'
  }
  if (pathname === '/login') {
    return 'sb-pending-auth-token' // كوكي مؤقت أثناء تسجيل الدخول فقط — ما يلمس كوكي المدير
  }
  return undefined
}
