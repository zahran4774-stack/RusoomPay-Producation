'use client'
// app/(app)/students/StudentsByClass.tsx
// كروت الشعب الصفّية — كل كرت يعرض الصف/الشعبة وعدد الطلاب، وبنقرة يتوسّع لعرض طلابها.
// ⚠️ عمود "ولي الأمر" أُزيل من العرض والطباعة عمداً — اسم الطالب الرباعي يتضمّن
// عادةً اسم الأب أصلاً، فتكراره كعمود منفصل زائد بصرياً في أغلب الحالات.
// الحقل نفسه يبقى محفوظاً في قاعدة البيانات، يُستخدم فقط في التواصل الفعلي
// (رسائل، فواتير) لا في جداول العرض العامة.
import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import CertificatesButton from './CertificatesButton'
import EditStudent from './EditStudent'
import PaymentTracker from './PaymentTracker'
import { printStudentCard, printClassCards } from '@/lib/print-student-card'

type Student = {
  id: string; code: string; full_name: string
  grade: string; section: string | null
  guardian_name: string | null; status: string
  guardian_phone?: string | null; guardian_email?: string | null
  birth_date?: string | null; gender?: string | null
  father_phone?: string | null; mother_phone?: string | null; address?: string | null
  annual_fee?: number | null; discount_pct?: number | null
  is_exempt?: boolean | null; special_case_reason?: string | null
  student_fees?: { id: string }[] | null
}

type ClassGroup = { key: string; grade: string; section: string; students: Student[] }
type Bus = { id: string; routes_label: string; fee: number }
type MealPlan = { id: string; name: string; fee: number }

const statusLabel = (s: string) => s === 'active' ? 'منتظم' : s === 'transferred' ? 'منقول' : s === 'withdrawn' ? 'منسحب' : 'متخرج'
const statusColor = (s: string) => s === 'active' ? '#067647' : s === 'transferred' ? '#B54708' : s === 'withdrawn' ? '#8A6D0F' : '#667085'

const PAGE_SIZE = 10

function StudentBadges({ s }: { s: Student }) {
  if (!s.is_exempt && !s.special_case_reason) return null
  return (
    <span style={{ display: 'inline-flex', gap: 4, marginInlineStart: 6, verticalAlign: 'middle' }}>
      {s.is_exempt && (
        <span title="معفى بالكامل من الرسوم" style={{
          display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700,
          background: '#E6F4EC', color: '#1A7A45', borderRadius: 20, padding: '2px 7px',
        }}>
          🎗️ معفى
        </span>
      )}
      {s.special_case_reason && (
        <span title={`حالة خاصة: ${s.special_case_reason}${s.discount_pct ? ` — تخفيض ${s.discount_pct}%` : ''}`} style={{
          display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700,
          background: '#FDF3D5', color: '#8A6D0F', borderRadius: 20, padding: '2px 7px',
        }}>
          ⭐ حالة خاصة
        </span>
      )}
    </span>
  )
}

export default function StudentsByClass({
  students, school, busMap = {}, buses = [], studentBusIdMap = {},
  mealPlans = [], studentMealPlanIdMap = {},
}: {
  students: Student[]
  school: { name: string; vat: string | null; logoUrl?: string | null; primaryColor?: string | null; accentColor?: string | null }
  busMap?: Record<string, { label: string; supervisor: string | null }>
  buses?: Bus[]
  studentBusIdMap?: Record<string, string>
  mealPlans?: MealPlan[]
  studentMealPlanIdMap?: Record<string, string>
}) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [noFeeOnly, setNoFeeOnly] = useState(false)
  const [pageMap, setPageMap] = useState<Record<string, number>>({})
  const [trackerStudent, setTrackerStudent] = useState<Student | null>(null)

  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('filter') === 'nofee') setNoFeeOnly(true)
  }, [searchParams])

  const baseStudents = useMemo(
    () => (noFeeOnly ? students.filter((s) => (s.student_fees ?? []).length === 0) : students),
    [students, noFeeOnly]
  )

  const groups = useMemo<ClassGroup[]>(() => {
    const map = new Map<string, ClassGroup>()
    for (const s of baseStudents) {
      const section = s.section ?? '—'
      const key = `${s.grade}||${section}`
      if (!map.has(key)) map.set(key, { key, grade: s.grade, section, students: [] })
      map.get(key)!.students.push(s)
    }
    return [...map.values()].sort((a, b) =>
      (a.grade + a.section).localeCompare(b.grade + a.section, 'ar', { numeric: true })
    )
  }, [baseStudents])

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
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 ابحث باسم الطالب أو رقمه…"
          style={{
            flex: '1 1 260px', height: 46, padding: '0 16px', borderRadius: 12,
            border: '1.5px solid #E2E7EE', fontSize: 15, fontFamily: 'inherit',
          }}
        />
        <button
          onClick={() => setNoFeeOnly((v) => !v)}
          style={{
            height: 46, padding: '0 16px', borderRadius: 12, cursor: 'pointer', fontWeight: 700,
            fontFamily: 'inherit', fontSize: 14,
            border: `1.5px solid ${noFeeOnly ? '#B54708' : '#E2E7EE'}`,
            background: noFeeOnly ? '#FFF6ED' : '#fff',
            color: noFeeOnly ? '#8A5A1D' : '#445',
          }}>
          {noFeeOnly ? '✓ ' : ''}بلا رسوم فقط
        </button>
        {noFeeOnly && (
          <button
            onClick={() => setNoFeeOnly(false)}
            style={{
              height: 46, padding: '0 16px', borderRadius: 12, cursor: 'pointer',
              border: '1.5px solid #EEF2F7', background: '#fff', color: '#667', fontFamily: 'inherit', fontSize: 14,
            }}>
            ✕ مسح الفلتر
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
        {filtered.map((g) => {
          const isOpen = openKey === g.key || !!query || noFeeOnly
          return (
            <div key={g.key} style={{ gridColumn: isOpen ? '1 / -1' : 'auto' }}>
              <button
                onClick={() => { setOpenKey(isOpen && !query && !noFeeOnly ? null : g.key); setPageMap((m) => ({ ...m, [g.key]: 1 })) }}
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

              {isOpen && (() => {
                const gPage = pageMap[g.key] ?? 1
                const gTotalPages = Math.max(1, Math.ceil(g.students.length / PAGE_SIZE))
                const gSafePage = Math.min(gPage, gTotalPages)
                const gPageStudents = g.students.slice((gSafePage - 1) * PAGE_SIZE, gSafePage * PAGE_SIZE)
                return (
                <div style={{ background: '#fff', borderRadius: 14, marginTop: 10, overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #EEF2F1' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Stat label="الإجمالي" value={g.students.length} color="#0F2744" />
                      <Stat label="منتظم" value={g.students.filter((s) => s.status === 'active').length} color="#067647" />
                      <Stat label="منقول" value={g.students.filter((s) => s.status === 'transferred').length} color="#B54708" />
                      <Stat label="منسحب" value={g.students.filter((s) => s.status === 'withdrawn').length} color="#8A6D0F" />
                      <Stat label="متخرج" value={g.students.filter((s) => s.status !== 'active' && s.status !== 'transferred' && s.status !== 'withdrawn').length} color="#667085" />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => exportClassPDF(g, school)}
                        style={{ padding: '8px 14px', background: '#163B68', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit' }}>
                        ⬇ تصدير قائمة الشعبة PDF
                      </button>
                      <button
                        onClick={() => printClassCards(
                          school,
                          g.students.map((s) => toCardStudent(s, busMap)),
                          `الصف ${g.grade}${g.section !== '—' ? ` - شعبة ${g.section}` : ''}`
                        )}
                        style={{ padding: '8px 14px', background: '#B08D2E', color: '#0A1D33', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit' }}>
                        🪪 طباعة بطاقات الشعبة
                      </button>
                    </div>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 560 }}>
                    <thead>
                      <tr style={{ background: '#F4F8F7', color: '#0F2744', textAlign: 'right' }}>
                        <th style={{ padding: 11 }}>الرقم</th>
                        <th style={{ padding: 11 }}>الطالب</th>
                        <th style={{ padding: 11 }}>الحالة</th>
                        <th style={{ padding: 11 }}>الدفعات</th>
                        <th style={{ padding: 11 }}>الشهادات</th>
                        <th style={{ padding: 11 }}>البطاقة</th>
                        <th style={{ padding: 11 }}>تعديل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gPageStudents.map((s) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid #EEF2F1' }}>
                          <td style={{ padding: 11, fontWeight: 700 }}>{s.code}</td>
                          <td style={{ padding: 11 }}>
                            {s.full_name}
                            <StudentBadges s={s} />
                          </td>
                          <td style={{ padding: 11 }}>
                            <span style={{ color: statusColor(s.status), fontWeight: 600 }}>{statusLabel(s.status)}</span>
                          </td>
                          <td style={{ padding: 11 }}>
                            <button
                              onClick={() => setTrackerStudent(s)}
                              title="تتبع الدفعات الشهرية"
                              style={{ background: '#EEF2F9', color: '#163B68', border: 0, padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                              📅 التتبع
                            </button>
                          </td>
                          <td style={{ padding: 11 }}>
                            <CertificatesButton studentId={s.id} studentName={s.full_name} school={school} />
                          </td>
                          <td style={{ padding: 11 }}>
                            <button
                              onClick={() => printStudentCard(school, toCardStudent(s, busMap))}
                              title="طباعة بطاقة الطالب"
                              style={{ background: '#F2F5F8', color: '#0F2744', border: 0, padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                              🪪 طباعة
                            </button>
                          </td>
                          <td style={{ padding: 11 }}>
                            <EditStudent
                              student={{
                                id: s.id,
                                full_name: s.full_name,
                                grade: s.grade,
                                section: s.section,
                                guardian_name: s.guardian_name,
                                guardian_phone: s.guardian_phone ?? null,
                                guardian_email: s.guardian_email ?? null,
                                birth_date: s.birth_date ?? null,
                                gender: s.gender ?? null,
                                father_phone: s.father_phone ?? null,
                                mother_phone: s.mother_phone ?? null,
                                address: s.address ?? null,
                                code: s.code ?? null,
                                annual_fee: s.annual_fee ?? null,
                                discount_pct: s.discount_pct ?? null,
                                is_exempt: s.is_exempt ?? null,
                                special_case_reason: s.special_case_reason ?? null,
                                status: s.status ?? null,
                              }}
                              buses={buses}
                              currentBusId={studentBusIdMap[s.id] ?? null}
                              mealPlans={mealPlans}
                              currentMealPlanId={studentMealPlanIdMap[s.id] ?? null}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {gTotalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '12px 14px', borderTop: '1px solid #EEF2F1' }}>
                      <button
                        onClick={() => setPageMap((m) => ({ ...m, [g.key]: Math.max(1, gSafePage - 1) }))}
                        disabled={gSafePage === 1}
                        style={{
                          padding: '7px 13px', borderRadius: 8, border: '1.5px solid #DDE3EC', background: '#fff',
                          fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                          cursor: gSafePage === 1 ? 'default' : 'pointer', opacity: gSafePage === 1 ? 0.5 : 1,
                        }}>
                        ‹ السابق
                      </button>
                      <span style={{ fontSize: 13, color: '#556', padding: '0 6px' }}>
                        صفحة {gSafePage} من {gTotalPages}
                      </span>
                      <button
                        onClick={() => setPageMap((m) => ({ ...m, [g.key]: Math.min(gTotalPages, gSafePage + 1) }))}
                        disabled={gSafePage === gTotalPages}
                        style={{
                          padding: '7px 13px', borderRadius: 8, border: '1.5px solid #DDE3EC', background: '#fff',
                          fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                          cursor: gSafePage === gTotalPages ? 'default' : 'pointer', opacity: gSafePage === gTotalPages ? 0.5 : 1,
                        }}>
                        التالي ›
                      </button>
                    </div>
                  )}
                </div>
                )
              })()}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: '#999', padding: 24 }}>
          {noFeeOnly ? 'لا يوجد طلاب بلا رسوم — كل الطلاب لهم فواتير مسجّلة.' : 'لا نتائج مطابقة لبحثك.'}
        </div>
      )}

      {trackerStudent && (
        <PaymentTracker
          studentId={trackerStudent.id}
          studentName={trackerStudent.full_name}
          onClose={() => setTrackerStudent(null)}
        />
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', background: '#F7FAF9', border: '1px solid #E6ECEA', borderRadius: 9, padding: '5px 12px', minWidth: 58 }}>
      <span style={{ fontWeight: 800, fontSize: 15, color }}>{value}</span>
      <span style={{ fontSize: 10.5, color: '#8A94A6' }}>{label}</span>
    </span>
  )
}

function toCardStudent(
  s: Student,
  busMap: Record<string, { label: string; supervisor: string | null }>
) {
  const bus = busMap[s.id]
  return {
    full_name: s.full_name,
    grade: s.grade,
    section: s.section,
    father_phone: s.father_phone ?? null,
    mother_phone: s.mother_phone ?? null,
    bus_label: bus?.label ?? null,
    bus_supervisor: bus?.supervisor ?? null,
  }
}

// تصدير قائمة الشعبة PDF — عمود "ولي الأمر" أُزيل هنا أيضاً (انظر تعليق الرأس)
function exportClassPDF(g: ClassGroup, school: { name: string; vat: string | null }) {
  const title = `قائمة الصف ${g.grade}${g.section !== '\u2014' ? ` - شعبة ${g.section}` : ''}`
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB')

  const rows = g.students.map((s, i) => {
    const st = s.status === 'active' ? 'منتظم' : s.status === 'transferred' ? 'منقول' : s.status === 'withdrawn' ? 'منسحب' : 'متخرج'
    return `<tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${s.code ?? '\u2014'}</td>
      <td>${s.full_name}</td>
      <td style="text-align:center">${st}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=block" rel="stylesheet">
    <style>
      *{margin:0;padding:0;box-sizing:border-box;font-family:'Cairo',Tahoma,sans-serif}
      body{padding:28px;color:#1a2530}
      .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0F2744;padding-bottom:14px;margin-bottom:6px}
      .school{font-size:1.25rem;font-weight:800;color:#0F2744}
      .vat{font-size:.8rem;color:#667;margin-top:2px}
      .title{font-size:1.05rem;font-weight:700;color:#1E5C4E}
      .date{font-size:.8rem;color:#667;margin-top:3px;text-align:left}
      .count{font-size:.82rem;color:#8A94A6;margin:12px 0}
      table{width:100%;border-collapse:collapse;margin-top:8px;font-size:.85rem}
      th{background:#0F2744;color:#fff;padding:9px 11px;text-align:right;font-weight:600}
      td{padding:8px 11px;border-bottom:1px solid #E6EBF1;text-align:right}
      tr:nth-child(even) td{background:#F7F9FC}
      .foot{margin-top:22px;padding-top:12px;border-top:1px solid #ccc;font-size:.72rem;color:#9AA7B8;text-align:center}
      @media print{
        body{padding:0}
        table{page-break-inside:auto}
        tr{page-break-inside:avoid;page-break-after:auto}
        thead{display:table-header-group}
        .head{page-break-after:avoid}
      }
    </style></head><body>
    <div class="head">
      <div><div class="school">${school.name}</div>${school.vat ? `<div class="vat">الرقم الضريبي: ${school.vat}</div>` : ''}</div>
      <div><div class="title">${title}</div><div class="date">تاريخ الطباعة: ${dateStr}</div></div>
    </div>
    <div class="count">عدد الطلاب: ${g.students.length}</div>
    <table>
      <thead><tr><th style="width:40px">#</th><th>الرقم</th><th>الطالب</th><th>الحالة</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="foot">RusoomPay · ${now.getFullYear()}</div>
    </body></html>`

  const win = window.open('', '_blank', 'width=900,height=650')
  if (!win) { alert('فعّل النوافذ المنبثقة للطباعة'); return }
  win.document.write(html)
  win.document.close()

  const doPrint = () => { try { win.focus(); win.print() } catch { /* أُغلقت */ } }
  const fonts = (win.document as Document & { fonts?: FontFaceSet }).fonts
  if (fonts && fonts.ready) {
    fonts.ready.then(() => setTimeout(doPrint, 150))
    setTimeout(doPrint, 3000)
  } else {
    setTimeout(doPrint, 800)
  }
}
