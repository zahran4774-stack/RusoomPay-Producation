-- Phase 4B — CRITICAL FIX: journal_entries كانت تسمح بـ ALL لأي دور بنفس المدرسة (بما فيهم parent)
-- بدون فحص الدور إطلاقاً. الإصلاح: تقييد الوصول لـ owner/admin/accountant فقط —
-- بنفس النمط الآمن المستخدَم فعلياً في student_fees و payroll_runs.
-- journal_lines تعتمد على journal_entries.school_id عبر EXISTS، فهذا الإصلاح يحميها تلقائياً أيضاً.
DROP POLICY IF EXISTS journal_entries_rw ON public.journal_entries;

CREATE POLICY journal_entries_staff_rw ON public.journal_entries
  FOR ALL
  USING (
    school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = auth.uid())
    AND (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) IN ('owner','admin','accountant')
  )
  WITH CHECK (
    school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = auth.uid())
    AND (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) IN ('owner','admin','accountant')
  );