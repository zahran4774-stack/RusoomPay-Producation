'use client'
// مكوّن التغذية المدرسية — باقات + اشتراكات متعددة لكل طالب + فوترة شهرية
// + قسم مستقل: مخزون المواد الغذائية الخام (شراء/صرف استهلاكي) — غير مفوتر على الطالب،
//   لأنه محسوب أصلاً ضمن الرسوم الدراسية العامة.
import { useState, useEffect } from 'react'
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

// صنف في مخزون المواد الغذائية الخام
type FoodItem = { id: string; name: string; unit: string; qty: number; cost: number }

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
const btnSm: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 8, border: '1px solid #DDE3EC', cursor: 'pointer',
  background: '#fff', color: '#445', fontWeight: 600, fontSize: 12.5, fontFamily: 'inherit',
}
const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const fmtQty = (n: number) => (n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })

const MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                     'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

// أسباب صرف شائعة — اختصار سريع، مع إمكانية كتابة سبب مخصّص
const DISPENSE_REASONS = ['وجبة إفطار', 'وجبة غداء', 'نشاط/مناسبة', 'تحضير يومي', 'أخرى']

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

  // ── مخزون المواد الغذائية الخام ──
  const [foodItems, setFoodItems] = useState<FoodItem[]>([])
  const [foodMsg, setFoodMsg] = useState('')
  const [foodBusy, setFoodBusy] = useState(false)
  // نموذج صنف جديد
  const [fName, setFName] = useState('عصير')
  const [fUnit, setFUnit] = useState('عبوه')
  const [fQty, setFQty] = useState('')
  const [fCost, setFCost] = useState('')
  // نافذة الحركة (شراء/صرف)
  const [moveItem, setMoveItem] = useState<FoodItem | null>(null)
  const [moveMode, setMoveMode] = useState<'buy' | 'dispense'>('buy')
  const [moveQty, setMoveQty] = useState('1')
  const [dispenseReason, setDispenseReason] = useState(DISPENSE_REASONS[0])
  const [customReason, setCustomReason] = useState('')

  async function loadFoodItems() {
    const { data } = await supabase.rpc('food_inventory_list')
    setFoodItems(data || [])
  }
  useEffect(() => { loadFoodItems() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function addFoodItem() {
    if (!fName.trim()) { setFoodMsg('اسم الصنف مطلوب'); return }
    setFoodBusy(true); setFoodMsg('')
    const { error } = await supabase.rpc('save_food_item', {
      p_name: fName.trim(), p_unit: fUnit.trim() || 'كجم',
      p_qty: parseFloat(fQty) || 0, p_cost: parseFloat(fCost) || 0,
    })
    if (error) { setFoodMsg('خطأ: ' + error.message); setFoodBusy(false); return }
    setFName(''); setFUnit('كجم'); setFQty(''); setFCost('')
    await loadFoodItems(); setFoodMsg('✓ تمت إضافة الصنف'); setFoodBusy(false)
  }

  function openMove(item: FoodItem, mode: 'buy' | 'dispense') {
    setMoveItem(item); setMoveMode(mode); setMoveQty('1')
    setDispenseReason(DISPENSE_REASONS[0]); setCustomReason(''); setFoodMsg('')
  }

  async function execMove() {
    if (!moveItem) return
    const q = parseFloat(moveQty) || 0
    if (q <= 0) { setFoodMsg('أدخل كمية صحيحة'); return }
    setFoodBusy(true); setFoodMsg('')

    if (moveMode === 'buy') {
      const { data, error } = await supabase.rpc('food_purchase', { p_item: moveItem.id, p_qty: q })
      if (error || !data?.ok) { setFoodMsg('خطأ: ' + (error?.message || 'تعذّر الشراء')); setFoodBusy(false); return }
      setFoodMsg('✓ تم الشراء — مخزون التغذية مدين / بنك دائن')
    } else {
      const reason = dispenseReason === 'أخرى' ? customReason.trim() : dispenseReason
      const { data, error } = await supabase.rpc('food_dispense', { p_item: moveItem.id, p_qty: q, p_reason: reason || null })
      if (error || !data?.ok) {
        const reasonMsg = data?.reason === 'insufficient_qty' ? `الكمية أكبر من الرصيد المتاح (${fmtQty(data.available)})` : (error?.message || 'تعذّر الصرف')
        setFoodMsg('خطأ: ' + reasonMsg); setFoodBusy(false); return
      }
      setFoodMsg('✓ سُجّل الصرف الاستهلاكي — بلا فاتورة على أولياء الأمور')
    }
    setMoveItem(null); await loadFoodItems(); setFoodBusy(false)
  }

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

      {/* ══ مخزون المواد الغذائية الخام — شراء وصرف استهلاكي، غير مفوتر على الطالب ══ */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0, color: '#0F2744', fontSize: 16 }}>مخزون المواد الغذائية</h3>
        </div>
        <p style={{ fontSize: 12.5, color: '#8A94A6', margin: '0 0 14px' }}>
          الكميات المشتراة والمصروفة من المواد الغذائية الخام (دقيق، خضار، لحوم...) — لمتابعة الاستهلاك والتكلفة فقط.
          محسوبة أصلاً ضمن الرسوم الدراسية العامة، ولا تُفوتر بشكل منفصل على أي طالب.
        </p>

        {foodMsg && (
          <div style={{ padding: '9px 13px', borderRadius: 9, marginBottom: 12, fontSize: 13, color: foodMsg.startsWith('✓') ? '#1A7A45' : '#C0392B', background: foodMsg.startsWith('✓') ? '#EAF7F0' : '#FDECEA' }}>
            {foodMsg}
          </div>
        )}

        {foodItems.length > 0 ? (
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
              <thead>
                <tr style={{ background: '#F7F9FC', textAlign: 'right' }}>
                  {['الصنف', 'الكمية المتاحة', 'تكلفة الوحدة', 'قيمة المخزون', ''].map((h) => (
                    <th key={h} style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {foodItems.map((it) => (
                  <tr key={it.id} style={{ borderTop: '1px solid #F2F5F8' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0F2744' }}>{it.name}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {fmtQty(it.qty)} {it.unit}
                      {it.qty < 5 && <span style={{ background: '#FCE9E6', color: '#C0392B', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99, marginRight: 6 }}>منخفض</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{fmt(it.cost)}</td>
                    <td style={{ padding: '10px 12px' }}>{fmt(it.qty * it.cost)}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <button style={btnSm} onClick={() => openMove(it, 'buy')}>＋ شراء</button>{' '}
                      <button style={{ ...btnSm, background: '#0D7D6B', color: '#fff', border: 'none' }} onClick={() => openMove(it, 'dispense')}>صرف استهلاكي</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: '#8A94A6', textAlign: 'center', padding: 16, marginBottom: 16 }}>لا توجد أصناف بعد — أضف أول صنف بالأسفل</p>
        )}

        {/* إضافة صنف غذائي جديد */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }}>اسم الصنف</label>
            <input style={input} value={fName} onChange={(e) => setFName(e.target.value)} placeholder="أرز" /></div>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }}>الوحدة</label>
            <input style={input} value={fUnit} onChange={(e) => setFUnit(e.target.value)} placeholder="كجم" /></div>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }}>الكمية</label>
            <input style={input} type="number" step="0.01" value={fQty} onChange={(e) => setFQty(e.target.value)} placeholder="0" /></div>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }}>تكلفة الوحدة</label>
            <input style={input} type="number" step="0.001" value={fCost} onChange={(e) => setFCost(e.target.value)} placeholder="0.000" /></div>
          <button style={btnGold} onClick={addFoodItem} disabled={foodBusy}>＋ إضافة</button>
        </div>
      </div>

      {/* نافذة حركة المخزون الغذائي (شراء/صرف) */}
      {moveItem && (
        <div onClick={() => setMoveItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(8,15,27,.55)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 420, width: '100%' }} dir="rtl">
            <h3 style={{ margin: '0 0 6px', color: '#0F2744' }}>
              {moveMode === 'buy' ? 'شراء مواد غذائية' : 'صرف استهلاكي'}
            </h3>
            <p style={{ fontSize: 13, color: '#667', margin: '0 0 16px' }}>
              <b>{moveItem.name}</b> — الرصيد الحالي: <b>{fmtQty(moveItem.qty)} {moveItem.unit}</b> · تكلفة الوحدة {fmt(moveItem.cost)}
            </p>

            {moveMode === 'dispense' && (
              <div style={{ background: '#EAF5F2', border: '1px solid #CDE8E1', borderRadius: 10, padding: '10px 13px', marginBottom: 14, fontSize: 12.5, color: '#0D7D6B' }}>
                صرف داخلي فقط — لا يُنشئ فاتورة ولا يُحمَّل على أي طالب.
              </div>
            )}

            <label style={{ fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }}>الكمية ({moveItem.unit})</label>
            <input style={{ ...input, marginBottom: 14 }} type="number" step="0.01" value={moveQty} onChange={(e) => setMoveQty(e.target.value)} />

            {moveMode === 'dispense' && (
              <>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }}>سبب الصرف</label>
                <select style={{ ...input, marginBottom: dispenseReason === 'أخرى' ? 10 : 14 }} value={dispenseReason} onChange={(e) => setDispenseReason(e.target.value)}>
                  {DISPENSE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                {dispenseReason === 'أخرى' && (
                  <input style={{ ...input, marginBottom: 14 }} value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="اكتب السبب..." />
                )}
              </>
            )}

            <div style={{ background: '#F7FAFC', border: '1px solid #EEF1F5', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, display: 'flex', justifyContent: 'space-between', color: '#0F2744' }}>
              <span>{moveMode === 'buy' ? 'تكلفة الشراء' : 'تكلفة الصرف (مصروف إداري)'}</span>
              <b>{fmt((parseFloat(moveQty) || 0) * moveItem.cost)}</b>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnGhost} onClick={() => setMoveItem(null)}>إلغاء</button>
              <button
                style={moveMode === 'dispense' ? { ...btnGold, background: '#0D7D6B', color: '#fff' } : btnGold}
                onClick={execMove} disabled={foodBusy}>
                {moveMode === 'buy' ? 'تأكيد الشراء والترحيل' : 'تأكيد الصرف الاستهلاكي'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
