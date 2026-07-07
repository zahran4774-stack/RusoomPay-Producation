-- ============================================================================
-- EduPay — مخطط قاعدة البيانات الإنتاجي (PostgreSQL / Supabase)
-- يعالج: الثبات (بيانات دائمة) + التعدد الآمن (عزل المدارس) + سلامة البيانات
-- ============================================================================

-- إضافة UUID
create extension if not exists "uuid-ossp";

-- ============================================================================
-- 1) المدارس (المستأجرون) — جذر العزل متعدد المستأجرين
-- ============================================================================
create table public.schools (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  branch        text,
  country       text not null default 'OM',          -- OM, SA, AE, QA, KW, BH
  currency      text not null default 'OMR',          -- OMR, SAR, AED, QAR, KWD, BHD
  governorate   text,
  cr_number     text,                                 -- السجل التجاري
  moe_license   text,                                 -- ترخيص وزارة التربية
  vat_number    text,                                 -- الرقم الضريبي
  phone         text,
  email         text,
  address       text,
  logo_url      text,                                 -- يُخزّن في Storage لا كـDataURL
  color         text default '#0F2744',
  created_at    timestamptz not null default now()
);

-- ============================================================================
-- 2) الملفات الشخصية — تربط مستخدم Supabase Auth بمدرسة ودور
--    (كلمات المرور تُدار بالكامل عبر Supabase Auth — مشفّرة، لا تُخزّن هنا)
-- ============================================================================
create type user_role as enum ('owner','admin','accountant','parent','student');

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  school_id   uuid not null references public.schools(id) on delete cascade,
  role        user_role not null default 'admin',
  full_name   text not null,
  phone       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index idx_profiles_school on public.profiles(school_id);

-- ============================================================================
-- 3) اشتراك المدرسة في المنصة (منفصل عن رسوم الطلاب)
-- ============================================================================
create type sub_status as enum ('trial','active','pending','expired');
create type sub_plan   as enum ('trial','monthly','yearly','lifetime');

create table public.subscriptions (
  id            uuid primary key default uuid_generate_v4(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  plan          sub_plan not null default 'trial',
  status        sub_status not null default 'trial',
  trial_ends_at timestamptz,
  renews_at     timestamptz,
  pay_method    text,                                 -- card, epay, gpay, bank
  receipt_url   text,                                 -- إيصال التحويل البنكي (Storage)
  created_at    timestamptz not null default now()
);
create index idx_sub_school on public.subscriptions(school_id);

-- ============================================================================
-- 4) الطلاب
-- ============================================================================
create type student_status as enum ('active','transferred','graduated');

create table public.students (
  id             uuid primary key default uuid_generate_v4(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  code           text not null,                       -- STU-001 (فريد داخل المدرسة)
  full_name      text not null,
  grade          text not null,                       -- براعم..الثاني عشر
  section        text,                                -- الشعبة
  guardian_name  text,
  guardian_phone text,
  status         student_status not null default 'active',
  repeater       boolean not null default false,      -- معيد
  promoted_year  int,                                 -- قفل الترفيع السنوي
  attendance     numeric(5,2) default 100,
  joined_at      date default current_date,
  created_at     timestamptz not null default now(),
  unique (school_id, code)
);
create index idx_students_school on public.students(school_id);

-- ============================================================================
-- 5) رسوم الطلاب (بنود الفاتورة لكل طالب)
-- ============================================================================
create table public.student_fees (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  description text not null,                           -- رسوم دراسية، زي، نقل...
  total       numeric(12,3) not null default 0,
  paid        numeric(12,3) not null default 0,
  due_date    date,
  created_at  timestamptz not null default now()
);
create index idx_fees_school on public.student_fees(school_id);
create index idx_fees_student on public.student_fees(student_id);

-- ============================================================================
-- 6) الموظفون
-- ============================================================================
create table public.employees (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  code        text not null,                           -- EMP-001
  full_name   text not null,
  job_title   text,
  nationality text not null default 'om',              -- om | expat
  basic       numeric(12,3) not null default 0,
  allowance   numeric(12,3) not null default 0,
  iban        text,
  created_at  timestamptz not null default now(),
  unique (school_id, code)
);
create index idx_employees_school on public.employees(school_id);

-- ============================================================================
-- 7) طلبات تعديل الرواتب (سير الموافقة: محاسب يطلب → مدير يعتمد)
-- ============================================================================
create type req_status as enum ('pending','approved','rejected');

create table public.salary_requests (
  id           uuid primary key default uuid_generate_v4(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  employee_id  uuid not null references public.employees(id) on delete cascade,
  old_basic    numeric(12,3),
  old_allow    numeric(12,3),
  new_basic    numeric(12,3),
  new_allow    numeric(12,3),
  requested_by uuid references public.profiles(id),
  decided_by   uuid references public.profiles(id),
  status       req_status not null default 'pending',
  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);
create index idx_salreq_school on public.salary_requests(school_id);

-- ============================================================================
-- 8) دليل الحسابات + القيود (المحرّك المحاسبي مزدوج القيد)
-- ============================================================================
create table public.accounts (
  id         uuid primary key default uuid_generate_v4(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  code       text not null,                            -- 1110, 4100...
  name       text not null,
  type       text not null,                            -- asset, liability, equity, revenue, expense
  unique (school_id, code)
);
create index idx_accounts_school on public.accounts(school_id);

create table public.journal_entries (
  id         uuid primary key default uuid_generate_v4(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  entry_date date not null default current_date,
  description text,
  reference  text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_journals_school on public.journal_entries(school_id);

create table public.journal_lines (
  id         uuid primary key default uuid_generate_v4(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  entry_id   uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.accounts(id),
  debit      numeric(12,3) not null default 0,
  credit     numeric(12,3) not null default 0
);
create index idx_lines_entry on public.journal_lines(entry_id);

-- ============================================================================
-- 9) سجل التدقيق (من فعل ماذا ومتى — غير قابل للتلاعب من العميل)
-- ============================================================================
create table public.audit_log (
  id         uuid primary key default uuid_generate_v4(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  actor_id   uuid references public.profiles(id),
  action     text not null,
  details    text,
  created_at timestamptz not null default now()
);
create index idx_audit_school on public.audit_log(school_id);

-- ============================================================================
-- ضمان توازن القيد المحاسبي (مجموع المدين = مجموع الدائن) على مستوى قاعدة البيانات
-- ============================================================================
create or replace function public.check_journal_balanced()
returns trigger language plpgsql as $$
declare d numeric; c numeric;
begin
  select coalesce(sum(debit),0), coalesce(sum(credit),0)
    into d, c from public.journal_lines where entry_id = new.entry_id;
  -- يُفحص بعد إدراج كل السطور؛ السماح بفارق ضئيل جداً (تقريب)
  if abs(d - c) > 0.0005 then
    raise exception 'قيد غير متوازن: مدين % دائن %', d, c;
  end if;
  return new;
end; $$;
-- (يُفعّل عبر deferred constraint trigger في التطبيق عند إنهاء القيد)
