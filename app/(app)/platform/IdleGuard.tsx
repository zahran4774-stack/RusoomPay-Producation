"use client";

// قفل خمول لمركز تحكّم المنصة (platform_admin) — تسجيل خروج فعلي بعد فترة
// خمول محددة. مستقل تمامًا عن صلاحية الجلسة نفسها (JWT/refresh token)، فيحل
// مشكلة الدخول التلقائي بدون طلب كلمة مرور حتى لو الجلسة لسا صالحة تقنيًا.
import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

const IDLE_LIMIT_MS = 10 * 60 * 1000; // 10 دقائق — أقصر بكثير من باقي التطبيق لأنها أخطر صفحة

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "visibilitychange",
] as const;

export default function IdleGuard() {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();

  const endSession = useCallback(async () => {
    // تسجيل خروج حقيقي — يحذف الجلسة من auth.sessions، مو مجرد توجيه شكلي
    await supabase.auth.signOut();
    router.replace("/login?reason=idle_timeout");
  }, [router, supabase]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(endSession, IDLE_LIMIT_MS);
  }, [endSession]);

  useEffect(() => {
    resetTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [resetTimer]);

  return null;
}
