
-- ===== rusoompay_control.org_members: split ALL admin policy off SELECT (redundant with member-read) =====
DROP POLICY "owners/admins can manage membership" ON rusoompay_control.org_members;

CREATE POLICY "owners/admins can insert membership" ON rusoompay_control.org_members
  FOR INSERT TO public
  WITH CHECK (organization_id IN (SELECT org_members_1.organization_id FROM rusoompay_control.org_members org_members_1 WHERE org_members_1.user_id = (select auth.uid()) AND org_members_1.role = ANY (ARRAY['owner'::rusoompay_control.org_role,'admin'::rusoompay_control.org_role])));

CREATE POLICY "owners/admins can update membership" ON rusoompay_control.org_members
  FOR UPDATE TO public
  USING (organization_id IN (SELECT org_members_1.organization_id FROM rusoompay_control.org_members org_members_1 WHERE org_members_1.user_id = (select auth.uid()) AND org_members_1.role = ANY (ARRAY['owner'::rusoompay_control.org_role,'admin'::rusoompay_control.org_role])))
  WITH CHECK (organization_id IN (SELECT org_members_1.organization_id FROM rusoompay_control.org_members org_members_1 WHERE org_members_1.user_id = (select auth.uid()) AND org_members_1.role = ANY (ARRAY['owner'::rusoompay_control.org_role,'admin'::rusoompay_control.org_role])));

CREATE POLICY "owners/admins can delete membership" ON rusoompay_control.org_members
  FOR DELETE TO public
  USING (organization_id IN (SELECT org_members_1.organization_id FROM rusoompay_control.org_members org_members_1 WHERE org_members_1.user_id = (select auth.uid()) AND org_members_1.role = ANY (ARRAY['owner'::rusoompay_control.org_role,'admin'::rusoompay_control.org_role])));

ALTER POLICY "members can read their own membership rows" ON rusoompay_control.org_members
  USING (organization_id IN (SELECT org_members_1.organization_id FROM rusoompay_control.org_members org_members_1 WHERE org_members_1.user_id = (select auth.uid())));

-- ===== rusoompay_control.subscriptions: split ALL write policy off SELECT (redundant with member-read) =====
DROP POLICY "admin/finance/owner can write subscriptions" ON rusoompay_control.subscriptions;

CREATE POLICY "admin/finance/owner can insert subscriptions" ON rusoompay_control.subscriptions
  FOR INSERT TO public
  WITH CHECK (organization_id IN (SELECT org_members.organization_id FROM rusoompay_control.org_members WHERE org_members.user_id = (select auth.uid()) AND org_members.role = ANY (ARRAY['owner'::rusoompay_control.org_role,'admin'::rusoompay_control.org_role,'finance'::rusoompay_control.org_role])));

CREATE POLICY "admin/finance/owner can update subscriptions" ON rusoompay_control.subscriptions
  FOR UPDATE TO public
  USING (organization_id IN (SELECT org_members.organization_id FROM rusoompay_control.org_members WHERE org_members.user_id = (select auth.uid()) AND org_members.role = ANY (ARRAY['owner'::rusoompay_control.org_role,'admin'::rusoompay_control.org_role,'finance'::rusoompay_control.org_role])))
  WITH CHECK (organization_id IN (SELECT org_members.organization_id FROM rusoompay_control.org_members WHERE org_members.user_id = (select auth.uid()) AND org_members.role = ANY (ARRAY['owner'::rusoompay_control.org_role,'admin'::rusoompay_control.org_role,'finance'::rusoompay_control.org_role])));

CREATE POLICY "admin/finance/owner can delete subscriptions" ON rusoompay_control.subscriptions
  FOR DELETE TO public
  USING (organization_id IN (SELECT org_members.organization_id FROM rusoompay_control.org_members WHERE org_members.user_id = (select auth.uid()) AND org_members.role = ANY (ARRAY['owner'::rusoompay_control.org_role,'admin'::rusoompay_control.org_role,'finance'::rusoompay_control.org_role])));

ALTER POLICY "members can read their org subscriptions" ON rusoompay_control.subscriptions
  USING (organization_id IN (SELECT org_members.organization_id FROM rusoompay_control.org_members WHERE org_members.user_id = (select auth.uid())));

-- ===== public.schools: merge platform_admin_schools + school_isolation (both SELECT) =====
DROP POLICY platform_admin_schools ON public.schools;
DROP POLICY school_isolation ON public.schools;
CREATE POLICY schools_read ON public.schools
  FOR SELECT TO public
  USING (is_platform_admin() OR id = my_school_id());

-- ===== public.subscriptions: merge platform_admin_subs (ALL) + subscriptions_school (ALL) =====
DROP POLICY platform_admin_subs ON public.subscriptions;
DROP POLICY subscriptions_school ON public.subscriptions;
CREATE POLICY subscriptions_rw ON public.subscriptions
  FOR ALL TO public
  USING (is_platform_admin() OR school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())))
  WITH CHECK (is_platform_admin() OR school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())));

-- ===== public.audit_log: merge platform_admin_audit_read + school_audit_read (both SELECT) =====
DROP POLICY platform_admin_audit_read ON public.audit_log;
DROP POLICY school_audit_read ON public.audit_log;
CREATE POLICY audit_log_read ON public.audit_log
  FOR SELECT TO public
  USING (is_platform_admin() OR (school_id = my_school_id() AND my_role() = ANY (ARRAY['owner'::user_role,'admin'::user_role])));

-- ===== public.help_articles: split admin ALL off SELECT, merge into help_articles_read =====
DROP POLICY help_articles_admin_write ON public.help_articles;

CREATE POLICY help_articles_admin_insert ON public.help_articles
  FOR INSERT TO authenticated
  WITH CHECK (my_role() = 'platform_admin'::user_role);

CREATE POLICY help_articles_admin_update ON public.help_articles
  FOR UPDATE TO authenticated
  USING (my_role() = 'platform_admin'::user_role)
  WITH CHECK (my_role() = 'platform_admin'::user_role);

CREATE POLICY help_articles_admin_delete ON public.help_articles
  FOR DELETE TO authenticated
  USING (my_role() = 'platform_admin'::user_role);

ALTER POLICY help_articles_read ON public.help_articles
  USING (my_role() = 'platform_admin'::user_role OR (is_published AND (cardinality(role_scope) = 0 OR (my_role())::text = ANY (role_scope))));

-- ===== public.meal_orders: split staff ALL off SELECT, merge into guardian_select =====
DROP POLICY meal_orders_staff_all ON public.meal_orders;

CREATE POLICY meal_orders_staff_insert ON public.meal_orders
  FOR INSERT TO authenticated
  WITH CHECK (school_id = my_school_id() AND my_role() = ANY (ARRAY['owner'::user_role,'admin'::user_role,'accountant'::user_role]));

CREATE POLICY meal_orders_staff_update ON public.meal_orders
  FOR UPDATE TO authenticated
  USING (school_id = my_school_id() AND my_role() = ANY (ARRAY['owner'::user_role,'admin'::user_role,'accountant'::user_role]))
  WITH CHECK (school_id = my_school_id() AND my_role() = ANY (ARRAY['owner'::user_role,'admin'::user_role,'accountant'::user_role]));

CREATE POLICY meal_orders_staff_delete ON public.meal_orders
  FOR DELETE TO authenticated
  USING (school_id = my_school_id() AND my_role() = ANY (ARRAY['owner'::user_role,'admin'::user_role,'accountant'::user_role]));

ALTER POLICY meal_orders_guardian_select ON public.meal_orders
  USING (
    (school_id = my_school_id() AND my_role() = ANY (ARRAY['owner'::user_role,'admin'::user_role,'accountant'::user_role]))
    OR EXISTS (SELECT 1 FROM parent_students ps WHERE ps.student_id = meal_orders.student_id AND ps.parent_id = (select auth.uid()))
  );

-- ===== public.announcements: split platform ALL off SELECT, merge into ann_school_read =====
DROP POLICY ann_platform_all ON public.announcements;

CREATE POLICY ann_platform_insert ON public.announcements
  FOR INSERT TO public
  WITH CHECK (is_platform_admin());

CREATE POLICY ann_platform_update ON public.announcements
  FOR UPDATE TO public
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY ann_platform_delete ON public.announcements
  FOR DELETE TO public
  USING (is_platform_admin());

ALTER POLICY ann_school_read ON public.announcements
  USING (is_platform_admin() OR target = 'all'::text OR target = (my_school_id())::text);
