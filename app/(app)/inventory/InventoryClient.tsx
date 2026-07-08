'use client'
// مكوّن المخزون — أصناف + شراء + بيع لطالب + طباعة
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { printReport, type SchoolHeader } from '@/lib/print-report'

type Item = { id: string; name: string; qty: number; cost: number; price: number; vat_rate: number; stock_value: number }
type Student = { id: string; full_name: string; guardian_name: string | null }

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
const btnSm: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 8, border: '1px solid #DDE3EC', cursor: 'pointer',
  background: '#fff', color: '#445', fontWeight: 600, fontSize: 12.5, fontFamily: 'inherit',
}
const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

export default function InventoryClient({ initialItems, students, school }: {
  initialItems: Item[]; students: Student[]; school: SchoolHeader
}) {
  const supabase = createClient()
  const [items, setItems] = useState<Item[]>(initialItems)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  // صنف جديد
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [cost, setCost] = useState('')
  const [price, setPrice] = useState('')

  // حركة (شراء/بيع)
  const [moveItem, setMoveItem] = useState<Item | null>(null)
  const [moveMode, setMoveMode] = useState<'buy' | 'sell'>('buy')
  const [moveQty, setMoveQty] = useState('1')
  const [moveStudent, setMoveStudent] = useState('')

  async function refresh() {
    const { data } = await supabase.rpc('inventory_list')
    setItems(data || [])
  }

  async function addItem() {
    if (!name.trim()) { setMsg('اسم الصنف مطلوب'); return }
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('save_inventory_item', {
      p_name: name.trim(), p_qty: parseInt(qty) || 0,
      p_cost: parseFloat(cost) || 0, p_price: parseFloat(price) || 0, p_vat: 5,
    })
    if (error) { setMsg('خطأ: ' + error.message); setBusy(false); return }
    setName(''); setQty(''); setCost(''); setPrice(''); await refresh()
    setMsg('✓ تمت إضافة الصنف'); setBusy(false)
  }

  function openMove(item: Item, mode: 'buy' | 'sell') {
    setMoveItem(item); setMoveMode(mode); setMoveQty('1'); setMoveStudent(''); setMsg('')
  }

  async function execMove() {
    if (!moveItem) return
    const q = parseInt(moveQty) || 0
    if (q <= 0) { setMsg('أدخل كمية صحيحة'); return }
    setBusy(true); setMsg('')
    if (moveMode === 'buy') {
      const { error } = await supabase.rpc('inventory_purchase', { p_item: moveItem.id, p_qty: q })
      if (error) { setMsg('خطأ: ' + error.message); setBusy(false); return }
      setMsg('✓ تم الشراء — مخزون مدين / بنك دائن')
    } else {
      if (!moveStudent) { setMsg('اختر الطالب'); setBusy(false); return }
      const { error } = await supabase.rpc('inventory_sell', { p_item: moveItem.id, p_qty: q, p_student: moveStudent })
      if (error) { setMsg('خطأ: ' + error.message); setBusy(false); return }
      setMsg('✓ صدرت فاتورة للطالب + قيد تكلفة وانخفض المخزون')
    }
    setMoveItem(null); await refresh(); setBusy(false)
  }

  return (
    <>
      {msg && <div style={{ ...card, padding: 12, marginBottom: 12, color: msg.startsWith('✓') ? '#1A7A45' : '#C0392B' }}>{msg}</div>}

      {/* جدول المخزون */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, color: '#0F2744', fontSize: 16 }}>الأصناف</h3>
          {items.length > 0 && (
            <button onClick={() => printReport({
              school, title: 'تقرير المخزون والكميات',
              columns: [
                { key: 'name', label: 'الصنف' }, { key: 'qty', label: 'الكمية' },
                { key: 'cost', label: 'التكلفة' }, { key: 'price', label: 'سعر البيع' },
                { key: 'value', label: 'قيمة المخزون' },
              ],
              rows: items.map((it) => ({
                name: it.name, qty: it.qty, cost: fmt(it.cost), price: fmt(it.price), value: fmt(it.stock_value),
              })),
            })} style={btnSm}>🖨 طباعة</button>
          )}
        </div>
        {items.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr style={{ background: '#F7F9FC', textAlign: 'right' }}>
                  {['الصنف', 'الكمية', 'التكلفة', 'سعر البيع', 'قيمة المخزون', ''].map((h) => (
                    <th key={h} style={{ padding: '10px 12px', fontSize: 13, color: '#69757F' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} style={{ borderTop: '1px solid #F2F5F8' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0F2744' }}>{it.name}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {it.qty} {it.qty < 10 && <span style={{ background: '#FCE9E6', color: '#C0392B', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>منخفض</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{fmt(it.cost)}</td>
                    <td style={{ padding: '10px 12px' }}>{fmt(it.price)}</td>
                    <td style={{ padding: '10px 12px' }}>{fmt(it.stock_value)}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <button style={btnSm} onClick={() => openMove(it, 'buy')}>＋ شراء</button>{' '}
                      <button style={{ ...btnSm, background: '#D4A017', color: '#08172B', border: 'none' }} onClick={() => openMove(it, 'sell')}>بيع لطالب</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p style={{ color: '#8A94A6', textAlign: 'center', padding: 20 }}>لا توجد أصناف بعد</p>}
      </div>

      {/* إضافة صنف */}
      <div style={card}>
        <h3 style={{ margin: '0 0 14px', color: '#0F2744', fontSize: 16 }}>إضافة صنف جديد</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div><label style={lbl}>اسم الصنف</label><input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="كتاب الرياضيات" /></div>
          <div><label style={lbl}>الكمية</label><input style={input} type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" /></div>
          <div><label style={lbl}>التكلفة</label><input style={input} type="number" step="0.001" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.000" /></div>
          <div><label style={lbl}>سعر البيع</label><input style={input} type="number" step="0.001" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.000" /></div>
          <button style={btnGold} onClick={addItem} disabled={busy}>＋ إضافة</button>
        </div>
      </div>

      {/* نافذة الحركة */}
      {moveItem && (
        <div onClick={() => setMoveItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(8,15,27,.55)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 420, width: '100%' }} dir="rtl">
            <h3 style={{ margin: '0 0 6px', color: '#0F2744' }}>{moveMode === 'buy' ? 'شراء مخزون' : 'بيع لطالب'}</h3>
            <p style={{ fontSize: 13, color: '#667', margin: '0 0 16px' }}>
              <b>{moveItem.name}</b> — الرصيد الحالي: <b>{moveItem.qty}</b> · {moveMode === 'buy' ? `تكلفة الوحدة ${fmt(moveItem.cost)}` : `سعر البيع ${fmt(moveItem.price)} + ضريبة 5%`}
            </p>
            <label style={lbl}>الكمية</label>
            <input style={{ ...input, marginBottom: 14 }} type="number" value={moveQty} onChange={(e) => setMoveQty(e.target.value)} />
            {moveMode === 'sell' && (
              <>
                <label style={lbl}>الطالب</label>
                <select style={{ ...input, marginBottom: 14 }} value={moveStudent} onChange={(e) => setMoveStudent(e.target.value)}>
                  <option value="">اختر الطالب</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} — {s.guardian_name}</option>)}
                </select>
              </>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnSm} onClick={() => setMoveItem(null)}>إلغاء</button>
              <button style={btnGold} onClick={execMove} disabled={busy}>
                {moveMode === 'buy' ? 'تأكيد الشراء والترحيل' : 'إصدار فاتورة + قيد التكلفة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
