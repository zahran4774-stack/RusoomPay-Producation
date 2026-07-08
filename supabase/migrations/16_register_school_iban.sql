-- ============================================================================
-- EduPay — تحديث register_school لقبول رقم الحساب البنكي (IBAN) عند التسجيل
-- يستبدل النسخة في 03_functions.sql بإضافة بارامتر p_bank_iban (اختياري)
-- ينفّذ بعد 01..15
-- ============================================================================

create or replace function public.register_school(
  p_name text, p_branch text, p_country text, p_currency text,
  p_cr text, p_license text, p_vat text,
  p_phone text, p_email text, p_address text, p_owner_name text,
  p_bank_iban text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_school_id uuid;
begin
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'لديك مدرسة مسجّلة بالفعل بهذا الحساب';
  end if;

  -- التحقق من رقم الحساب البنكي إن أُدخل (الصيغة والطول حسب الدولة)
  if coalesce(trim(p_bank_iban),'') <> '' then
    declare v_iban text := upper(replace(p_bank_iban,' ',''));
            v_len int;
    begin
      v_len := case p_country
        when 'OM' then 23 when 'SA' then 24 when 'AE' then 23
        when 'QA' then 29 when 'KW' then 30 when 'BH' then 22 else 23 end;
      if v_iban !~ '^[A-Z]{2}[0-9A-Z]+$' then
        raise exception 'رقم الحساب البنكي (IBAN) غير صحيح';
      end if;
      if left(v_iban,2) <> p_country then
        raise exception 'يجب أن يبدأ الحساب البنكي برمز الدولة (%)', p_country;
      end if;
      if length(v_iban) <> v_len then
        raise exception 'طول الحساب البنكي غير صحيح (% من % خانة)', length(v_iban), v_len;
      end if;
      p_bank_iban := v_iban;
    end;
  end if;

  insert into public.schools(name,branch,country,currency,cr_number,moe_license,vat_number,phone,email,address,bank_iban,bank_enabled)
  values(p_name,p_branch,p_country,p_currency,p_cr,p_license,p_vat,p_phone,p_email,p_address,
         nullif(p_bank_iban,''), (nullif(p_bank_iban,'') is not null))
  returning id into new_school_id;

  if p_country = 'OM' then
    update public.schools set ins_cap = 3000, ins_configured = true where id = new_school_id;
  else
    update public.schools set ins_configured = false where id = new_school_id;
  end if;

  insert into public.profiles(id,school_id,role,full_name,phone)
  values(auth.uid(), new_school_id, 'owner', coalesce(p_owner_name,'مدير المدرسة'), p_phone);

  insert into public.subscriptions(school_id,plan,status,trial_ends_at)
  values(new_school_id,'trial','trial', now() + interval '14 days');

  insert into public.accounts(school_id,code,name,type) values
    (new_school_id,'1110','الصندوق','asset'),
    (new_school_id,'1120','البنك','asset'),
    (new_school_id,'1210','ذمم أولياء الأمور','asset'),
    (new_school_id,'2210','ضريبة القيمة المضافة المستحقة','liability'),
    (new_school_id,'2320','رواتب مستحقة','liability'),
    (new_school_id,'3100','رأس المال','equity'),
    (new_school_id,'4100','إيرادات الرسوم الدراسية','revenue'),
    (new_school_id,'5110','مصروف الرواتب','expense'),
    (new_school_id,'5120','مصروف التأمينات','expense'),
    (new_school_id,'5210','مصاريف إدارية','expense');

  insert into public.audit_log(school_id,actor_id,action,details)
  values(new_school_id, auth.uid(), 'تسجيل مدرسة جديدة', p_name);

  return new_school_id;
end;
$$;

grant execute on function public.register_school(text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
