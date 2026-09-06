ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.backup_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bus_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cafeteria_billing ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.certificate_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.error_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.food_dispenses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.food_inventory ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.grade_fees ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.guardian_invites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.intelligence_flags ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inventory_dispenses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.legal_consents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.meal_orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.meal_purchases ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.meal_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payment_state_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pending_payments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.platform_countries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.promotion_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.receipt_verifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recommendation_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.salary_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.school_registrations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_school_rw ON public.accounts AS PERMISSIVE FOR ALL TO authenticated USING ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY asst_conv_rw ON public.assistant_conversations AS PERMISSIVE FOR ALL TO authenticated USING (((school_id = my_school_id()) AND (user_id = ( SELECT auth.uid() AS uid)))) WITH CHECK (((school_id = my_school_id()) AND (user_id = ( SELECT auth.uid() AS uid))));

CREATE POLICY asst_msg_rw ON public.assistant_messages AS PERMISSIVE FOR ALL TO authenticated USING (((school_id = my_school_id()) AND (EXISTS ( SELECT 1
   FROM assistant_conversations c
  WHERE ((c.id = assistant_messages.conversation_id) AND (c.user_id = ( SELECT auth.uid() AS uid))))))) WITH CHECK (((school_id = my_school_id()) AND (EXISTS ( SELECT 1
   FROM assistant_conversations c
  WHERE ((c.id = assistant_messages.conversation_id) AND (c.user_id = ( SELECT auth.uid() AS uid)))))));

CREATE POLICY backup_log_read ON public.backup_log AS PERMISSIVE FOR SELECT TO authenticated USING (((school_id = ( SELECT my_school_id() AS my_school_id)) AND (( SELECT my_role() AS my_role) = ANY (ARRAY['owner'::user_role, 'admin'::user_role]))));

CREATE POLICY bus_subscriptions_school_rw ON public.bus_subscriptions AS PERMISSIVE FOR ALL TO authenticated USING ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY buses_school_rw ON public.buses AS PERMISSIVE FOR ALL TO authenticated USING ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY employees_staff_read ON public.employees AS PERMISSIVE FOR SELECT TO authenticated USING ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY help_articles_admin_delete ON public.help_articles AS PERMISSIVE FOR DELETE TO authenticated USING ((my_role() = 'platform_admin'::user_role));

CREATE POLICY help_articles_admin_insert ON public.help_articles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((my_role() = 'platform_admin'::user_role));

CREATE POLICY help_articles_admin_update ON public.help_articles AS PERMISSIVE FOR UPDATE TO authenticated USING ((my_role() = 'platform_admin'::user_role)) WITH CHECK ((my_role() = 'platform_admin'::user_role));

CREATE POLICY help_articles_read ON public.help_articles AS PERMISSIVE FOR SELECT TO authenticated USING (((my_role() = 'platform_admin'::user_role) OR (is_published AND ((cardinality(role_scope) = 0) OR ((my_role())::text = ANY (role_scope))))));

CREATE POLICY inventory_items_school_rw ON public.inventory_items AS PERMISSIVE FOR ALL TO authenticated USING ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY journal_lines_rw ON public.journal_lines AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM journal_entries e
  WHERE ((e.id = journal_lines.entry_id) AND (e.school_id = ( SELECT profiles.school_id
           FROM profiles
          WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM journal_entries e
  WHERE ((e.id = journal_lines.entry_id) AND (e.school_id = ( SELECT profiles.school_id
           FROM profiles
          WHERE (profiles.id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY meal_orders_guardian_select ON public.meal_orders AS PERMISSIVE FOR SELECT TO authenticated USING ((((school_id = my_school_id()) AND (my_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role]))) OR (EXISTS ( SELECT 1
   FROM parent_students ps
  WHERE ((ps.student_id = meal_orders.student_id) AND (ps.parent_id = ( SELECT auth.uid() AS uid)))))));

CREATE POLICY meal_orders_staff_delete ON public.meal_orders AS PERMISSIVE FOR DELETE TO authenticated USING (((school_id = my_school_id()) AND (my_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role]))));

CREATE POLICY meal_orders_staff_insert ON public.meal_orders AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((school_id = my_school_id()) AND (my_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role]))));

CREATE POLICY meal_orders_staff_update ON public.meal_orders AS PERMISSIVE FOR UPDATE TO authenticated USING (((school_id = my_school_id()) AND (my_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role])))) WITH CHECK (((school_id = my_school_id()) AND (my_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role]))));

CREATE POLICY meal_plans_school_rw ON public.meal_plans AS PERMISSIVE FOR ALL TO authenticated USING ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY meal_purchases_rw ON public.meal_purchases AS PERMISSIVE FOR ALL TO authenticated USING ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY meal_subscriptions_school_rw ON public.meal_subscriptions AS PERMISSIVE FOR ALL TO authenticated USING ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY notification_queue_staff_select ON public.notification_queue AS PERMISSIVE FOR SELECT TO authenticated USING (((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))) = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role, 'platform_admin'::user_role]))));

CREATE POLICY payment_state_log_rw ON public.payment_state_log AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM payments p
  WHERE ((p.id = payment_state_log.payment_id) AND (p.school_id = ( SELECT profiles.school_id
           FROM profiles
          WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM payments p
  WHERE ((p.id = payment_state_log.payment_id) AND (p.school_id = ( SELECT profiles.school_id
           FROM profiles
          WHERE (profiles.id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY pending_payments_guardian_select ON public.pending_payments AS PERMISSIVE FOR SELECT TO authenticated USING ((guardian_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY plans_read_all ON public.plans AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY profiles_self_read ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((id = ( SELECT auth.uid() AS uid)));

CREATE POLICY promo_log_read ON public.promotion_log AS PERMISSIVE FOR SELECT TO authenticated USING (((school_id = my_school_id()) AND (my_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role]))));

CREATE POLICY rec_log_insert ON public.recommendation_log AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((school_id = my_school_id()) AND (my_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role]))));

CREATE POLICY rec_log_read ON public.recommendation_log AS PERMISSIVE FOR SELECT TO authenticated USING (((school_id = my_school_id()) AND (my_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'accountant'::user_role]))));

CREATE POLICY salary_requests_school_rw ON public.salary_requests AS PERMISSIVE FOR ALL TO authenticated USING ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY staff_invites_owner ON public.staff_invites AS PERMISSIVE FOR ALL TO authenticated USING (((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))) = 'owner'::user_role))) WITH CHECK (((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))) = 'owner'::user_role)));

CREATE POLICY student_fees_school_rw ON public.student_fees AS PERMISSIVE FOR ALL TO authenticated USING ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY students_staff_read ON public.students AS PERMISSIVE FOR SELECT TO authenticated USING ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY suppliers_rw ON public.suppliers AS PERMISSIVE FOR ALL TO authenticated USING ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
