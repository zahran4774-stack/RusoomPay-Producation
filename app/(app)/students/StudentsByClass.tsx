'use client'
// app/(app)/students/StudentsByClass.tsx
// كروت الشعب الصفّية — كل كرت يعرض الصف/الشعبة وعدد الطلاب، وبنقرة يتوسّع لعرض طلابها.
// التوسّع في المتصفّح (لا طلبات إضافية) — سريع ومناسب حتى مئات الطلاب.
import { useState, useMemo } from 'react'
import CertificatesButton from './CertificatesButton'

type Student = {
  id: string; code: string; full_name: string
  grade: string; section: string | null
  guardian_name: string | null; status: string
}

type ClassGroup = { key: string; grade: string; section: string; students: Student[] }

const statusLabel = (s: string) => s === 'active' ? 'منتظم' : s === 'transferred' ? 'منقول' : 'متخرج'
const statusColor = (s: string) => s === 'active' ? '#067647' : s === 'transferred' ? '#B54708' : '#667085'

export default function StudentsByClass({
  students, school,
}: {
  students: Student[]
  school: { name: string; vat: string | null }
}) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // تجميع الطلاب في شعب صفّية (مرّة واحدة، مخزّن)
  const groups = useMemo<ClassGroup[]>(() => {
    const map = new Map<string, ClassGroup>()
    for (const s of students) {
      const section = s.section ?? '—'
      const key = `${s.grade}||${section}`
      if (!map.has(key)) map.set(key, { key, grade: s.grade, section, students: [] })
      map.get(key)!.students.push(s)
    }
    return [...map.values()].sort((a, b) =>
      (a.grade + a.section).localeCompare(b.grade + b.section, 'ar', { numeric: true })
    )
  }, [students])

  // بحث سريع بالاسم أو الرقم — يفتح الشعبة المطابقة
  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return groups
    return groups
      .map((g) => ({ ...g, students: g.students.filter((s) => s.full_name.includes(q) || s.code.includes(q)) }))
      .filter((g) => g.students.length > 0)
  }, [groups, query])

  if (students.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: 14, padding: 32, textAlign: 'center', color: '#999' }}>
        لا يوجد طلاب — أضف أول طالب لتبدأ.
      </div>
    )
  }

  return (
    <div>
      {/* شريط البحث */}
      <input
        value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 ابحث باسم الطالب أو رقمه…"
        style={{
          width: '100%', height: 46, padding: '0 16px', borderRadius: 12,
          border: '1.5px solid #E2E7EE', fontSize: 15, marginBottom: 18, fontFamily: 'inherit',
        }}
      />

      {/* شبكة كروت الشعب */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
        {filtered.map((g) => {
          const isOpen = openKey === g.key || !!query
          return (
            <div key={g.key} style={{ gridColumn: isOpen ? '1 / -1' : 'auto' }}>
              {/* الكرت */}
              <button
                onClick={() => setOpenKey(isOpen && !query ? null : g.key)}
                aria-expanded={isOpen}
                style={{
                  width: '100%', textAlign: 'right', cursor: 'pointer', fontFamily: 'inherit',
                  background: isOpen ? 'linear-gradient(135deg,#0F2744,#1A3A5C)' : '#fff',
                  color: isOpen ? '#fff' : '#0F2744',
                  border: `1px solid ${isOpen ? 'transparent' : '#E2E7EE'}`,
                  borderRadius: 16, padding: '16px 18px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  boxShadow: isOpen ? '0 8px 24px rgba(15,39,68,.22)' : '0 1px 3px rgba(0,0,0,.06)',
                  transition: 'background .2s, box-shadow .2s',
                }}
              >
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>الصف {g.grade}</div>
                  <div style={{ fontSize: '.85rem', opacity: .8, marginTop: 2 }}>
                    {g.section !== '—' ? `شعبة ${g.section}` : 'بلا شعبة'}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>{g.students.length}</div>
                  <div style={{ fontSize: '.72rem', opacity: .75 }}>طالب</div>
                </div>
              </button>

              {/* جدول طلاب الشعبة (يظهر عند الفتح) */}
              {isOpen && (
                <div style={{ background: '#fff', borderRadius: 14, marginTop: 10, overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
                  {/* شريط إحصائيات + تصدير */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #EEF2F1' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Stat label="الإجمالي" value={g.students.length} color="#0F2744" />
                      <Stat label="منتظم" value={g.students.filter((s) => s.status === 'active').length} color="#067647" />
                      <Stat label="منقول" value={g.students.filter((s) => s.status === 'transferred').length} color="#B54708" />
                      <Stat label="متخرج" value={g.students.filter((s) => s.status !== 'active' && s.status !== 'transferred').length} color="#667085" />
                    </div>
                    <button onClick={() => exportClassPDF(g, school)}
                      style={{ padding: '8px 14px', background: '#163B68', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit' }}>
                      ⬇ تصدير قائمة الشعبة PDF
                    </button>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 560 }}>
                    <thead>
                      <tr style={{ background: '#F4F8F7', color: '#0F2744', textAlign: 'right' }}>
                        <th style={{ padding: 11 }}>الرقم</th>
                        <th style={{ padding: 11 }}>الطالب</th>
                        <th style={{ padding: 11 }}>ولي الأمر</th>
                        <th style={{ padding: 11 }}>الحالة</th>
                        <th style={{ padding: 11 }}>الشهادات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.students.map((s) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid #EEF2F1' }}>
                          <td style={{ padding: 11, fontWeight: 700 }}>{s.code}</td>
                          <td style={{ padding: 11 }}>{s.full_name}</td>
                          <td style={{ padding: 11 }}>{s.guardian_name || '—'}</td>
                          <td style={{ padding: 11 }}>
                            <span style={{ color: statusColor(s.status), fontWeight: 600 }}>{statusLabel(s.status)}</span>
                          </td>
                          <td style={{ padding: 11 }}>
                            <CertificatesButton studentId={s.id} studentName={s.full_name} school={school} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: '#999', padding: 24 }}>لا نتائج مطابقة لبحثك.</div>
      )}
    </div>
  )
}

// بطاقة إحصائية صغيرة
function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', background: '#F7FAF9', border: '1px solid #E6ECEA', borderRadius: 9, padding: '5px 12px', minWidth: 58 }}>
      <span style={{ fontWeight: 800, fontSize: 15, color }}>{value}</span>
      <span style={{ fontSize: 10.5, color: '#8A94A6' }}>{label}</span>
    </span>
  )
}

// تصدير قائمة الشعبة PDF
async function exportClassPDF(g: ClassGroup, school: { name: string; vat: string | null }) {
  const jsPDF = await loadJsPDF()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFontSize(15); doc.text(school.name, 200, 18, { align: 'right' })
  if (school.vat) { doc.setFontSize(10); doc.text(`VAT: ${school.vat}`, 200, 24, { align: 'right' }) }
  doc.setFontSize(13)
  const title = `قائمة الصف ${g.grade}${g.section !== '—' ? ` - شعبة ${g.section}` : ''} (${g.students.length} طالب)`
  doc.text(title, 200, 34, { align: 'right' })
  doc.line(10, 38, 200, 38)
  let y = 46
  doc.setFontSize(9)
  doc.text('الرقم | الطالب | ولي الأمر | الحالة', 200, y, { align: 'right' }); y += 7
  g.students.forEach((s) => {
    if (y > 285) { doc.addPage(); y = 20 }
    const st = s.status === 'active' ? 'منتظم' : s.status === 'transferred' ? 'منقول' : 'متخرج'
    doc.text(`${s.code} | ${s.full_name} | ${s.guardian_name || '—'} | ${st}`, 200, y, { align: 'right' })
    y += 6
  })
  doc.save(`قائمة-${g.grade}-${g.section}.pdf`)
}

// تحميل jsPDF كسولاً من CDN
let _jsPDFPromise: Promise<{ new (o: object): { setFontSize: (n: number) => void; text: (t: string, x: number, y: number, o?: object) => void; line: (a: number, b: number, c: number, d: number) => void; addPage: () => void; save: (n: string) => void } }> | null = null
function loadJsPDF() {
  const w = window as unknown as { jspdf?: { jsPDF: unknown } }
  if (w.jspdf?.jsPDF) return Promise.resolve(w.jspdf.jsPDF as never)
  if (!_jsPDFPromise) {
    _jsPDFPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      s.onload = () => resolve((window as unknown as { jspdf: { jsPDF: never } }).jspdf.jsPDF)
      s.onerror = () => reject(new Error('load failed'))
      document.head.appendChild(s)
    })
  }
  return _jsPDFPromise
}
