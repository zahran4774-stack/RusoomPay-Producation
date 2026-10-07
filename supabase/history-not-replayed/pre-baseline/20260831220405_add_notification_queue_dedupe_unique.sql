
-- dedupe_key ما كان عليه قيد UNIQUE فعلياً — يعني لو اشتغل عامل التذكيرات مرتين بنفس اليوم
-- كان بيكرر نفس التذكير. هذا يضيف الحماية الفعلية ويمكّن upsert...onConflict من العمل.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_queue_dedupe_key
  ON public.notification_queue (dedupe_key)
  WHERE dedupe_key IS NOT NULL;
