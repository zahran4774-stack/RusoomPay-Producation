-- ============================================================================
-- RusoomPay — الهيكل التنظيمي للموظفين (شجرة تحت مدير المدرسة)
-- يضيف: manager_id (يتبع مَن) + photo_url (صورة اختيارية عبر رابط أو Storage لاحقاً)
-- ينفّذ بعد 01..25
-- ============================================================================

alter table public.employees
  add column if not exists manager_id uuid references public.employees(id) on delete set null,
  add column if not exists photo_url  text;

-- فهرس لتسريع بناء الشجرة (جلب مرؤوسي كل مدير)
create index if not exists idx_employees_manager on public.employees(manager_id);

-- دالة تعيين مدير الموظف — للمدير فقط، مع منع الحلقات (موظف يتبع نفسه أو دائرة)
create or replace function public.set_employee_manager(
  p_employee_id uuid,
  p_manager_id  uuid
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_school uuid;
  v_cursor uuid;
  v_guard  int := 0;
begin
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: تعديل الهيكل التنظيمي لمدير المدرسة فقط';
  end if;

  v_school := public.my_school_id();

  -- تأكّد أن الموظف والمدير من نفس المدرسة (عزل)
  if not exists (select 1 from public.employees where id = p_employee_id and school_id = v_school) then
    raise exception 'الموظف غير موجود في مدرستك';
  end if;
  if p_manager_id is not null then
    if not exists (select 1 from public.employees where id = p_manager_id and school_id = v_school) then
      raise exception 'المدير المحدّد غير موجود في مدرستك';
    end if;
    if p_manager_id = p_employee_id then
      raise exception 'لا يمكن أن يتبع الموظف نفسه';
    end if;
    -- منع الحلقات: اصعد سلسلة المديرين وتأكّد ألّا نعود للموظف
    v_cursor := p_manager_id;
    while v_cursor is not null and v_guard < 100 loop
      if v_cursor = p_employee_id then
        raise exception 'هذا التعيين يُنشئ حلقة في الهيكل التنظيمي';
      end if;
      select manager_id into v_cursor from public.employees where id = v_cursor;
      v_guard := v_guard + 1;
    end loop;
  end if;

  update public.employees set manager_id = p_manager_id where id = p_employee_id;

  insert into public.audit_log(school_id, actor_id, action, details)
  values (v_school, auth.uid(), 'set_manager', 'تحديث الهيكل التنظيمي للموظف');
end;
$$;

-- دالة تحديث صورة الموظف (رابط https) — للمدير فقط
create or replace function public.set_employee_photo(
  p_employee_id uuid,
  p_photo_url   text
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  if public.my_role() <> 'owner' then
    raise exception 'غير مصرّح: تعديل صور الموظفين لمدير المدرسة فقط';
  end if;
  v_school := public.my_school_id();
  if not exists (select 1 from public.employees where id = p_employee_id and school_id = v_school) then
    raise exception 'الموظف غير موجود في مدرستك';
  end if;
  if p_photo_url is not null and length(trim(p_photo_url)) > 0
     and p_photo_url not like 'https://%' then
    raise exception 'رابط الصورة يجب أن يبدأ بـ https://';
  end if;
  update public.employees set photo_url = nullif(trim(p_photo_url), '') where id = p_employee_id;
end;
$$;

grant execute on function public.set_employee_manager(uuid, uuid) to authenticated;
grant execute on function public.set_employee_photo(uuid, text) to authenticated;
