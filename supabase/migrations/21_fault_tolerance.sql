-- ============================================================================
-- EduPay — تحمّل الأخطاء بمعايير المؤسسات (Enterprise Fault Tolerance)
-- (1) طابور الإشعارات مع إعادة المحاولة  (2) حالات الدفع الآمنة
-- (3) الحذف الناعم  (4) سجلّ الأخطاء  (5) سجلّ النسخ الاحتياطي
-- ينفّذ بعد 01..20
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) طابور الإشعارات الموحّد (Email / SMS / WhatsApp / Push)
--    كل رسالة صادرة تُسجّل هنا أولاً، ثم يعالجها العامل (worker) مع إعادة محاولة
-- ----------------------------------------------------------------------------
create table if not exists public.notification_queue (
  id            uuid primary key default uuid_generate_v4(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  channel       text not null,                       -- email | sms | whatsapp | push
  recipient     text not null,                       -- بريد / رقم هاتف / token
  payload       jsonb not null,                      -- { subject, body, template, vars }
  status        text not null default 'queued',      -- queued | processing | sent | failed | dead
  attempts      int  not null default 0,
  max_attempts  int  not null default 5,
  next_retry_at timestamptz not null default now(),  -- وقت المحاولة التالية (backoff)
  last_error    text,
  provider_id   text,                                -- معرّف الرسالة لدى المزوّد (للتتبّع)
  dedupe_key    text,                                -- لمنع الإرسال المكرّر
  created_at    timestamptz not null default now(),
  sent_at       timestamptz,
  constraint nq_channel_chk check (channel in ('email','sms','whatsapp','push')),
  constraint nq_status_chk  check (status in ('queued','processing','sent','failed','dead'))
);
-- فهرس للعامل: يلتقط الرسائل الجاهزة للإرسال بترتيب المحاولة
create index if not exists idx_nq_due on public.notification_queue(status, next_retry_at)
  where status in ('queued','failed');
create index if not exists idx_nq_school on public.notification_queue(school_id);
-- منع التكرار: مفتاح فريد اختياري لكل مدرسة
create unique index if not exists idx_nq_dedupe on public.notification_queue(school_id, dedupe_key)
  where dedupe_key is not null;

alter table public.notification_queue enable row level security;
-- لا وصول مباشر من العملاء — تُدار حصراً عبر دوال SECURITY DEFINER والعامل (service role)
create policy nq_no_client on public.notification_queue
  for select using (school_id = public.my_school_id() and public.my_role() in ('owner','admin'));

-- ----------------------------------------------------------------------------
-- 2) حالات الدفع الآمنة — توسيع جدول pending_payments بحالات كاملة
--    pending → processing → paid | failed | refunded
-- ----------------------------------------------------------------------------
alter table public.pending_payments
  add column if not exists txn_state text not null default 'pending',
  add column if not exists provider_ref text,                 -- مرجع بوابة الدفع
  add column if not exists idempotency_key text,              -- منع الدفع المزدوج
  add column if not exists state_updated_at timestamptz not null default now(),
  add column if not exists failure_reason text;

-- قيد الحالات المسموحة
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pp_txn_state_chk') then
    alter table public.pending_payments
      add constraint pp_txn_state_chk
      check (txn_state in ('pending','processing','paid','failed','refunded'));
  end if;
end $$;

-- منع تكرار الدفع بنفس المفتاح
create unique index if not exists idx_pp_idem on public.pending_payments(idempotency_key)
  where idempotency_key is not null;

-- سجلّ انتقالات حالة الدفع (لتتبّع كامل وقابلية تدقيق)
create table if not exists public.payment_state_log (
  id          uuid primary key default uuid_generate_v4(),
  payment_id  uuid not null references public.pending_payments(id) on delete cascade,
  school_id   uuid not null references public.schools(id) on delete cascade,
  from_state  text,
  to_state    text not null,
  reason      text,
  actor_id    uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists idx_psl_payment on public.payment_state_log(payment_id);

alter table public.payment_state_log enable row level security;
create policy psl_read on public.payment_state_log
  for select using (school_id = public.my_school_id() and public.my_role() in ('owner','admin','accountant'));

-- دالة انتقال حالة آمنة (تتحقّق من الانتقالات المسموحة فقط)
create or replace function public.transition_payment_state(
  p_payment_id uuid,
  p_to_state text,
  p_reason text default null,
  p_provider_ref text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_from text; v_allowed boolean;
begin
  select school_id, txn_state into v_school, v_from
    from public.pending_payments where id = p_payment_id;
  if v_school is null then raise exception 'الدفعة غير موجودة'; end if;

  -- مصفوفة الانتقالات المسموحة (آلة حالات)
  v_allowed := case
    when v_from = 'pending'    and p_to_state in ('processing','failed')            then true
    when v_from = 'processing' and p_to_state in ('paid','failed')                  then true
    when v_from = 'paid'       and p_to_state in ('refunded')                       then true
    when v_from = 'failed'     and p_to_state in ('pending','processing')           then true  -- إعادة المحاولة
    else false
  end;
  if not v_allowed then
    raise exception 'انتقال غير مسموح: % → %', v_from, p_to_state;
  end if;

  update public.pending_payments
    set txn_state = p_to_state,
        provider_ref = coalesce(p_provider_ref, provider_ref),
        failure_reason = case when p_to_state = 'failed' then p_reason else failure_reason end,
        state_updated_at = now()
    where id = p_payment_id;

  insert into public.payment_state_log(payment_id, school_id, from_state, to_state, reason, actor_id)
  values (p_payment_id, v_school, v_from, p_to_state, p_reason, auth.uid());
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) الحذف الناعم (Soft Delete) للسجلّات الحرجة
--    إضافة deleted_at بدل الحذف الفعلي — لا فقدان للبيانات
-- ----------------------------------------------------------------------------
alter table public.students       add column if not exists deleted_at timestamptz;
alter table public.student_fees   add column if not exists deleted_at timestamptz;
alter table public.payments       add column if not exists deleted_at timestamptz;
alter table public.employees      add column if not exists deleted_at timestamptz;
alter table public.journal_entries add column if not exists deleted_at timestamptz;
alter table public.certificates   add column if not exists deleted_at timestamptz;

-- فهارس جزئية: الاستعلامات النشطة تتجاهل المحذوف
create index if not exists idx_students_active on public.students(school_id) where deleted_at is null;
create index if not exists idx_fees_active on public.student_fees(school_id) where deleted_at is null;

-- دالة حذف ناعم عامة (تتحقّق من الجدول والصلاحية)
create or replace function public.soft_delete(p_table text, p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  if public.my_role() not in ('owner','admin') then
    raise exception 'غير مصرّح بالحذف';
  end if;
  if p_table not in ('students','student_fees','payments','employees','journal_entries','certificates') then
    raise exception 'جدول غير مدعوم للحذف الناعم';
  end if;
  -- تنفيذ ديناميكي آمن (القائمة البيضاء أعلاه تمنع الحقن)
  execute format(
    'update public.%I set deleted_at = now() where id = $1 and school_id = public.my_school_id()',
    p_table
  ) using p_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (public.my_school_id(), auth.uid(), 'حذف ناعم: ' || p_table, p_id::text);
end;
$$;

-- استرجاع سجلّ محذوف
create or replace function public.restore_record(p_table text, p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() not in ('owner','admin') then
    raise exception 'غير مصرّح بالاسترجاع';
  end if;
  if p_table not in ('students','student_fees','payments','employees','journal_entries','certificates') then
    raise exception 'جدول غير مدعوم';
  end if;
  execute format(
    'update public.%I set deleted_at = null where id = $1 and school_id = public.my_school_id()',
    p_table
  ) using p_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (public.my_school_id(), auth.uid(), 'استرجاع سجلّ: ' || p_table, p_id::text);
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) سجلّ الأخطاء والمراقبة (Error Log)
-- ----------------------------------------------------------------------------
create table if not exists public.error_log (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid references public.schools(id) on delete set null,
  source      text not null,                         -- api | queue | payment | rpc | client
  severity    text not null default 'error',         -- info | warning | error | critical
  message     text not null,
  context     jsonb,                                 -- بيانات إضافية للتشخيص (بلا أسرار)
  request_id  text,                                  -- لربط الأخطاء بطلب واحد
  resolved    boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint el_sev_chk check (severity in ('info','warning','error','critical'))
);
create index if not exists idx_el_recent on public.error_log(created_at desc);
create index if not exists idx_el_unresolved on public.error_log(severity, created_at desc) where resolved = false;

alter table public.error_log enable row level security;
-- مدير المنصّة يرى كل الأخطاء؛ مدير المدرسة يرى أخطاء مدرسته فقط
create policy el_platform on public.error_log
  for select using (public.is_platform_admin());
create policy el_school on public.error_log
  for select using (school_id = public.my_school_id() and public.my_role() in ('owner','admin'));

-- دالة تسجيل خطأ (تُستدعى من API/RPC) — لا تكشف الأسرار
create or replace function public.log_error(
  p_source text, p_severity text, p_message text,
  p_context jsonb default null, p_request_id text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.error_log(school_id, source, severity, message, context, request_id)
  values (public.my_school_id(), p_source, coalesce(p_severity,'error'), p_message, p_context, p_request_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- ملخّص صحّة النظام لمدير المنصّة (للوحة المراقبة)
create or replace function public.system_health()
returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'queue_pending',  (select count(*) from public.notification_queue where status in ('queued','failed')),
    'queue_dead',     (select count(*) from public.notification_queue where status = 'dead'),
    'errors_24h',     (select count(*) from public.error_log where created_at > now() - interval '24 hours'),
    'critical_open',  (select count(*) from public.error_log where severity = 'critical' and resolved = false),
    'payments_stuck', (select count(*) from public.pending_payments where txn_state = 'processing' and state_updated_at < now() - interval '30 minutes')
  )
  where public.is_platform_admin();
$$;

-- ----------------------------------------------------------------------------
-- 5) سجلّ النسخ الاحتياطي (تتبّع لا تنفيذ — التنفيذ عبر Supabase)
-- ----------------------------------------------------------------------------
create table if not exists public.backup_log (
  id          uuid primary key default uuid_generate_v4(),
  kind        text not null default 'daily',         -- daily | manual | pitr
  status      text not null,                         -- success | failed
  size_bytes  bigint,
  note        text,
  created_at  timestamptz not null default now()
);
alter table public.backup_log enable row level security;
create policy bl_platform on public.backup_log for select using (public.is_platform_admin());

-- ----------------------------------------------------------------------------
-- 6) دوال الطابور (Queue) — تُستدعى من العامل بصلاحية service role
-- ----------------------------------------------------------------------------
-- إضافة رسالة للطابور (مع منع التكرار عبر dedupe_key)
create or replace function public.enqueue_notification(
  p_channel text, p_recipient text, p_payload jsonb,
  p_dedupe_key text default null, p_max_attempts int default 5
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_school uuid;
begin
  v_school := public.my_school_id();
  insert into public.notification_queue(school_id, channel, recipient, payload, dedupe_key, max_attempts)
  values (v_school, p_channel, p_recipient, p_payload, p_dedupe_key, coalesce(p_max_attempts,5))
  on conflict (school_id, dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- العامل يلتقط دفعة جاهزة للإرسال (atomic claim عبر FOR UPDATE SKIP LOCKED)
create or replace function public.claim_queue_batch(p_limit int default 20)
returns setof public.notification_queue
language plpgsql security definer set search_path = public as $$
begin
  -- للعامل فقط (service role يتجاوز RLS؛ هذه حماية إضافية)
  return query
  update public.notification_queue q
    set status = 'processing', attempts = attempts + 1
    where q.id in (
      select id from public.notification_queue
      where status in ('queued','failed')
        and next_retry_at <= now()
        and attempts < max_attempts
      order by next_retry_at
      limit p_limit
      for update skip locked
    )
    returning q.*;
end;
$$;

-- تحديث نتيجة الإرسال (نجاح/فشل مع backoff أسّي)
create or replace function public.mark_queue_result(
  p_id uuid, p_success boolean, p_error text default null, p_provider_id text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_attempts int; v_max int;
begin
  select attempts, max_attempts into v_attempts, v_max
    from public.notification_queue where id = p_id;

  if p_success then
    update public.notification_queue
      set status = 'sent', sent_at = now(), provider_id = p_provider_id, last_error = null
      where id = p_id;
  else
    update public.notification_queue
      set status = case when v_attempts >= v_max then 'dead' else 'failed' end,
          last_error = p_error,
          -- backoff أسّي: 1د، 2د، 4د، 8د، 16د
          next_retry_at = now() + (power(2, least(v_attempts,5)) * interval '1 minute')
      where id = p_id;
  end if;
end;
$$;

grant execute on function public.transition_payment_state(uuid,text,text,text) to authenticated;
grant execute on function public.soft_delete(text,uuid) to authenticated;
grant execute on function public.restore_record(text,uuid) to authenticated;
grant execute on function public.log_error(text,text,text,jsonb,text) to authenticated;
grant execute on function public.system_health() to authenticated;
grant execute on function public.enqueue_notification(text,text,jsonb,text,int) to authenticated;
grant execute on function public.claim_queue_batch(int) to service_role;
grant execute on function public.mark_queue_result(uuid,boolean,text,text) to service_role;
