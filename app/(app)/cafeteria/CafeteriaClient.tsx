'use client'
// مكون التغذية المدرسية — باقات (سنوية/شهرية) + اشتراكات + فوترة
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { printReport, type SchoolHeader } from '@/lib/print-report'
import MealCost from './MealCost'

type Plan = { id: string; name: string; fee: number; plan_type: 'annual' | 'monthly'; subscribers: number }
type Sub = { student_id: string; student_name: string; guardian: string; plan_name: string }
type Student = { id: string; full_name: string; guardian_name: string | null }

// أسماء الأشهر بالعربية — تُستخدم لتوليد قائمة اختيار الشهر ديناميكياً
const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

// يبني قائمة أشهر من بداية السنة الحالية وحتى نهاية 2050 — بدل قائمة ثابتة
// كانت مكتوبة يدوياً بـ5 أشهر فقط (يونيو–أكتوبر 2026) وتتوقف عن العمل بعدها
function buildMonthOptions(): { value: string; label: string }[] {
  const startYear = new Date().getFullYear()
  const endYear = 2050
  const options: { value: string; label: string }[] = []
  for (let year = startYear; year <= endYear; year++) {
    for (let m = 1; m <= 12; m++) {
      const value = `${year}-${String(m).padStart(2, '0')}`
      options.push({ value, label: `${MONTH_NAMES_AR[m - 1]} ${year}` })
    }
  }
  return options
}

// الشهر الحالي الفعلي بصيغة YYYY-MM — بدل قيمة مثبّتة بالكود كانت دائماً "2026-06"
function currentMonthValue(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const MONTH_OPTIONS = buildMonthOptions()

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
const badge = (type: 'annual' | 'monthly'): React.CSSProperties => ({
  display: 'inline-block', fontSize: 11.5, fontWeight: 700, borderRadius: 7, padding: '3px 9px',
  background: type === 'annual' ? '#FDF3E7' : '#EEF4FF',
  color: type === 'annual' ? '#B5720E' : '#1D4ED8',
})
const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const typeLabel = (t: 'annual' | 'monthly') => (t === 'annual' ? 'سنوية' : 'شهرية')

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
  const [pType, setPType] = useState<'annual' | 'monthly'>('monthly')
  // نموذج اشتراك
  const [selStudent, setSelStudent] = useState('')
  const [selPlan, setSelPlan] = useState('')
  const [available, setAvailable] = useState<Student[]>(students)
  // الفوترة
  const [month, setMonth] = useState(currentMonthValue())

  async function refresh() {
    const [{ data: p }, { data: s }, { data: avail }] = await Promise.all([
      supabase.rpc('cafeteria_plans'),
      supabase.rpc('cafeteria_subscribers'),
      supabase.rpc('students_without_meal'),
    ])
    setPlans(p || []); setSubs(s || [])
    if (avail) setAvailable(avail)
  }

  async function addPlan() {
    if (!pName.trim() || !pFee) { setMsg('أدخل اسم الباقة والرسم'); return }
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('save_meal_plan', { p_name: pName.trim(), p_fee: parseFloat(pFee), p_type: pType })
    if (error) { setMsg('خطأ: ' + error.message); setBusy(false); return }
    setPName(''); setPFee(''); setPType('monthly'); await refresh(); setMsg('✓ تمت إضافة الباقة'); setBusy(false)
  }

  async function subscribe() {
    if (!selStudent || !selPlan) { setMsg('اختر الطالب والباقة'); return }
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('subscribe_meal', { p_student: selStudent, p_plan: selPlan })
    if (error) { setMsg('⚠ ' + error.message); setBusy(false); return }
    setSelStudent(''); setSelPlan(''); await refresh(); setMsg('✓ تم تسجيل الاشتراك وإصدار الفاتورة'); setBusy(false)
  }

  async function removeSub(studentId: string) {
    setBusy(true)
    await supabase.rpc('unsubscribe_meal', { p_student: studentId })
    await refresh(); setBusy(false)
  }

  async function bill() {
    setBusy(true); setMsg('')
    const { data, error } = await supabase.rpc('bill_cafeteria', { p_month: month })
    if (error) { setMsg('خطأ: ' + error.message); setBusy(false); return }
    await refresh(); setMsg(`⚡ صدرت ${data} فاتورة تغذية لشهر ${month}`); setBusy(false)
  }

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
              columns: [{ key: 'name', label: 'الباقة' }, { key: 'type', label: 'النوع' }, { key: 'fee', label: 'الرسم' }, { key: 'subs', label: 'المشتركون' }],
              rows: plans.map((p) => ({ name: p.name, type: typeLabel(p.plan_type), fee: fmt(p.fee), subs: p.subscribers })),
            })} style={{ background: '#fff', color: '#0F2744', border: '1.5px solid #DDE3EC', borderRadius: 9, padding: '7px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>🖨 طباعة</button>
          )}
        </div>
        {plans.length > 0 && (
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
              <thead>
                <tr style={{ background: '#F7F9FC', textAlign: 'right' }}>
                  <th style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>الباقة</th>
                  <th style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>النوع</th>
                  <th style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>الرسم</th>
                  <th style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>المشتركون</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} style={{ borderTop: '1px solid #F2F5F8' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0F2744' }}>{p.name}</td>
                    <td style={{ padding: '10px 12px' }}><span style={badge(p.plan_type)}>{typeLabel(p.plan_type)}</span></td>
                    <td style={{ padding: '10px 12px' }}>{fmt(p.fee)}</td>
                    <td style={{ padding: '10px 12px' }}>{p.subscribers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }}>اسم الباقة</label>
            <input style={input} value={pName} onChange={(e) => setPName(e.target.value)} placeholder="مثال: إفطار + غداء" /></div>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }}>النوع</label>
            <select style={input} value={pType} onChange={(e) => setPType(e.target.value as 'annual' | 'monthly')}>
              <option value="monthly">شهرية</option>
              <option value="annual">سنوية</option>
            </select></div>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }}>الرسم ({pType === 'annual' ? 'سنوي' : 'شهري'})</label>
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
              columns: [{ key: 'student', label: 'الطالب' }, { key: 'guardian', label: 'ولي الأمر' }, { key: 'plan', label: 'الباقة' }],
              rows: subs.map((s) => ({ student: s.student_name, guardian: s.guardian || '—', plan: s.plan_name })),
            })} style={{ background: '#fff', color: '#0F2744', border: '1.5px solid #DDE3EC', borderRadius: 9, padding: '7px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>🖨 طباعة المشتركين</button>
          )}
        </div>
        <p style={{ fontSize: 12.5, color: '#8A94A6', margin: '0 0 12px' }}>
          💡 عند تسجيل اشتراك شهري تصدر الفاتورة الأولى فورًا. إذا كان الطالب مقيّدًا في باقة سنوية، لا يمكن تسجيله في باقة أخرى.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }}>الطالب</label>
            <select style={input} value={selStudent} onChange={(e) => setSelStudent(e.target.value)}>
              <option value="">اختر الطالب</option>
              {available.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select></div>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }}>الباقة</label>
            <select style={input} value={selPlan} onChange={(e) => setSelPlan(e.target.value)}>
              <option value="">اختر الباقة</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {typeLabel(p.plan_type)} — {fmt(p.fee)}</option>)}
            </select></div>
          <button style={btnGold} onClick={subscribe} disabled={busy}>حفظ</button>
        </div>
        {subs.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
              <thead>
                <tr style={{ background: '#F7F9FC', textAlign: 'right' }}>
                  <th style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>الطالب</th>
                  <th style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>ولي الأمر</th>
                  <th style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>الباقة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.student_id} style={{ borderTop: '1px solid #F2F5F8' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0F2744' }}>{s.student_name}</td>
                    <td style={{ padding: '10px 12px' }}>{s.guardian || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{s.plan_name}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <button style={btnGhost} onClick={() => removeSub(s.student_id)} disabled={busy}>إلغاء</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* الفوترة الشهرية — فقط للمشتركين الشهريين غير المفوترين لهذا الشهر */}
      <div style={card}>
        <h3 style={{ margin: '0 0 14px', color: '#0F2744', fontSize: 16 }}>الفوترة الشهرية</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }}>شهر الفوترة</label>
            <select style={input} value={month} onChange={(e) => setMonth(e.target.value)}>
              {MONTH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select></div>
          <button style={btnGold} onClick={bill} disabled={busy}>⚡ فوترة الشهريين غير المفوترين لهذا الشهر</button>
        </div>
        <p style={{ fontSize: 12, color: '#8A94A6', marginTop: 10 }}>
          💡 تصدر رسومًا فقط للمشتركين الشهريين اللي ما انفوترو لهذا الشهر بعد (تدخل كإيراد للمدرسة، حساب 4220). الباقات السنوية تُفوتر تلقائيًا مرة واحدة عند التسجيل ولا تظهر هنا.
        </p>
      </div>

      {/* تتبّع تكلفة الوجبات */}
      <div style={card}>
        <h3 style={{ margin: '0 0 6px', color: '#0F2744', fontSize: 16 }}>تتبّع تكلفة الوجبات</h3>
        <p style={{ fontSize: 12.5, color: '#8A94A6', margin: '0 0 4px' }}>
          سجّل مشتريات الوجبات من الموردين لقياس التكلفة والهامش. (تكلفة داخلية — لا تظهر لولي الأمر.)
        </p>
        <MealCost sym="ر.ع" />
      </div>
    </>
  )
}
