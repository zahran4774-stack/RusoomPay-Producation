-- ============================================================================
-- RusoomPay — تخصيص هوية المدرسة (شعار + لون)
-- يتيح لمدير المدرسة ضبط شعارها ولونها الأساسي، فيظهران في الفواتير والتقارير.
-- ينفّذ بعد 01..24
-- ============================================================================

-- دالة تحديث هوية المدرسة — للمدير فقط (نفس نمط update_school_bank)
create or replace function public.update_school_branding(
  p_logo_url text,
  p_color text
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: تخصيص هوية المدرسة لمدير المدرسة فقط';
  end if;

  v_school := public.my_school_id();
  if v_school is null then
    raise exception 'لا توجد مدرسة مرتبطة بالحساب';
  end if;

  -- تحقّق بسيط: رابط الشعار يجب أن يكون https (أو فارغاً لإزالته)
  if p_logo_url is not null and length(trim(p_logo_url)) > 0
     and p_logo_url not like 'https://%' then
    raise exception 'رابط الشعار يجب أن يبدأ بـ https://';
  end if;

  -- تحقّق: اللون صيغة hex صحيحة (أو فارغ)
  if p_color is not null and length(trim(p_color)) > 0
     and p_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'اللون يجب أن يكون بصيغة hex مثل ‎#0F9D74';
  end if;

  update public.schools set
    logo_url = nullif(trim(p_logo_url), ''),
    color    = nullif(trim(p_color), '')
  where id = v_school;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_school, auth.uid(), 'update_branding', 'تحديث شعار/لون المدرسة');
end;
$$;

grant execute on function public.update_school_branding(text, text) to authenticated;
