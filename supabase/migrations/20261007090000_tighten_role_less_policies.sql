-- ============================================================================
-- Tighten RLS policies that had NO role check.
--
-- Found by supabase/tests/tenant_isolation.sql: in production, the policies
--   students_staff_read, employees_staff_read   (SELECT)
--   student_fees_school_rw, journal_lines_rw    (ALL)
-- only compared school_id with the caller's profiles.school_id. Any
-- authenticated user attached to a school -- including role 'parent' -- could
-- therefore read every student, fee and employee (salaries) of that school and
-- write student_fees / journal_lines directly.
--
-- Fix: staff roles only (owner, admin, accountant), same school check as before.
-- Parents keep read access to THEIR OWN children's rows through parent_students
-- (needed by app/api/thawani/create-session/route.ts, which reads student_fees
-- as the parent with the user's own client). The parent portal itself uses
-- SECURITY DEFINER RPCs and is unaffected.
--
-- NOT applied to production. Review, then apply deliberately.
-- ============================================================================

-- staff of the same school
DROP POLICY IF EXISTS students_staff_read ON public.students;
CREATE POLICY students_staff_read ON public.students
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.school_id = students.school_id
      AND p.role IN ('owner','admin','accountant')
  ));

DROP POLICY IF EXISTS employees_staff_read ON public.employees;
CREATE POLICY employees_staff_read ON public.employees
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.school_id = employees.school_id
      AND p.role IN ('owner','admin','accountant')
  ));

DROP POLICY IF EXISTS student_fees_school_rw ON public.student_fees;
CREATE POLICY student_fees_school_rw ON public.student_fees
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.school_id = student_fees.school_id
      AND p.role IN ('owner','admin','accountant')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.school_id = student_fees.school_id
      AND p.role IN ('owner','admin','accountant')
  ));

DROP POLICY IF EXISTS journal_lines_rw ON public.journal_lines;
CREATE POLICY journal_lines_rw ON public.journal_lines
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.journal_entries e
    JOIN public.profiles p ON p.school_id = e.school_id
    WHERE e.id = journal_lines.entry_id
      AND p.id = (SELECT auth.uid())
      AND p.role IN ('owner','admin','accountant')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.journal_entries e
    JOIN public.profiles p ON p.school_id = e.school_id
    WHERE e.id = journal_lines.entry_id
      AND p.id = (SELECT auth.uid())
      AND p.role IN ('owner','admin','accountant')
  ));

-- parents: read-only access to their own linked children
DROP POLICY IF EXISTS students_parent_read ON public.students;
CREATE POLICY students_parent_read ON public.students
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.parent_students ps
    WHERE ps.student_id = students.id
      AND ps.parent_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS student_fees_parent_read ON public.student_fees;
CREATE POLICY student_fees_parent_read ON public.student_fees
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.parent_students ps
    WHERE ps.student_id = student_fees.student_id
      AND ps.parent_id = (SELECT auth.uid())
  ));
