-- جدول تتبّع دعوات أولياء الأمور — يسجّل آخر مرة أُرسلت فيها دعوة تفعيل لكل رقم
-- معزول بالمدرسة عبر RLS، مثل بقية الجداول
CREATE TABLE IF NOT EXISTS public.guardian_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  phone       text NOT NULL,
  invited_at  timestamptz NOT NULL DEFAULT now(),
  invited_by  uuid REFERENCES auth.users(id),
  UNIQUE (school_id, phone)
);

ALTER TABLE public.guardian_invites ENABLE ROW LEVEL SECURITY;

-- الطاقم المالي/الإداري لمدرسته فقط يقرأ ويكتب
CREATE POLICY guardian_invites_school_select ON public.guardian_invites
  FOR SELECT USING (school_id = public.my_school_id());

CREATE POLICY guardian_invites_school_insert ON public.guardian_invites
  FOR INSERT WITH CHECK (
    school_id = public.my_school_id()
    AND public.my_role() IN ('owner','admin','accountant')
  );

CREATE POLICY guardian_invites_school_update ON public.guardian_invites
  FOR UPDATE USING (school_id = public.my_school_id())
  WITH CHECK (school_id = public.my_school_id());

-- دالة: تسجيل/تحديث وقت إرسال الدعوة لرقم معيّن (upsert)
CREATE OR REPLACE FUNCTION public.mark_guardian_invited(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_school uuid;
BEGIN
  v_school := public.my_school_id();
  IF v_school IS NULL OR public.my_role() NOT IN ('owner','admin','accountant') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  INSERT INTO public.guardian_invites (school_id, phone, invited_at, invited_by)
  VALUES (v_school, p_phone, now(), auth.uid())
  ON CONFLICT (school_id, phone)
  DO UPDATE SET invited_at = now(), invited_by = auth.uid();

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_guardian_invited(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_guardian_invited(text) TO authenticated;

-- تحديث unlinked_guardians ليرجع آخر تاريخ دعوة (إن وُجد) لكل رقم
CREATE OR REPLACE FUNCTION public.unlinked_guardians()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_school uuid;
  v_rows   jsonb;
begin
  v_school := my_school_id();
  if v_school is null or my_role() not in ('owner','admin','accountant') then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  select coalesce(jsonb_agg(t order by t->>'guardian_name'), '[]'::jsonb)
  into v_rows
  from (
    select jsonb_build_object(
      'phone',          s.guardian_phone,
      'guardian_name',  coalesce(max(s.guardian_name), 'ولي الأمر'),
      'children_count', count(*),
      'children',       string_agg(s.full_name, '، ' order by s.full_name),
      'invited_at',      max(gi.invited_at)
    ) as t
    from public.students s
    left join public.guardian_invites gi
      on gi.school_id = s.school_id and gi.phone = s.guardian_phone
    where s.school_id = v_school
      and s.deleted_at is null
      and s.status = 'active'
      and s.guardian_phone is not null
      and not exists (
        select 1 from public.profiles p
        where p.role = 'parent' and p.phone = s.guardian_phone
      )
    group by s.guardian_phone
  ) sub;

  return jsonb_build_object(
    'ok', true,
    'count', jsonb_array_length(v_rows),
    'guardians', v_rows
  );
end;
$function$;