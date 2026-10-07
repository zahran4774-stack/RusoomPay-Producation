-- 33_help_center.sql — قاعdة معرفة رسوم Pay
create table if not exists public.help_articles (
  id           uuid primary key default extensions.uuid_generate_v4(),
  slug         text not null unique,
  category     text not null,
  page_route   text,
  title        text not null,
  summary      text not null,
  body         text not null,
  steps        jsonb not null default '[]'::jsonb,
  media        jsonb not null default '[]'::jsonb,
  keywords     text[] not null default '{}',
  role_scope   text[] not null default '{}',
  sort_order   int  not null default 100,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table  public.help_articles          is 'قاعدة معرفة رسوم Pay: شروح الصفحات والمميزات لكل الأدوار';
comment on column public.help_articles.slug       is 'مُعرّف ثابت يُستخدم في زر المساعدة السياقي داخل الصفحات';
comment on column public.help_articles.role_scope is 'أدوار user_role المسموح لها برؤية المقال؛ مصفوفة فارغة تعني عام للجميع';

create index if not exists help_articles_category_idx   on public.help_articles (category, sort_order);
create index if not exists help_articles_route_idx      on public.help_articles (page_route);
create index if not exists help_articles_keywords_idx   on public.help_articles using gin (keywords);
create index if not exists help_articles_published_idx  on public.help_articles (is_published) where is_published;

create or replace function public.touch_help_articles()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists trg_touch_help_articles on public.help_articles;
create trigger trg_touch_help_articles
  before update on public.help_articles
  for each row execute function public.touch_help_articles();

alter table public.help_articles enable row level security;

drop policy if exists help_articles_read on public.help_articles;
create policy help_articles_read
  on public.help_articles for select to authenticated
  using (
    is_published
    and (cardinality(role_scope) = 0 or public.my_role()::text = any (role_scope))
  );

drop policy if exists help_articles_admin_write on public.help_articles;
create policy help_articles_admin_write
  on public.help_articles for all to authenticated
  using (public.my_role() = 'platform_admin')
  with check (public.my_role() = 'platform_admin');