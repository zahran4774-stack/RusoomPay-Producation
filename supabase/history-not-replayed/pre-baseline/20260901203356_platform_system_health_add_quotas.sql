
CREATE OR REPLACE FUNCTION public.platform_system_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result jsonb;
  v_conn jsonb;
  v_queue jsonb;
  v_whatsapp jsonb;
  v_email jsonb;
  v_payments jsonb;
  v_errors jsonb;
  v_quotas jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'غير مصرّح: صحّة النظام لمدير المنصة فقط';
  END IF;

  SELECT jsonb_build_object(
    'total', count(*),
    'active', count(*) FILTER (WHERE state = 'active'),
    'idle', count(*) FILTER (WHERE state = 'idle'),
    'max_connections', (SELECT setting::int FROM pg_settings WHERE name = 'max_connections')
  ) INTO v_conn
  FROM pg_stat_activity
  WHERE datname = current_database();

  SELECT jsonb_build_object(
    'pending', count(*) FILTER (WHERE status IN ('queued','processing')),
    'dead', count(*) FILTER (WHERE status = 'dead'),
    'oldest_pending_seconds', COALESCE(EXTRACT(EPOCH FROM (now() - min(created_at) FILTER (WHERE status IN ('queued','processing')))), 0)
  ) INTO v_queue
  FROM notification_queue;

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

  SELECT jsonb_build_object(
    'last_paid_at', max(created_at) FILTER (WHERE to_state = 'paid'),
    'last_failed_at', max(created_at) FILTER (WHERE to_state = 'failed'),
    'paid_24h', count(*) FILTER (WHERE to_state = 'paid' AND created_at > now() - interval '24 hours'),
    'failed_24h', count(*) FILTER (WHERE to_state = 'failed' AND created_at > now() - interval '24 hours')
  ) INTO v_payments
  FROM payment_state_log;

  SELECT jsonb_build_object(
    'critical_24h', count(*) FILTER (WHERE severity = 'critical' AND created_at > now() - interval '24 hours'),
    'unresolved_total', count(*) FILTER (WHERE resolved IS NOT TRUE)
  ) INTO v_errors
  FROM error_log;

  -- حصص Supabase الفعلية القابلة للقياس مباشرة من القاعدة (بدون API خارجي):
  -- حجم قاعدة البيانات ومساحة التخزين، ضد حدود الخطة المجانية.
  SELECT jsonb_build_object(
    'db_size_bytes', pg_database_size(current_database()),
    'db_limit_bytes', 500 * 1024 * 1024,
    'storage_size_bytes', COALESCE((SELECT SUM((metadata->>'size')::bigint) FROM storage.objects), 0),
    'storage_limit_bytes', 1024 * 1024 * 1024
  ) INTO v_quotas;

  v_result := jsonb_build_object(
    'connections', v_conn,
    'queue', v_queue,
    'whatsapp', v_whatsapp,
    'email', v_email,
    'payments', v_payments,
    'errors', v_errors,
    'quotas', v_quotas,
    'generated_at', now()
  );

  RETURN v_result;
END;
$function$;
