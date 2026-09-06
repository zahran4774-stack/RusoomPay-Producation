CREATE TRIGGER no_delete_journal BEFORE DELETE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION block_journal_mutation();

CREATE TRIGGER no_delete_lines BEFORE DELETE ON public.journal_lines FOR EACH ROW EXECUTE FUNCTION block_journal_mutation();

CREATE TRIGGER no_update_journal BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION block_journal_mutation();

CREATE TRIGGER no_update_lines BEFORE UPDATE ON public.journal_lines FOR EACH ROW EXECUTE FUNCTION block_journal_mutation();

CREATE TRIGGER trg_accrue_student_fee AFTER INSERT ON public.student_fees FOR EACH ROW EXECUTE FUNCTION accrue_student_fee();

CREATE TRIGGER trg_block_approved_items BEFORE INSERT OR DELETE OR UPDATE ON public.payroll_items FOR EACH ROW EXECUTE FUNCTION block_approved_payroll_items();

CREATE TRIGGER trg_sync_pasi_flag BEFORE INSERT OR UPDATE OF nationality, subject_to_pasi ON public.employees FOR EACH ROW EXECUTE FUNCTION sync_pasi_flag();

CREATE TRIGGER trg_touch_asst_conv AFTER INSERT ON public.assistant_messages FOR EACH ROW EXECUTE FUNCTION touch_assistant_conversation();

CREATE TRIGGER trg_touch_help_articles BEFORE UPDATE ON public.help_articles FOR EACH ROW EXECUTE FUNCTION touch_help_articles();
