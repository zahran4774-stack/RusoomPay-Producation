'use client'
// مكوّن المخزون — أصناف مصنَّفة (فئة + نوع فرعي) + شراء + بيع لطالب + صرف استهلاكي داخلي (غير مفوتر) + فلترة وتقرير + طباعة
// عند الشراء: يسأل صراحة عن مصدر الدفع (صندوق أم بنك) بدل افتراض البنك دائماً.
// تكلفة الوحدة تلقائية: الإجمالي ÷ الكمية — عند إضافة صنف، وعند الشراء (مع متوسط مرجّح للتكلفة الجديدة).
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { printReport, type SchoolHeader } from '@/lib/print-report'

type Item = {
  id: string; name: string; qty: number; cost: number; price: number; vat_rate: number
  stock_value: number; category: string; subtype: string | null
}
type Student = { id: string; full_name: string; guardian_name: string | null }
type CategoryReportRow = { category: string; items_count: number; total_qty: number; total_value: number }
type PaymentSource = 'cash' | 'bank'

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #E6EBF1', borderRadius: 14,
  padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.05)', marginBottom: 16,
}
const input: React.CSSProperties = {
  width: '100%', padding: 11, borderRadius: 10, border: '1.5px solid #DDE3EC',
  fontFamily: 'inherit', fontSize: 14, background: '#fff',
}
// حقل محسوب تلقائياً (للقراءة فقط)
const autoInput: React.CSSProperties = {
  ...input, background: '#F0F7F5', border: '1.5px solid #CDE8E1', color: '#0D7D6B', fontWeight: 700,
}
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }
const btnGold: React.CSSProperties = {
  padding: '11px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: '#D4A017', color: '#08172B', fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
}
const btnTeal: React.CSSProperties = {
  padding: '11px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: '#0D7D6B', color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
}
const btnSm: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 8, border: '1px solid #DDE3EC', cursor: 'pointer',
  background: '#fff', color: '#445', fontWeight: 600, fontSize: 12.5, fontFamily: 'inherit',
}
const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

// تكلفة الوحدة: 3 خانات إن كانت دقيقة، وإلا 4 (مثال: 10 ÷ 3 = 3.3333) — التخزين الفعلي بـ 6 خانات
const unitText = (n: number) => {
  const v = n ?? 0
  const exact3 = Math.abs(Math.round(v * 1000) / 1000 - v) < 1e-7
  const d = exact3 ? 3 : 4
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

const DISPENSE_REASONS = ['قرطاسية صفوف', 'مواد نظافة', 'صيانة وأدوات', 'استخدام إداري', 'أخرى']

export default function InventoryClient({ initialItems, students, school }: {
  initialItems: Item[]; students: Student[]; school: SchoolHeader
}) {
  const supabase = createClient()
  const [items, setItems] = useState<Item[]>(initialItems)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [total, setTotal] = useState('')   // إجمالي المبلغ — اختياري: إن أُدخل تُحسب تكلفة الوحدة تلقائياً
  const [cost, setCost] = useState('')     // تكلفة الوحدة اليدوية — تُستخدم فقط عند ترك الإجمالي فارغاً
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('كتب')
  const [subtype, setSubtype] = useState('')
  const [customCategory, setCustomCategory] = useState('')

  const [categories, setCategories] = useState<string[]>(['كتب', 'زي مدرسي', 'قرطاسية', 'أخرى'])
  const [filterCategory, setFilterCategory] = useState<string>('all')

  const [categoryReport, setCategoryReport] = useState<CategoryReportRow[]>([])
  const [showReport, setShowReport] = useState(false)

  const [moveItem, setMoveItem] = useState<Item | null>(null)
  const [moveMode, setMoveMode] = useState<'buy' | 'sell' | 'dispense'>('buy')
  const [moveQty, setMoveQty] = useState('1')
  const [moveTotal, setMoveTotal] = useState('') // إجمالي المبلغ المدفوع عند الشراء (اختياري)
  const [moveStudent, setMoveStudent] = useState('')
  const [applyTax, setApplyTax] = useState(true)
  const [dispenseReason, setDispenseReason] = useState(DISPENSE_REASONS[0])
  const [customReason, setCustomReason] = useState('')
  // مصدر الدفع عند الشراء — يظهر فقط لـ moveMode === 'buy'
  const [paymentSource, setPaymentSource] = useState<PaymentSource>('bank')

  // تكلفة الوحدة التلقائية في نموذج الإضافة
  const addQty = parseInt(qty) || 0
  const addTotal = parseFloat(total) || 0
  const autoUnit = addTotal > 0 && addQty > 0 ? addTotal / addQty : null

  async function refresh(cat?: string) {
    const activeFilter = cat !== undefined ? cat : filterCategory
    const { data } = await supabase.rpc('inventory_list', {
      p_category: activeFilter === 'all' ? null : activeFilter,
    })
    setItems(data || [])
  }

  async function loadCategories() {
    const { data } = await supabase.rpc('inventory_categories')
    if (data) setCategories(data.map((r: { category: string }) => r.category))
  }

  async function loadReport() {
    const { data } = await supabase.rpc('inventory_category_report')
    setCategoryReport(data || [])
  }

  useEffect(() => { loadCategories() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function addItem() {
    if (!name.trim()) { setMsg('اسم الصنف مطلوب'); return }
    const finalCategory = category === '__new__' ? customCategory.trim() : category
    if (!finalCategory) { setMsg('اختر أو اكتب فئة للصنف'); return }
    if (total.trim() !== '' && addTotal <= 0) { setMsg('المبلغ الإجمالي غير صحيح'); return }
    if (addTotal > 0 && addQty <= 0) { setMsg('أدخل الكمية لحساب تكلفة الوحدة من المبلغ الإجمالي'); return }
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('save_inventory_item', {
      p_name: name.trim(), p_qty: addQty,
      p_cost: autoUnit ?? (parseFloat(cost) || 0),
      p_price: parseFloat(price) || 0, p_vat: 5,
      p_category: finalCategory, p_subtype: subtype.trim() || null,
      p_total: addTotal > 0 ? addTotal : null,
    })
    if (error) { setMsg('خطأ: ' + error.message); setBusy(false); return }
    setName(''); setQty(''); setTotal(''); setCost(''); setPrice(''); setSubtype(''); setCustomCategory('')
    await refresh(); await loadCategories()
    setMsg('✓ تمت إضافة الصنف'); setBusy(false)
  }

  function openMove(item: Item, mode: 'buy' | 'sell' | 'dispense') {
    setMoveItem(item); setMoveMode(mode); setMoveQty('1'); setMoveTotal(''); setMoveStudent(''); setApplyTax(true)
    setDispenseReason(DISPENSE_REASONS[0]); setCustomReason(''); setPaymentSource('bank'); setMsg('')
  }

  async function execMove() {
    if (!moveItem) return
    const q = parseInt(moveQty) || 0
    if (q <= 0) { setMsg('أدخل كمية صحيحة'); return }
    setBusy(true); setMsg('')

    if (moveMode === 'buy') {
      const t = parseFloat(moveTotal) || 0
      if (moveTotal.trim() !== '' && t <= 0) { setMsg('المبلغ الإجمالي غير صحيح'); setBusy(false); return }
      const { error } = await supabase.rpc('inventory_purchase', {
        p_item: moveItem.id, p_qty: q, p_payment_source: paymentSource,
        p_total: t > 0 ? t : null,
      })
      if (error) { setMsg('خطأ: ' + error.message); setBusy(false); return }
      setMsg(`✓ تم الشراء — مخزون مدين / ${paymentSource === 'cash' ? 'الصندوق' : 'البنك'} دائن${t > 0 ? ` · تكلفة الوحدة ${unitText(t / q)}` : ''}`)
    } else if (moveMode === 'sell') {
      if (!moveStudent) { setMsg('اختر الطالب'); setBusy(false); return }
      const { error } = await supabase.rpc('inventory_sell', { p_item: moveItem.id, p_qty: q, p_student: moveStudent, p_apply_tax: applyTax })
      if (error) { setMsg('خطأ: ' + error.message); setBusy(false); return }
      setMsg('✓ صدرت فاتورة للطالب + قيد تكلفة وانخفض المخزون')
    } else {
      const reason = dispenseReason === 'أخرى' ? customReason.trim() : dispenseReason
      const { error } = await supabase.rpc('inventory_dispense', { p_item: moveItem.id, p_qty: q, p_reason: reason || null })
      if (error) { setMsg('خطأ: ' + error.message); setBusy(false); return }
      setMsg('✓ سُجّل الصرف الاستهلاكي — بلا فاتورة على أولياء الأمور')
    }
    setMoveItem(null); await refresh(); setBusy(false)
  }

  return (
    <>
      {msg && <div style={{ ...card, padding: 12, marginBottom: 12, color: msg.startsWith('✓') ? '#1A7A45' : '#C0392B' }}>{msg}</div>}

      {/* ملخّص المخزون حسب الفئة */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showReport ? 14 : 0 }}>
          <h3 style={{ margin: 0, color: '#0F2744', fontSize: 16 }}>ملخّص المخزون حسب الفئة</h3>
          <button style={btnSm} onClick={async () => { if (!showReport) await loadReport(); setShowReport(!showReport) }}>
            {showReport ? 'إخفاء' : 'عرض التقرير'}
          </button>
        </div>
        {showReport && (
          categoryReport.length > 0 ? (
            <div style={{ overflowX: 'auto', marginTop: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                <thead>
                  <tr style={{ background: '#F7F9FC', textAlign: 'right' }}>
                    {['الفئة', 'عدد الأصناف', 'إجمالي الكمية', 'قيمة المخزون'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categoryReport.map((r) => (
                    <tr key={r.category} style={{ borderTop: '1px solid #F2F5F8' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0F2744' }}>{r.category}</td>
                      <td style={{ padding: '10px 12px' }}>{r.items_count}</td>
                      <td style={{ padding: '10px 12px' }}>{r.total_qty}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{fmt(r.total_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p style={{ color: '#8A94A6', textAlign: 'center', padding: 16 }}>لا توجد بيانات بعد</p>
        )}
      </div>

      {/* جدول المخزون */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0, color: '#0F2744', fontSize: 16 }}>الأصناف</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              style={{ ...input, width: 'auto', padding: '7px 12px', fontSize: 13 }}
              value={filterCategory}
              onChange={async (e) => { setFilterCategory(e.target.value); await refresh(e.target.value) }}>
              <option value="all">كل الفئات</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {items.length > 0 && (
              <button onClick={() => printReport({
                school, title: filterCategory === 'all' ? 'تقرير المخزون والكميات' : `تقرير المخزون — ${filterCategory}`,
                columns: [
                  { key: 'name', label: 'الصنف' }, { key: 'category', label: 'الفئة' }, { key: 'qty', label: 'الكمية' },
                  { key: 'cost', label: 'التكلفة' }, { key: 'price', label: 'سعر البيع' },
                  { key: 'value', label: 'قيمة المخزون' },
                ],
                rows: items.map((it) => ({
                  name: it.name, category: it.category + (it.subtype ? ` / ${it.subtype}` : ''),
                  qty: it.qty, cost: unitText(it.cost), price: fmt(it.price), value: fmt(it.stock_value),
                })),
              })} style={btnSm}>🖨 طباعة</button>
            )}
          </div>
        </div>
        {items.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
              <thead>
                <tr style={{ background: '#F7F9FC', textAlign: 'right' }}>
                  {['الصنف', 'الفئة', 'الكمية', 'التكلفة', 'سعر البيع', 'قيمة المخزون', ''].map((h) => (
                    <th key={h} style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} style={{ borderTop: '1px solid #F2F5F8' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0F2744' }}>{it.name}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 12, background: '#EEF3F9', color: '#1B4F8A', padding: '2px 9px', borderRadius: 20, fontWeight: 600 }}>
                        {it.category}{it.subtype ? ` / ${it.subtype}` : ''}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {it.qty} {it.qty < 10 && <span style={{ background: '#FCE9E6', color: '#C0392B', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>منخفض</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{unitText(it.cost)}</td>
                    <td style={{ padding: '10px 12px' }}>{fmt(it.price)}</td>
                    <td style={{ padding: '10px 12px' }}>{fmt(it.stock_value)}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <button style={btnSm} onClick={() => openMove(it, 'buy')}>＋ شراء</button>{' '}
                      <button style={{ ...btnSm, background: '#D4A017', color: '#08172B', border: 'none' }} onClick={() => openMove(it, 'sell')}>بيع لطالب</button>{' '}
                      <button style={{ ...btnSm, background: '#0D7D6B', color: '#fff', border: 'none' }} onClick={() => openMove(it, 'dispense')}>صرف استهلاكي</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p style={{ color: '#8A94A6', textAlign: 'center', padding: 20 }}>لا توجد أصناف بهذي الفئة</p>}
      </div>

      {/* إضافة صنف */}
      <div style={card}>
        <h3 style={{ margin: '0 0 14px', color: '#0F2744', fontSize: 16 }}>إضافة صنف جديد</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={lbl}>الفئة</label>
            <select style={input} value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="__new__">＋ فئة جديدة...</option>
            </select>
          </div>
          {category === '__new__' ? (
            <div><label style={lbl}>اسم الفئة الجديدة</label>
              <input style={input} value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="مثال: أدوات صيانة" />
            </div>
          ) : (
            <div><label style={lbl}>النوع الفرعي (اختياري)</label>
              <input style={input} value={subtype} onChange={(e) => setSubtype(e.target.value)} placeholder="مثال: قميص، بنطلون، حذاء" />
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>اسم الصنف</label>
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="كتاب الرياضيات" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 8 }}>
          <div>
            <label style={lbl}>الكمية</label>
            <input style={input} type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label style={lbl}>إجمالي المبلغ (اختياري)</label>
            <input style={input} type="number" step="0.001" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0.000" />
          </div>
          <div>
            {autoUnit !== null ? (
              <>
                <label style={{ ...lbl, color: '#0D7D6B' }}>تكلفة الوحدة (تلقائي)</label>
                <input style={autoInput} value={unitText(autoUnit)} readOnly tabIndex={-1} />
              </>
            ) : (
              <>
                <label style={lbl}>تكلفة الوحدة</label>
                <input style={input} type="number" step="0.001" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.000" />
              </>
            )}
          </div>
          <div>
            <label style={lbl}>سعر البيع</label>
            <input style={input} type="number" step="0.001" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.000" />
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#8A94A6', margin: '0 0 14px', lineHeight: 1.7 }}>
          {autoUnit !== null
            ? 'تكلفة الوحدة = إجمالي المبلغ ÷ الكمية — تُحسب تلقائياً. امسح الإجمالي لإدخال التكلفة يدوياً.'
            : 'أدخل الكمية وإجمالي المبلغ لتُحسب تكلفة الوحدة تلقائياً، أو اترك الإجمالي فارغاً وأدخل التكلفة يدوياً.'}
        </p>
        <button style={btnGold} onClick={addItem} disabled={busy}>＋ إضافة</button>
      </div>

      {/* نافذة الحركة */}
      {moveItem && (
        <div onClick={() => setMoveItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(8,15,27,.55)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 420, width: '100%', maxHeight: '92vh', overflowY: 'auto' }} dir="rtl">
            <h3 style={{ margin: '0 0 6px', color: '#0F2744' }}>
              {moveMode === 'buy' ? 'شراء مخزون' : moveMode === 'sell' ? 'بيع لطالب' : 'صرف استهلاكي داخلي'}
            </h3>
            <p style={{ fontSize: 13, color: '#667', margin: '0 0 16px' }}>
              <b>{moveItem.name}</b> — الرصيد الحالي: <b>{moveItem.qty}</b> ·{' '}
              {moveMode === 'buy'
                ? `تكلفة الوحدة الحالية ${unitText(moveItem.cost)}`
                : moveMode === 'sell'
                  ? `سعر البيع ${fmt(moveItem.price)}${applyTax ? ` + ضريبة ${moveItem.vat_rate ?? 5}%` : ' (بدون ضريبة)'}`
                  : `تكلفة الوحدة ${unitText(moveItem.cost)} — بلا فاتورة على أولياء الأمور`}
            </p>

            {moveMode === 'dispense' && (
              <div style={{ background: '#EAF5F2', border: '1px solid #CDE8E1', borderRadius: 10, padding: '10px 13px', marginBottom: 14, fontSize: 12.5, color: '#0D7D6B' }}>
                هذا صرف داخلي فقط — لا يُنشئ فاتورة ولا يُحمَّل على أي طالب، لأنه محسوب أصلاً ضمن تكاليف الدراسة العامة.
              </div>
            )}

            <label style={lbl}>الكمية</label>
            <input style={{ ...input, marginBottom: 14 }} type="number" value={moveQty} onChange={(e) => setMoveQty(e.target.value)} />

            {moveMode === 'buy' && (() => {
              const q = parseInt(moveQty) || 0
              const t = parseFloat(moveTotal) || 0
              const purchaseUnit = t > 0 && q > 0 ? t / q : null
              const oldQty = Math.max(moveItem.qty, 0)
              const newAvg = purchaseUnit !== null ? (oldQty * moveItem.cost + t) / (oldQty + q) : null
              return (
                <>
                  <label style={lbl}>إجمالي المبلغ المدفوع (اختياري)</label>
                  <input style={{ ...input, marginBottom: 12 }} type="number" step="0.001" value={moveTotal}
                    onChange={(e) => setMoveTotal(e.target.value)} placeholder="0.000" />

                  <label style={{ ...lbl, color: purchaseUnit !== null ? '#0D7D6B' : '#445' }}>تكلفة الوحدة (تلقائي)</label>
                  <input style={{ ...autoInput, marginBottom: 14, ...(purchaseUnit === null ? { background: '#F5F7FA', border: '1.5px solid #DDE3EC', color: '#8A94A6' } : null) }}
                    value={purchaseUnit !== null ? unitText(purchaseUnit) : '—'} readOnly tabIndex={-1} />

                  <label style={lbl}>مصدر الدفع</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <button type="button" onClick={() => setPaymentSource('cash')}
                      style={{
                        flex: 1, padding: '10px 12px', borderRadius: 10, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                        border: paymentSource === 'cash' ? '2px solid #163B68' : '1px solid #E3E8EE',
                        background: paymentSource === 'cash' ? '#EAF0FA' : '#fff',
                        color: paymentSource === 'cash' ? '#163B68' : '#667',
                      }}>
                      💵 من الصندوق
                    </button>
                    <button type="button" onClick={() => setPaymentSource('bank')}
                      style={{
                        flex: 1, padding: '10px 12px', borderRadius: 10, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                        border: paymentSource === 'bank' ? '2px solid #163B68' : '1px solid #E3E8EE',
                        background: paymentSource === 'bank' ? '#EAF0FA' : '#fff',
                        color: paymentSource === 'bank' ? '#163B68' : '#667',
                      }}>
                      🏦 من البنك
                    </button>
                  </div>

                  <div style={{ background: '#F7FAFC', border: '1px solid #EEF1F5', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
                    <div style={{ display: 'grid', gap: 5, color: '#475569' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0F2744' }}>
                        <span>إجمالي الشراء</span>
                        <b>{fmt(purchaseUnit !== null ? t : q * moveItem.cost)}</b>
                      </div>
                      {newAvg !== null ? (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>متوسط تكلفة الوحدة بعد الشراء</span>
                            <b style={{ color: '#0D7D6B' }}>{unitText(newAvg)}</b>
                          </div>
                          <div style={{ fontSize: 11.5, color: '#8A94A6', lineHeight: 1.7 }}>
                            متوسط مرجّح: (قيمة الرصيد الحالي + المبلغ) ÷ (الكمية الحالية + المشتراة)، ويحلّ محلّ التكلفة الحالية ({unitText(moveItem.cost)}).
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 11.5, color: '#8A94A6', lineHeight: 1.7 }}>
                          بلا إجمالي مدفوع: يُقيَّد الشراء بتكلفة الصنف الحالية. أدخل الإجمالي لحساب تكلفة الوحدة تلقائياً وتحديث متوسط التكلفة.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )
            })()}

            {moveMode === 'sell' && (
              <>
                <label style={lbl}>الطالب</label>
                <select style={{ ...input, marginBottom: 14 }} value={moveStudent} onChange={(e) => setMoveStudent(e.target.value)}>
                  <option value="">اختر الطالب</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} — {s.guardian_name}</option>)}
                </select>

                <label style={lbl}>الضريبة</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <button type="button" onClick={() => setApplyTax(true)}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 10, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                      border: applyTax ? '2px solid #D4A017' : '1px solid #E3E8EE',
                      background: applyTax ? '#FBF3D5' : '#fff',
                      color: applyTax ? '#7A5C0A' : '#667',
                    }}>
                    مع ضريبة {moveItem.vat_rate ?? 5}%
                  </button>
                  <button type="button" onClick={() => setApplyTax(false)}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 10, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                      border: !applyTax ? '2px solid #163B68' : '1px solid #E3E8EE',
                      background: !applyTax ? '#EAF0FA' : '#fff',
                      color: !applyTax ? '#163B68' : '#667',
                    }}>
                    بدون ضريبة
                  </button>
                </div>

                <div style={{ background: '#F7FAFC', border: '1px solid #EEF1F5', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
                  {(() => {
                    const q = parseInt(moveQty) || 0
                    const sub = moveItem.price * q
                    const vat = applyTax ? sub * ((moveItem.vat_rate ?? 5) / 100) : 0
                    return (
                      <div style={{ display: 'grid', gap: 4, color: '#475569' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>المجموع الفرعي</span><b>{fmt(sub)}</b></div>
                        {applyTax && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>الضريبة ({moveItem.vat_rate ?? 5}%)</span><b>{fmt(vat)}</b></div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0F2744', fontSize: 14, borderTop: '1px solid #E3E8EE', paddingTop: 4, marginTop: 2 }}><span>الإجمالي</span><b>{fmt(sub + vat)}</b></div>
                      </div>
                    )
                  })()}
                </div>
              </>
            )}

            {moveMode === 'dispense' && (
              <>
                <label style={lbl}>سبب الصرف</label>
                <select style={{ ...input, marginBottom: dispenseReason === 'أخرى' ? 10 : 14 }} value={dispenseReason} onChange={(e) => setDispenseReason(e.target.value)}>
                  {DISPENSE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                {dispenseReason === 'أخرى' && (
                  <input style={{ ...input, marginBottom: 14 }} value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="اكتب السبب..." />
                )}
                <div style={{ background: '#F7FAFC', border: '1px solid #EEF1F5', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0F2744' }}>
                    <span>تكلفة الصرف (مصروف إداري)</span>
                    <b>{fmt((parseInt(moveQty) || 0) * moveItem.cost)}</b>
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnSm} onClick={() => setMoveItem(null)}>إلغاء</button>
              <button style={moveMode === 'dispense' ? btnTeal : btnGold} onClick={execMove} disabled={busy}>
                {moveMode === 'buy' ? 'تأكيد الشراء والترحيل' : moveMode === 'sell' ? 'إصدار فاتورة + قيد التكلفة' : 'تأكيد الصرف الاستهلاكي'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
