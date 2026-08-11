'use client'
// تتبّع تكلفة الوجبات — الموردون + المشتريات + تقرير التكلفة

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'

type Supplier = { id: string; name: string; contact_name: string | null; phone: string | null; email: string | null; vat_number: string | null; active: boolean }
type Purchase = { id: string; supplier_id: string | null; supplier_name: string | null; purchase_date: string; purchase_type: string; meals_count: number; unit_cost: number; total_cost: number; period: string | null; paid: boolean; notes: string | null }
type Report = { meals_purchased: number; total_cost: number; avg_per_meal: number; meal_students: number; avg_per_student: number; suppliers: { supplier: string; meals: number; cost: number; avg_cost: number }[] }

const TYPES: Record<string, string> = { daily: 'يومي', monthly: 'شهري', bulk: 'جملة', other: 'أخرى' }
const fmt3 = (n: number) => (n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const fmt0 = (n: number) => (n || 0).toLocaleString('en-US')
const thisPeriod = () => new Date().toISOString().slice(0, 7)

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

  const btn = (active: boolean): React.CSSProperties => ({
    padding: '9px 18px', borderRadius: 10, border: 0, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
    background: active ? '#163B68' : '#F2F5F8', color: active ? '#fff' : '#0F2744',
  })

  return (
    <div dir="rtl" style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <button style={btn(tab === 'report')} onClick={() => setTab('report')}>📊 التقرير</button>
        <button style={btn(tab === 'purchases')} onClick={() => setTab('purchases')}>🧾 المشتريات</button>
        <button style={btn(tab === 'suppliers')} onClick={() => setTab('suppliers')}>🏢 الموردون</button>
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

// ═══ التقرير ═══
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

// ═══ المشتريات ═══
function PurchasesView({ purchases, suppliers, period, sym, onChange }: { purchases: Purchase[]; suppliers: Supplier[]; period: string; sym: string; onChange: () => void }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ supplier: '', date: new Date().toISOString().slice(0, 10), type: 'daily', meals: '', unit: '', paid: false, notes: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

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
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setOpen(false)
    setF({ supplier: '', date: new Date().toISOString().slice(0, 10), type: 'daily', meals: '', unit: '', paid: false, notes: '' })
    onChange()
  }

  async function del(id: string) {
    await supabase.rpc('delete_meal_purchase', { p_id: id })
    onChange()
  }

  async function markPaid(p: Purchase) {
    setBusyId(p.id)
    const { error } = await supabase.rpc('mark_meal_purchase_paid', { p_id: p.id })
    setBusyId(null)
    if (error) { alert(error.message); return }
    onChange()
  }

  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #E3E8EE', fontSize: 14, fontFamily: 'inherit' }
  const cell: React.CSSProperties = { flex: '1 1 150px' }

  return (
    <div>
      <button onClick={() => setOpen(true)} style={{ background: '#163B68', color: '#fff', border: 0, padding: '11px 20px', borderRadius: 11, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16 }}>
        ＋ تسجيل شراء
      </button>

      <div style={{ background: '#fff', borderRadius: 12, overflow: 'auto', border: '1px solid #EDF1F5' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead><tr style={{ background: '#F7FAFC', textAlign: 'right' }}>
            <th style={{ padding: 10 }}>التاريخ</th><th style={{ padding: 10 }}>المورّد</th>
            <th style={{ padding: 10 }}>النوع</th><th style={{ padding: 10 }}>الوجبات</th>
            <th style={{ padding: 10 }}>الوحدة</th><th style={{ padding: 10 }}>الإجمالي</th>
            <th style={{ padding: 10 }}>الحالة</th><th style={{ padding: 10 }}></th>
          </tr></thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid #F2F5F8' }}>
                <td style={{ padding: 10, direction: 'ltr', textAlign: 'right' }}>{p.purchase_date}</td>
                <td style={{ padding: 10 }}>{p.supplier_name || '—'}</td>
                <td style={{ padding: 10 }}>{TYPES[p.purchase_type] || p.purchase_type}</td>
                <td style={{ padding: 10 }}>{fmt0(p.meals_count)}</td>
                <td style={{ padding: 10 }}>{fmt3(p.unit_cost)}</td>
                <td style={{ padding: 10, fontWeight: 700 }}>{fmt3(p.total_cost)} {sym}</td>
                <td style={{ padding: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: p.paid ? '#067647' : '#B54708' }}>{p.paid ? 'مدفوع' : 'غير مدفوع'}</span>
                </td>
                <td style={{ padding: 10, display: 'flex', gap: 8 }}>
                  {!p.paid && (
                    <button onClick={() => markPaid(p)} disabled={busyId === p.id}
                      style={{ background: '#EAF7EE', color: '#067647', border: 0, borderRadius: 8, padding: '6px 10px', cursor: busyId === p.id ? 'default' : 'pointer', fontSize: 12, fontWeight: 700 }}>
                      {busyId === p.id ? '...' : '✓ تم الدفع'}
                    </button>
                  )}
                  <button onClick={() => del(p.id)} style={{ background: 'none', border: 0, color: '#C0392B', cursor: 'pointer', fontSize: 13 }}>حذف</button>
                </td>
              </tr>
            ))}
            {purchases.length === 0 && <tr><td colSpan={8} style={{ padding: 18, textAlign: 'center', color: '#999' }}>لا مشتريات</td></tr>}
          </tbody>
        </table>
      </div>

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
              <div style={{ flex: '1 1 100%' }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#0F2744' }}>ملاحظات</label>
                <input style={input} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#0F2744', cursor: 'pointer' }}>
                <input type="checkbox" checked={f.paid} onChange={(e) => set('paid', e.target.checked)} style={{ width: 17, height: 17 }} />
                مدفوع
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

// ═══ الموردون ═══
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
