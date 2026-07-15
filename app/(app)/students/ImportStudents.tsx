'use client'
// استيراد الطلاب جماعياً — قالب CSV يفتحه Excel مباشرة (بلا مكتبات خارجية)
// التحقّق من الصف/الشعبة ضد القائمة المعتمدة يمنع عودة تكرار الشُعب.
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { GRADES, SECTIONS, isValidGrade, isValidSection } from '@/lib/academic'

type Row = Record<string, string>
type Result = { ok: number; failed: number; errors: { row: number; name: string; error: string }[] }
// صف بعد التحقّق: يحمل رقمه الأصلي وقائمة مشاكله (إن وُجدت)
type Checked = { row: Row; line: number; issues: string[] }

const HEADERS = [
  'الاسم الكامل', 'الصف', 'الشعبة', 'اسم ولي الأمر', 'رقم ولي الأمر',
  'بريد ولي الأمر', 'تاريخ الميلاد', 'الجنس', 'الرسوم السنوية',
]
const KEYS = [
  'full_name', 'grade', 'section', 'guardian_name', 'guardian_phone',
  'guardian_email', 'birth_date', 'gender', 'annual_fee',
]

// محلّل CSV بسيط يدعم الحقول المقتبسة
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false
      } else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') { cur.push(field); field = '' }
    else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field || cur.length) { cur.push(field); rows.push(cur) }
  return rows.filter((r) => r.some((c) => c.trim()))
}

// تحقّق صف واحد — يعيد قائمة المشاكل (فارغة = سليم)
function checkRow(o: Row): string[] {
  const issues: string[] = []
  if (!o.full_name?.trim()) issues.push('الاسم مفقود')
  if (!o.grade?.trim()) {
    issues.push('الصف مفقود')
  } else if (!isValidGrade(o.grade.trim())) {
    issues.push(`الصف "${o.grade}" غير معتمد`)
  }
  // الشعبة اختيارية، لكن إن وُجدت يجب أن تكون معتمدة
  if (o.section?.trim() && !isValidSection(o.section.trim())) {
    issues.push(`الشعبة "${o.section}" غير معتمدة`)
  }
  return issues
}

export default function ImportStudents() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [checked, setChecked] = useState<Checked[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const validRows = checked.filter((c) => c.issues.length === 0)
  const invalidRows = checked.filter((c) => c.issues.length > 0)

  function downloadTemplate() {
    // BOM لضمان قراءة Excel للعربية بشكل صحيح
    // العيّنة تستخدم القيم المعتمدة بالضبط ("الخامس" لا "الصف الخامس")
    const sample = ['محمد أحمد الكندي', 'الخامس', 'أ', 'أحمد الكندي', '99123456', 'parent@email.com', '2014-05-20', 'male', '900']
    const csv = '\uFEFF' + HEADERS.join(',') + '\n' + sample.join(',') + '\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'RusoomPay-قالب-الطلاب.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null); setResult(null); setChecked([])
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const grid = parseCSV(String(reader.result ?? ''))
        if (grid.length < 2) { setErr('الملف فارغ أو لا يحتوي بيانات'); return }
        const header = grid[0].map((h) => h.trim())
        const idx = HEADERS.map((h) => header.indexOf(h))
        const useOrder = idx.some((i) => i === -1)
        const out: Checked[] = grid.slice(1).map((r, ri) => {
          const o: Row = {}
          KEYS.forEach((k, i) => {
            const col = useOrder ? i : idx[i]
            o[k] = (col >= 0 ? (r[col] ?? '') : '').trim()
          })
          return { row: o, line: ri + 2, issues: checkRow(o) } // line: رقم السطر في الملف (بعد الترويسة)
        }).filter((c) => c.row.full_name || c.issues.length)
        if (!out.length) { setErr('لم يُعثر على صفوف صالحة (عمود الاسم فارغ)'); return }
        setChecked(out)
      } catch {
        setErr('تعذّرت قراءة الملف. تأكّد أنه بصيغة CSV.')
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  async function submit() {
    // نرسل الصفوف السليمة فقط — المخالفة تبقى معروضة ليصحّحها المستخدم
    const rows = validRows.map((c) => c.row)
    setBusy(true); setErr(null)
    const { data, error } = await supabase.rpc('import_students', { p_rows: rows })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setResult(data as Result)
    setChecked([])
    if (fileRef.current) fileRef.current.value = ''
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ background: '#F2F5F8', color: '#0F2744', border: '1px solid #E3E8EE', padding: '12px 20px', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
        ⇪ استيراد من ملف
      </button>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 18, padding: 24, marginBottom: 18, boxShadow: '0 12px 34px -20px rgba(10,37,64,.25)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h3 style={{ color: '#0F2744', margin: 0, fontSize: 18 }}>استيراد الطلاب من ملف</h3>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 0, fontSize: 22, cursor: 'pointer', color: '#667' }}>×</button>
      </div>
      <p style={{ color: '#667', fontSize: 13, margin: '0 0 16px', lineHeight: 1.8 }}>
        نزّل القالب، املأه في Excel، ثم احفظه بصيغة <b>CSV UTF-8</b> وارفعه.
        الرقم المدرسي يُولَّد تلقائياً.
      </p>

      {/* دليل القيم المعتمدة — يقلّل أخطاء الإدخال */}
      <div style={{ background: '#F7FAFC', border: '1px solid #E3E8EE', borderRadius: 11, padding: '12px 16px', marginBottom: 16, fontSize: 12.5, lineHeight: 1.9 }}>
        <div style={{ color: '#0F2744', fontWeight: 700, marginBottom: 4 }}>القيم المعتمدة:</div>
        <div style={{ color: '#667' }}><b>الصف:</b> {GRADES.join('، ')}</div>
        <div style={{ color: '#667' }}><b>الشعبة:</b> {SECTIONS.join('، ')}</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <button onClick={downloadTemplate}
          style={{ background: '#0F2744', color: '#fff', border: 0, padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
          ⬇ تنزيل القالب
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile}
          style={{ fontSize: 13, fontFamily: 'inherit' }} />
      </div>

      {err && <div style={{ color: '#C0392B', fontWeight: 600, fontSize: 14, marginBottom: 12 }}>⚠ {err}</div>}

      {/* صفوف مخالفة — تُعرض للتصحيح ولا تُستورد */}
      {invalidRows.length > 0 && (
        <div style={{ background: '#FFF6E6', border: '1px solid #FFE0A3', borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, color: '#B54708', marginBottom: 8 }}>
            ⚠ {invalidRows.length} صف يحتاج تصحيحاً — لن يُستورد
          </div>
          <ul style={{ margin: 0, paddingRight: 18, fontSize: 13, color: '#B54708', lineHeight: 1.9, maxHeight: 160, overflowY: 'auto' }}>
            {invalidRows.slice(0, 20).map((c, i) => (
              <li key={i}>صف {c.line} ({c.row.full_name || 'بلا اسم'}): {c.issues.join('، ')}</li>
            ))}
          </ul>
          <div style={{ color: '#B54708', fontSize: 12.5, marginTop: 8 }}>
            صحّح هذه الصفوف في الملف وأعد رفعه، أو استورد السليمة فقط.
          </div>
        </div>
      )}

      {checked.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ background: '#F7FAFC', border: '1px solid #E3E8EE', borderRadius: 11, padding: '12px 16px', marginBottom: 12 }}>
            <b style={{ color: '#067647' }}>{validRows.length}</b> <span style={{ color: '#667', fontSize: 14 }}>طالب جاهز للاستيراد</span>
            {invalidRows.length > 0 && (
              <span style={{ color: '#B54708', fontSize: 14 }}> · <b>{invalidRows.length}</b> مستبعَد</span>
            )}
          </div>
          {validRows.length > 0 && (
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #EDF1F5', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ background: '#F7FAFC', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '8px 10px', textAlign: 'right', color: '#667', fontSize: 12 }}>الاسم</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', color: '#667', fontSize: 12 }}>الصف</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', color: '#667', fontSize: 12 }}>الشعبة</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', color: '#667', fontSize: 12 }}>ولي الأمر</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', color: '#667', fontSize: 12 }}>الرسوم</th>
                  </tr>
                </thead>
                <tbody>
                  {validRows.slice(0, 50).map((c, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #F2F5F8' }}>
                      <td style={{ padding: '8px 10px' }}>{c.row.full_name}</td>
                      <td style={{ padding: '8px 10px' }}>{c.row.grade}</td>
                      <td style={{ padding: '8px 10px' }}>{c.row.section || '—'}</td>
                      <td style={{ padding: '8px 10px' }}>{c.row.guardian_name || '—'}</td>
                      <td style={{ padding: '8px 10px', direction: 'ltr', textAlign: 'right' }}>{c.row.annual_fee || '0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {validRows.length > 0 && (
            <button onClick={submit} disabled={busy}
              style={{ marginTop: 14, background: busy ? '#8AA' : '#163B68', color: '#fff', border: 0, padding: '12px 26px', borderRadius: 11, fontWeight: 800, fontSize: 15, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {busy ? 'جارٍ الاستيراد…' : `استيراد ${validRows.length} طالب`}
            </button>
          )}
        </div>
      )}

      {result && (
        <div style={{ background: result.failed ? '#FFF6E6' : '#E4F7EF', border: `1px solid ${result.failed ? '#FFE0A3' : '#B7E4CE'}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 800, color: result.failed ? '#B54708' : '#067647', marginBottom: result.failed ? 8 : 0 }}>
            ✓ استُورد {result.ok} طالب{result.failed ? ` · فشل ${result.failed}` : ''}
          </div>
          {result.errors?.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingRight: 18, fontSize: 13, color: '#B54708' }}>
              {result.errors.slice(0, 10).map((e, i) => (
                <li key={i}>صف {e.row} ({e.name}): {e.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
