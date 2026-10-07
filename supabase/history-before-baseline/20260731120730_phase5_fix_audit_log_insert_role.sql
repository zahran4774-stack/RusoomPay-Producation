-- Phase 5 — CRITICAL FIX: audit_insert كانت تسمح بإدراج مباشر لأي دور (بما فيه parent) بنفس المدرسة،
-- بدون فحص دور. الإصلاح: تقييدها لـ owner/admin/accountant فقط.
-- آمن تماماً: 31 دالة SECURITY DEFINER تُدرج في audit_log، وكلها تتجاوز RLS تلقائياً (لا تتأثر).
-- الهدف فقط منع الإدراج المباشر عبر REST API من مستخدم غير موثوق.
DROP POLICY IF EXISTS audit_insert ON public.audit_log;

CREATE POLICY audit_insert_staff_only ON public.audit_log
  FOR INSERT
  WITH CHECK (
    school_id = my_school_id()
    AND my_role() IN ('owner','admin','accountant')
  );