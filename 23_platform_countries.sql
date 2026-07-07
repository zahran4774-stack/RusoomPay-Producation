-- ============================================================================
-- EduPay — تفعيل/تعطيل دول الخليج (يتحكّم بها مالك المنصّة)
-- يحدّد أي الدول متاحة للتسجيل. عُمان مفعّلة افتراضياً، والباقي للمستقبل.
-- ينفّذ بعد 01..22
-- ============================================================================

create table if not exists public.platform_countries (
  code        text primary key,              -- OM, SA, AE, QA, KW, BH
  name_ar     text not null,
  currency    text not null,
  enabled     boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- البيانات الأوّلية: عُمان مفعّلة، الباقي معطّل (جاهز للتفعيل المستقبلي)
insert into public.platform_countries(code, name_ar, currency, enabled) values
  ('OM', 'سلطنة عُمان', 'OMR', true),
  ('SA', 'السعودية',    'SAR', false),
  ('AE', 'الإمارات',    'AED', false),
  ('QA', 'قطر',         'QAR', false),
  ('KW', 'الكويت',      'KWD', false),
  ('BH', 'البحرين',     'BHD', false)
on conflict (code) do nothing;

alter table public.platform_countries enable row level security;

-- القراءة متاحة للجميع (نموذج التسجيل يحتاجها) — لكن التعديل لمالك المنصّة فقط
create policy pc_read on public.platform_countries
  for select using (true);

-- دالة التبديل — لمالك المنصّة حصراً
create or replace function public.set_country_enabled(p_code text, p_enabled boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'غير مصرّح — هذا الإجراء لمالك المنصّة فقط';
  end if;
  update public.platform_countries
    set enabled = p_enabled, updated_at = now()
    where code = p_code;
  if not found then
    raise exception 'دولة غير معروفة: %', p_code;
  end if;
end;
$$;

-- قائمة الدول المفعّلة (للتسجيل العام)
create or replace function public.enabled_countries()
returns setof public.platform_countries
language sql stable security definer set search_path = public as $$
  select * from public.platform_countries where enabled = true order by name_ar;
$$;

grant execute on function public.set_country_enabled(text, boolean) to authenticated;
grant execute on function public.enabled_countries() to anon, authenticated;
