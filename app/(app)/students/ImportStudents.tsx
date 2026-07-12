'use client'
// استيراد الطلاب جماعياً — قالب CSV يفتحه Excel مباشرة (بلا مكتبات خارجية)
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

type Row = Record<string, string>
type Result = { ok: number; failed: number; errors: { row: number; name: string; error: string }[] }

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

export default function ImportStudents() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  function downloadTemplate() {
    // BOM لضمان قراءة Excel للعربية بشكل صحيح
    const sample = ['محمد أحمد الكندي', 'الصف الخامس', 'أ', 'أحمد الكندي', '99123456', 'parent@email.com', '2014-05-20', 'male', '900']
    const csv = '\uFEFF' + HEADERS.join(',') + '\n' + sample.join(',') + '\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'RusoomPay-قالب-الطلاب.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null); setResult(null); setRows([])
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const grid = parseCSV(String(reader.result ?? ''))
        if (grid.length < 2) { setErr('الملف فارغ أو لا يحتوي بيانات'); return }
        const header = grid[0].map((h) => h.trim())
        // مطابقة الأعمدة بالترتيب أو بالاسم العربي
        const idx = HEADERS.map((h) => header.indexOf(h))
        const useOrder = idx.some((i) => i === -1)
        const parsed: Row[] = grid.slice(1).map((r) => {
          const o: Row = {}
          KEYS.forEach((k, i) => {
            const col = useOrder ? i : idx[i]
            o[k] = (col >= 0 ? (r[col] ?? '') : '').trim()
          })
          return o
        }).filter((o) => o.full_name)
        if (!parsed.length) { setErr('لم يُعثر على صفوف صالحة (عمود الاسم فارغ)'); return }
        setRows(parsed)
      } catch {
        setErr('تعذّرت قراءة الملف. تأكّد أنه بصيغة CSV.')
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  async function submit() {
    setBusy(true); setErr(null)
    const { data, error } = await supabase.rpc('import_students', { p_rows: rows })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setResult(data as Result)
    setRows([])
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <button onClick={downloadTemplate}
          style={{ background: '#0F2744', color: '#fff', border: 0, padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
          ⬇ تنزيل القالب
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile}
          style={{ fontSize: 13, fontFamily: 'inherit' }} />
      </div>

      {err && <div style={{ color: '#C0392B', fontWeight: 600, fontSize: 14, marginBottom: 12 }}>⚠ {err}</div>}

      {rows.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ background: '#F7FAFC', border: '1px solid #E3E8EE', borderRadius: 11, padding: '12px 16px', marginBottom: 12 }}>
            <b style={{ color: '#0F2744' }}>{rows.length}</b> <span style={{ color: '#667', fontSize: 14 }}>طالب جاهز للاستيراد</span>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #EDF1F5', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#F7FAFC', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '8px 10px', textAlign: 'right', color: '#667', fontSize: 12 }}>الاسم</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', color: '#667', fontSize: 12 }}>الصف</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', color: '#667', fontSize: 12 }}>ولي الأمر</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', color: '#667', fontSize: 12 }}>الرسوم</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #F2F5F8' }}>
                    <td style={{ padding: '8px 10px' }}>{r.full_name}</td>
                    <td style={{ padding: '8px 10px' }}>{r.grade || '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{r.guardian_name || '—'}</td>
                    <td style={{ padding: '8px 10px', direction: 'ltr', textAlign: 'right' }}>{r.annual_fee || '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={submit} disabled={busy}
            style={{ marginTop: 14, background: busy ? '#8AA' : '#163B68', color: '#fff', border: 0, padding: '12px 26px', borderRadius: 11, fontWeight: 800, fontSize: 15, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {busy ? 'جارٍ الاستيراد…' : `استيراد ${rows.length} طالب`}
          </button>
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
