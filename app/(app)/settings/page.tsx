// app/(app)/settings/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import MfaSetup from './MfaSetup'
import SchoolBranding from './SchoolBranding'
import VatSetting from './VatSetting'
import IntelligencePanel from './IntelligencePanel'
import StaffInvites from './StaffInvites'
import SchoolBackup from './SchoolBackup'
import SectionStyleSetting from './SectionStyleSetting'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // جلب دور المستخدم وهوية مدرسته (للمدير فقط تظهر أدوات الهوية)
  const { data: profile } = await supabase.from('profiles').select('role, school_id').eq('id', user.id).maybeSingle()
  const isOwner = profile?.role === 'owner'

  // إعداد الضريبة حسب قانون الدولة (لكل المستخدمين للعرض، التعديل للمدير)
  const vatRes = await supabase.rpc('my_vat_setting').maybeSingle()
  const vat = vatRes.data as { vat_mode?: string; vat_rate?: number; applies?: boolean } | null

  let logo: string | null = null
  let color: string | null = null
  let schoolName: string | null = null
  let sectionStyles: string[] = ['ar_letters']
  if (isOwner && profile?.school_id) {
    const { data: school } = await supabase.from('schools').select('logo_url, color, name, section_styles').eq('id', profile.school_id).maybeSingle()
    logo = school?.logo_url ?? null
    color = school?.color ?? null
    schoolName = school?.name ?? null
    sectionStyles = school?.section_styles ?? ['ar_letters']
  }

  // طبقة الذكاء — حالة المحرّكات (School Intelligence Core)
  const { data: engines } = await supabase.rpc('intelligence_status')

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }} dir="rtl">
      <h1 style={{ color: '#0F2744', fontSize: 24, marginBottom: 4 }}>الإعدادات</h1>
      <p style={{ color: '#667', fontSize: 14, marginBottom: 24 }}>إدارة أمان حسابك وهوية مدرستك.</p>
      <MfaSetup />
      <SchoolBranding initialLogo={logo} initialColor={color} canEdit={isOwner} />
      {isOwner && <SectionStyleSetting initial={sectionStyles} canEdit={isOwner} />}
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
      {isOwner && <div style={{ marginTop: 18 }}><SchoolBackup schoolName={schoolName ?? undefined} /></div>}
      {isOwner && <StaffInvites />}
    </div>
  )
}
