'use client'
// تتبّع تكلفة الوجبات — الموردون + المشتريات + تقرير التكلفة
// كل بند شراء له زر "تعديل" منسدل بثلاثة خيارات:
//   1) تعديل سعر الشراء والبيانات — قيد عكسي + قيد جديد بالسعر الصحيح
//   2) الدفع — تأكيد السداد مع اختيار مصدر الدفع (صندوق/بنك)
//   3) إلغاء الشراء — يبقى ظاهراً بعلامة "ملغى"، قيد عكسي يُصفّر أثره المالي والكمي
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase-client'

type Supplier = { id: string; name: string; contact_name: string | null; phone: string | null; email: string | null; vat_number: string | null; active: boolean }
type Purchase = {
  id: string; supplier_id: string | null; supplier_name: string | null; purchase_date: string
  purchase_type: string; meals_count: number; unit_cost: number; total_cost: number
  period: string | null; paid: boolean; notes: string | null; item_type: string | null; status: string
}
type Report = { meals_purchased: number; total_cost: number; avg_per_meal: number; meal_students: number; avg_per_student: number; suppliers: { supplier: string; meals: number; cost: number; avg_cost: number }[] }
type PaymentSource = 'cash' | 'bank'

const TYPES: Record<string, string> = { daily: 'يومي', monthly: 'شهري', bulk: 'جملة', other: 'أخرى' }
const fmt3 = (n: number) => (n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const fmt0 = (n: number) => (n || 0).toLocaleString('en-US')
const thisPeriod = () => new Date().toISOString().slice(0, 7)

function PaymentSourcePicker({ value, onChange }: { value: PaymentSource; onChange: (v: PaymentSource) => void }) {
  const opt = (v: PaymentSource): React.CSSProperties => ({
    flex: 1, padding: '10px 12px', borderRadius: 9, cursor: 'pointer', textAlign: 'center',
    fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit',
    border: `1.5px solid ${value === v ? '#163B68' : '#E3E8EE'}`,
    background: value === v ? '#F0F5FB' : '#fff',
    color: value === v ? '#163B68' : '#667',
  })
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#0F2744', display: 'block', marginBottom: 6 }}>مصدر الدفع</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={opt('cash')} onClick={() => onChange('cash')}>💵 من الصندوق</div>
        <div style={opt('bank')} onClick={() => onChange('bank')}>🏦 من البنك</div>
      </div>
    </div>
  )
}

export default function MealCost({ sym = 'ر.ع' }: { sym?: string }) {
  const supabase = createClient()
  const [tab, setTab] = useState<'report' | 'purchases' | 'suppliers'>('report')
  const [period, setPeriod] = useState(thisPeriod())
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [s, p, r] = await Promise.all([
      supabase.rpc('meal_suppliers'),
      supabase.rpc('meal_purchases_list', { p_period: period || null }),
      supabase.rpc('meal_cost_report', { p_period: period || null }),
    ])
    setSuppliers(s.data ?? [])
    setPurchases(p.data ?? [])
    setReport(r.data ?? null)
    setLoading(false)
  }, [supabase, period])

  useEffect(() => { load() }, [load])

  return (
    <div dir="rtl" style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div className="module-tabs" role="tablist" aria-label="أقسام تكلفة الوجبات" style={{ border: 'none', paddingBottom: 0, margin: 0 }}>
          <button role="tab" aria-selected={tab === 'report'} className={`module-tab ${tab === 'report' ? 'active' : ''}`} onClick={() => setTab('report')}>📊 التقرير</button>
          <button role="tab" aria-selected={tab === 'purchases'} className={`module-tab ${tab === 'purchases' ? 'active' : ''}`} onClick={() => setTab('purchases')}>🧾 المشتريات</button>
          <button role="tab" aria-selected={tab === 'suppliers'} className={`module-tab ${tab === 'suppliers' ? 'active' : ''}`} onClick={() => setTab('suppliers')}>🏢 الموردون</button>
        </div>
        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: '#667' }}>الفترة</label>
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid #E3E8EE', fontFamily: 'inherit' }} dir="ltr" />
        </div>
      </div>

      {loading ? <div style={{ padding: 30, textAlign: 'center', color: '#8A94A6' }}>جارٍ التحميل…</div> : (
        <>
          {tab === 'report' && <ReportView report={report} sym={sym} />}
          {tab === 'purchases' && <PurchasesView purchases={purchases} suppliers={suppliers} period={period} sym={sym} onChange={load} />}
          {tab === 'suppliers' && <SuppliersView suppliers={suppliers} onChange={load} />}
        </>
      )}
    </div>
  )
}

function ReportView({ report, sym }: { report: Report | null; sym: string }) {
  if (!report) return <div style={{ color: '#8A94A6' }}>لا بيانات</div>
  const cards = [
    { label: 'إجمالي التكلفة', value: fmt3(report.total_cost), unit: sym, tone: 'act' },
    { label: 'وجبات مُشتراة', value: fmt0(report.meals_purchased), unit: '' },
    { label: 'متوسّط تكلفة الوجبة', value: fmt3(report.avg_per_meal), unit: sym },
    { label: 'طلاب مشتركون', value: fmt0(report.meal_students), unit: '' },
    { label: 'متوسّط التكلفة للطالب', value: fmt3(report.avg_per_student), unit: sym },
  ]
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        {cards.map((c, i) => (
          <div key={i} style={{ background: c.tone === 'act' ? '#FDFAF4' : '#fff', border: `1px solid ${c.tone === 'act' ? '#F0E0C0' : '#E7EBF0'}`, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12.5, color: '#8A94A6', marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 21, fontWeight: 800, color: c.tone === 'act' ? '#B54708' : '#0F2744' }}>
              {c.value} {c.unit && <span style={{ fontSize: 12, color: '#8A94A6', fontWeight: 400 }}>{c.unit}</span>}
            </div>
          </div>
        ))}
      </div>
      <h4 style={{ color: '#0F2744', margin: '0 0 10px' }}>التكلفة حسب المورّد</h4>
      <div style={{ background: '#fff', borderRadius: 12, overflow: 'auto', border: '1px solid #EDF1F5' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead><tr style={{ background: '#F7FAFC', textAlign: 'right' }}>
            <th style={{ padding: 11 }}>المورّد</th><th style={{ padding: 11 }}>الوجبات</th>
            <th style={{ padding: 11 }}>التكلفة</th><th style={{ padding: 11 }}>متوسّط/وجبة</th>
          </tr></thead>
          <tbody>
            {report.suppliers.map((s, i) => (
              <tr key={i} style={{ borderTop: '1px solid #F2F5F8' }}>
                <td style={{ padding: 11, fontWeight: 600 }}>{s.supplier}</td>
                <td style={{ padding: 11 }}>{fmt0(s.meals)}</td>
                <td style={{ padding: 11 }}>{fmt3(s.cost)} {sym}</td>
                <td style={{ padding: 11 }}>{fmt3(s.avg_cost)} {sym}</td>
              </tr>
            ))}
            {report.suppliers.length === 0 && <tr><td colSpan={4} style={{ padding: 18, textAlign: 'center', color: '#999' }}>لا مشتريات في هذه الفترة</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const ITEM_TYPE_SUGGESTIONS = ['أرز', 'دجاج', 'لحوم', 'خضار وفواكه', 'ألبان', 'مخبوزات', 'مشروبات', 'أدوات مطبخ', 'أخرى']

// القائمة المنسدلة لزر "تعديل" — تُغلق عند الضغط خارجها
function ActionMenu({ purchase, onPay, onEditPrice, onCancel }: {
  purchase: Purchase
  onPay: () => void
  onEditPrice: () => void
  onCancel: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  if (purchase.status === 'cancelled') {
    return <span style={{ fontSize: 12, color: '#8A94A6', fontWeight: 600 }}>لا إجراءات — ملغى</span>
  }

  const item: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'right', padding: '9px 14px', background: 'none',
    border: 0, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: '#0F2744',
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen((v) => !v)}
        style={{ background: '#F2F5F8', color: '#0F2744', border: 0, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit' }}>
        ⚙ تعديل ▾
      </button>
      {open && (
        <div style={{
          position: 'absolute', left: 0, top: '110%', zIndex: 40, minWidth: 210,
          background: '#fff', border: '1px solid #E3E8EE', borderRadius: 11,
          boxShadow: '0 10px 30px -10px rgba(15,39,68,.25)', overflow: 'hidden',
        }}>
          <button style={item} onClick={() => { setOpen(false); onEditPrice() }}>💲 تعديل سعر الشراء والبيانات</button>
          {!purchase.paid && (
            <button style={item} onClick={() => { setOpen(false); onPay() }}>✓ تسجيل الدفع</button>
          )}
          <button style={{ ...item, color: '#C0392B', borderTop: '1px solid #F2F5F8' }} onClick={() => { setOpen(false); onCancel() }}>✕ إلغاء الشراء</button>
        </div>
      )}
    </div>
  )
}

function PurchasesView({ purchases, suppliers, period, sym, onChange }: { purchases: Purchase[]; suppliers: Supplier[]; period: string; sym: string; onChange: () => void }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ supplier: '', date: new Date().toISOString().slice(0, 10), type: 'daily', meals: '', unit: '', paid: false, notes: '', itemType: '' })
  const [paymentSource, setPaymentSource] = useState<PaymentSource>('bank')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  // نافذة تأكيد الدفع لشراء موجود
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payingSource, setPayingSource] = useState<PaymentSource>('bank')

  // نافذة تعديل السعر والبيانات
  const [editing, setEditing] = useState<Purchase | null>(null)
  const [editMeals, setEditMeals] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [editSource, setEditSource] = useState<PaymentSource>('bank')
  const [editErr, setEditErr] = useState('')

  // نافذة تأكيد الإلغاء
  const [cancelling, setCancelling] = useState<Purchase | null>(null)

  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }))
  const total = (Number(f.meals) || 0) * (Number(f.unit) || 0)

  async function save() {
    setErr('')
    if (!f.meals || Number(f.meals) <= 0) { setErr('عدد الوجبات مطلوب'); return }
    if (!f.unit || Number(f.unit) <= 0) { setErr('تكلفة الوحدة مطلوبة'); return }
    setBusy(true)
    const { error } = await supabase.rpc('save_meal_purchase', {
      p_id: null, p_supplier: f.supplier || null, p_date: f.date,
      p_type: f.type, p_meals: Number(f.meals), p_unit_cost: Number(f.unit),
      p_period: period, p_paid: f.paid, p_notes: f.notes || null,
      p_item_type: f.itemType || null, p_payment_source: paymentSource,
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setOpen(false)
    setF({ supplier: '', date: new Date().toISOString().slice(0, 10), type: 'daily', meals: '', unit: '', paid: false, notes: '', itemType: '' })
    setPaymentSource('bank')
    onChange()
  }

  async function confirmMarkPaid() {
    if (!payingId) return
    setBusyId(payingId)
    const { error } = await supabase.rpc('mark_meal_purchase_paid', { p_id: payingId, p_payment_source: payingSource })
    setBusyId(null)
    if (error) { alert(error.message); return }
    setPayingId(null)
    setPayingSource('bank')
    onChange()
  }

  function openEdit(p: Purchase) {
    setEditing(p)
    setEditMeals(String(p.meals_count))
    setEditUnit(String(p.unit_cost))
    setEditSource('bank')
    setEditErr('')
  }

  async function confirmEditPrice() {
    if (!editing) return
    setEditErr('')
    if (!editMeals || Number(editMeals) <= 0) { setEditErr('عدد الوجبات مطلوب'); return }
    if (!editUnit || Number(editUnit) <= 0) { setEditErr('تكلفة الوحدة مطلوبة'); return }
    setBusyId(editing.id)
    const { error } = await supabase.rpc('edit_meal_purchase_price', {
      p_id: editing.id, p_meals: Number(editMeals), p_unit_cost: Number(editUnit), p_payment_source: editSource,
    })
    setBusyId(null)
    if (error) { setEditErr(error.message); return }
    setEditing(null)
    onChange()
  }

  async function confirmCancel() {
    if (!cancelling) return
    setBusyId(cancelling.id)
    const { error } = await supabase.rpc('cancel_meal_purchase', { p_id: cancelling.id })
    setBusyId(null)
    if (error) { alert(error.message); return }
    setCancelling(null)
    onChange()
  }

  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #E3E8EE', fontSize: 14, fontFamily: 'inherit' }
  const cell: React.CSSProperties = { flex: '1 1 150px' }
  const editTotal = (Number(editMeals) || 0) * (Number(editUnit) || 0)

  return (
    <div>
      <button onClick={() => setOpen(true)} style={{ background: '#163B68', color: '#fff', border: 0, padding: '11px 20px', borderRadius: 11, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16 }}>
        ＋ تسجيل شراء
      </button>

      <div style={{ background: '#fff', borderRadius: 12, overflow: 'auto', border: '1px solid #EDF1F5' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead><tr style={{ background: '#F7FAFC', textAlign: 'right' }}>
            <th style={{ padding: 10 }}>التاريخ</th><th style={{ padding: 10 }}>المورّد</th>
            <th style={{ padding: 10 }}>النوع</th><th style={{ padding: 10 }}>المنتج</th>
            <th style={{ padding: 10 }}>الوجبات</th>
            <th style={{ padding: 10 }}>الوحدة</th><th style={{ padding: 10 }}>الإجمالي</th>
            <th style={{ padding: 10 }}>الحالة</th><th style={{ padding: 10 }}></th>
          </tr></thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #EEF2F1', opacity: p.status === 'cancelled' ? 0.55 : 1 }}>
                <td style={{ padding: 10, direction: 'ltr', textAlign: 'right' }}>{p.purchase_date}</td>
                <td style={{ padding: 10 }}>{p.supplier_name || '—'}</td>
                <td style={{ padding: 10 }}>{TYPES[p.purchase_type] || p.purchase_type}</td>
                <td style={{ padding: 10 }}>{p.item_type || '—'}</td>
                <td style={{ padding: 10, textDecoration: p.status === 'cancelled' ? 'line-through' : 'none' }}>{fmt0(p.meals_count)}</td>
                <td style={{ padding: 10 }}>{fmt3(p.unit_cost)}</td>
                <td style={{ padding: 10, fontWeight: 700, textDecoration: p.status === 'cancelled' ? 'line-through' : 'none' }}>{fmt3(p.total_cost)} {sym}</td>
                <td style={{ padding: 10 }}>
                  {p.status === 'cancelled' ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#C0392B' }}>ملغى</span>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 700, color: p.paid ? '#067647' : '#B54708' }}>{p.paid ? 'مدفوع' : 'غير مدفوع'}</span>
                  )}
                </td>
                <td style={{ padding: 10 }}>
                  <ActionMenu
                    purchase={p}
                    onPay={() => { setPayingId(p.id); setPayingSource('bank') }}
                    onEditPrice={() => openEdit(p)}
                    onCancel={() => setCancelling(p)}
                  />
                </td>
              </tr>
            ))}
            {purchases.length === 0 && <tr><td colSpan={9} style={{ padding: 18, textAlign: 'center', color: '#999' }}>لا مشتريات</td></tr>}
          </tbody>
        </table>
      </div>

      {/* نافذة تأكيد الدفع */}
      {payingId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,37,64,.45)', display: 'grid', placeItems: 'center', zIndex: 999, padding: 16 }} onClick={() => setPayingId(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 22, width: '100%', maxWidth: 360 }}>
            <h4 style={{ margin: '0 0 14px', color: '#0F2744' }}>تأكيد السداد</h4>
            <PaymentSourcePicker value={payingSource} onChange={setPayingSource} />
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={confirmMarkPaid} disabled={busyId === payingId}
                style={{ flex: 1, background: '#163B68', color: '#fff', border: 0, padding: 11, borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {busyId === payingId ? 'جارٍ...' : 'تأكيد السداد'}
              </button>
              <button onClick={() => setPayingId(null)}
                style={{ background: '#F2F5F8', color: '#0F2744', border: 0, padding: '11px 16px', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تعديل السعر والبيانات */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,37,64,.45)', display: 'grid', placeItems: 'center', zIndex: 999, padding: 16 }} onClick={() => setEditing(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 22, width: '100%', maxWidth: 400 }}>
            <h4 style={{ margin: '0 0 4px', color: '#0F2744' }}>تعديل سعر الشراء</h4>
            <p style={{ color: '#8A94A6', fontSize: 12.5, margin: '0 0 16px' }}>{editing.supplier_name || '—'} — {editing.purchase_date}</p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#0F2744', display: 'block', marginBottom: 6 }}>عدد الوجبات</label>
                <input type="number" style={input} value={editMeals} onChange={(e) => setEditMeals(e.target.value)} dir="ltr" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#0F2744', display: 'block', marginBottom: 6 }}>تكلفة الوحدة ({sym})</label>
                <input type="number" step="0.001" style={input} value={editUnit} onChange={(e) => setEditUnit(e.target.value)} dir="ltr" />
              </div>
            </div>

            <div style={{ background: '#F7FAFC', border: '1px solid #EEF1F5', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
              <span>الإجمالي الجديد</span><b>{fmt3(editTotal)} {sym}</b>
            </div>

            <div style={{ marginBottom: 14 }}>
              <PaymentSourcePicker value={editSource} onChange={setEditSource} />
            </div>

            <div style={{ background: '#FDF8ED', border: '1px solid #F0E0C0', borderRadius: 9, padding: '9px 12px', fontSize: 11.5, color: '#8A6D0F', marginBottom: 14 }}>
              💡 سيُسجَّل قيد عكسي يُلغي القيد السابق، وقيد جديد بالسعر الصحيح — للحفاظ على سجل تدقيق كامل.
            </div>

            {editErr && <div style={{ color: '#C0392B', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>⚠ {editErr}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={confirmEditPrice} disabled={busyId === editing.id}
                style={{ flex: 1, background: '#163B68', color: '#fff', border: 0, padding: 11, borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {busyId === editing.id ? 'جارٍ الحفظ…' : 'حفظ التعديل'}
              </button>
              <button onClick={() => setEditing(null)}
                style={{ background: '#F2F5F8', color: '#0F2744', border: 0, padding: '11px 16px', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تأكيد إلغاء الشراء */}
      {cancelling && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,37,64,.45)', display: 'grid', placeItems: 'center', zIndex: 999, padding: 16 }} onClick={() => setCancelling(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 22, width: '100%', maxWidth: 380 }}>
            <h4 style={{ margin: '0 0 10px', color: '#C0392B' }}>⚠ تأكيد إلغاء الشراء</h4>
            <p style={{ color: '#556', fontSize: 13.5, lineHeight: 1.8, marginBottom: 16 }}>
              سيبقى هذا السجل ظاهراً بعلامة «ملغى» للشفافية، وسيُصفَّر أثره المالي والكمّي بقيد عكسي.
              هذا الإجراء لا يمكن التراجع عنه من هنا.
            </p>
            <div style={{ background: '#F7FAFC', border: '1px solid #EEF1F5', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
              <div>{cancelling.supplier_name || '—'} — {cancelling.purchase_date}</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>{fmt3(cancelling.total_cost)} {sym} · {fmt0(cancelling.meals_count)} وجبة</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={confirmCancel} disabled={busyId === cancelling.id}
                style={{ flex: 1, background: '#C0392B', color: '#fff', border: 0, padding: 11, borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {busyId === cancelling.id ? 'جارٍ الإلغاء…' : 'تأكيد الإلغاء'}
              </button>
              <button onClick={() => setCancelling(null)}
                style={{ background: '#F2F5F8', color: '#0F2744', border: 0, padding: '11px 16px', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,37,64,.45)', display: 'grid', placeItems: 'center', zIndex: 999, padding: 16 }} onClick={() => !busy && setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 26, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#0F2744' }}>تسجيل شراء وجبات</h3>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 0, fontSize: 22, cursor: 'pointer', color: '#667' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <div style={cell}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#0F2744' }}>المورّد</label>
                <select style={input} value={f.supplier} onChange={(e) => set('supplier', e.target.value)}>
                  <option value="">— بدون —</option>
                  {suppliers.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div style={cell}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#0F2744' }}>التاريخ</label>
                <input type="date" style={input} value={f.date} onChange={(e) => set('date', e.target.value)} dir="ltr" />
              </div>
              <div style={cell}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#0F2744' }}>النوع</label>
                <select style={input} value={f.type} onChange={(e) => set('type', e.target.value)}>
                  {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={cell}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#0F2744' }}>نوع المنتج</label>
                <input style={input} value={f.itemType} onChange={(e) => set('itemType', e.target.value)} placeholder="مثال: أرز، دجاج، خضار" list="item-type-suggestions" />
                <datalist id="item-type-suggestions">
                  {ITEM_TYPE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}
                </datalist>
              </div>
              <div style={cell}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#0F2744' }}>عدد الوجبات</label>
                <input type="number" style={input} value={f.meals} onChange={(e) => set('meals', e.target.value)} dir="ltr" />
              </div>
              <div style={cell}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#0F2744' }}>تكلفة الوحدة ({sym})</label>
                <input type="number" step="0.001" style={input} value={f.unit} onChange={(e) => set('unit', e.target.value)} dir="ltr" />
              </div>
              <div style={cell}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#0F2744' }}>الإجمالي (تلقائي)</label>
                <input style={{ ...input, background: '#F7FAFC', fontWeight: 700 }} value={`${fmt3(total)} ${sym}`} readOnly dir="ltr" />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#0F2744', cursor: 'pointer' }}>
                <input type="checkbox" checked={f.paid} onChange={(e) => set('paid', e.target.checked)} style={{ width: 17, height: 17 }} />
                مدفوع الآن
              </label>
              {f.paid && (
                <div style={{ flex: '1 1 100%' }}>
                  <PaymentSourcePicker value={paymentSource} onChange={setPaymentSource} />
                </div>
              )}
              <div style={{ flex: '1 1 100%' }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#0F2744' }}>ملاحظات</label>
                <input style={input} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
              </div>
            </div>
            {err && <div style={{ color: '#C0392B', marginTop: 12, fontWeight: 600, fontSize: 13 }}>⚠ {err}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={save} disabled={busy} style={{ flex: 1, background: busy ? '#8AA' : '#163B68', color: '#fff', border: 0, padding: 12, borderRadius: 11, fontWeight: 800, fontSize: 15, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {busy ? 'جارٍ الحفظ…' : 'حفظ'}
              </button>
              <button onClick={() => setOpen(false)} style={{ background: '#F2F5F8', color: '#0F2744', border: 0, padding: '12px 20px', borderRadius: 11, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SuppliersView({ suppliers, onChange }: { suppliers: Supplier[]; onChange: () => void }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ id: '', name: '', contact: '', phone: '', email: '', vat: '', active: true })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }))

  function edit(s: Supplier) {
    setF({ id: s.id, name: s.name, contact: s.contact_name ?? '', phone: s.phone ?? '', email: s.email ?? '', vat: s.vat_number ?? '', active: s.active })
    setOpen(true)
  }
  function add() {
    setF({ id: '', name: '', contact: '', phone: '', email: '', vat: '', active: true })
    setOpen(true)
  }
  async function save() {
    setErr('')
    if (!f.name.trim()) { setErr('الاسم مطلوب'); return }
    setBusy(true)
    const { error } = await supabase.rpc('save_supplier', {
      p_id: f.id || null, p_name: f.name, p_contact: f.contact || null,
      p_phone: f.phone || null, p_email: f.email || null, p_vat: f.vat || null, p_active: f.active,
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setOpen(false)
    onChange()
  }

  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #E3E8EE', fontSize: 14, fontFamily: 'inherit' }
  const cell: React.CSSProperties = { flex: '1 1 190px' }

  return (
    <div>
      <button onClick={add} style={{ background: '#163B68', color: '#fff', border: 0, padding: '11px 20px', borderRadius: 11, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16 }}>
        ＋ إضافة مورّد
      </button>
      <div style={{ background: '#fff', borderRadius: 12, overflow: 'auto', border: '1px solid #EDF1F5' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead><tr style={{ background: '#F7FAFC', textAlign: 'right' }}>
            <th style={{ padding: 11 }}>المورّد</th><th style={{ padding: 11 }}>جهة الاتصال</th>
            <th style={{ padding: 11 }}>الهاتف</th><th style={{ padding: 11 }}>الحالة</th><th style={{ padding: 11 }}></th>
          </tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid #F2F5F8' }}>
                <td style={{ padding: 11, fontWeight: 600 }}>{s.name}</td>
                <td style={{ padding: 11 }}>{s.contact_name || '—'}</td>
                <td style={{ padding: 11, direction: 'ltr', textAlign: 'right' }}>{s.phone || '—'}</td>
                <td style={{ padding: 11 }}><span style={{ fontSize: 12, fontWeight: 700, color: s.active ? '#067647' : '#8A94A6' }}>{s.active ? 'نشط' : 'موقوف'}</span></td>
                <td style={{ padding: 11 }}><button onClick={() => edit(s)} style={{ background: '#EEF2F9', color: '#163B68', border: 0, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>✏️</button></td>
              </tr>
            ))}
            {suppliers.length === 0 && <tr><td colSpan={5} style={{ padding: 18, textAlign: 'center', color: '#999' }}>لا موردين</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,37,64,.45)', display: 'grid', placeItems: 'center', zIndex: 999, padding: 16 }} onClick={() => !busy && setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 26, width: '100%', maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#0F2744' }}>{f.id ? 'تعديل مورّد' : 'إضافة مورّد'}</h3>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 0, fontSize: 22, cursor: 'pointer', color: '#667' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: '1 1 100%' }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#0F2744' }}>اسم المورّد *</label>
                <input style={input} value={f.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div style={cell}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#0F2744' }}>جهة الاتصال</label>
                <input style={input} value={f.contact} onChange={(e) => set('contact', e.target.value)} />
              </div>
              <div style={cell}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#0F2744' }}>الهاتف</label>
                <input style={input} value={f.phone} onChange={(e) => set('phone', e.target.value)} dir="ltr" />
              </div>
              <div style={cell}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#0F2744' }}>البريد</label>
                <input style={input} value={f.email} onChange={(e) => set('email', e.target.value)} dir="ltr" />
              </div>
              <div style={cell}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#0F2744' }}>الرقم الضريبي</label>
                <input style={input} value={f.vat} onChange={(e) => set('vat', e.target.value)} dir="ltr" />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#0F2744', cursor: 'pointer' }}>
                <input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} style={{ width: 17, height: 17 }} />
                نشط
              </label>
            </div>
            {err && <div style={{ color: '#C0392B', marginTop: 12, fontWeight: 600, fontSize: 13 }}>⚠ {err}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={save} disabled={busy} style={{ flex: 1, background: busy ? '#8AA' : '#163B68', color: '#fff', border: 0, padding: 12, borderRadius: 11, fontWeight: 800, fontSize: 15, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {busy ? 'جارٍ الحفظ…' : 'حفظ'}
              </button>
              <button onClick={() => setOpen(false)} style={{ background: '#F2F5F8', color: '#0F2744', border: 0, padding: '12px 20px', borderRadius: 11, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
