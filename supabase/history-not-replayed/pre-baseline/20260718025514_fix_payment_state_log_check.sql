ALTER POLICY payment_state_log_rw ON public.payment_state_log
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_state_log.payment_id
        AND p.school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    )
  );