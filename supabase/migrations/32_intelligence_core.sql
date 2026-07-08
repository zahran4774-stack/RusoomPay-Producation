-- ============================================================================
-- RusoomPay — School Intelligence Core (طبقة الذكاء فوق V1)
-- طبقة معزولة تماماً: جدول مستقلّ لمفاتيح تفعيل/تعطيل المحرّكات.
-- لا تُعدّل أي وحدة أو جدول قائم. كل محرّك قابل للتشغيل/الإيقاف لكل مدرسة.
-- المحرّكات تقرأ من V1 فقط (لا تكتب فيه) وتُرجع رؤى.
-- ينفّذ بعد 01..31
-- ============================================================================

-- جدول مستقلّ: مفاتيح المحرّكات لكل مدرسة (feature flags)
create table if not exists public.intelligence_flags (
  school_id  uuid not null references public.schools(id) on delete cascade,
  engine     text not null,          -- معرّف المحرّك: 'copilot', 'risk', 'forecast', ...
  enabled    boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (school_id, engine)
);

alter table public.intelligence_flags enable row level security;

-- قراءة: أي عضو في المدرسة يرى حالة المحرّكات
create policy intel_flags_read on public.intelligence_flags
  for select using (school_id = public.my_school_id());

-- تعديل المفاتيح: المدير فقط
create policy intel_flags_write on public.intelligence_flags
  for all using (school_id = public.my_school_id() and public.my_role() = 'owner')
  with check (school_id = public.my_school_id() and public.my_role() = 'owner');

-- ===== سجلّ المحرّكات المتاحة (تعريف مركزي) =====
-- دالة تُرجع كل المحرّكات وحالتها للمدرسة الحالية (مفعّل افتراضياً إن لم يُضبط)
create or replace function public.intelligence_status()
returns table(engine text, name_ar text, description text, enabled boolean)
language sql stable security definer set search_path = public as $$
  with catalog(engine, name_ar, description) as (
    values
      ('copilot',  'المساعد التنفيذي', 'ملخّص يومي وتنبيهات وتوصيات من بيانات المدرسة'),
      ('risk',     'مؤشّر خطورة التعثّر', 'ترتيب أولياء الأمور حسب احتمال تأخّر السداد'),
      ('forecast', 'التنبّؤ بالتدفّق النقدي', 'توقّع التحصيل المتوقّع للأشهر القادمة')
  )
  select c.engine, c.name_ar, c.description,
         coalesce(f.enabled, true) as enabled   -- مفعّل افتراضياً
  from catalog c
  left join public.intelligence_flags f
    on f.engine = c.engine and f.school_id = public.my_school_id()
  order by c.engine;
$$;

-- دالة فحص سريع: هل محرّك معيّن مفعّل؟ (تستخدمها المحرّكات نفسها)
create or replace function public.intelligence_enabled(p_engine text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select enabled from public.intelligence_flags
       where school_id = public.my_school_id() and engine = p_engine),
    true   -- الافتراضي: مفعّل
  );
$$;

-- دالة تبديل مفتاح محرّك (للمدير فقط)
create or replace function public.set_intelligence_flag(p_engine text, p_enabled boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: ضبط محرّكات الذكاء لمدير المدرسة فقط';
  end if;
  insert into public.intelligence_flags(school_id, engine, enabled, updated_at)
  values (public.my_school_id(), p_engine, p_enabled, now())
  on conflict (school_id, engine)
  do update set enabled = excluded.enabled, updated_at = now();
end; $$;

grant execute on function public.intelligence_status()               to authenticated;
grant execute on function public.intelligence_enabled(text)          to authenticated;
grant execute on function public.set_intelligence_flag(text, boolean) to authenticated;

-- ===== ربط المحرّكات الموجودة بمفاتيح التفعيل =====
-- نغلّف school_copilot ليحترم مفتاحه (دون تعديل الدالة الأصلية في 31)
create or replace function public.copilot_gated()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.intelligence_enabled('copilot') then
    return jsonb_build_object('ok', false, 'disabled', true);
  end if;
  return public.school_copilot();
end; $$;

grant execute on function public.copilot_gated() to authenticated;
