'use client'
// كشف طلاب كل باص — عرض وطباعة قائمة الطلاب المشتركين في كل باص.
// مفيد للسائقين وإدارة النقل. طباعة عبر HTML + خط Cairo (عربية سليمة).
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Bus, Printer, Users, ChevronDown } from 'lucide-react'

type Student = {
  student_id: string; full_name: string; grade: string; section: string | null
  guardian_name: string | null; guardian_phone: string | null
}
type BusData = {
  bus_id: string; route: string; driver: string; capacity: number; fee: number
  students: Student[]; student_count: number
}

export default function BusRoster({ schoolName }: { schoolName?: string }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [buses, setBuses] = useState<BusData[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc('transport_roster')
    const res = (data ?? {}) as { ok?: boolean; buses?: BusData[] }
    setBuses(res.ok && res.buses ? res.buses : [])
    setLoading(false)
  }

  function toggle() {
    if (!open) load()
    setOpen(!open)
  }

  function printBus(bus: BusData) {
    const rows = bus.students.map((s, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${s.full_name}</td>
        <td style="text-align:center">${s.grade}${s.section ? ' / ' + s.section : ''}</td>
        <td>${s.guardian_name ?? '—'}</td>
        <td style="text-align:center; direction:ltr">${s.guardian_phone ?? '—'}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>كشف طلاب الباص</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
        * { font-family: 'Cairo', sans-serif; }
        body { padding: 32px; color: #1A2530; }
        h1 { color: #0F2744; font-size: 20px; margin: 0 0 4px; }
        .meta { color: #667; font-size: 13px; margin-bottom: 4px; }
        .info { display: flex; gap: 24px; margin: 16px 0; padding: 14px; background: #F7FAFC; border-radius: 10px; font-size: 14px; }
        .info b { color: #0F2744; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #D5DCE5; padding: 9px 12px; font-size: 13.5px; text-align: right; }
        th { background: #163B68; color: #fff; font-weight: 700; }
        tr:nth-child(even) td { background: #F7FAFC; }
        .foot { margin-top: 20px; font-size: 12px; color: #8A94A6; }
      </style></head><body>
      <h1>كشف طلاب الباص</h1>
      <div class="meta">${schoolName ?? 'مدرسة'}</div>
      <div class="info">
        <span>المسار: <b>${bus.route}</b></span>
        <span>السائق: <b>${bus.driver}</b></span>
        <span>عدد الطلاب: <b>${bus.student_count}</b> / ${bus.capacity}</span>
      </div>
      <table>
        <thead><tr><th style="width:40px">#</th><th>اسم الطالب</th><th>الصف</th><th>ولي الأمر</th><th>الهاتف</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#999">لا طلاب مشتركين</td></tr>'}</tbody>
      </table>
      <div class="foot">صدر من RusoomPay · ${new Date().toLocaleDateString('ar')}</div>
      <script>window.onload = () => { window.print() }</script>
      </body></html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  if (!open) {
    return (
      <button onClick={toggle}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#F2F5F8', color: '#0F2744', border: '1px solid #E3E8EE', padding: '10px 18px', borderRadius: 11, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
        <Bus size={17} strokeWidth={2} /> كشف طلاب الباصات
      </button>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 16, padding: 20, marginBottom: 16 }} dir="rtl">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <b style={{ color: '#0F2744', fontSize: 16 }}>كشف طلاب الباصات</b>
        <button onClick={toggle} style={{ background: 'none', border: 0, fontSize: 21, cursor: 'pointer', color: '#667' }}>×</button>
      </div>

      {loading && <div style={{ color: '#8A94A6', fontSize: 14, padding: 14 }}>جارٍ التحميل…</div>}

      {!loading && buses.length === 0 && (
        <div style={{ color: '#8A94A6', fontSize: 14, padding: 14, textAlign: 'center' }}>لا توجد باصات مسجّلة.</div>
      )}

      {!loading && buses.map((bus) => {
        const isOpen = expanded === bus.bus_id
        return (
          <div key={bus.bus_id} style={{ border: '1px solid #EEF1F5', borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', background: '#FAFBFC' }}>
              <button onClick={() => setExpanded(isOpen ? null : bus.bus_id)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 0, cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit' }}>
                <ChevronDown size={17} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', color: '#667' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: '#0F2744' }}>{bus.route}</div>
                  <div style={{ fontSize: 12.5, color: '#667', marginTop: 2 }}>
                    السائق: {bus.driver} · <Users size={12} style={{ display: 'inline', verticalAlign: -1 }} /> {bus.student_count} طالب
                  </div>
                </div>
              </button>
              <button onClick={() => printBus(bus)} title="طباعة الكشف"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#163B68', color: '#fff', border: 0, borderRadius: 9, padding: '8px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                <Printer size={15} strokeWidth={2} /> طباعة
              </button>
            </div>

            {isOpen && (
              <div style={{ padding: '4px 15px 14px' }}>
                {bus.students.length === 0 ? (
                  <div style={{ color: '#8A94A6', fontSize: 13, padding: '10px 0', textAlign: 'center' }}>لا طلاب مشتركين في هذا الباص</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: '#8A94A6', fontSize: 12 }}>
                        <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 600 }}>#</th>
                        <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 600 }}>الطالب</th>
                        <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 600 }}>الصف</th>
                        <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 600 }}>ولي الأمر</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bus.students.map((s, i) => (
                        <tr key={s.student_id} style={{ borderTop: '1px solid #F2F5F8' }}>
                          <td style={{ padding: '8px 4px', color: '#8A94A6' }}>{i + 1}</td>
                          <td style={{ padding: '8px 4px', fontWeight: 600, color: '#0F2744' }}>{s.full_name}</td>
                          <td style={{ padding: '8px 4px', color: '#475569' }}>{s.grade}{s.section ? ` / ${s.section}` : ''}</td>
                          <td style={{ padding: '8px 4px', color: '#475569' }}>{s.guardian_name ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
