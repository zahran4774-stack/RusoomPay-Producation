
CREATE OR REPLACE FUNCTION public.platform_system_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_conn jsonb;
  v_queue jsonb;
  v_whatsapp jsonb;
  v_email jsonb;
  v_payments jsonb;
  v_errors jsonb;
BEGIN
  IF my_role() IS DISTINCT FROM 'platform_admin'::user_role THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- اتصالات قاعدة البيانات الحالية
  SELECT jsonb_build_object(
    'total', count(*),
    'active', count(*) FILTER (WHERE state = 'active'),
    'idle', count(*) FILTER (WHERE state = 'idle'),
    'max_connections', (SELECT setting::int FROM pg_settings WHERE name = 'max_connections')
  ) INTO v_conn
  FROM pg_stat_activity
  WHERE datname = current_database();

  -- طابور الإشعارات العام
  SELECT jsonb_build_object(
    'pending', count(*) FILTER (WHERE status IN ('queued','processing')),
    'dead', count(*) FILTER (WHERE status = 'dead'),
    'oldest_pending_seconds', COALESCE(EXTRACT(EPOCH FROM (now() - min(created_at) FILTER (WHERE status IN ('queued','processing')))), 0)
  ) INTO v_queue
  FROM notification_queue;

  -- نسبة نجاح آخر 100 رسالة واتساب
  SELECT jsonb_build_object(
    'sample_size', count(*),
    'sent', count(*) FILTER (WHERE status = 'sent'),
    'failed', count(*) FILTER (WHERE status IN ('failed','dead')),
    'last_sent_at', max(sent_at) FILTER (WHERE status = 'sent')
  ) INTO v_whatsapp
  FROM (
    SELECT status, sent_at FROM notification_queue
    WHERE channel = 'whatsapp' AND status IN ('sent','failed','dead')
    ORDER BY created_at DESC LIMIT 100
  ) w;

  -- نسبة نجاح آخر 100 بريد
  SELECT jsonb_build_object(
    'sample_size', count(*),
    'sent', count(*) FILTER (WHERE status = 'sent'),
    'failed', count(*) FILTER (WHERE status IN ('failed','dead')),
    'last_sent_at', max(sent_at) FILTER (WHERE status = 'sent')
  ) INTO v_email
  FROM (
    SELECT status, sent_at FROM notification_queue
    WHERE channel = 'email' AND status IN ('sent','failed','dead')
    ORDER BY created_at DESC LIMIT 100
  ) e;

  -- بوابة الدفع: آخر تأكيد ناجح/فاشل + عدد آخر 24 ساعة
  SELECT jsonb_build_object(
    'last_paid_at', max(created_at) FILTER (WHERE to_state = 'paid'),
    'last_failed_at', max(created_at) FILTER (WHERE to_state = 'failed'),
    'paid_24h', count(*) FILTER (WHERE to_state = 'paid' AND created_at > now() - interval '24 hours'),
    'failed_24h', count(*) FILTER (WHERE to_state = 'failed' AND created_at > now() - interval '24 hours')
  ) INTO v_payments
  FROM payment_state_log;

  -- الأخطاء الحرجة
  SELECT jsonb_build_object(
    'critical_24h', count(*) FILTER (WHERE severity = 'critical' AND created_at > now() - interval '24 hours'),
    'unresolved_total', count(*) FILTER (WHERE resolved IS NOT TRUE)
  ) INTO v_errors
  FROM error_log;

  v_result := jsonb_build_object(
    'connections', v_conn,
    'queue', v_queue,
    'whatsapp', v_whatsapp,
    'email', v_email,
    'payments', v_payments,
    'errors', v_errors,
    'generated_at', now()
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_system_health() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.platform_system_health() TO authenticated;
