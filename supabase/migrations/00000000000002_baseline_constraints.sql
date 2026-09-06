ALTER TABLE public.academic_years ADD CONSTRAINT academic_years_pkey PRIMARY KEY (id);

ALTER TABLE public.accounts ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);

ALTER TABLE public.announcements ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);

ALTER TABLE public.assistant_conversations ADD CONSTRAINT assistant_conversations_pkey PRIMARY KEY (id);

ALTER TABLE public.assistant_messages ADD CONSTRAINT assistant_messages_pkey PRIMARY KEY (id);

ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);

ALTER TABLE public.backup_log ADD CONSTRAINT backup_log_pkey PRIMARY KEY (school_id);

ALTER TABLE public.bus_subscriptions ADD CONSTRAINT bus_subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE public.buses ADD CONSTRAINT buses_pkey PRIMARY KEY (id);

ALTER TABLE public.cafeteria_billing ADD CONSTRAINT cafeteria_billing_pkey PRIMARY KEY (id);

ALTER TABLE public.certificate_requests ADD CONSTRAINT certificate_requests_pkey PRIMARY KEY (id);

ALTER TABLE public.certificates ADD CONSTRAINT certificates_pkey PRIMARY KEY (id);

ALTER TABLE public.employees ADD CONSTRAINT employees_pkey PRIMARY KEY (id);

ALTER TABLE public.error_log ADD CONSTRAINT error_log_pkey PRIMARY KEY (id);

ALTER TABLE public.feedback ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);

ALTER TABLE public.food_dispenses ADD CONSTRAINT food_dispenses_pkey PRIMARY KEY (id);

ALTER TABLE public.food_inventory ADD CONSTRAINT food_inventory_pkey PRIMARY KEY (id);

ALTER TABLE public.grade_fees ADD CONSTRAINT grade_fees_pkey PRIMARY KEY (id);

ALTER TABLE public.guardian_invites ADD CONSTRAINT guardian_invites_pkey PRIMARY KEY (id);

ALTER TABLE public.help_articles ADD CONSTRAINT help_articles_pkey PRIMARY KEY (id);

ALTER TABLE public.intelligence_flags ADD CONSTRAINT intelligence_flags_pkey PRIMARY KEY (school_id, engine);

ALTER TABLE public.inventory_dispenses ADD CONSTRAINT inventory_dispenses_pkey PRIMARY KEY (id);

ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);

ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);

ALTER TABLE public.journal_lines ADD CONSTRAINT journal_lines_pkey PRIMARY KEY (id);

ALTER TABLE public.legal_consents ADD CONSTRAINT legal_consents_pkey PRIMARY KEY (id);

ALTER TABLE public.meal_orders ADD CONSTRAINT meal_orders_pkey PRIMARY KEY (id);

ALTER TABLE public.meal_plans ADD CONSTRAINT meal_plans_pkey PRIMARY KEY (id);

ALTER TABLE public.meal_purchases ADD CONSTRAINT meal_purchases_pkey PRIMARY KEY (id);

ALTER TABLE public.meal_subscriptions ADD CONSTRAINT meal_subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE public.notification_queue ADD CONSTRAINT notification_queue_pkey PRIMARY KEY (id);

ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE public.parent_students ADD CONSTRAINT parent_students_pkey PRIMARY KEY (id);

ALTER TABLE public.payment_state_log ADD CONSTRAINT payment_state_log_pkey PRIMARY KEY (id);

ALTER TABLE public.payments ADD CONSTRAINT payments_pkey PRIMARY KEY (id);

ALTER TABLE public.payroll_items ADD CONSTRAINT payroll_items_pkey PRIMARY KEY (id);

ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_pkey PRIMARY KEY (id);

ALTER TABLE public.payroll_settings ADD CONSTRAINT payroll_settings_pkey PRIMARY KEY (school_id);

ALTER TABLE public.pending_payments ADD CONSTRAINT pending_payments_pkey PRIMARY KEY (id);

ALTER TABLE public.plans ADD CONSTRAINT plans_pkey PRIMARY KEY (code);

ALTER TABLE public.platform_countries ADD CONSTRAINT platform_countries_pkey PRIMARY KEY (code);

ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE public.promotion_log ADD CONSTRAINT promotion_log_pkey PRIMARY KEY (id);

ALTER TABLE public.rate_limits ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (key);

ALTER TABLE public.receipt_verifications ADD CONSTRAINT receipt_verifications_pkey PRIMARY KEY (id);

ALTER TABLE public.recommendation_log ADD CONSTRAINT recommendation_log_pkey PRIMARY KEY (id);

ALTER TABLE public.salary_requests ADD CONSTRAINT salary_requests_pkey PRIMARY KEY (id);

ALTER TABLE public.school_registrations ADD CONSTRAINT school_registrations_pkey PRIMARY KEY (id);

ALTER TABLE public.schools ADD CONSTRAINT schools_pkey PRIMARY KEY (id);

ALTER TABLE public.staff_invites ADD CONSTRAINT staff_invites_pkey PRIMARY KEY (id);

ALTER TABLE public.student_fees ADD CONSTRAINT student_fees_pkey PRIMARY KEY (id);

ALTER TABLE public.students ADD CONSTRAINT students_pkey PRIMARY KEY (id);

ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);

ALTER TABLE public.accounts ADD CONSTRAINT accounts_school_id_code_key UNIQUE (school_id, code);

ALTER TABLE public.bus_subscriptions ADD CONSTRAINT bus_subscriptions_student_id_key UNIQUE (student_id);

ALTER TABLE public.cafeteria_billing ADD CONSTRAINT cafeteria_billing_school_id_month_key UNIQUE (school_id, month);

ALTER TABLE public.employees ADD CONSTRAINT employees_school_id_code_key UNIQUE (school_id, code);

ALTER TABLE public.grade_fees ADD CONSTRAINT grade_fees_school_id_grade_key UNIQUE (school_id, grade);

ALTER TABLE public.guardian_invites ADD CONSTRAINT guardian_invites_school_id_phone_key UNIQUE (school_id, phone);

ALTER TABLE public.help_articles ADD CONSTRAINT help_articles_slug_key UNIQUE (slug);

ALTER TABLE public.legal_consents ADD CONSTRAINT legal_consents_user_id_document_type_version_key UNIQUE (user_id, document_type, version);

ALTER TABLE public.meal_orders ADD CONSTRAINT meal_orders_student_id_plan_id_meal_date_key UNIQUE (student_id, plan_id, meal_date);

ALTER TABLE public.parent_students ADD CONSTRAINT parent_students_parent_id_student_id_key UNIQUE (parent_id, student_id);

ALTER TABLE public.receipt_verifications ADD CONSTRAINT receipt_verifications_reference_number_key UNIQUE (reference_number);

ALTER TABLE public.staff_invites ADD CONSTRAINT staff_invites_school_id_email_key UNIQUE (school_id, email);

ALTER TABLE public.students ADD CONSTRAINT students_school_id_code_key UNIQUE (school_id, code);

ALTER TABLE public.academic_years ADD CONSTRAINT academic_years_dates_check CHECK ((start_date < end_date));

ALTER TABLE public.assistant_messages ADD CONSTRAINT assistant_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])));

ALTER TABLE public.employees ADD CONSTRAINT employees_department_check CHECK ((department = ANY (ARRAY['management'::text, 'admin'::text, 'teaching'::text, 'support'::text])));

ALTER TABLE public.employees ADD CONSTRAINT employees_id_type_check CHECK ((id_type = ANY (ARRAY['CIVIL'::text, 'PASSPORT'::text])));

ALTER TABLE public.employees ADD CONSTRAINT employees_nationality_check CHECK ((nationality = ANY (ARRAY['OM'::text, 'NON_OM'::text])));

ALTER TABLE public.employees ADD CONSTRAINT employees_org_level_check CHECK (((org_level >= 1) AND (org_level <= 3)));

ALTER TABLE public.error_log ADD CONSTRAINT el_sev_chk CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text, 'critical'::text])));

ALTER TABLE public.food_dispenses ADD CONSTRAINT food_dispenses_qty_check CHECK ((qty > (0)::numeric));

ALTER TABLE public.food_inventory ADD CONSTRAINT food_inventory_qty_check CHECK ((qty >= (0)::numeric));

ALTER TABLE public.inventory_dispenses ADD CONSTRAINT inventory_dispenses_qty_check CHECK ((qty > 0));

ALTER TABLE public.legal_consents ADD CONSTRAINT legal_consents_document_type_check CHECK ((document_type = ANY (ARRAY['terms'::text, 'privacy'::text])));

ALTER TABLE public.meal_plans ADD CONSTRAINT meal_plans_plan_type_check CHECK ((plan_type = ANY (ARRAY['annual'::text, 'monthly'::text])));

ALTER TABLE public.meal_subscriptions ADD CONSTRAINT meal_subscriptions_billing_method_check CHECK ((billing_method = ANY (ARRAY['with_tuition'::text, 'separate'::text])));

ALTER TABLE public.notification_queue ADD CONSTRAINT nq_channel_chk CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text, 'whatsapp'::text, 'push'::text])));

ALTER TABLE public.notification_queue ADD CONSTRAINT nq_status_chk CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'dead'::text])));

ALTER TABLE public.payments ADD CONSTRAINT payments_amount_check CHECK ((amount > (0)::numeric));

ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_period_month_check CHECK (((period_month >= 1) AND (period_month <= 12)));

ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_period_year_check CHECK (((period_year >= 2020) AND (period_year <= 2100)));

ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'paid'::text, 'cancelled'::text])));

ALTER TABLE public.pending_payments ADD CONSTRAINT pending_payments_amount_check CHECK ((amount > (0)::numeric));

ALTER TABLE public.pending_payments ADD CONSTRAINT pp_txn_state_chk CHECK ((txn_state = ANY (ARRAY['pending'::text, 'processing'::text, 'paid'::text, 'failed'::text, 'refunded'::text])));

ALTER TABLE public.platform_countries ADD CONSTRAINT platform_countries_vat_mode_check CHECK ((vat_mode = ANY (ARRAY['mandatory'::text, 'optional'::text, 'none'::text])));

ALTER TABLE public.profiles ADD CONSTRAINT chk_full_name_length CHECK (((full_name IS NULL) OR ((length(TRIM(BOTH FROM full_name)) >= 1) AND (length(TRIM(BOTH FROM full_name)) <= 100))));

ALTER TABLE public.profiles ADD CONSTRAINT chk_full_name_no_html CHECK (((full_name IS NULL) OR (full_name !~ '<[^>]*>'::text)));

ALTER TABLE public.profiles ADD CONSTRAINT chk_phone_format CHECK (((phone IS NULL) OR (phone = ''::text) OR (phone ~ '^[0-9]{7,15}$'::text)));

ALTER TABLE public.receipt_verifications ADD CONSTRAINT receipt_verifications_verification_status_check CHECK ((verification_status = ANY (ARRAY['approved'::text, 'suspicious'::text, 'rejected'::text])));

ALTER TABLE public.school_registrations ADD CONSTRAINT school_registrations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));

ALTER TABLE public.school_registrations ADD CONSTRAINT school_registrations_verification_status_check CHECK ((verification_status = ANY (ARRAY['approved'::text, 'suspicious'::text, 'rejected'::text])));

ALTER TABLE public.students ADD CONSTRAINT students_discount_pct_range CHECK (((discount_pct >= (0)::numeric) AND (discount_pct <= (100)::numeric)));

ALTER TABLE public.students ADD CONSTRAINT students_grade_valid CHECK ((grade = ANY (ARRAY['روضة'::text, 'تمهيدي'::text, 'تجهيزي'::text, 'الأول'::text, 'الثاني'::text, 'الثالث'::text, 'الرابع'::text, 'الخامس'::text, 'السادس'::text, 'السابع'::text, 'الثامن'::text, 'التاسع'::text, 'العاشر'::text, 'الحادي عشر'::text, 'الثاني عشر'::text])));

ALTER TABLE public.students ADD CONSTRAINT students_section_valid CHECK (((section IS NULL) OR (section = ANY (ARRAY['أ'::text, 'ب'::text, 'ج'::text, 'د'::text, 'هـ'::text, 'و'::text, 'ز'::text, 'ح'::text, 'ط'::text, 'ي'::text, '١'::text, '٢'::text, '٣'::text, '٤'::text, '٥'::text, '٦'::text, '٧'::text, '٨'::text, '٩'::text, '١٠'::text, 'A'::text, 'B'::text, 'C'::text, 'D'::text, 'E'::text, 'F'::text, 'G'::text, 'H'::text, 'I'::text, 'J'::text, '1'::text, '2'::text, '3'::text, '4'::text, '5'::text, '6'::text, '7'::text, '8'::text, '9'::text, '10'::text]))));

ALTER TABLE public.students ADD CONSTRAINT students_transport_type_check CHECK ((transport_type = ANY (ARRAY['none'::text, 'school'::text, 'driver'::text, 'private'::text])));

ALTER TABLE public.academic_years ADD CONSTRAINT academic_years_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.accounts ADD CONSTRAINT accounts_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.announcements ADD CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);

ALTER TABLE public.assistant_conversations ADD CONSTRAINT assistant_conversations_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.assistant_conversations ADD CONSTRAINT assistant_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.assistant_messages ADD CONSTRAINT assistant_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES assistant_conversations(id) ON DELETE CASCADE;

ALTER TABLE public.assistant_messages ADD CONSTRAINT assistant_messages_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id);

ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.bus_subscriptions ADD CONSTRAINT bus_subscriptions_bus_id_fkey FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE;

ALTER TABLE public.bus_subscriptions ADD CONSTRAINT bus_subscriptions_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.bus_subscriptions ADD CONSTRAINT bus_subscriptions_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE public.buses ADD CONSTRAINT buses_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.cafeteria_billing ADD CONSTRAINT cafeteria_billing_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.certificate_requests ADD CONSTRAINT certificate_requests_certificate_id_fkey FOREIGN KEY (certificate_id) REFERENCES certificates(id);

ALTER TABLE public.certificate_requests ADD CONSTRAINT certificate_requests_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES profiles(id);

ALTER TABLE public.certificate_requests ADD CONSTRAINT certificate_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES profiles(id);

ALTER TABLE public.certificate_requests ADD CONSTRAINT certificate_requests_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id);

ALTER TABLE public.certificate_requests ADD CONSTRAINT certificate_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id);

ALTER TABLE public.certificates ADD CONSTRAINT certificates_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES profiles(id);

ALTER TABLE public.certificates ADD CONSTRAINT certificates_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.certificates ADD CONSTRAINT certificates_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE public.employees ADD CONSTRAINT employees_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE public.employees ADD CONSTRAINT employees_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.error_log ADD CONSTRAINT error_log_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL;

ALTER TABLE public.feedback ADD CONSTRAINT feedback_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id);

ALTER TABLE public.feedback ADD CONSTRAINT feedback_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.food_dispenses ADD CONSTRAINT food_dispenses_dispensed_by_fkey FOREIGN KEY (dispensed_by) REFERENCES auth.users(id);

ALTER TABLE public.food_dispenses ADD CONSTRAINT food_dispenses_item_id_fkey FOREIGN KEY (item_id) REFERENCES food_inventory(id) ON DELETE CASCADE;

ALTER TABLE public.food_dispenses ADD CONSTRAINT food_dispenses_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.food_inventory ADD CONSTRAINT food_inventory_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.grade_fees ADD CONSTRAINT grade_fees_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.guardian_invites ADD CONSTRAINT guardian_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);

ALTER TABLE public.guardian_invites ADD CONSTRAINT guardian_invites_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.intelligence_flags ADD CONSTRAINT intelligence_flags_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.inventory_dispenses ADD CONSTRAINT inventory_dispenses_dispensed_by_fkey FOREIGN KEY (dispensed_by) REFERENCES auth.users(id);

ALTER TABLE public.inventory_dispenses ADD CONSTRAINT inventory_dispenses_item_id_fkey FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE;

ALTER TABLE public.inventory_dispenses ADD CONSTRAINT inventory_dispenses_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);

ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_fee_id_fkey FOREIGN KEY (fee_id) REFERENCES student_fees(id) ON DELETE SET NULL;

ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_reversed_by_entry_fkey FOREIGN KEY (reversed_by_entry) REFERENCES journal_entries(id) ON DELETE SET NULL;

ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_reverses_entry_fkey FOREIGN KEY (reverses_entry) REFERENCES journal_entries(id) ON DELETE SET NULL;

ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.journal_lines ADD CONSTRAINT journal_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id);

ALTER TABLE public.journal_lines ADD CONSTRAINT journal_lines_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE;

ALTER TABLE public.journal_lines ADD CONSTRAINT journal_lines_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.legal_consents ADD CONSTRAINT legal_consents_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL;

ALTER TABLE public.legal_consents ADD CONSTRAINT legal_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.meal_orders ADD CONSTRAINT meal_orders_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES meal_plans(id);

ALTER TABLE public.meal_orders ADD CONSTRAINT meal_orders_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id);

ALTER TABLE public.meal_orders ADD CONSTRAINT meal_orders_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id);

ALTER TABLE public.meal_plans ADD CONSTRAINT meal_plans_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.meal_purchases ADD CONSTRAINT meal_purchases_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE public.meal_purchases ADD CONSTRAINT meal_purchases_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id);

ALTER TABLE public.meal_purchases ADD CONSTRAINT meal_purchases_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.meal_purchases ADD CONSTRAINT meal_purchases_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

ALTER TABLE public.meal_subscriptions ADD CONSTRAINT meal_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES meal_plans(id) ON DELETE CASCADE;

ALTER TABLE public.meal_subscriptions ADD CONSTRAINT meal_subscriptions_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.meal_subscriptions ADD CONSTRAINT meal_subscriptions_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE public.notification_queue ADD CONSTRAINT notification_queue_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_guardian_id_fkey FOREIGN KEY (guardian_id) REFERENCES profiles(id);

ALTER TABLE public.notifications ADD CONSTRAINT notifications_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.parent_students ADD CONSTRAINT parent_students_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public.parent_students ADD CONSTRAINT parent_students_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.parent_students ADD CONSTRAINT parent_students_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE public.payment_state_log ADD CONSTRAINT payment_state_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id);

ALTER TABLE public.payment_state_log ADD CONSTRAINT payment_state_log_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES pending_payments(id) ON DELETE CASCADE;

ALTER TABLE public.payment_state_log ADD CONSTRAINT payment_state_log_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.payments ADD CONSTRAINT payments_fee_id_fkey FOREIGN KEY (fee_id) REFERENCES student_fees(id) ON DELETE CASCADE;

ALTER TABLE public.payments ADD CONSTRAINT payments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES profiles(id);

ALTER TABLE public.payments ADD CONSTRAINT payments_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.payroll_items ADD CONSTRAINT payroll_items_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);

ALTER TABLE public.payroll_items ADD CONSTRAINT payroll_items_run_id_fkey FOREIGN KEY (run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE;

ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id);

ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_payment_journal_entry_id_fkey FOREIGN KEY (payment_journal_entry_id) REFERENCES journal_entries(id);

ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.payroll_settings ADD CONSTRAINT payroll_settings_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.pending_payments ADD CONSTRAINT pending_payments_fee_id_fkey FOREIGN KEY (fee_id) REFERENCES student_fees(id) ON DELETE CASCADE;

ALTER TABLE public.pending_payments ADD CONSTRAINT pending_payments_guardian_id_fkey FOREIGN KEY (guardian_id) REFERENCES profiles(id);

ALTER TABLE public.pending_payments ADD CONSTRAINT pending_payments_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES profiles(id);

ALTER TABLE public.pending_payments ADD CONSTRAINT pending_payments_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_impersonating_school_id_fkey FOREIGN KEY (impersonating_school_id) REFERENCES schools(id);

ALTER TABLE public.profiles ADD CONSTRAINT profiles_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.receipt_verifications ADD CONSTRAINT receipt_verifications_school_registration_id_fkey FOREIGN KEY (school_registration_id) REFERENCES school_registrations(id) ON DELETE CASCADE;

ALTER TABLE public.salary_requests ADD CONSTRAINT salary_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES profiles(id);

ALTER TABLE public.salary_requests ADD CONSTRAINT salary_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE public.salary_requests ADD CONSTRAINT salary_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES profiles(id);

ALTER TABLE public.salary_requests ADD CONSTRAINT salary_requests_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.staff_invites ADD CONSTRAINT staff_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES profiles(id);

ALTER TABLE public.staff_invites ADD CONSTRAINT staff_invites_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.student_fees ADD CONSTRAINT student_fees_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL;

ALTER TABLE public.student_fees ADD CONSTRAINT student_fees_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.student_fees ADD CONSTRAINT student_fees_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE public.students ADD CONSTRAINT students_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
