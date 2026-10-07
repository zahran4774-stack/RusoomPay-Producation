-- كائنات مخطط قاعدة البيانات (public + بعض storage) كجدول مؤقت schema_objects(kind, k).
-- يُشغَّل على القاعدة المبنية من الـ migrations (CI) وعلى الإنتاج (read-only) لمقارنة البصمات.
-- لا يعتمد على OIDs أو ترتيب الأعمدة أو المالك، كي لا تظهر فروق وهمية.
create temp table schema_objects as
with
cols as (
  select format('%s.%s:%s:%s:%s:%s', c.table_name, c.column_name, c.data_type, c.is_nullable,
                coalesce(c.column_default, ''), coalesce(c.generation_expression, '')) as k
  from information_schema.columns c
  join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
),
funcs as (
  select format('%s(%s)=%s|anon:%s|auth:%s|public:%s', p.proname, pg_get_function_identity_arguments(p.oid),
                md5(pg_get_functiondef(p.oid)),
                has_function_privilege('anon', p.oid, 'execute'),
                has_function_privilege('authenticated', p.oid, 'execute'),
                has_function_privilege('public', p.oid, 'execute')) as k
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p')
),
pols as (
  select format('%s.%s.%s.%s.%s.%s.%s', schemaname, tablename, policyname, cmd, permissive,
                array_to_string(roles, ','), md5(coalesce(qual, '') || '|' || coalesce(with_check, ''))) as k
  from pg_policies where (schemaname = 'public') or (schemaname = 'storage' and tablename = 'objects')
),
idx as (
  select indexdef as k from pg_indexes where schemaname = 'public'
),
trg as (
  select format('%s.%s=%s', c.relname, t.tgname, pg_get_triggerdef(t.oid)) as k
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal
),
cons as (
  select format('%s.%s=%s', c.relname, k.conname, pg_get_constraintdef(k.oid)) as k
  from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
),
rls as (
  select format('%s:rls=%s:force=%s', c.relname, c.relrowsecurity, c.relforcerowsecurity) as k
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
buckets as (
  select format('%s:public=%s', id, public) as k from storage.buckets
),
enums as (
  select format('%s=%s', t.typname, string_agg(e.enumlabel, ',' order by e.enumsortorder)) as k
  from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' group by t.typname
)
select 'columns' as kind, k from cols
union all select 'functions', k from funcs
union all select 'policies', k from pols
union all select 'indexes', k from idx
union all select 'triggers', k from trg
union all select 'constraints', k from cons
union all select 'rls_flags', k from rls
union all select 'buckets', k from buckets
union all select 'enums', k from enums;
