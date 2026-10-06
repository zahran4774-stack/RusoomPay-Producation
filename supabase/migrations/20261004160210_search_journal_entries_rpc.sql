CREATE OR REPLACE FUNCTION public.search_journal_entries(
  p_from  date DEFAULT NULL,
  p_to    date DEFAULT NULL,
  p_q     text DEFAULT NULL,
  p_limit int  DEFAULT 500
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_school uuid;
  v_from   date;
  v_to     date;
  v_lim    int;
  v_norm   text;
  v_items  jsonb;
  v_total  int;
BEGIN
  v_school := public.my_school_id();
  IF v_school IS NULL OR public.my_role() NOT IN ('owner','admin','accountant','platform_admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  v_from := p_from;
  v_to   := p_to;
  IF v_from IS NOT NULL AND v_to IS NOT NULL AND v_to < v_from THEN
    v_from := p_to;
    v_to   := p_from;
  END IF;

  v_lim := LEAST(GREATEST(COALESCE(p_limit, 500), 1), 1000);

  -- توحيد النص: أحرف صغيرة + أ/إ/آ→ا + ة→ه + ى→ي + إزالة التشكيل + أرقام عربية→لاتينية
  v_norm := NULLIF(btrim(COALESCE(p_q, '')), '');
  IF v_norm IS NOT NULL THEN
    v_norm := translate(lower(v_norm), 'أإآةى٠١٢٣٤٥٦٧٨٩', 'اااهي0123456789');
    v_norm := regexp_replace(v_norm, '[\u064B-\u065F\u0670\u0640]', '', 'g');
  END IF;

  WITH base AS (
    SELECT
      e.id, e.entry_date, e.description, e.reference,
      e.reversed_by_entry, e.reverses_entry, e.created_at,
      st.full_name AS student_name,
      (SELECT COALESCE(SUM(l.debit), 0) FROM public.journal_lines l WHERE l.entry_id = e.id) AS debit_total,
      regexp_replace(
        translate(lower(
          COALESCE(e.description, '') || ' ' || COALESCE(e.reference, '') || ' ' || COALESCE(st.full_name, '') || ' ' || COALESCE(st.code, '')
        ), 'أإآةى٠١٢٣٤٥٦٧٨٩', 'اااهي0123456789'),
        '[\u064B-\u065F\u0670\u0640]', '', 'g'
      ) AS hay
    FROM public.journal_entries e
    LEFT JOIN public.student_fees sf ON sf.id = e.fee_id
    LEFT JOIN public.students st     ON st.id = sf.student_id
    WHERE e.school_id = v_school
      AND (v_from IS NULL OR e.entry_date >= v_from)
      AND (v_to   IS NULL OR e.entry_date <= v_to)
  ), filtered AS (
    SELECT b.* FROM base b
    WHERE v_norm IS NULL
       OR NOT EXISTS (
            SELECT 1 FROM unnest(regexp_split_to_array(v_norm, '\s+')) AS tok
            WHERE tok <> '' AND position(tok IN b.hay) = 0
          )
  )
  SELECT
    (SELECT COUNT(*) FROM filtered),
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', f.id,
        'entry_date', f.entry_date,
        'description', f.description,
        'reference', f.reference,
        'reversed_by_entry', f.reversed_by_entry,
        'reverses_entry', f.reverses_entry,
        'student_name', f.student_name,
        'journal_lines', jsonb_build_array(jsonb_build_object('debit', f.debit_total))
      ) ORDER BY f.entry_date DESC, f.created_at DESC
    ), '[]'::jsonb)
  INTO v_total, v_items
  FROM (SELECT * FROM filtered ORDER BY entry_date DESC, created_at DESC LIMIT v_lim) f;

  RETURN jsonb_build_object('ok', true, 'total', v_total, 'limit', v_lim, 'items', v_items);
END;
$function$;

REVOKE ALL ON FUNCTION public.search_journal_entries(date, date, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_journal_entries(date, date, text, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_journal_entries(date, date, text, int) TO authenticated;