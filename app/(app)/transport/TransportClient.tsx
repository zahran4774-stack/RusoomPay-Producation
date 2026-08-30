'use client'
// مكوّن النقل المدرسي — باصات (مسارات متعددة + مشرفة) + اشتراكات
// رسوم النقل تدرج ضمن الرسوم الدراسية السنوية عند تسجيل الطالب — لا فوترة شهرية منفصلة
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { printReport, type SchoolHeader } from '@/lib/print-report'
import BusRoster from './BusRoster'

type Bus = {
  id: string; routes: string[]; routes_label: string; driver: string; supervisor: string | null
  capacity: number; fee: number; pay_to: string; subscribers: number
}
type Sub = { id: string; full_name: string; guardian_name: string | null; routes_label: string; driver: string; supervisor: string | null }
type Student = { id: string; full_name: string; guardian_name: string | null }

const PAY_LABEL: Record<string, { t: string; bg: string; c: string }> = {
  school: { t: 'المدرسة', bg: '#E8EEF8', c: '#2E5EA8' },
  driver: { t: 'السائق مباشرة', bg: '#F6DDD0', c: '#7A2E12' },
  private: { t: 'توصيل خاص', bg: '#EDE4F6', c: '#7A2E8F' },
}
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #E6EBF1', borderRadius: 14,
  padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.05)', marginBottom: 16,
}
const input: React.CSSProperties = {
  width: '100%', padding: 11, borderRadius: 10, border: '1.5px solid #DDE3EC',
  fontFamily: 'inherit', fontSize: 14, background: '#fff',
}
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }
const btnGold: React.CSSProperties = {
  padding: '11px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: '#D4A017', color: '#08172B', fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
}
const btnGhost: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 9, border: '1px solid #DDE3EC', cursor: 'pointer',
  background: '#fff', color: '#445', fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
}
const btnSm: React.CSSProperties = {
  background: '#EEF2F9', color: '#163B68', border: 0, borderRadius: 8, padding: '6px 12px',
  cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
}
const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

type BusForm = { id: string; routes: string[]; driver: string; supervisor: string; capacity: string; fee: string; payTo: string }
const emptyForm: BusForm = { id: '', routes: [''], driver: '', supervisor: '', capacity: '30', fee: '', payTo: 'school' }

export default function TransportClient({ initialBuses, initialSubscribers, students, school }: {
  initialBuses: Bus[]; initialSubscribers: Sub[]; students: Student[]; school: SchoolHeader
}) {
  const supabase = createClient()
  const [buses, setBuses] = useState<Bus[]>(initialBuses)
  const [subs, setSubs] = useState<Sub[]>(initialSubscribers)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const [form, setForm] = useState<BusForm>(emptyForm)
  const [editOpen, setEditOpen] = useState(false)

  const [selStudent, setSelStudent] = useState('')
  const [selBus, setSelBus] = useState('')

  const schoolRevenue = buses
    .filter((b) => b.pay_to === 'school')
    .reduce((a, b) => a + Number(b.fee ?? 0) * Number(b.subscribers ?? 0), 0)

  async function refresh() {
    const [{ data: b }, { data: s }] = await Promise.all([
      supabase.rpc('transport_buses'), supabase.rpc('transport_subscribers'),
    ])
    setBuses(b || []); setSubs(s || [])
  }

  function setRouteAt(i: number, v: string) {
    setForm((p) => { const routes = [...p.routes]; routes[i] = v; return { ...p, routes } })
  }
  function addRouteField() {
    setForm((p) => ({ ...p, routes: [...p.routes, ''] }))
  }
  function removeRouteField(i: number) {
    setForm((p) => ({ ...p, routes: p.routes.length > 1 ? p.routes.filter((_, idx) => idx !== i) : p.routes }))
  }

  function openAdd() { setForm(emptyForm); setEditOpen(true); setMsg('') }
  function openEdit(b: Bus) {
    setForm({
      id: b.id, routes: b.routes.length ? [...b.routes] : [''], driver: b.driver,
      supervisor: b.supervisor || '', capacity: String(b.capacity), fee: String(b.fee), payTo: b.pay_to,
    })
    setEditOpen(true); setMsg('')
  }

  async function saveBus() {
    const cleanRoutes = form.routes.map((r) => r.trim()).filter(Boolean)
    if (cleanRoutes.length === 0 || !form.driver.trim() || !form.fee) {
      setMsg('أدخل مسارًا واحدًا على الأقل واسم السائق والرسم'); return
    }
    setBusy(true); setMsg('')
    try {
      const payload = {
        p_routes: cleanRoutes, p_driver: form.driver.trim(), p_supervisor: form.supervisor.trim() || null,
        p_capacity: parseInt(form.capacity) || 30, p_fee: parseFloat(form.fee), p_pay_to: form.payTo,
      }
      const { error } = form.id
        ? await supabase.rpc('update_bus', { p_id: form.id, ...payload })
        : await supabase.rpc('save_bus', payload)
      if (error) { setMsg('خطأ: ' + error.message); setBusy(false); return }
      setEditOpen(false); setForm(emptyForm)
      await refresh(); setMsg(form.id ? '✓ تم تحديث الباص' : '✓ تمت إضافة الباص'); setBusy(false)
    } catch {
      // انقطاع اتصال قبل وصول أي رد — بلا هذا يبقى الزر معطّلاً للأبد
      setMsg('تعذّر الاتصال — تحقّق من الإنترنت وحاول مجدداً'); setBusy(false)
    }
  }

  async function subscribe() {
    if (!selStudent || !selBus) { setMsg('اختر الطالب والباص'); return }
    setBusy(true); setMsg('')
    try {
      const { error } = await supabase.rpc('subscribe_bus', { p_student: selStudent, p_bus: selBus })
      if (error) { setMsg('خطأ: ' + error.message); setBusy(false); return }
      setSelStudent(''); setSelBus(''); await refresh(); setMsg('✓ تم تسجيل الاشتراك'); setBusy(false)
    } catch {
      setMsg('تعذّر الاتصال — تحقّق من الإنترنت وحاول مجدداً'); setBusy(false)
    }
  }

  async function removeSub(studentId: string) {
    setBusy(true); setMsg('')
    try {
      const { error } = await supabase.rpc('unsubscribe_bus', { p_student: studentId })
      if (error) { setMsg('خطأ: ' + error.message); setBusy(false); return }
      await refresh(); setBusy(false)
    } catch {
      setMsg('تعذّر الاتصال — تحقّق من الإنترنت وحاول مجدداً'); setBusy(false)
    }
  }

  return (
    <>
      {msg && <div style={{ ...card, padding: 12, marginBottom: 12, color: msg.startsWith('✓') ? '#1A7A45' : '#C0392B' }}>{msg}</div>}

      <div style={{ marginBottom: 16 }}>
        <BusRoster schoolName={school?.name} />
      </div>

      <div style={{ background: '#EEF3F9', border: '1px solid #DDE5EF', borderRadius: 12,
                    padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#37506F' }}>
        <b style={{ color: '#0F2744' }}>آلية تحصيل رسوم النقل</b>
        <div style={{ marginTop: 4 }}>
          رسم النقل يُدرج ضمن إجمالي الرسوم الدراسية السنوية عند تسجيل الطالب — يُحدَّد نوع النقل من شاشة الطلاب.
          لا توجد فوترة شهرية منفصلة للنقل.
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0, color: '#0F2744', fontSize: 16 }}>الباصات</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {buses.length > 0 && (
              <button onClick={() => printReport({
                school, title: 'تقرير الباصات والمسارات',
                columns: [
                  { key: 'routes', label: 'المسارات' }, { key: 'driver', label: 'السائق' },
                  { key: 'supervisor', label: 'المشرفة' },
                  { key: 'capacity', label: 'السعة' }, { key: 'fee', label: 'الرسم' },
                  { key: 'subs', label: 'المشتركون' }, { key: 'payto', label: 'جهة الدفع' },
                ],
                rows: buses.map((b) => ({
                  routes: b.routes_label, driver: b.driver, supervisor: b.supervisor || '—',
                  capacity: b.capacity, fee: fmt(b.fee),
                  subs: b.subscribers, payto: (PAY_LABEL[b.pay_to] || PAY_LABEL.school).t,
                })),
              })} style={{ background: '#fff', color: '#0F2744', border: '1.5px solid #DDE3EC', borderRadius: 9, padding: '7px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>🖨 طباعة</button>
            )}
            <button onClick={openAdd} style={{ background: '#163B68', color: '#fff', border: 0, borderRadius: 9, padding: '7px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>＋ إضافة باص</button>
          </div>
        </div>

        {buses.length > 0 && (
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr style={{ background: '#F7F9FC', textAlign: 'right' }}>
                  {['المسارات', 'السائق', 'المشرفة', 'السعة', 'الرسم', 'المشتركون', 'الإيراد الشهري', 'جهة الدفع', ''].map((h) => (
                    <th key={h} style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {buses.map((b) => {
                  const p = PAY_LABEL[b.pay_to] || PAY_LABEL.school
                  const rev = Number(b.fee ?? 0) * Number(b.subscribers ?? 0)
                  const full = b.subscribers >= b.capacity
                  return (
                    <tr key={b.id} style={{ borderTop: '1px solid #F2F5F8' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0F2744' }}>{b.routes_label}</td>
                      <td style={{ padding: '10px 12px' }}>{b.driver}</td>
                      <td style={{ padding: '10px 12px' }}>{b.supervisor || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>{b.capacity}</td>
                      <td style={{ padding: '10px 12px' }}>{fmt(b.fee)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ color: full ? '#8A2B2B' : '#334', fontWeight: full ? 700 : 400 }}>
                          {b.subscribers}
                        </span>
                        {full && <span style={{ fontSize: 11, color: '#8A2B2B', marginInlineStart: 5 }}>مكتمل</span>}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        {b.pay_to === 'school' ? fmt(rev) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: p.bg, color: p.c, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99 }}>{p.t}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button style={btnSm} onClick={() => openEdit(b)}>✏️ تعديل</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {schoolRevenue > 0 && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: '#F7F9FC', borderRadius: 10,
                            display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                <span style={{ color: '#556' }}>إيراد النقل عبر المدرسة</span>
                <b style={{ color: '#0F2744' }}>{fmt(schoolRevenue)} شهرياً</b>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, color: '#0F2744', fontSize: 16 }}>تسجيل اشتراك طالب</h3>
          {subs.length > 0 && (
            <button onClick={() => printReport({
              school, title: 'تقرير المشتركين في النقل',
              columns: [
                { key: 'student', label: 'الطالب' }, { key: 'guardian', label: 'ولي الأمر' },
                { key: 'routes', label: 'المسارات' }, { key: 'driver', label: 'السائق' }, { key: 'supervisor', label: 'المشرفة' },
              ],
              rows: subs.map((s) => ({
                student: s.full_name, guardian: s.guardian_name || '—',
                routes: s.routes_label, driver: s.driver, supervisor: s.supervisor || '—',
              })),
            })} style={{ background: '#fff', color: '#0F2744', border: '1.5px solid #DDE3EC', borderRadius: 9, padding: '7px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>🖨 طباعة المشتركين</button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div><label style={lbl}>الطالب</label>
            <select style={input} value={selStudent} onChange={(e) => setSelStudent(e.target.value)}>
              <option value="">اختر الطالب</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select></div>
          <div><label style={lbl}>الباص</label>
            <select style={input} value={selBus} onChange={(e) => setSelBus(e.target.value)}>
              <option value="">اختر الباص</option>
              {buses.map((b) => <option key={b.id} value={b.id}>{b.routes_label} — {fmt(b.fee)}</option>)}
            </select></div>
          <button style={btnGold} onClick={subscribe} disabled={busy}>حفظ</button>
        </div>
        {subs.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr style={{ background: '#F7F9FC', textAlign: 'right' }}>
                  <th style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>الطالب</th>
                  <th style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>ولي الأمر</th>
                  <th style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>المسارات</th>
                  <th style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>المشرفة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} style={{ borderTop: '1px solid #F2F5F8' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0F2744' }}>{s.full_name}</td>
                    <td style={{ padding: '10px 12px' }}>{s.guardian_name || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{s.routes_label}</td>
                    <td style={{ padding: '10px 12px' }}>{s.supervisor || '—'}</td>
                    <td style={{ padding: '10px 12px' }}><button style={btnGhost} onClick={() => removeSub(s.id)} disabled={busy}>إلغاء</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* نافذة إضافة/تعديل باص */}
      {editOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,37,64,.45)', display: 'grid', placeItems: 'center', zIndex: 999, padding: 16 }} onClick={() => !busy && setEditOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 26, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} dir="rtl">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#0F2744' }}>{form.id ? 'تعديل باص' : 'إضافة باص'}</h3>
              <button onClick={() => setEditOpen(false)} style={{ background: 'none', border: 0, fontSize: 22, cursor: 'pointer', color: '#667' }}>×</button>
            </div>

            <label style={lbl}>المسارات</label>
            {form.routes.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input style={input} value={r} onChange={(e) => setRouteAt(i, e.target.value)} placeholder={`مسار ${i + 1} — مثال: الخوض — الموالح`} />
                {form.routes.length > 1 && (
                  <button onClick={() => removeRouteField(i)} style={{ background: '#FBEAE8', color: '#C0392B', border: 0, borderRadius: 9, width: 42, cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' }}>×</button>
                )}
              </div>
            ))}
            <button onClick={addRouteField} style={{ background: '#F2F5F8', color: '#163B68', border: 0, borderRadius: 9, padding: '8px 14px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14 }}>＋ أضف مسارًا آخر</button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={lbl}>اسم السائق</label><input style={input} value={form.driver} onChange={(e) => setForm((p) => ({ ...p, driver: e.target.value }))} placeholder="اسم السائق" /></div>
              <div><label style={lbl}>اسم المشرفة</label><input style={input} value={form.supervisor} onChange={(e) => setForm((p) => ({ ...p, supervisor: e.target.value }))} placeholder="اسم المشرفة (اختياري)" /></div>
              <div><label style={lbl}>السعة</label><input style={input} type="number" value={form.capacity} onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))} /></div>
              <div><label style={lbl}>الرسم الشهري</label><input style={input} type="number" step="0.001" value={form.fee} onChange={(e) => setForm((p) => ({ ...p, fee: e.target.value }))} placeholder="25.000" /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>جهة تحصيل رسوم النقل</label>
                <select style={input} value={form.payTo} onChange={(e) => setForm((p) => ({ ...p, payTo: e.target.value }))}>
                  <option value="school">المدرسة (ضمن الرسوم الدراسية)</option>
                  <option value="driver">السائق مباشرةً (لا يدخل حسابات المدرسة)</option>
                  <option value="private">توصيل خاص (ترتيب خاص — خارج حسابات المدرسة)</option>
                </select>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#8A94A6', margin: '10px 0' }}>
              💡 "السائق مباشرة" و"توصيل خاص" لا تدخلان إيرادات المدرسة.
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button style={{ ...btnGold, flex: 1 }} onClick={saveBus} disabled={busy}>{busy ? 'جارٍ الحفظ…' : form.id ? 'حفظ التعديلات' : 'إضافة الباص'}</button>
              <button style={btnGhost} onClick={() => setEditOpen(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
