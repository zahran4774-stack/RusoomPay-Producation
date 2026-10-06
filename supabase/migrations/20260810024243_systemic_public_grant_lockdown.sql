-- سحب صلاحية PUBLIC (يعني anon تلقائياً) من كل دوال SECURITY DEFINER الحساسة،
-- باستثناء قائمة محدّدة يجب أن تبقى متاحة قبل تسجيل الدخول (تسجيل مدرسة جديدة،
-- تسجيل ولي أمر بالهاتف، تصفح قائمة المدارس العامة، تسجيل أخطاء العميل).
-- كل دالة غير مستثناة: تُسحب من PUBLIC، وتُمنح صراحة لـ authenticated فقط
-- (تبقى تعمل بنفس الشكل لأي مستخدم مسجّل دخول فعلياً — الفحص الداخلي
-- my_role()/my_school_id() هو اللي يحدد صلاحياته الفعلية بعد كذا).

do $$
declare
  r record;
  allowlist text[] := array[
    'register_school',
    'parent_signup_by_phone',
    'public_schools',
    'enabled_countries',
    'create_parent_profile',
    'available_plans',
    'log_error',
    'my_role',
    'my_school_id',
    'system_health'
  ];
  fixed_count int := 0;
begin
  for r in
    select p.oid, p.proname,
           format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
      and has_function_privilege('anon', p.oid, 'EXECUTE')
      and p.proname <> all(allowlist)
  loop
    execute format('revoke all on function %s from public', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
    fixed_count := fixed_count + 1;
  end loop;

  raise notice 'تم تصحيح % دالة', fixed_count;
end $$;
