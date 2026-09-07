'use client'
// مبدّل الفروع — يظهر فقط للمالك ولو كان يملك أكثر من فرع (عبر عضويات فعّالة).
// عند التبديل: يستدعي switch_active_school() (يتحقق من عضوية فعّالة قبل الكتابة)
// ثم يعيد تحميل الصفحة كاملة لضمان تحديث كل البيانات المرتبطة بالمدرسة النشطة.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { Building2, ChevronDown, LayoutGrid } from 'lucide-react'

type BranchRow = {
  school_id: string
  school_name: string
  branch: string | null
  role: string
  is_active_context: boolean
}

export default function BranchSwitcher() {
  const pathname = usePathname()
  const [branches, setBranches] = useState<BranchRow[] | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.rpc('my_schools').then(({ data }) => {
      if (!cancelled && data) setBranches(data as BranchRow[])
    })
    return () => { cancelled = true }
  }, [])

  // أقل من فرعين → لا داعي لعرض المبدّل إطلاقاً
  if (!branches || branches.length < 2) return null

  const active = branches.find((b) => b.is_active_context) ?? branches[0]

  async function switchTo(schoolId: string) {
    if (schoolId === active.school_id || busy) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.rpc('switch_active_school', { p_school_id: schoolId })
    if (error) {
      setBusy(false)
      alert('تعذّر تبديل الفرع: ' + error.message)
      return
    }
    // إعادة تحميل كاملة — تضمن أن كل بيانات الصفحة (طلاب، رسوم، إلخ) تُجلب من الفرع الجديد
    window.location.reload()
  }

  return (
    <div style={{ margin: '4px 14px 10px' }}>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={busy}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            background: 'var(--brand-tint-08)', border: '1px solid var(--brand-tint-22)',
            borderRadius: 10, padding: '9px 12px', cursor: busy ? 'default' : 'pointer',
            font: 'inherit', textAlign: 'right', color: '#0F2744',
          }}
        >
          <Building2 size={17} strokeWidth={2} style={{ color: 'var(--brand)' }} />
          <span style={{ flex: 1, fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {active.school_name}{active.branch ? ` — ${active.branch}` : ''}
          </span>
          <ChevronDown size={15} strokeWidth={2} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: '100%', insetInlineStart: 0, insetInlineEnd: 0, marginTop: 4,
            background: '#fff', border: '1px solid #E3E8EE', borderRadius: 10,
            boxShadow: '0 6px 20px rgba(10,37,64,.12)', zIndex: 50, overflow: 'hidden',
          }}>
            {branches.map((b) => (
              <button
                key={b.school_id}
                type="button"
                onClick={() => { setOpen(false); switchTo(b.school_id) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'right', padding: '10px 12px',
                  background: b.is_active_context ? 'var(--brand-tint-08)' : '#fff',
                  border: 0, borderBottom: '1px solid #F0F3F7', cursor: 'pointer',
                  font: 'inherit', fontSize: 13.5, fontWeight: b.is_active_context ? 700 : 500,
                  color: '#0F2744',
                }}
              >
                {b.school_name}{b.branch ? ` — ${b.branch}` : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* رابط النظرة التجميعية — يظهر بنفس شرط ظهور المبدّل (فرعان فأكثر) */}
      <Link
        href="/organization"
        style={{
          display: 'flex', alignItems: 'center', gap: 7, marginTop: 6,
          padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
          color: pathname === '/organization' ? 'var(--brand)' : '#667',
          textDecoration: 'none',
        }}
      >
        <LayoutGrid size={14} strokeWidth={2} />
        نظرة عامة على كل الفروع
      </Link>
    </div>
  )
}
