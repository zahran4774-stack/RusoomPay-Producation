CREATE OR REPLACE FUNCTION public.trial_balance_period(p_from date, p_to date)
 RETURNS TABLE(account_id uuid, code text, name text, type text, debit numeric, credit numeric, balance numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- استبعاد قيود اختبارية أُدرجت مباشرة بقاعدة البيانات (مرجعها JV-<timestamp>،
  -- وصف فارغ، لا يمكن أن تنشأ من create_manual_journal_entry اللي يفرض وصفاً)
  -- وأزواجها العكسية (REV-JV-...) من الإجمالي الظاهر بميزان المراجعة، رغم أن
  -- الصافي أصلاً صحيح بفضل قيود العكس.
  with period_lines as (
    select l.account_id, l.debit, l.credit
    from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id
    where e.school_id = public.my_school_id()
      and e.entry_date >= p_from and e.entry_date <= p_to
      and e.reference !~ '^(REV-)?JV-[0-9]+$'
  )
  select a.id, a.code, a.name, a.type,
    coalesce(round(sum(pl.debit), 3), 0) as debit,
    coalesce(round(sum(pl.credit), 3), 0) as credit,
    coalesce(round(sum(pl.debit - pl.credit), 3), 0) as balance
  from public.accounts a
  left join period_lines pl on pl.account_id = a.id
  where a.school_id = public.my_school_id()
  group by a.id, a.code, a.name, a.type
  order by a.code;
$function$;