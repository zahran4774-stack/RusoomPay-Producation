-- فهارس مفقودة على أعمدة تُستخدم فعلياً بشروط WHERE في أكثر الدوال استدعاءً:
-- 1) payments.fee_id — يُستعلَم بكل عملية دفع (حارس التكرار في record_payment، Phase 1)
-- 2) journal_entries.fee_id — يُستعلَم عند كل استرداد (refund_payment)
-- 3) payroll_runs.school_id — فهرس مركّب موجود يغطي (school_id, period_year, period_month) شرطياً،
--    لكن استعلامات تبحث بـ school_id فقط (مثل payroll_yearly_summary) تستفيد من فهرس مستقل أخف.
CREATE INDEX IF NOT EXISTS idx_payments_fee_id ON public.payments (fee_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_fee_id ON public.journal_entries (fee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_school_id ON public.payroll_runs (school_id);