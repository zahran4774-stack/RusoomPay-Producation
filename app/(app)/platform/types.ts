// app/(app)/platform/types.ts
// أنواع لوحة مالك المنصّة — مشتركة بين الصفحة ومكوّناتها.
// (نُقلت من page.tsx لأن Next.js يمنع تصدير الأنواع المخصّصة من ملفات الصفحات.)

export type Sub = {
  school_id: string; school_name: string; country: string | null
  plan: string | null; status: string | null
  created_at: string | null; renews_at: string | null; amount: number | null
}

export type SchoolStat = {
  school_id: string; school_name: string; country: string | null
  students: number; employees: number
  fees_total: number; fees_paid: number; collection_rate: number
  last_activity: string | null
}

export type AuditRow = {
  id: string; school_name: string | null; actor_name: string
  action: string; details: string | null; created_at: string
}

export type FeedbackRow = {
  id: string; school_name: string | null; author_name: string | null
  kind: string; priority: string; body: string; status: string
  reply: string | null; created_at: string
}
