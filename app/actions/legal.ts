'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { LEGAL_VERSIONS } from '@/lib/legal';

export async function recordConsent(schoolId?: string | null) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'غير مصرح' };

  const h = await headers();
  const ip =
    h.get('x-nf-client-connection-ip') ??
    h.get('x-forwarded-for')?.split(',')[0].trim() ??
    null;
  const ua = h.get('user-agent') ?? null;

  const rows = (Object.keys(LEGAL_VERSIONS) as Array<keyof typeof LEGAL_VERSIONS>).map(
    (doc) => ({
      user_id: user.id,
      school_id: schoolId ?? null,
      document_type: doc,
      version: LEGAL_VERSIONS[doc],
      ip_address: ip,
      user_agent: ua,
    })
  );

  const { error } = await supabase
    .from('legal_consents')
    .upsert(rows, { onConflict: 'user_id,document_type,version', ignoreDuplicates: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
