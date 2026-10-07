-- جدول تتبّع فوترة النقل الشهرية — نفس بنية cafeteria_billing تماماً
CREATE TABLE IF NOT EXISTS public.transport_billing (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month      text NOT NULL,
  billed_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, month)
);

ALTER TABLE public.transport_billing ENABLE ROW LEVEL SECURITY;

CREATE POLICY transport_billing_school_all ON public.transport_billing
  FOR ALL USING (school_id = public.my_school_id())
  WITH CHECK (school_id = public.my_school_id());