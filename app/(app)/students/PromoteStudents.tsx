'use client'
// ترقية نهاية العام الدراسي — نقل الطلاب للصف التالي دفعة واحدة.
// الافتراضي: الجميع ناجح. الطاقم يحدّد المعيدين فقط (الأقلّية).
// الصف الأخير → متخرّج. الرسوم غير المسدّدة تبقى كما هي (دين مستمر).
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { GRADES } from '@/lib/academic'

type Student = { id: string; code: string; full_name: string; grade: string; section: string | null; status: string }

const LAST_GRADE = 'الثاني عشر'

// العام الدراسي الحالي بصيغة 2025/2026 (يبدأ في سبتمبر)
function currentAcademicYear(): string {
  const now = new Date()
  const y = now.getFullYear()
  const start = now.getMonth() >= 8 ? y : y - 1   // سبتمبر = الشهر 8
  return `${start}/${start + 1}`
}

function nextGrade(grade: string): string | null {
  const i = (GRADES as readonly string[]).indexOf(grade.trim())
  if (i === -1 || i >= GRADES.length - 1) return null
  return GRADES[i + 1]
}

export default function PromoteStudents({ students }: { students: Student[] }) {
  const router = useRouter()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(currentAcademicYear())
  const [repeatIds, setRepeatIds] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // الطلاب النشطون فقط — مرتّبون بالصف
  const active = useMemo(
    () => students
      .filter((s) => s.status === 'active')
      .sort((a, b) => {
        const ga = (GRADES as readonly string[]).indexOf(a.grade)
        const gb = (GRADES as readonly string[]).indexOf(b.grade)
        if (ga !== gb) return ga - gb
        return (a.section ?? '').localeCompare(b.section ?? '', 'ar')
      }),
    [students]
  )

  // ماذا سيحدث؟ حساب فوري في الواجهة
  const preview = useMemo(() => {
    let promote = 0, graduate = 0, repeat = 0, unknown = 0
    for (const s of active) {
      if (repeatIds.has(s.id)) { repeat++; continue }
      const ng = nextGrade(s.grade)
      if (ng) promote++
      else if (s.grade.trim() === LAST_GRADE) graduate++
      else unknown++
    }
    return { promote, graduate, repeat, unknown }
  }, [active, repeatIds])

  function toggleRepeat(id: string) {
    setRepeatIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function execute() {
    setBusy(true); setMsg(null)
    const { data, error } = await supabase.rpc('promote_students', {
      p_academic_year: year,
      p_repeat_ids: Array.from(repeatIds),
    })
    setBusy(false)

    if (error) { setMsg({ ok: false, text: error.message }); setConfirming(false); return }

    const res = (data ?? {}) as { ok?: boolean; reason?: string; message?: string; promoted?: number; repeated?: number; graduated?: number }
    if (!res.ok) {
      setMsg({ ok: false, text: res.message ?? 'تعذّر تنفيذ الترقية' })
      setConfirming(false)
      return
    }

    setMsg({
      ok: true,
      text: `تمّت الترقية — رُقّي ${res.promoted} طالباً · أعاد ${res.repeated} · تخرّج ${res.graduated}`,
    })
    setConfirming(false)
    setRepeatIds(new Set())
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ background: '#F2F5F8', color: '#0F2744', border: '1px solid #E3E8EE', padding: '10px 18px', borderRadius: 11, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
        🎓 ترقية نهاية العام
      </button>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 16, padding: 22, marginBottom: 16, boxShadow: '0 10px 30px -18px rgba(10,37,64,.3)' }} dir="rtl">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <b style={{ color: '#0F2744', fontSize: 16 }}>ترقية نهاية العام الدراسي</b>
        <button onClick={() => { setOpen(false); setMsg(null); setConfirming(false) }}
          style={{ background: 'none', border: 0, fontSize: 21, cursor: 'pointer', color: '#667' }}>×</button>
      </div>
      <p style={{ color: '#667', fontSize: 13.5, margin: '0 0 18px', lineHeight: 1.85 }}>
        ينتقل كل طالب نشط إلى الصف التالي. طلاب <b>{LAST_GRADE}</b> يصبحون متخرّجين.
        حدّد <b>المعيدين</b> فقط — الباقون يُرقّون تلقائياً. الرسوم غير المسدّدة تبقى مستحقّة.
      </p>

      {/* العام الدراسي */}
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0F2744', marginBottom: 6 }}>العام الدراسي المنتهي</label>
      <input value={year} onChange={(e) => setYear(e.target.value)} dir="ltr"
        style={{ width: 180, padding: '9px 12px', borderRadius: 10, border: '1px solid #E3E8EE', fontSize: 14, fontFamily: 'inherit', marginBottom: 16 }} />

      {/* المعاينة */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 18 }}>
        <Box label="سيُرقّى" value={preview.promote} color="#067647" />
        <Box label="سيعيد" value={preview.repeat} color="#B54708" />
        <Box label="سيتخرّج" value={preview.graduate} color="#2E5EA8" />
        {preview.unknown > 0 && <Box label="صف غير معروف" value={preview.unknown} color="#C0392B" />}
      </div>

      {preview.unknown > 0 && (
        <div style={{ background: '#FDECEA', border: '1px solid #F3C9C2', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#A5331F', marginBottom: 16, lineHeight: 1.7 }}>
          ⚠ {preview.unknown} طالب بصف غير معروف — لن يُرقّوا. راجع صفوفهم أولاً.
        </div>
      )}

      {/* قائمة الطلاب — تحديد المعيدين */}
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F2744', marginBottom: 8 }}>
        حدّد المعيدين ({repeatIds.size} محدّد)
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #EEF1F5', borderRadius: 12 }}>
        {active.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: '#8A94A6', fontSize: 14 }}>لا طلاب نشطون</div>
        )}
        {active.map((s, i) => {
          const isRepeat = repeatIds.has(s.id)
          const ng = nextGrade(s.grade)
          const dest = isRepeat ? s.grade : (ng ?? (s.grade.trim() === LAST_GRADE ? 'متخرّج' : '—'))
          return (
            <label key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', cursor: 'pointer',
              borderTop: i === 0 ? 'none' : '1px solid #F2F5F8',
              background: isRepeat ? '#FFF9EC' : '#fff',
            }}>
              <input type="checkbox" checked={isRepeat} onChange={() => toggleRepeat(s.id)}
                style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#B54708' }} />
              <span style={{ flex: 1, fontSize: 14, color: '#1A2530' }}>
                {s.full_name}
                <span style={{ color: '#8A94A6', fontSize: 12.5 }}> · {s.code}</span>
              </span>
              <span style={{ fontSize: 12.5, color: '#667', whiteSpace: 'nowrap' }}>
                {s.grade}{s.section ? `/${s.section}` : ''}
                <span style={{ color: '#8A94A6' }}> ← </span>
                <b style={{ color: isRepeat ? '#B54708' : '#067647' }}>{dest}</b>
              </span>
            </label>
          )
        })}
      </div>

      {msg && (
        <div style={{
          marginTop: 16, borderRadius: 10, padding: '11px 14px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.7,
          background: msg.ok ? '#EAF7F0' : '#FDECEA',
          border: `1px solid ${msg.ok ? '#BFE5D0' : '#F3C9C2'}`,
          color: msg.ok ? '#15803D' : '#A5331F',
        }}>{msg.text}</div>
      )}

      {/* التأكيد قبل التنفيذ — عملية لا رجعة فيها */}
      {confirming ? (
        <div style={{ marginTop: 18, background: '#FBF3D5', border: '1px solid #EAD9A0', borderRadius: 12, padding: 16 }}>
          <b style={{ color: '#7A5C0A', fontSize: 14.5 }}>تأكيد الترقية</b>
          <p style={{ color: '#8A6D0F', fontSize: 13, margin: '6px 0 14px', lineHeight: 1.8 }}>
            سيُرقّى {preview.promote} طالباً، ويعيد {preview.repeat}، ويتخرّج {preview.graduate}.
            <br />هذه العملية <b>لا يمكن التراجع عنها</b>، وتُنفَّذ مرّة واحدة للعام {year}.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={execute} disabled={busy}
              style={{ background: busy ? '#8AA' : '#B54708', color: '#fff', border: 0, padding: '10px 22px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {busy ? 'جارٍ التنفيذ…' : 'نعم، نفّذ الترقية'}
            </button>
            <button onClick={() => setConfirming(false)} disabled={busy}
              style={{ background: '#fff', color: '#7A5C0A', border: '1px solid #EAD9A0', padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              رجوع
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} disabled={active.length === 0}
          style={{ marginTop: 18, background: active.length === 0 ? '#CBD5E1' : '#163B68', color: '#fff', border: 0, padding: '12px 26px', borderRadius: 11, fontWeight: 800, fontSize: 15, cursor: active.length === 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          مراجعة وتنفيذ الترقية
        </button>
      )}
    </div>
  )
}

function Box({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#FAFBFC', border: '1px solid #EEF1F5', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 12, color: '#8A94A6', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'Cairo, sans-serif' }}>{value}</div>
    </div>
  )
}
