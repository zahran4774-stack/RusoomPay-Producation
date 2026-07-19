'use client'
// app/(app)/dashboard/CopilotWithActions.tsx
// غلاف عميل حول SchoolCopilot — يمنحه القدرة على تنفيذ التوصيات:
// عند الضغط، يسجّل التوصية (لقياس أثرها) ثم ينتقل لمكان الإجراء.
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import SchoolCopilot from './SchoolCopilot'

type SmartRec = {
  type: string; priority: number; title: string; reason: string
  action_label: string; action: string
  target_count: number | null; expected_amount: number | null
}

// أين يذهب كل إجراء
const ROUTES: Record<string, string> = {
  send_overdue_reminders: '/fees#overdue',
  view_partial: '/fees',
  view_nofee: '/students',
  invite_parents: '/students#invite-parents',
}

export default function CopilotWithActions({
  data, sym, firstName, schoolName, smartRecs, impact,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  sym: string
  firstName: string
  schoolName?: string
  smartRecs: SmartRec[]
  impact: { actions_this_month?: number; collected_this_month?: number } | null
}) {
  const router = useRouter()
  const supabase = createClient()

  async function handleAct(rec: SmartRec) {
    // سجّل التنفيذ — هذه بداية حلقة قياس الأثر
    try {
      await supabase.rpc('log_recommendation_action', {
        p_rec_type: rec.type,
        p_rec_title: rec.title,
        p_target_count: rec.target_count,
        p_expected_amount: rec.expected_amount,
      })
    } catch {
      // فشل التسجيل لا يمنع الانتقال — الأولوية لعمل المستخدم
    }
    router.push(ROUTES[rec.action] ?? '/dashboard')
  }

  return (
    <SchoolCopilot
      data={data}
      sym={sym}
      firstName={firstName}
      schoolName={schoolName}
      smartRecs={smartRecs}
      impact={impact}
      onAct={handleAct}
    />
  )
}
