-- 34_ai_assistant.sql — الطبقة الخلفية للمساعد الذكي

create or replace function public.assistant_search_help(q text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_role text; v_out jsonb;
begin
  v_role := public.my_role()::text;
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_out
  from (
    select slug, category, page_route, title, summary, body, steps
    from public.help_articles
    where is_published
      and (cardinality(role_scope) = 0 or v_role = any (role_scope))
      and (
        q is null or length(trim(q)) = 0
        or title ilike '%'||q||'%' or summary ilike '%'||q||'%'
        or body ilike '%'||q||'%' or category ilike '%'||q||'%'
        or exists (select 1 from unnest(keywords) k where k ilike '%'||q||'%')
      )
    order by
      case when q is not null and title ilike '%'||q||'%' then 0 else 1 end,
      sort_order
    limit 8
  ) t;
  return v_out;
end; $$;

comment on function public.assistant_search_help(text) is 'بحث في قاعدة المعرفة يحترم دور المستخدم؛ أداة search_help للمساعد الذكي';

create or replace function public.assistant_context()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_school uuid; v_role text; v_copilot jsonb; v_school_name text;
begin
  v_school := public.my_school_id();
  v_role := public.my_role()::text;
  if v_school is null then
    return jsonb_build_object('ok', false, 'error', 'no_school');
  end if;
  select name into v_school_name from public.schools where id = v_school;
  v_copilot := public.school_copilot();
  return jsonb_build_object('ok', true, 'role', v_role, 'school_name', v_school_name, 'data', v_copilot);
end; $$;

comment on function public.assistant_context() is 'سياق بيانات المدرسة للمساعد الذكي؛ يغلّف school_copilot مع عزل تام بـ my_school_id';

create table if not exists public.assistant_conversations (
  id uuid primary key default extensions.uuid_generate_v4(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assistant_messages (
  id uuid primary key default extensions.uuid_generate_v4(),
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists asst_conv_user_idx on public.assistant_conversations (user_id, updated_at desc);
create index if not exists asst_msg_conv_idx on public.assistant_messages (conversation_id, created_at);

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;

drop policy if exists asst_conv_rw on public.assistant_conversations;
create policy asst_conv_rw on public.assistant_conversations for all to authenticated
  using (school_id = public.my_school_id() and user_id = auth.uid())
  with check (school_id = public.my_school_id() and user_id = auth.uid());

drop policy if exists asst_msg_rw on public.assistant_messages;
create policy asst_msg_rw on public.assistant_messages for all to authenticated
  using (school_id = public.my_school_id() and exists (
    select 1 from public.assistant_conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (school_id = public.my_school_id() and exists (
    select 1 from public.assistant_conversations c where c.id = conversation_id and c.user_id = auth.uid()));

create or replace function public.touch_assistant_conversation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.assistant_conversations set updated_at = now() where id = new.conversation_id;
  return new;
end; $$;

drop trigger if exists trg_touch_asst_conv on public.assistant_messages;
create trigger trg_touch_asst_conv after insert on public.assistant_messages
  for each row execute function public.touch_assistant_conversation();

revoke all on function public.assistant_search_help(text) from public, anon;
revoke all on function public.assistant_context() from public, anon;
grant execute on function public.assistant_search_help(text) to authenticated;
grant execute on function public.assistant_context() to authenticated;