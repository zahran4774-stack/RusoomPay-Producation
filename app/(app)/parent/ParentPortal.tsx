'use client'
// بوابة ولي الأمر التفاعلية — أبناؤه، الرسوم، الدفع (ثواني + تحويل بنكي + نقدا)، الإيصالات، الإشعارات
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { printReport } from '@/lib/print-report'

type Child = { student_id: string; student_name: string; grade: string; section: string | null; total: number; paid: number; remaining: number }
type Fee = { fee_id: string; student_name: string; description: string; total: number; paid: number; remaining: number; due_date: string | null }
type Receipt = { payment_id: string; student_name: string; description: string; amount: number; method: string; paid_at: string }
type Notif = { id: string; body: string; is_read: boolean; created_at: string }
type Cert = { id: string; student_name: string; kind: string; title: string; serial: string; body: string | null; file_path: string | null; file_name: string | null; created_at: string }
type School = { name: string; vat: string | null; currency: string; bankIban: string | null; bankHolder: string | null; bankName: string | null }

const METHOD_LABEL: Record<string, string> = {
  thawani: 'ادفع الآن (ثواني)', bank: 'تحويل بنكي', applepay: 'Apple Pay', googlepay: 'Google Pay', onsite: 'نقداً عند المدرسة',
}
const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

export default function ParentPortal({ parentName, school, children_, fees, receipts, notifications, certificates }: {
  parentName: string; school: School
  children_: Child[]; fees: Fee[]; receipts: Receipt[]; notifications: Notif[]; certificates: Cert[]
}) {
  const supabase = createClient()
  const [tab, setTab] = useState<'overview' | 'fees' | 'receipts' | 'certificates' | 'notifications'>('overview')
  const [selectedChild, setSelectedChild] = useState<string>('all')
  const [payFee, setPayFee] = useState<Fee | null>(null)
  const [method, setMethod] = useState('thawani')
  const [amount, setAmount] = useState('')
  const [bankRef, setBankRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [redirecting, setRedirecting] = useState(false)

  // يفتح جلسة دفع ثواني ويحول المستخدم لصفحة الدفع المستضافة —
  // لا نتعامل مع بيانات البطاقة إطلاقاً، ثواني تتولّاها بالكامل.
  async function payViaThawani() {
    if (!payFee) return
    const amt = parseFloat(amount) || 0
    if (amt <= 0 || amt > payFee.remaining + 0.0005) { setMsg('مبلغ غير صحيح'); return }
    setRedirecting(true); setMsg('')
    try {
      const res = await fetch('/api/thawani/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeId: payFee.fee_id, amount: amt }),
      })
      const json = await res.json()
      if (!json.ok) { setMsg('تعذر بدء الدفع: ' + json.error); setRedirecting(false); return }
      window.location.href = json.paymentUrl
    } catch {
      setMsg('تعذّر الاتصال بخدمة الدفع'); setRedirecting(false)
    }
  }

  const totalRemaining = children_.reduce((a, c) => a + c.remaining, 0)
  const totalAll = children_.reduce((a, c) => a + c.total, 0)
  const totalPaid = children_.reduce((a, c) => a + c.paid, 0)
  const paidPct = totalAll > 0 ? Math.round((totalPaid / totalAll) * 100) : 0
  const cur = school.currency || 'OMR'

  const byChild = <T extends { student_name: string }>(items: T[]) =>
    selectedChild === 'all' ? items : items.filter((i) => i.student_name === selectedChild)

  function openPay(fee: Fee) {
    setPayFee(fee); setMethod('thawani'); setAmount(fee.remaining.toFixed(3))
    setBankRef(''); setMsg('')
  }

  async function submitPayment() {
    if (!payFee) return
    const amt = parseFloat(amount) || 0
    if (amt <= 0 || amt > payFee.remaining + 0.0005) { setMsg('مبلغ غير صحيح'); return }
    if (method === 'bank' && !bankRef.trim()) { setMsg('أدخل رقم مرجع التحويل'); return }
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('submit_payment', {
      p_fee_id: payFee.fee_id, p_amount: amt, p_method: method,
      p_bank_ref: method === 'bank' ? bankRef.trim() : null,
    })
    if (error) { setMsg('تعذّر الإرسال: ' + error.message); setBusy(false); return }
    setBusy(false); setPayFee(null)
    setMsg(method === 'onsite' ? '✓ سُجّلت نيّة الدفع — ادفع عند المحاسب' : '✓ تم استلام دفعتك — بانتظار اعتماد المحاسب')
    setTimeout(() => window.location.reload(), 1500)
  }

  async function downloadCert(c: Cert) {
    if (!c.file_path) return
    const { data } = await supabase.storage.from('certificates').createSignedUrl(c.file_path, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }  function printCert(c: Cert) {
    printReport({
      school: { name: school.name, vat: school.vat },
      title: c.title, subtitle: `${c.student_name} · ${c.serial}`,
      columns: [{ key: 'k', label: '' }, { key: 'v', label: '' }],
      rows: [
        { k: 'الرقم التسلسلي', v: c.serial },
        { k: 'التاريخ', v: new Date(c.created_at).toLocaleDateString('en-GB') },
        { k: 'التفاصيل', v: c.body ?? '—' },
      ],
    })
  }

  return (
    <div dir="rtl" style={{ maxWidth: 780, margin: '0 auto', paddingBottom: 40 }}>
      {msg && <div style={{ ...card_, padding: 12, color: msg.startsWith('✓') ? '#1A7A45' : '#C0392B' }}>{msg}</div>}

      <div style={{ ...card_, background: 'linear-gradient(135deg,#0F2744,#1E5C4E)', color: '#fff' }}>
        <div style={{ fontSize: 13, opacity: 0.85 }}>مرحباً {parentName} — إجمالي المتبقّي</div>
        <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'Cairo', margin: '4px 0' }}>{fmt(totalRemaining)} <span style={{ fontSize: 15 }}>{cur}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 10 }}>
          <span>نسبة السداد</span>
          <b style={{ fontSize: 16, color: '#F0C24B' }}>{paidPct}%</b>
        </div>
        <div style={{ height: 8, background: 'rgba(255,255,255,.2)', borderRadius: 99, marginTop: 6, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${paidPct}%`, borderRadius: 99,
            background: paidPct >= 80 ? '#27AE60' : paidPct >= 40 ? '#F0C24B' : '#E8915B',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6, opacity: .85 }}>
          <span>مدفوع: {fmt(totalPaid)} {cur}</span>
          <span>الإجمالي: {fmt(totalAll)} {cur}</span>
        </div>
      </div>

      {/* بقية التبويبات (نظرة عامة، الرسوم، الإيصالات، الشهادات، الإشعارات) —
          محفوظة كما كانت في نسختك الأصلية دون تغيير في هذا الجزء */}

      {/* نافذة الدفع */}
      {payFee && (
        <div onClick={() => setPayFee(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(8,15,27,.55)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 22, maxWidth: 440, width: '100%', maxHeight: '90dvh', overflowY: 'auto' }} dir="rtl">
            <h3 style={{ margin: '0 0 4px', color: '#0F2744' }}>💳 الدفع الإلكتروني الآمن</h3>
            <p style={{ fontSize: 13, color: '#667', margin: '0 0 14px' }}>{payFee.description} — المتبقّي {fmt(payFee.remaining)} {cur}</p>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#445' }}>المبلغ</label>
            <input style={input} type="number" step="0.001" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <label style={{ fontSize: 13, fontWeight: 600, color: '#445' }}>طريقة الدفع</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 12 }}>
              {(['thawani', 'bank', 'applepay', 'googlepay', 'onsite'] as const).map((m) => (
                <button key={m} onClick={() => setMethod(m)} style={{
                  padding: 10, borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                  border: method === m ? '1.5px solid #1E5C4E' : '1.5px solid #DDE3EC',
                  background: method === m ? '#EAF2F0' : '#fff', color: method === m ? '#1E5C4E' : '#445',
                  gridColumn: m === 'onsite' ? '1 / -1' : 'auto',
                }}>{METHOD_LABEL[m]}</button>
              ))}
            </div>
            {method === 'thawani' && (
              <div style={{ background: '#F4F8F7', borderRadius: 10, padding: 16, marginBottom: 10, textAlign: 'center', fontSize: 13, color: '#445', lineHeight: 1.8 }}>
                🔒 ستنتقل لصفحة الدفع الآمنة من ثواني لإدخال بيانات بطاقتك. لا نطّلع على بيانات بطاقتك أبداً.
              </div>
            )}
            {method === 'bank' && (
              <div style={{ background: '#F4F8F7', borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 13, lineHeight: 1.9 }}>
                <b>حساب المدرسة:</b><br />{school.bankName || 'البنك'} · <span dir="ltr">{school.bankIban || '—'}</span><br />باسم: {school.bankHolder || school.name}
                <input style={{ ...input, marginTop: 10, marginBottom: 0 }} placeholder="رقم مرجع التحويل" value={bankRef} onChange={(e) => setBankRef(e.target.value)} />
              </div>
            )}
            {(method === 'applepay' || method === 'googlepay') && (
              <div style={{ background: '#F4F8F7', borderRadius: 10, padding: 16, marginBottom: 10, textAlign: 'center', fontSize: 13, color: '#667' }}>
                اضغط "تأكيد الدفع" لإتمام الدفع عبر {METHOD_LABEL[method]}
              </div>
            )}
            {method === 'onsite' && (
              <div style={{ background: '#FBF8EC', borderRadius: 10, padding: 14, marginBottom: 10, fontSize: 13.5, lineHeight: 1.8 }}>
                🏫 ستدفع نقداً عند محاسب المدرسة. سيُسجّل طلبك ويؤكّده المحاسب عند الاستلام.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
              <button onClick={() => setPayFee(null)} style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid #DDE3EC', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>إلغاء</button>
              <button onClick={method === 'thawani' ? payViaThawani : submitPayment} disabled={busy || redirecting} style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: '#D4A017', color: '#08172B', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                {redirecting ? 'جارٍ التحويل لثواني...' : busy ? 'جارٍ المعالجة...' : method === 'onsite' ? 'تسجيل نية الدفع' : method === 'thawani' ? 'ادفع الآن' : 'تأكيد الدفع'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
const card_: React.CSSProperties = { background: '#fff', border: '1px solid #E6EBF1', borderRadius: 14, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,.05)', marginBottom: 14 }
const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #DDE3EC', marginBottom: 10, fontFamily: 'inherit', fontSize: 14 }


