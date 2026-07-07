-- ============================================================================
-- EduPay — تحديد المعدّل (Rate Limiting) على مستوى قاعدة البيانات
-- عدّاد ذرّي بنافذة منزلقة، يعمل عبر خوادم serverless المتعدّدة
-- ينفّذ بعد 01..21
-- ============================================================================

create table if not exists public.rate_limits (
  key         text primary key,
  count       int  not null default 0,
  window_start timestamptz not null default now()
);
-- لا RLS — يُدار حصراً عبر service role في الخادم

-- دالة ذرّية: تزيد العدّاد وتُرجع هل تجاوز الحدّ
create or replace function public.check_rate_limit(
  p_key text, p_limit int, p_window_sec int
)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_count int; v_start timestamptz; v_now timestamptz := now();
  v_reset timestamptz;
begin
  -- upsert ذرّي مع قفل الصفّ
  insert into public.rate_limits(key, count, window_start)
  values (p_key, 1, v_now)
  on conflict (key) do update
    set count = case
          -- نافذة جديدة: صفّر العدّاد
          when public.rate_limits.window_start < v_now - (p_window_sec || ' seconds')::interval then 1
          else public.rate_limits.count + 1
        end,
        window_start = case
          when public.rate_limits.window_start < v_now - (p_window_sec || ' seconds')::interval then v_now
          else public.rate_limits.window_start
        end
  returning count, window_start into v_count, v_start;

  v_reset := v_start + (p_window_sec || ' seconds')::interval;

  return json_build_object(
    'allowed', v_count <= p_limit,
    'remaining', greatest(0, p_limit - v_count),
    'reset_at', v_reset
  );
end;
$$;

-- تنظيف دوري للسجلّات القديمة (يُستدعى من cron أو يدوياً)
create or replace function public.cleanup_rate_limits()
returns void
language sql security definer set search_path = public as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;

grant execute on function public.check_rate_limit(text,int,int) to service_role;
grant execute on function public.cleanup_rate_limits() to service_role;
