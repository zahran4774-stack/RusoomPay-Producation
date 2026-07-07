-- ============================================================================
-- EduPay — سياسات أمان الصفوف (RLS)
-- هذا هو جوهر الأمان: العزل بين المدارس يُفرض في قاعدة البيانات نفسها،
-- فلا يستطيع أي كود في المتصفح (أو أداة مطوّر) تجاوزه — يُطبّق على كل استعلام.
-- ============================================================================

-- تفعيل RLS على كل الجداول
alter table public.schools          enable row level security;
alter table public.profiles         enable row level security;
alter table public.subscriptions    enable row level security;
alter table public.students         enable row level security;
alter table public.student_fees     enable row level security;
alter table public.employees        enable row level security;
alter table public.salary_requests  enable row level security;
alter table public.accounts         enable row level security;
alter table public.journal_entries  enable row level security;
alter table public.journal_lines    enable row level security;
alter table public.audit_log        enable row level security;

-- ----------------------------------------------------------------------------
-- دوال مساعدة: تستخرج مدرسة المستخدم الحالي ودوره من ملفه الشخصي
-- (auth.uid() = هوية المستخدم المُصادَق عبر Supabase Auth)
-- ----------------------------------------------------------------------------
create or replace function public.my_school_id()
returns uuid language sql stable security definer set search_path = public as $$
  select school_id from public.profiles where id = auth.uid();
$$;

create or replace function public.my_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- قاعدة العزل الأساسية: كل مستخدم يرى/يعدّل بيانات مدرسته فقط
-- تُطبّق على كل الجداول التي تحوي school_id
-- ----------------------------------------------------------------------------

-- المدارس: يرى المستخدم مدرسته فقط
create policy school_isolation on public.schools
  for select using (id = public.my_school_id());
-- التعديل على بيانات المدرسة: المدير فقط
create policy school_update on public.schools
  for update using (id = public.my_school_id() and public.my_role() = 'owner');

-- الملفات الشخصية: يرى مستخدمي مدرسته؛ المدير يدير الحسابات
create policy profiles_select on public.profiles
  for select using (school_id = public.my_school_id());
create policy profiles_manage on public.profiles
  for all using (school_id = public.my_school_id() and public.my_role() = 'owner')
  with check (school_id = public.my_school_id() and public.my_role() = 'owner');

-- الاشتراكات: المدير فقط
create policy sub_owner on public.subscriptions
  for all using (school_id = public.my_school_id() and public.my_role() = 'owner')
  with check (school_id = public.my_school_id());

-- ----------------------------------------------------------------------------
-- الطلاب: الإدارة/المحاسب/المدير يديرون؛ ولي الأمر والطالب يقرآن المسموح فقط
-- ----------------------------------------------------------------------------
create policy students_staff_all on public.students
  for all using (
    school_id = public.my_school_id()
    and public.my_role() in ('owner','admin','accountant')
  ) with check (school_id = public.my_school_id());

-- ولي الأمر يرى أبناءه فقط (المرتبطين برقم هاتفه)
create policy students_parent_read on public.students
  for select using (
    school_id = public.my_school_id()
    and public.my_role() = 'parent'
    and guardian_phone = (select phone from public.profiles where id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- رسوم الطلاب: نفس منطق الطلاب
-- ----------------------------------------------------------------------------
create policy fees_staff_all on public.student_fees
  for all using (
    school_id = public.my_school_id()
    and public.my_role() in ('owner','admin','accountant')
  ) with check (school_id = public.my_school_id());

create policy fees_parent_read on public.student_fees
  for select using (
    school_id = public.my_school_id()
    and public.my_role() = 'parent'
    and student_id in (
      select id from public.students
      where guardian_phone = (select phone from public.profiles where id = auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- الموظفون: المدير والمحاسب فقط (بيانات حساسة)
-- ----------------------------------------------------------------------------
create policy employees_staff on public.employees
  for all using (
    school_id = public.my_school_id()
    and public.my_role() in ('owner','accountant')
  ) with check (school_id = public.my_school_id());

-- ----------------------------------------------------------------------------
-- طلبات تعديل الرواتب: المحاسب ينشئ ويقرأ؛ المدير يعتمد/يرفض (يحدّث)
-- هذا يفرض سير الموافقة على مستوى قاعدة البيانات — لا يمكن للمحاسب الاعتماد
-- ----------------------------------------------------------------------------
create policy salreq_read on public.salary_requests
  for select using (school_id = public.my_school_id()
    and public.my_role() in ('owner','accountant'));

create policy salreq_create on public.salary_requests
  for insert with check (school_id = public.my_school_id()
    and public.my_role() in ('accountant','owner'));

-- الاعتماد/الرفض (التحديث): المدير فقط
create policy salreq_approve on public.salary_requests
  for update using (school_id = public.my_school_id() and public.my_role() = 'owner')
  with check (school_id = public.my_school_id());

-- ----------------------------------------------------------------------------
-- المحاسبة (الحسابات، القيود، السطور): المدير والمحاسب
-- ----------------------------------------------------------------------------
create policy accounts_staff on public.accounts
  for all using (school_id = public.my_school_id()
    and public.my_role() in ('owner','accountant'))
  with check (school_id = public.my_school_id());

create policy journals_staff on public.journal_entries
  for all using (school_id = public.my_school_id()
    and public.my_role() in ('owner','accountant'))
  with check (school_id = public.my_school_id());

create policy lines_staff on public.journal_lines
  for all using (school_id = public.my_school_id()
    and public.my_role() in ('owner','accountant'))
  with check (school_id = public.my_school_id());

-- ----------------------------------------------------------------------------
-- سجل التدقيق: قراءة للمدير فقط؛ الإدراج عبر دوال الخادم (لا تعديل/حذف أبداً)
-- ----------------------------------------------------------------------------
create policy audit_read on public.audit_log
  for select using (school_id = public.my_school_id() and public.my_role() = 'owner');
create policy audit_insert on public.audit_log
  for insert with check (school_id = public.my_school_id());
-- لا توجد سياسة update/delete على سجل التدقيق → غير قابل للتلاعب

-- ============================================================================
-- ملاحظة أمنية جوهرية:
-- مع تفعيل RLS، حتى لو عدّل المهاجم كود المتصفح أو أرسل طلباً مباشراً للـAPI،
-- فإن PostgreSQL يرفض أي وصول خارج مدرسته أو خارج صلاحيات دوره — تلقائياً.
-- هذا يحل: المصادقة الوهمية + العزل التجميلي + تجاوز الصلاحيات.
-- ============================================================================
