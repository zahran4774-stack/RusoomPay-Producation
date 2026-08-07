export function getAuthCookieName(pathname: string): string | undefined {
  if (pathname.startsWith('/parent')) {
    return 'sb-parent-auth-token'
  }
  return undefined
}
