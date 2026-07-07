-- ============================================================================
-- EduPay — دوال ومحفّزات الخادم (تسجيل المدرسة، التأمينات، الترفيع)
-- منطق حسّاس يُنفّذ على الخادم لا في المتصفح
-- ============================================================================

-- ----------------------------------------------------------------------------
-- تسجيل مدرسة جديدة + حساب المدير + اشتراك تجريبي — في معاملة واحدة آمنة
-- تُستدعى من التطبيق بعد إنشاء المستخدم في Supabase Auth
-- ----------------------------------------------------------------------------
create or replace function public.register_school(
  p_name text, p_branch text, p_country text, p_currency text,
  p_cr text, p_license text, p_vat text,
  p_phone text, p_email text, p_address text, p_owner_name text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_school_id uuid;
begin
  -- منع التسجيل المزدوج: إن كان للمستخدم ملف (مدرسة) مسبقاً، ارفض
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'لديك مدرسة مسجّلة بالفعل بهذا الحساب';
  end if;

  -- إنشاء المدرسة
  insert into public.schools(name,branch,country,currency,cr_number,moe_license,vat_number,phone,email,address)
  values(p_name,p_branch,p_country,p_currency,p_cr,p_license,p_vat,p_phone,p_email,p_address)
  returning id into new_school_id;

  -- نسب التأمينات: عُمان معروفة (تُضبط تلقائياً)، باقي الخليج يحتاج ضبطاً يدوياً من المدير
  if p_country = 'OM' then
    update public.schools set ins_cap = 3000, ins_configured = true where id = new_school_id;
  else
    update public.schools set ins_configured = false where id = new_school_id;
  end if;

  -- ربط المستخدم الحالي (المُصادَق) كمدير لهذه المدرسة
  insert into public.profiles(id,school_id,role,full_name,phone)
  values(auth.uid(), new_school_id, 'owner', coalesce(p_owner_name,'مدير المدرسة'), p_phone);

  -- اشتراك تجريبي أسبوعان
  insert into public.subscriptions(school_id,plan,status,trial_ends_at)
  values(new_school_id,'trial','trial', now() + interval '14 days');

  -- إنشاء دليل حسابات افتراضي
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

  -- تسجيل في التدقيق
  insert into public.audit_log(school_id,actor_id,action,details)
  values(new_school_id, auth.uid(), 'تسجيل مدرسة جديدة', p_name);

  return new_school_id;
end; $$;

-- ----------------------------------------------------------------------------
-- اعتماد طلب تعديل راتب (المدير فقط) — يطبّق التغيير ويُغلق الطلب ذرّياً
-- ----------------------------------------------------------------------------
create or replace function public.approve_salary_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: اعتماد الرواتب للمدير فقط';
  end if;

  select * into r from public.salary_requests
    where id = p_request_id and school_id = public.my_school_id() and status = 'pending';
  if not found then raise exception 'الطلب غير موجود أو سبق البتّ فيه'; end if;

  update public.employees
    set basic = r.new_basic, allowance = r.new_allow
    where id = r.employee_id and school_id = public.my_school_id();

  update public.salary_requests
    set status = 'approved', decided_by = auth.uid(), decided_at = now()
    where id = p_request_id;

  insert into public.audit_log(school_id,actor_id,action,details)
  values(public.my_school_id(), auth.uid(), 'اعتماد تعديل راتب', r.employee_id::text);
end; $$;

-- ----------------------------------------------------------------------------
-- حساب التأمينات العُمانية (مرسوم 52/2023) — على الخادم لضمان الدقة
-- الموظف 8% (7.5%+0.5%) · صاحب العمل 12.5% (11%+0.5%+1%) · الوافد معفى · حد 3000
-- ----------------------------------------------------------------------------
create or replace function public.calc_social_insurance(p_basic numeric, p_allow numeric, p_nat text)
returns table(emp_contrib numeric, er_contrib numeric, net numeric)
language plpgsql immutable as $$
declare gross numeric; base numeric;
begin
  gross := p_basic + p_allow;
  base  := least(gross, 3000);
  if p_nat = 'om' then
    emp_contrib := round(base * 0.08, 3);     -- 7.5% + 0.5%
    er_contrib  := round(base * 0.125, 3);    -- 11% + 0.5% + 1%
  else
    emp_contrib := 0; er_contrib := 0;        -- الوافد معفى
  end if;
  net := round(gross - emp_contrib, 3);
  return next;
end; $$;
