-- pending_insert كانت تتحقق من guardian_id وschool_id فقط: أي مستخدم مسجّل يستطيع إدراج صف
-- بحالة 'approved'/'paid' أو مبلغ سالب. الإدراج المشروع (جلسة ثواني) دائماً pending/pending بمبلغ موجب.
-- الاعتماد والتحديث يتمّان عبر دوال security definer فلا يتأثران.
DROP POLICY IF EXISTS pending_insert ON public.pending_payments;
CREATE POLICY pending_insert ON public.pending_payments
  FOR INSERT
  WITH CHECK (
    guardian_id = (SELECT auth.uid())
    AND school_id = public.my_school_id()
    AND status = 'pending'
    AND txn_state = 'pending'
    AND amount > 0
    AND resolved_at IS NULL
    AND resolved_by IS NULL
  );
