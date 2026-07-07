-- ============================================================================
-- EduPay — نسب التأمينات القابلة للتخصيص (لدول الخليج)
-- عُمان: نسب ثابتة معروفة (8% / 12.5% / حد 3000) تُضبط تلقائياً
-- باقي دول الخليج: المدير يحدّد نسب بلده يدوياً (أنظمتها مختلفة)
-- ينفّذ بعد 01..08
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) حقول نسب التأمينات في جدول المدارس
-- ----------------------------------------------------------------------------
alter table public.schools add column if not exists ins_emp_rate    numeric(6,4) not null default 0.08;   -- نسبة اشتراك الموظف
alter table public.schools add column if not exists ins_er_rate     numeric(6,4) not null default 0.125;  -- نسبة حصة صاحب العمل
alter table public.schools add column if not exists ins_cap         numeric(12,3);                        -- الحد الأقصى للراتب الخاضع (null = بلا حد)
alter table public.schools add column if not exists ins_expat_exempt boolean not null default true;       -- إعفاء الوافدين؟
alter table public.schools add column if not exists ins_configured  boolean not null default false;       -- هل ضبط المدير النسب؟

-- عُمان: الحد الأقصى 3000 والنسب المعروفة (القيم الافتراضية أعلاه صحيحة لعُمان)
update public.schools set ins_cap = 3000, ins_configured = true where country = 'OM' and ins_cap is null;

-- ----------------------------------------------------------------------------
-- 2) دالة تحديث نسب التأمينات — للمدير فقط
-- ----------------------------------------------------------------------------
create or replace function public.update_insurance_rates(
  p_emp_rate numeric,
  p_er_rate numeric,
  p_cap numeric,
  p_expat_exempt boolean
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: ضبط نسب التأمينات لمدير المدرسة فقط';
  end if;
  -- تحقّق منطقي من النسب (بين 0 و 1)
  if p_emp_rate < 0 or p_emp_rate > 1 or p_er_rate < 0 or p_er_rate > 1 then
    raise exception 'النسب يجب أن تكون بين 0 و 100%%';
  end if;
  if p_cap is not null and p_cap < 0 then
    raise exception 'الحد الأقصى يجب أن يكون موجباً';
  end if;

  v_school := public.my_school_id();
  update public.schools set
    ins_emp_rate = p_emp_rate,
    ins_er_rate = p_er_rate,
    ins_cap = p_cap,
    ins_expat_exempt = coalesce(p_expat_exempt, true),
    ins_configured = true
  where id = v_school;

  insert into public.audit_log(school_id, actor_id, action, details)
  values(v_school, auth.uid(), 'تحديث نسب التأمينات',
         'موظف ' || round(p_emp_rate*100,2) || '% · صاحب عمل ' || round(p_er_rate*100,2) || '%');
end; $$;

-- ----------------------------------------------------------------------------
-- 3) تحديث دالة الراتب لتستخدم نسب المدرسة (بدل الثابتة)
-- ----------------------------------------------------------------------------
create or replace function public.calc_social_insurance(
  p_basic numeric,
  p_allow numeric,
  p_nationality text
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_school uuid := public.my_school_id();
  v_emp_rate numeric; v_er_rate numeric; v_cap numeric; v_expat_exempt boolean;
  v_gross numeric; v_base numeric; v_emp numeric; v_er numeric;
begin
  select ins_emp_rate, ins_er_rate, ins_cap, ins_expat_exempt
    into v_emp_rate, v_er_rate, v_cap, v_expat_exempt
    from public.schools where id = v_school;

  v_gross := coalesce(p_basic,0) + coalesce(p_allow,0);
  -- تطبيق الحد الأقصى إن وُجد
  v_base := case when v_cap is not null then least(v_gross, v_cap) else v_gross end;

  -- إعفاء الوافد (إن كانت المدرسة تُعفيه)
  if p_nationality <> 'om' and v_expat_exempt then
    v_emp := 0; v_er := 0;
  else
    v_emp := round(v_base * v_emp_rate, 3);
    v_er := round(v_base * v_er_rate, 3);
  end if;

  return jsonb_build_object(
    'gross', v_gross,
    'employee', v_emp,
    'employer', v_er,
    'net', round(v_gross - v_emp, 3)
  );
end; $$;

-- ============================================================================
-- ملاحظة: المدرسة العُمانية تعمل بالنسب الافتراضية فوراً (مضبوطة تلقائياً).
-- المدرسة من دولة أخرى تظهر لها رسالة لضبط نسب بلدها (ins_configured = false).
-- ============================================================================
