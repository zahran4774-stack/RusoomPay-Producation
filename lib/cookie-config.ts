// lib/supabase/cookie-config.ts
// يحدد اسم الكوكي حسب نوع البوابة بناءً على المسار
// المدير/الموظفين: الاسم الافتراضي لـ Supabase (بدون تغيير)
// ولي الأمر: اسم منفصل تمامًا -> جلسة مستقلة كليًا عن جلسة المدير

export function getAuthCookieName(pathname: string): string | undefined {
  if (pathname.startsWith('/parent')) {
    return 'sb-parent-auth-token'
  }
  // undefined = يستخدم Supabase اسمه الافتراضي (sb-<ref>-auth-token)
  // هذا يحافظ على كل الجلسات الحالية للمدراء بدون أي انقطاع
  return undefined
}
