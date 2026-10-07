-- 1. Pin search_path on flagged functions (pure-logic, safe)
ALTER FUNCTION public.block_journal_mutation() SET search_path = '';
ALTER FUNCTION public.check_journal_balanced() SET search_path = '';
ALTER FUNCTION public.is_valid_gulf_phone(text) SET search_path = '';
ALTER FUNCTION public.normalize_phone(text, text) SET search_path = '';

-- 2. Restrict logos bucket listing (bucket is public, so image URLs still work)
DROP POLICY IF EXISTS logos_read ON storage.objects;
CREATE POLICY logos_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = (
      SELECT profiles.school_id::text FROM public.profiles WHERE profiles.id = auth.uid()
    )
  );