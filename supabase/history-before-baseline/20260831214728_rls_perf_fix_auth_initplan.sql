
-- ===== Fix auth_rls_initplan: wrap auth.uid() in (select auth.uid()) =====

ALTER POLICY accounts_school_rw ON public.accounts
  USING (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())))
  WITH CHECK (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())));

ALTER POLICY bus_subscriptions_school_rw ON public.bus_subscriptions
  USING (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())))
  WITH CHECK (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())));

ALTER POLICY buses_school_rw ON public.buses
  USING (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())))
  WITH CHECK (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())));

ALTER POLICY employees_staff_read ON public.employees
  USING (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())));

ALTER POLICY inventory_items_school_rw ON public.inventory_items
  USING (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())))
  WITH CHECK (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())));

ALTER POLICY journal_lines_rw ON public.journal_lines
  USING (EXISTS (SELECT 1 FROM journal_entries e WHERE e.id = journal_lines.entry_id AND e.school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM journal_entries e WHERE e.id = journal_lines.entry_id AND e.school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid()))));

ALTER POLICY meal_plans_school_rw ON public.meal_plans
  USING (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())))
  WITH CHECK (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())));

ALTER POLICY meal_purchases_rw ON public.meal_purchases
  USING (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())))
  WITH CHECK (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())));

ALTER POLICY meal_subscriptions_school_rw ON public.meal_subscriptions
  USING (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())))
  WITH CHECK (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())));

ALTER POLICY payment_state_log_rw ON public.payment_state_log
  USING (EXISTS (SELECT 1 FROM payments p WHERE p.id = payment_state_log.payment_id AND p.school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM payments p WHERE p.id = payment_state_log.payment_id AND p.school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid()))));

ALTER POLICY salary_requests_school_rw ON public.salary_requests
  USING (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())))
  WITH CHECK (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())));

ALTER POLICY staff_invites_owner ON public.staff_invites
  USING (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())) AND (SELECT profiles.role FROM profiles WHERE profiles.id = (select auth.uid())) = 'owner'::user_role)
  WITH CHECK (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())) AND (SELECT profiles.role FROM profiles WHERE profiles.id = (select auth.uid())) = 'owner'::user_role);

ALTER POLICY student_fees_school_rw ON public.student_fees
  USING (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())))
  WITH CHECK (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())));

ALTER POLICY students_staff_read ON public.students
  USING (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())));

ALTER POLICY suppliers_rw ON public.suppliers
  USING (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())))
  WITH CHECK (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())));

ALTER POLICY notification_queue_staff_select ON public.notification_queue
  USING (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())) AND (SELECT profiles.role FROM profiles WHERE profiles.id = (select auth.uid())) = ANY (ARRAY['owner'::user_role,'admin'::user_role,'accountant'::user_role,'platform_admin'::user_role]));

ALTER POLICY journal_entries_staff_rw ON public.journal_entries
  USING (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())) AND (SELECT profiles.role FROM profiles WHERE profiles.id = (select auth.uid())) = ANY (ARRAY['owner'::user_role,'admin'::user_role,'accountant'::user_role]))
  WITH CHECK (school_id = (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid())) AND (SELECT profiles.role FROM profiles WHERE profiles.id = (select auth.uid())) = ANY (ARRAY['owner'::user_role,'admin'::user_role,'accountant'::user_role]));

ALTER POLICY payroll_runs_rw ON public.payroll_runs
  USING (school_id IN (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = ANY (ARRAY['owner'::user_role,'admin'::user_role,'accountant'::user_role])))
  WITH CHECK (school_id IN (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = ANY (ARRAY['owner'::user_role,'admin'::user_role,'accountant'::user_role])));

ALTER POLICY payroll_items_rw ON public.payroll_items
  USING (run_id IN (SELECT payroll_runs.id FROM payroll_runs WHERE payroll_runs.school_id IN (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = ANY (ARRAY['owner'::user_role,'admin'::user_role,'accountant'::user_role]))))
  WITH CHECK (run_id IN (SELECT payroll_runs.id FROM payroll_runs WHERE payroll_runs.school_id IN (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = ANY (ARRAY['owner'::user_role,'admin'::user_role,'accountant'::user_role]))));

ALTER POLICY payroll_settings_rw ON public.payroll_settings
  USING (school_id IN (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = ANY (ARRAY['owner'::user_role,'admin'::user_role,'accountant'::user_role])))
  WITH CHECK (school_id IN (SELECT profiles.school_id FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = ANY (ARRAY['owner'::user_role,'admin'::user_role])));

ALTER POLICY asst_conv_rw ON public.assistant_conversations
  USING (school_id = my_school_id() AND user_id = (select auth.uid()))
  WITH CHECK (school_id = my_school_id() AND user_id = (select auth.uid()));

ALTER POLICY asst_msg_rw ON public.assistant_messages
  USING (school_id = my_school_id() AND EXISTS (SELECT 1 FROM assistant_conversations c WHERE c.id = assistant_messages.conversation_id AND c.user_id = (select auth.uid())))
  WITH CHECK (school_id = my_school_id() AND EXISTS (SELECT 1 FROM assistant_conversations c WHERE c.id = assistant_messages.conversation_id AND c.user_id = (select auth.uid())));

ALTER POLICY profiles_self_read ON public.profiles
  USING (id = (select auth.uid()));

ALTER POLICY ps_parent_read ON public.parent_students
  USING (parent_id = (select auth.uid()));

ALTER POLICY own_consents_select ON public.legal_consents
  USING ((select auth.uid()) = user_id);

ALTER POLICY own_consents_insert ON public.legal_consents
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY payments_parent_read ON public.payments
  USING (fee_id IN (SELECT f.id FROM student_fees f JOIN parent_students ps ON ps.student_id = f.student_id WHERE ps.parent_id = (select auth.uid())));

ALTER POLICY cert_parent_read ON public.certificates
  USING (student_id IN (SELECT parent_students.student_id FROM parent_students WHERE parent_students.parent_id = (select auth.uid())));

ALTER POLICY certificate_requests_select ON public.certificate_requests
  USING (parent_id = (select auth.uid()) OR school_id = my_school_id());

ALTER POLICY pending_insert ON public.pending_payments
  WITH CHECK (guardian_id = (select auth.uid()) AND school_id = my_school_id());

ALTER POLICY pending_payments_guardian_update ON public.pending_payments
  USING (guardian_id = (select auth.uid()) AND status = 'pending'::text)
  WITH CHECK (guardian_id = (select auth.uid()) AND status = 'rejected'::text);

ALTER POLICY notif_update ON public.notifications
  USING ((audience = 'staff'::text AND school_id = my_school_id()) OR (audience = 'guardian'::text AND guardian_id = (select auth.uid())));

-- rusoompay_control schema

ALTER POLICY "members can read their orgs" ON rusoompay_control.organizations
  USING (id IN (SELECT org_members.organization_id FROM rusoompay_control.org_members WHERE org_members.user_id = (select auth.uid())));

ALTER POLICY "owners/admins can update their orgs" ON rusoompay_control.organizations
  USING (id IN (SELECT org_members.organization_id FROM rusoompay_control.org_members WHERE org_members.user_id = (select auth.uid()) AND org_members.role = ANY (ARRAY['owner'::rusoompay_control.org_role,'admin'::rusoompay_control.org_role])));

ALTER POLICY "authenticated users can create an org" ON rusoompay_control.organizations
  WITH CHECK ((select auth.uid()) IS NOT NULL);

ALTER POLICY "vendors are readable by any authenticated user" ON rusoompay_control.vendors
  USING ((select auth.uid()) IS NOT NULL);
