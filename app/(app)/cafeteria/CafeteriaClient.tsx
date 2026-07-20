'use client'
// مكوّن التغذية المدرسية — باقات + اشتراكات متعددة لكل طالب + فوترة شهرية
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { printReport, type SchoolHeader } from '@/lib/print-report'

type Plan = { id: string; name: string; fee: number; subscribers: number }
type Sub = {
  student_id: string
  full_name: string
  guardian_name: string | null
  plan_id: string
  plan_name: string
  fee: number
}
type Student = { id: string; full_name: string; guardian_name: string | null }

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #E6EBF1', borderRadius: 14,
  padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.05)', marginBottom: 16,
}
const input: React.CSSProperties = {
  width: '100%', padding: 11, borderRadius: 10, border: '1.5px solid #DDE3EC',
  fontFamily: 'inherit', fontSize: 14, background: '#fff',
}
const btnGold: React.CSSProperties = {
  padding: '11px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: '#D4A017', color: '#08172B', fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
}
const btnGhost: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 9, border: '1px solid #DDE3EC', cursor: 'pointer',
  background: '#fff', color: '#445', fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
}
const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

const MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                     'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

// قائمة الأشهر: من ستة أشهر مضت إلى ستة قادمة
function monthOptions() {
  const out: { value: string; label: string }[] = []
  const now = new Date()
  for (let d = -6; d <= 6; d++) {
    const dt = new Date(now.getFullYear(), now.getMonth() + d, 1)
    const y = dt.getFullYear()
    const m = dt.getMonth()
    out.push({
      value: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: `${MONTH_NAMES[m]} ${y}`,
    })
  }
  return out
}

export default function CafeteriaClient({ initialPlans, initialSubscribers, students, school }: {
  initialPlans: Plan[]; initialSubscribers: Sub[]; students: Student[]; school: SchoolHeader
}) {
  const supabase = createClient()
  const [plans, setPlans] = useState<Plan[]>(initialPlans)
  const [subs, setSubs] = useState<Sub[]>(initialSubscribers)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  // نموذج باقة جديدة
  const [pName, setPName] = useState('')
  const [pFee, setPFee] = useState('')
  // نموذج اشتراك
  const [selStudent, setSelStudent] = useState('')
  const [selPlan, setSelPlan] = useState('')
  // الفوترة
  const months = monthOptions()
  const [month, setMonth] = useState(months[6].value)

  // تجميع الاشتراكات حسب الطالب
  const grouped = subs.reduce((acc, s) => {
    const g = acc.get(s.student_id) ?? {
      student_id: s.student_id, full_name: s.full_name,
      guardian_name: s.guardian_name, plans: [] as Sub[],
    }
    g.plans.push(s)
    acc.set(s.student_id, g)
    return acc
  }, new Map<string, { student_id: string; full_name: string; guardian_name: string | null; plans: Sub[] }>())
  const rows = Array.from(grouped.values())

  async function refresh() {
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.rpc('cafeteria_plans'), supabase.rpc('cafeteria_subscribers'),
    ])
    setPlans(p || []); setSubs(s || [])
  }

  async function addPlan() {
    if (!pName.trim() || !pFee) { setMsg('أدخل اسم الباقة والرسم'); return }
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('save_meal_plan', { p_name: pName.trim(), p_fee: parseFloat(pFee) })
    if (error) { setMsg('خطأ: ' + error.message); setBusy(false); return }
    setPName(''); setPFee(''); await refresh(); setMsg('✓ تمت إضافة الباقة'); setBusy(false)
  }

  async function subscribe() {
    if (!selStudent || !selPlan) { setMsg('اختر الطالب والباقة'); return }
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('subscribe_meal', { p_student: selStudent, p_plan: selPlan })
    if (error) { setMsg('خطأ: ' + error.message); setBusy(false); return }
    setSelPlan(''); await refresh(); setMsg('✓ تم تسجيل الاشتراك'); setBusy(false)
  }

  // إلغاء باقة واحدة للطالب
  async function removeOne(studentId: string, planId: string) {
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('unsubscribe_meal', { p_student: studentId, p_plan: planId })
    if (error) { setMsg('خطأ: ' + error.message); setBusy(false); return }
    await refresh(); setBusy(false)
  }

  // إلغاء كل باقات الطالب
  async function removeAll(studentId: string, name: string) {
    if (!confirm(`إلغاء جميع اشتراكات ${name}؟`)) return
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('unsubscribe_meal', { p_student: studentId, p_plan: null })
    if (error) { setMsg('خطأ: ' + error.message); setBusy(false); return }
    await refresh(); setBusy(false)
  }

  async function bill() {
    setBusy(true); setMsg('')
    const { data, error } = await supabase.rpc('bill_cafeteria', { p_month: month })
    if (error) { setMsg('خطأ: ' + error.message); setBusy(false); return }
    await refresh(); setMsg(`⚡ صدرت ${data} فاتورة تغذية لشهر ${month}`); setBusy(false)
  }

  const monthlyTotal = subs.reduce((a, s) => a + Number(s.fee ?? 0), 0)

  return (
    <>
      {msg && <div style={{ ...card, padding: 12, color: msg.startsWith('✓') || msg.startsWith('⚡') ? '#1A7A45' : '#C0392B', marginBottom: 12 }}>{msg}</div>}

      {/* باقات التغذية */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, color: '#0F2744', fontSize: 16 }}>باقات التغذية</h3>
          {plans.length > 0 && (
            <button onClick={() => printReport({
              school, title: 'تقرير باقات التغذية',
              columns: [{ key: 'name', label: 'الباقة' }, { key: 'fee', label: 'الرسم الشهري' }, { key: 'subs', label: 'المشتركون' }],
              rows: plans.map((p) => ({ name: p.name, fee: fmt(p.fee), subs: p.subscribers })),
            })} style={{ background: '#fff', color: '#0F2744', border: '1.5px solid #DDE3EC', borderRadius: 9, padding: '7px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>🖨 طباعة</button>
          )}
        </div>
        {plans.length > 0 && (
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 360 }}>
              <thead>
                <tr style={{ background: '#F7F9FC', textAlign: 'right' }}>
                  <th style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>الباقة</th>
                  <th style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>الرسم الشهري</th>
                  <th style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>المشتركون</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} style={{ borderTop: '1px solid #F2F5F8' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0F2744' }}>{p.name}</td>
                    <td style={{ padding: '10px 12px' }}>{fmt(p.fee)}</td>
                    <td style={{ padding: '10px 12px' }}>{p.subscribers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }}>اسم الباقة</label>
            <input style={input} value={pName} onChange={(e) => setPName(e.target.value)} placeholder="مثال: إفطار" /></div>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }}>الرسم الشهري</label>
            <input style={input} type="number" step="0.001" value={pFee} onChange={(e) => setPFee(e.target.value)} placeholder="28.000" /></div>
          <button style={btnGold} onClick={addPlan} disabled={busy}>＋ إضافة</button>
        </div>
      </div>

      {/* اشتراك طالب */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, color: '#0F2744', fontSize: 16 }}>تسجيل اشتراك طالب</h3>
          {subs.length > 0 && (
            <button onClick={() => printReport({
              school, title: 'تقرير المشتركين في التغذية',
              columns: [
                { key: 'student', label: 'الطالب' },
                { key: 'guardian', label: 'ولي الأمر' },
                { key: 'plan', label: 'الباقة' },
                { key: 'fee', label: 'الرسم' },
              ],
              rows: subs.map((s) => ({
                student: s.full_name, guardian: s.guardian_name || '—',
                plan: s.plan_name, fee: fmt(s.fee),
              })),
            })} style={{ background: '#fff', color: '#0F2744', border: '1.5px solid #DDE3EC', borderRadius: 9, padding: '7px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>🖨 طباعة المشتركين</button>
          )}
        </div>

        <p style={{ fontSize: 12.5, color: '#8A94A6', margin: '0 0 12px' }}>
          💡 يمكن تسجيل الطالب في أكثر من باقة — اختر الطالب ثم أضف الباقات واحدة تلو الأخرى.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }}>الطالب</label>
            <select style={input} value={selStudent} onChange={(e) => setSelStudent(e.target.value)}>
              <option value="">اختر الطالب</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select></div>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }}>الباقة</label>
            <select style={input} value={selPlan} onChange={(e) => setSelPlan(e.target.value)}>
              <option value="">اختر الباقة</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmt(p.fee)}</option>)}
            </select></div>
          <button style={btnGold} onClick={subscribe} disabled={busy}>＋ إضافة باقة</button>
        </div>

        {rows.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <thead>
                <tr style={{ background: '#F7F9FC', textAlign: 'right' }}>
                  <th style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>الطالب</th>
                  <th style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>ولي الأمر</th>
                  <th style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>الباقات</th>
                  <th style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>الإجمالي</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const total = r.plans.reduce((a, p) => a + Number(p.fee ?? 0), 0)
                  return (
                    <tr key={r.student_id} style={{ borderTop: '1px solid #F2F5F8' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0F2744' }}>{r.full_name}</td>
                      <td style={{ padding: '10px 12px' }}>{r.guardian_name || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {r.plans.map((p) => (
                            <span key={p.plan_id}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                                       background: '#EEF3F9', color: '#1B4F8A', borderRadius: 20,
                                       padding: '4px 10px', fontSize: 12.5, fontWeight: 600 }}>
                              {p.plan_name} · {fmt(p.fee)}
                              <button onClick={() => removeOne(r.student_id, p.plan_id)} disabled={busy}
                                title="إلغاء هذه الباقة"
                                style={{ background: 'none', border: 0, color: '#8A2B2B',
                                         cursor: busy ? 'default' : 'pointer', fontSize: 15,
                                         lineHeight: 1, padding: 0 }}>×</button>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0F2744' }}>{fmt(total)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <button style={btnGhost} onClick={() => removeAll(r.student_id, r.full_name)} disabled={busy}>
                          إلغاء الكل
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div style={{ marginTop: 12, padding: '10px 12px', background: '#F7F9FC', borderRadius: 10,
                          display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
              <span style={{ color: '#556' }}>
                {rows.length} طالب · {subs.length} اشتراك
              </span>
              <b style={{ color: '#0F2744' }}>الإيراد الشهري المتوقع: {fmt(monthlyTotal)}</b>
            </div>
          </div>
        )}
      </div>

      {/* الفوترة الشهرية */}
      <div style={card}>
        <h3 style={{ margin: '0 0 14px', color: '#0F2744', fontSize: 16 }}>الفوترة الشهرية</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }}>شهر الفوترة</label>
            <select style={input} value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select></div>
          <button style={btnGold} onClick={bill} disabled={busy}>⚡ فوترة التغذية لكل المشتركين</button>
        </div>
        <p style={{ fontSize: 12, color: '#8A94A6', marginTop: 10 }}>
          💡 تُنشئ رسماً منفصلاً لكل باقة يشترك فيها الطالب، يدخل كإيراد للمدرسة ويدفعه ولي الأمر عبر بوابته.
        </p>
      </div>
    </>
  )
}
