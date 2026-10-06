# Graph Report - repo  (2026-10-06)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1839 nodes · 3274 edges · 259 communities (109 shown, 150 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ef45b253`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 146 edges
2. `next` - 92 edges
3. `react` - 90 edges
4. `createClient()` - 65 edges
5. `isStaff()` - 25 edges
6. `Role` - 21 edges
7. `ControlCenter()` - 19 edges
8. `EmployeesPage()` - 18 edges
9. `printReport()` - 17 edges
10. `TransportClient()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `ReportTable()` --indirect_call--> `employeeTypeLabel()`  [INFERRED]
  app/(app)/accounting/PeriodReports.tsx → lib/employee-types.ts
- `handleLogout()` --calls--> `createClient()`  [EXTRACTED]
  app/(app)/AppShell.tsx → lib/supabase-client.ts
- `stop()` --calls--> `createClient()`  [EXTRACTED]
  components/ImpersonationBar.tsx → lib/supabase-client.ts
- `ForecastPanel()` --calls--> `createClient()`  [EXTRACTED]
  app/(app)/accounting/ForecastPanel.tsx → lib/supabase-client.ts
- `PayrollYearlyReport()` --calls--> `createClient()`  [EXTRACTED]
  app/(app)/accounting/PayrollYearlyReport.tsx → lib/supabase-client.ts

## Import Cycles
- None detected.

## Communities (259 total, 150 thin omitted)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (54): public.academic_years, public.accounts, public.announcements, public.assistant_conversations, public.assistant_messages, public.audit_log, public.backup_log, public.bus_subscriptions (+46 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (37): badge(), btnGhost, btnGold, CafeteriaClient(), addPlan(), bill(), refresh(), removeSub() (+29 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (30): public.add_annual_meal_fee(), public.add_student(), public.approve_certificate_request(), public.bill_cafeteria(), public.bill_cafeteria_student(), public.cashflow_forecast(), public.collection_analytics(), public.daily_payments_report() (+22 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (35): getSupabaseAdmin(), POST(), dynamic, normalizePhone(), POST(), fmt(), POST(), serviceClient() (+27 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (31): recordConsent(), LoginPage(), finishLogin(), handleLogin(), needsMfa(), verifyMfa(), COUNTRY_CUR, RegisterPage() (+23 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (16): Row, FB, KIND_LABEL, PRIORITY_LABEL, METHOD_LABEL, Pending, Fee, MONTHS (+8 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (30): addDays(), btnLite, btnPrint, CUR_DEC, CUR_SYM, DailyPaymentsReport(), printReport(), dateInput (+22 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (15): Bank, BankSettings(), BranchManager(), ChangePassword(), PasswordRequirement, GradePricing(), Engine, IntelligencePanel() (+7 more)

### Community 9 - "Community 9"
Cohesion: 0.11
Nodes (18): POST(), ROLE_AR, dynamic, GET(), dynamic, GET(), POST(), FeedbackClient() (+10 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (20): authorized(), dynamic, GET(), maxDuration, ActivityPagination(), navBtn, ActivityRow, ActivityTable() (+12 more)

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (21): AccountingTabKey, AccountingTabs(), TABS, AccountingPage(), KPI(), Row(), DashboardPage(), curSymbol() (+13 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (20): JournalForm(), allowedSide(), onAccountChange(), setLine(), sideOf(), Line, PAYROLL_LOCKED_CODES, Side (+12 more)

### Community 13 - "Community 13"
Cohesion: 0.15
Nodes (22): EmpRow, esc(), KINDS, MONTHS, nowYm(), PAY_STATUS, PAY_STATUS_STYLE, payCount() (+14 more)

### Community 14 - "Community 14"
Cohesion: 0.14
Nodes (19): Bus, MealPlan, SPECIAL_CASE_SUGGESTIONS, Bus, EditStudent(), MealPlan, SPECIAL_CASE_SUGGESTIONS, splitPhone() (+11 more)

### Community 15 - "Community 15"
Cohesion: 0.13
Nodes (16): AppShell(), handleLogout(), NAV, NavEntry, NavGroup, NavLeaf, toRgb(), WA_MSG (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.09
Nodes (22): bar, box, chiefCard, col, colHead, cols, countPill, DEPTS (+14 more)

### Community 17 - "Community 17"
Cohesion: 0.11
Nodes (17): public.accept_staff_invite(), public.approve_payroll_run(), public.block_approved_payroll_items(), public.cancel_payroll_run(), public.export_wps_header(), public.export_wps_rows(), public.is_platform_admin(), public.link_parent_by_email() (+9 more)

### Community 18 - "Community 18"
Cohesion: 0.13
Nodes (18): AR_DIGITS, ARROWS, cache, DEFAULT_LANGUAGE, ENGLISH_ENABLED, exact, Language, LANGUAGE_STORAGE_KEY (+10 more)

### Community 19 - "Community 19"
Cohesion: 0.10
Nodes (15): Forecast, ForecastPanel(), Month, LazyForecastPanel, Item, ITEMS, NAV_ICONS, NavKey (+7 more)

### Community 20 - "Community 20"
Cohesion: 0.15
Nodes (15): EditModal(), onIbanChange(), submit(), Emp, EmployeesTable(), saveEdit(), fmt(), payslip() (+7 more)

### Community 21 - "Community 21"
Cohesion: 0.30
Nodes (13): BundleStatusNotice(), Service, TEXT, CafeteriaPage(), InventoryPage(), employeesPayrollTabs(), schoolServicesTabs(), ModuleTabs() (+5 more)

### Community 22 - "Community 22"
Cohesion: 0.17
Nodes (12): AddEmployee(), InsuranceSettings(), EmployeesPage(), Sum(), PERMISSIONS, ROLE_LABEL, StaffPermissionsManager(), StaffRow (+4 more)

### Community 23 - "Community 23"
Cohesion: 0.11
Nodes (13): BankRow(), Cert, CERT_KIND_LABEL, CertRequest, Child, Fee, fmt(), METHOD_LABEL (+5 more)

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (16): GradeFee, input, STYLE_KEYS, AR_LETTERS, AR_NUMBERS, CountryCode, DEFAULT_SECTION_STYLES, EN_LETTERS (+8 more)

### Community 25 - "Community 25"
Cohesion: 0.16
Nodes (14): idx_food_dispenses_dispensed_by, idx_food_dispenses_item_id, idx_food_dispenses_school_id, idx_journal_entries_created_by, idx_journal_entries_fee_id, idx_journal_entries_reversed_by_entry, idx_journal_entries_reverses_entry, idx_journal_entries_school_date (+6 more)

### Community 26 - "Community 26"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 27 - "Community 27"
Cohesion: 0.15
Nodes (16): callClaude(), callClaudeNoTools(), checkRateLimit(), ClaudeMessage, dynamic, getSupabase(), maxDuration, POST() (+8 more)

### Community 28 - "Community 28"
Cohesion: 0.12
Nodes (13): public.available_plans(), public.calc_social_insurance(), public.control_center_subscriptions(), public.food_purchase(), public.my_school_feedback(), public.plan_usage(), public.platform_audit_log(), public.platform_feedback() (+5 more)

### Community 29 - "Community 29"
Cohesion: 0.21
Nodes (16): applyDocumentLanguage(), ATTRIBUTES, attrState, isIgnored(), LanguageContext, LanguageContextValue, LanguageProvider(), NodeState (+8 more)

### Community 30 - "Community 30"
Cohesion: 0.13
Nodes (9): no_delete_journal, no_delete_lines, no_update_journal, no_update_lines, trg_accrue_student_fee, trg_block_approved_items, trg_sync_pasi_flag, trg_touch_asst_conv (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.16
Nodes (10): authorized(), dynamic, GET(), maxDuration, Channel, deliver(), dispatch, NotificationJob (+2 more)

### Community 32 - "Community 32"
Cohesion: 0.23
Nodes (11): dynamic, GET(), dynamic, POST(), dynamic, POST(), POST(), checkRateLimit() (+3 more)

### Community 33 - "Community 33"
Cohesion: 0.18
Nodes (12): BranchRow, BranchSwitcher(), switchTo(), btn(), RunActions(), call(), exportWps(), BundleTransportMealsSetting() (+4 more)

### Community 34 - "Community 34"
Cohesion: 0.23
Nodes (8): sb, anonClient(), createTestFixture(), serviceClient(), TestFixture, sb, sb, sb

### Community 35 - "Community 35"
Cohesion: 0.21
Nodes (13): public.acc_id(), public.account_balances(), public.balance_sheet_asof(), public.check_journal_balanced(), public.ensure_cafeteria_account(), public.ensure_inventory_accounts(), public.ensure_meal_cost_accounts(), public.ensure_transport_account() (+5 more)

### Community 36 - "Community 36"
Cohesion: 0.20
Nodes (13): ControlCenter(), Empty(), Grid(), Kpi(), Mini(), Nums, Pending, PLAN_AR (+5 more)

### Community 37 - "Community 37"
Cohesion: 0.25
Nodes (13): OK_TYPES, buildStyle(), cardHtml(), CardStudent, escapeHtml(), isValidHex(), openPrintWindow(), paginate() (+5 more)

### Community 38 - "Community 38"
Cohesion: 0.21
Nodes (13): CertificatesButton(), School, Bus, ClassGroup, exportClassPDF(), MealPlan, Stat(), statusColor() (+5 more)

### Community 39 - "Community 39"
Cohesion: 0.20
Nodes (12): ROUTES, SmartRec, Alert, CopilotData, ImpactData, MiniKpi(), num(), num3() (+4 more)

### Community 40 - "Community 40"
Cohesion: 0.21
Nodes (11): printCert(), PrintButton(), Cert, printCert(), KIND_BADGE, Req, School, Column (+3 more)

### Community 41 - "Community 41"
Cohesion: 0.18
Nodes (10): METHOD_LABEL, MonthDetail, MonthPayment, MonthRow, PaymentTracker(), handlePrint(), SchoolInfo, printPaymentTracker() (+2 more)

### Community 42 - "Community 42"
Cohesion: 0.14
Nodes (13): btnGhost, btnGold, btnSm, Bus, BusForm, card, emptyForm, fmt() (+5 more)

### Community 43 - "Community 43"
Cohesion: 0.15
Nodes (11): AddFeeModal(), AR_COLLATOR, CUR_DEC, CUR_SYM, EditablePayment, Fee, METHOD_OPTIONS, PayStatus (+3 more)

### Community 44 - "Community 44"
Cohesion: 0.15
Nodes (12): autoInput, btnGold, btnSm, btnTeal, card, CategoryReportRow, DISPENSE_REASONS, input (+4 more)

### Community 45 - "Community 45"
Cohesion: 0.22
Nodes (6): AddStudent(), LinkParent(), Student, StudentsPage(), buildSectionOptions(), gradeOrder()

### Community 46 - "Community 46"
Cohesion: 0.19
Nodes (10): BANK_ACCOUNT, BankRow(), Plan, PlansManager(), confirmBankTransfer(), notifyAdmin(), Row(), STATUS (+2 more)

### Community 47 - "Community 47"
Cohesion: 0.23
Nodes (11): AiAssistant(), Dot(), HIDDEN_PATHS, Msg, renderContent(), renderInline(), S, SparkIcon() (+3 more)

### Community 48 - "Community 48"
Cohesion: 0.23
Nodes (9): Props, PAYMENT_CONFIG, PLAN_PRICES, checkDateValid(), checkRecipientMatch(), normalize(), ReceiptVerificationResult, verifyReceipt() (+1 more)

### Community 49 - "Community 49"
Cohesion: 0.15
Nodes (12): name, private, version, autoprefixer, pdfmake, postcss, react-dom, tailwindcss (+4 more)

### Community 50 - "Community 50"
Cohesion: 0.15
Nodes (13): dependencies, @anthropic-ai/sdk, framer-motion, lucide-react, next, pdfmake, react, react-dom (+5 more)

### Community 51 - "Community 51"
Cohesion: 0.15
Nodes (10): public.approve_payment(), public.check_rate_limit(), public._confirm_thawani_payment_core(), public.mark_gateway_payment_failed(), public.mark_queue_result(), public.platform_error_log(), public.reject_payment(), public.set_employee_manager() (+2 more)

### Community 52 - "Community 52"
Cohesion: 0.20
Nodes (7): currentMonthRange(), FeesManager(), clearAll(), printMonthlyReport(), nameKey(), RefundButton(), printMonthlyPaymentReport()

### Community 53 - "Community 53"
Cohesion: 0.23
Nodes (8): InvoiceModal(), downloadPDF(), InvoiceButton(), handle(), MonthInvoices(), printOne(), generateInvoice(), InvoiceData

### Community 54 - "Community 54"
Cohesion: 0.24
Nodes (8): ClickSound(), onClick(), playClick(), cairo, metadata, RootLayout(), viewport, PWARegister()

### Community 55 - "Community 55"
Cohesion: 0.17
Nodes (8): public.intelligence_enabled(), public.intelligence_status(), public.inventory_category_report(), public.inventory_dispense(), public.inventory_dispenses_list(), public.inventory_list(), public.inventory_purchase(), public.inventory_sell()

### Community 56 - "Community 56"
Cohesion: 0.20
Nodes (8): daysUntil(), INTERVAL_AR, OpsSubscriptionsPanel(), OrgPlan, PLAN_AR, STATUS_AR, SubItem, Summary

### Community 57 - "Community 57"
Cohesion: 0.24
Nodes (6): PageNav(), TransportClient(), refresh(), removeSub(), saveBus(), subscribe()

### Community 58 - "Community 58"
Cohesion: 0.33
Nodes (8): CopilotWithActions(), CollectionChart(), DashboardClient(), Data, eventMeta(), Kpi(), QuickAction(), relTime()

### Community 59 - "Community 59"
Cohesion: 0.27
Nodes (8): COLOR, fmtAgo(), Gauge(), Health, LABEL, minsAgo(), Status, SystemHealthPanel()

### Community 60 - "Community 60"
Cohesion: 0.22
Nodes (7): HEADERS, ImportStudents(), onFile(), KEYS, parseCSV(), Result, Row

### Community 61 - "Community 61"
Cohesion: 0.29
Nodes (5): onRequestError, register(), nextConfig, { withSentryConfig }, @sentry/nextjs

### Community 62 - "Community 62"
Cohesion: 0.20
Nodes (6): errorRate, loginTime, options, errorRate, healthLatency, options

### Community 63 - "Community 63"
Cohesion: 0.28
Nodes (7): levelBg(), levelColor(), RiskData, RiskIndicator(), RiskItem, td, th

### Community 64 - "Community 64"
Cohesion: 0.33
Nodes (7): fmt(), InventoryClient(), addItem(), execMove(), loadCategories(), refresh(), unitText()

### Community 65 - "Community 65"
Cohesion: 0.33
Nodes (8): NewRunButton(), create(), fmt(), MONTHS, PayrollPage(), STATUS, Td(), Th()

### Community 66 - "Community 66"
Cohesion: 0.33
Nodes (5): WpsSettingsPage(), Settings, WpsSettingsForm(), SubscriptionPage(), isOwner()

### Community 67 - "Community 67"
Cohesion: 0.33
Nodes (7): InviteParents(), copyMsg(), messageFor(), normalizePhone(), sendInvite(), stripGccCode(), toEnglishDigits()

### Community 68 - "Community 68"
Cohesion: 0.36
Nodes (8): BANK, CopyBtn(), PLANS, Step1(), Step2(), Step3(), StepBar(), SubscribePage()

### Community 69 - "Community 69"
Cohesion: 0.22
Nodes (9): devDependencies, autoprefixer, postcss, tailwindcss, @types/node, @types/pdfmake, @types/react, typescript (+1 more)

### Community 70 - "Community 70"
Cohesion: 0.32
Nodes (7): CashPayment(), sendThankYou(), submit(), Fee, METHOD_LABEL, normalizePhone(), RecordPaymentResult

### Community 71 - "Community 71"
Cohesion: 0.43
Nodes (7): fmt(), MONTHS, RunPage(), STATUS, Sum(), Td(), Th()

### Community 72 - "Community 72"
Cohesion: 0.39
Nodes (6): PlatformPage(), AuditRow, FeedbackRow, SchoolStat, Sub, isPlatformAdmin()

### Community 73 - "Community 73"
Cohesion: 0.32
Nodes (6): C, Factor, MfaSetup(), loadFactors(), removeFactor(), verifyEnroll()

### Community 74 - "Community 74"
Cohesion: 0.32
Nodes (4): idx_staff_invites_email, public.accept_staff_invite(), public.invite_staff(), public.staff_invites

### Community 75 - "Community 75"
Cohesion: 0.43
Nodes (7): CertificatesModal(), approveReq(), generate(), load(), rejectReq(), remove(), upload()

### Community 76 - "Community 76"
Cohesion: 0.36
Nodes (5): Box(), currentAcademicYear(), nextGrade(), PromoteStudents(), Student

### Community 77 - "Community 77"
Cohesion: 0.38
Nodes (3): fmt(), SchoolManageModal(), Stat()

### Community 78 - "Community 78"
Cohesion: 0.33
Nodes (6): Check, CHECKS, COMMON, passwordIssue(), ResetPasswordPage(), submit()

### Community 79 - "Community 79"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, test:watch

### Community 80 - "Community 80"
Cohesion: 0.33
Nodes (5): public.mark_meal_purchase_paid(), public.meal_cost_report(), public.meal_purchases_list(), public.meal_suppliers(), public.save_meal_purchase()

### Community 81 - "Community 81"
Cohesion: 0.38
Nodes (3): public.add_employee(), public.employees_classification(), public.update_employee()

### Community 82 - "Community 82"
Cohesion: 0.33
Nodes (3): Entry, JournalList(), SearchResult

### Community 83 - "Community 83"
Cohesion: 0.40
Nodes (3): fmt(), Req, SalaryRequests()

### Community 84 - "Community 84"
Cohesion: 0.33
Nodes (3): ErrorLogSection(), resolve(), FeedbackSection()

### Community 85 - "Community 85"
Cohesion: 0.47
Nodes (5): Invite, StaffInvites(), invite(), load(), remove()

### Community 86 - "Community 86"
Cohesion: 0.47
Nodes (5): Dashboard(), GlassCard(), GlassCardProps, RusoomHero(), framer-motion

### Community 88 - "Community 88"
Cohesion: 0.33
Nodes (5): academic_years_one_current_per_school, academic_years_school_label_key, idx_academic_years_school, idx_academic_years_school_current, idx_academic_years_school_start

### Community 89 - "Community 89"
Cohesion: 0.33
Nodes (5): idx_certificate_requests_certificate_id, idx_certificate_requests_parent, idx_certificate_requests_reviewed_by, idx_certificate_requests_school_status, idx_certificate_requests_student_id

### Community 90 - "Community 90"
Cohesion: 0.33
Nodes (5): idx_fees_school, idx_fees_school_academic_year, idx_fees_school_created, idx_fees_student, idx_fees_student_academic_year

### Community 91 - "Community 91"
Cohesion: 0.33
Nodes (5): idx_meal_purchases_created_by, idx_meal_purchases_journal_entry_id, idx_meal_purchases_period, idx_meal_purchases_school, idx_meal_purchases_supplier_id

### Community 92 - "Community 92"
Cohesion: 0.33
Nodes (5): idx_payroll_runs_created_by, idx_payroll_runs_journal_entry_id, idx_payroll_runs_payment_journal_entry_id, idx_payroll_runs_school_id, uq_payroll_run_period

### Community 93 - "Community 93"
Cohesion: 0.33
Nodes (5): idx_pending_payments_fee_id, idx_pending_payments_guardian_id, idx_pending_payments_resolved_by, idx_pending_school, idx_pp_idem

### Community 95 - "Community 95"
Cohesion: 0.50
Nodes (4): Article, HelpCenterPage(), P, toAr()

### Community 97 - "Community 97"
Cohesion: 0.40
Nodes (4): help_articles_category_idx, help_articles_keywords_idx, help_articles_published_idx, help_articles_route_idx

### Community 98 - "Community 98"
Cohesion: 0.40
Nodes (4): idx_feedback_author_id, idx_feedback_created, idx_feedback_school, idx_feedback_status

### Community 99 - "Community 99"
Cohesion: 0.40
Nodes (4): idx_nq_dedupe, idx_nq_due, idx_nq_school, uq_notification_queue_dedupe_key

### Community 100 - "Community 100"
Cohesion: 0.40
Nodes (4): idx_salary_requests_decided_by, idx_salary_requests_employee_id, idx_salary_requests_requested_by, idx_salreq_school

### Community 101 - "Community 101"
Cohesion: 0.50
Nodes (4): checkThawaniStatus(), FetchLike, sb, simulateWebhook()

### Community 103 - "Community 103"
Cohesion: 0.67
Nodes (3): BusRoster(), load(), toggle()

### Community 105 - "Community 105"
Cohesion: 0.50
Nodes (3): MonthlyReportData, PaidRow, UnpaidRow

### Community 106 - "Community 106"
Cohesion: 0.50
Nodes (3): idx_certificates_issued_by, idx_certificates_school, idx_certificates_student

### Community 107 - "Community 107"
Cohesion: 0.50
Nodes (3): idx_el_recent, idx_el_unresolved, idx_error_log_school_id

### Community 108 - "Community 108"
Cohesion: 0.50
Nodes (3): idx_inventory_dispenses_dispensed_by, idx_inventory_dispenses_item_id, idx_inventory_dispenses_school_id

### Community 109 - "Community 109"
Cohesion: 0.50
Nodes (3): idx_meal_subs_school, idx_meal_subscriptions_plan_id, uq_meal_subs_student_plan

### Community 110 - "Community 110"
Cohesion: 0.50
Nodes (3): idx_parent_students_parent, idx_parent_students_school, idx_parent_students_student_id

### Community 111 - "Community 111"
Cohesion: 0.50
Nodes (3): idx_payment_state_log_actor_id, idx_payment_state_log_school_id, idx_psl_payment

### Community 112 - "Community 112"
Cohesion: 0.50
Nodes (3): idx_payments_fee_id, idx_payments_recorded_by, idx_payments_school_date

### Community 113 - "Community 113"
Cohesion: 0.50
Nodes (3): idx_students_active, idx_students_guardian_phone, idx_students_school

### Community 114 - "Community 114"
Cohesion: 0.50
Nodes (3): public.create_academic_year(), public.current_academic_year(), public.send_announcement()

## Knowledge Gaps
- **463 isolated node(s):** `Handler`, `FetchLike`, `MonthlyReportData`, `PaidRow`, `UnpaidRow` (+458 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 836 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **150 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient()` connect `Community 33` to `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 19`, `Community 20`, `Community 22`, `Community 23`, `Community 24`, `Community 36`, `Community 37`, `Community 39`, `Community 40`, `Community 41`, `Community 42`, `Community 43`, `Community 44`, `Community 45`, `Community 46`, `Community 52`, `Community 53`, `Community 57`, `Community 58`, `Community 60`, `Community 63`, `Community 64`, `Community 65`, `Community 66`, `Community 67`, `Community 70`, `Community 73`, `Community 75`, `Community 76`, `Community 77`, `Community 78`, `Community 82`, `Community 83`, `Community 84`, `Community 85`, `Community 94`, `Community 95`, `Community 102`, `Community 103`, `Community 116`?**
  _High betweenness centrality (0.129) - this node is a cross-community bridge._
- **What connects `Handler`, `FetchLike`, `MonthlyReportData` to the rest of the system?**
  _463 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.02197802197802198 - nodes in this community are weakly interconnected._
- **Why does `next` connect `Community 10` to `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 11`, `Community 12`, `Community 14`, `Community 15`, `Community 20`, `Community 21`, `Community 22`, `Community 24`, `Community 27`, `Community 31`, `Community 32`, `Community 33`, `Community 38`, `Community 39`, `Community 43`, `Community 45`, `Community 46`, `Community 47`, `Community 49`, `Community 54`, `Community 58`, `Community 60`, `Community 65`, `Community 66`, `Community 70`, `Community 71`, `Community 72`, `Community 76`, `Community 78`, `Community 82`, `Community 83`, `Community 94`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.03636363636363636 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Community 6` to `Community 2`, `Community 5`, `Community 7`, `Community 8`, `Community 10`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 16`, `Community 19`, `Community 20`, `Community 22`, `Community 23`, `Community 24`, `Community 29`, `Community 33`, `Community 36`, `Community 37`, `Community 38`, `Community 39`, `Community 40`, `Community 41`, `Community 42`, `Community 43`, `Community 44`, `Community 45`, `Community 46`, `Community 47`, `Community 48`, `Community 49`, `Community 53`, `Community 54`, `Community 56`, `Community 58`, `Community 59`, `Community 60`, `Community 63`, `Community 66`, `Community 68`, `Community 70`, `Community 73`, `Community 76`, `Community 77`, `Community 78`, `Community 82`, `Community 83`, `Community 85`, `Community 94`, `Community 95`, `Community 104`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.061224489795918366 - nodes in this community are weakly interconnected._