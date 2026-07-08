// app/(app)/settings/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import MfaSetup from './MfaSetup'
import SchoolBranding from './SchoolBranding'
import VatSetting from './VatSetting'
import IntelligencePanel from './IntelligencePanel'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // جلب دور المستخدم وهوية مدرسته (للمدير فقط تظهر أدوات الهوية)
  const { data: profile } = await supabase.from('profiles').select('role, school_id').eq('id', user.id).maybeSingle()
  const isOwner = profile?.role === 'owner'
  let logo: string | null = null
  let color: string | null = null
  if (isOwner && profile?.school_id) {
    const { data: school } = await supabase.from('schools').select('logo_url, color').eq('id', profile.school_id).maybeSingle()
    logo = school?.logo_url ?? null
    color = school?.color ?? null
  }

  // إعداد الضريبة حسب قانون الدولة (لكل المستخدمين للعرض، التعديل للمدير)
  const { data: vat } = await supabase.rpc('my_vat_setting').maybeSingle() as {
   data: { vat_mode?: string; vat_rate?: number; applies?: boolean } | null
 }
  // طبقة الذكاء — حالة المحرّكات (School Intelligence Core)
  const { data: engines } = await supabase.rpc('intelligence_status')

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }} dir="rtl">
      <h1 style={{ color: '#0F2744', fontSize: 24, marginBottom: 4 }}>الإعدادات</h1>
      <p style={{ color: '#667', fontSize: 14, marginBottom: 24 }}>إدارة أمان حسابك وهوية مدرستك.</p>
      <MfaSetup />
      <SchoolBranding initialLogo={logo} initialColor={color} canEdit={isOwner} />
      {vat && (
        <VatSetting
          mode={(vat.vat_mode ?? 'none') as 'mandatory' | 'optional' | 'none'}
          rate={vat.vat_rate ?? 0}
          enabled={vat.applies ?? false}
          canEdit={isOwner}
        />
      )}
      {engines && engines.length > 0 && (
        <IntelligencePanel initial={engines} canEdit={isOwner} />
      )}
    </div>
  )
}
