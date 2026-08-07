// عميل Supabase للمتصفح (مكوّنات العميل)
import { createBrowserClient } from '@supabase/ssr'
import { getAuthCookieName } from '@/lib/supabase-cookie-config'

export function createClient() {
  const cookieName = typeof window !== 'undefined'
    ? getAuthCookieName(window.location.pathname)
    : undefined

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: cookieName ? { name: cookieName } : undefined }
  )
}

function getTabStorage() {
  if (typeof window === 'undefined') return undefined

  // معرّف فريد لهذا التبويب تحديدًا، يبقى ثابت طول عمر التبويب
  let tabId = sessionStorage.getItem('rp_tab_id')
  if (!tabId) {
    tabId = crypto.randomUUID()
    sessionStorage.setItem('rp_tab_id', tabId)
  }

  return {
    getItem: (key: string) => localStorage.getItem(`${tabId}_${key}`),
    setItem: (key: string, value: string) => localStorage.setItem(`${tabId}_${key}`, value),
    removeItem: (key: string) => localStorage.removeItem(`${tabId}_${key}`),
  }
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: getTabStorage(),
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  )
}
