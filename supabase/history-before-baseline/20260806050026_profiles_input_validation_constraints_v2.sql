ALTER TABLE public.profiles
  ADD CONSTRAINT chk_full_name_length CHECK (
    full_name IS NULL OR (length(trim(full_name)) BETWEEN 1 AND 100)
  ),
  ADD CONSTRAINT chk_full_name_no_html CHECK (
    full_name IS NULL OR full_name !~ '<[^>]*>'
  ),
  ADD CONSTRAINT chk_phone_format CHECK (
    phone IS NULL OR phone = '' OR phone ~ '^[0-9]{7,15}$'
  );