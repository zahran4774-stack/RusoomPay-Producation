'use client'
// بوابة ولي الأمر التفاعلية — أبناؤه، الرسوم، الدفع (5 طرق)، الإيصالات، الإشعارات
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { printReport } from '@/lib/print-report'

type Child = { student_id: string; student_name: string; grade: string; section: string | null; total: number; paid: number; remaining: number }
type Fee = { fee_id: string; student_name: string; description: string; total: number; paid: number; remaining: number; due_date: string | null }
type Receipt = { payment_id: string; student_name: string; description: string; amount: number; method: string; paid_at: string }
type Notif = { id: string; body: string; is_read: boolean; created_at: string }
type Cert = { id: string; student_name: string; kind: string; title: string; serial: string; body: string | null; file_path: string | null; file_name: string | null; created_at: string }
type School = { name: string; vat: string | null; currency: string; bankIban: string | null; bankHolder: string | null; bankName: string | null }

const METHOD_LABEL: Record<string, string> = {
  card: 'بطاقة بنكية', bank: 'تحويل بنكي', applepay: 'Apple Pay', googlepay: 'Google Pay', onsite: 'نقداً عند المدرسة',
}
const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

export default function ParentPortal({ parentName, school, children_, fees, receipts, notifications, certificates }: {
  parentName: string; school: School
  children_: Child[]; fees: Fee[]; receipts: Receipt[]; notifications: Notif[]; certificates: Cert[]
}) {
  const supabase = createClient()
  const [tab, setTab] = useState<'overview' | 'fees' | 'receipts' | 'certificates' | 'notifications'>('overview')
  const [payFee, setPayFee] = useState<Fee | null>(null)
  const [method, setMethod] = useState('card')
  const [amount, setAmount] = useState('')
  const [bankRef, setBankRef] = useState('')
  const [card, setCard] = useState({ name: '', num: '', exp: '', cvv: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const totalRemaining = children_.reduce((a, c) => a + c.remaining, 0)
  const totalAll = children_.reduce((a, c) => a + c.total, 0)
  const totalPaid = children_.reduce((a, c) => a + c.paid, 0)
  const paidPct = totalAll > 0 ? Math.round((totalPaid / totalAll) * 100) : 0
  const cur = school.currency === 'OMR' ? 'ر.ع' : school.currency

  function openPay(fee: Fee) {
    setPayFee(fee); setMethod('card'); setAmount(fee.remaining.toFixed(3))
    setBankRef(''); setCard({ name: '', num: '', exp: '', cvv: '' }); setMsg('')
  }

  async function submitPayment() {
    if (!payFee) return
    const amt = parseFloat(amount) || 0
    if (amt <= 0 || amt > payFee.remaining + 0.0005) { setMsg('مبلغ غير صحيح'); return }
    if (method === 'card' && (card.num.replace(/\s/g, '').length < 12 || !card.name.trim())) { setMsg('أكمل بيانات البطاقة'); return }
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
  }

  function printCert(c: Cert) {
    printReport({
      school: { name: school.name, vat: school.vat },
      title: c.title, subtitle: `${c.student_name} · ${c.serial}`,
      columns: [{ key: 'k', label: 'البند' }, { key: 'v', label: 'التفاصيل' }],
      rows: [
        { k: 'الطالب', v: c.student_name }, { k: 'الشهادة', v: c.title },
        { k: 'الرقم', v: c.serial }, { k: 'التاريخ', v: new Date(c.created_at).toLocaleDateString('en-GB') },
        { k: 'النص', v: c.body || '—' },
      ],
    })
  }

  // أنماط
  const wrap: React.CSSProperties = { maxWidth: 760, margin: '0 auto', padding: '24px 16px' }
  const card_: React.CSSProperties = { background: '#fff', border: '1px solid #E6EBF1', borderRadius: 14, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,.05)', marginBottom: 14 }
  const input: React.CSSProperties = { width: '100%', padding: 11, borderRadius: 10, border: '1.5px solid #DDE3EC', fontFamily: 'inherit', fontSize: 14, marginBottom: 10 }
  const tabBtn = (k: string): React.CSSProperties => ({
    flex: 1, padding: '11px 8px', border: 'none', background: 'none', cursor: 'pointer',
    fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit',
    color: tab === k ? '#0A1D33' : '#8A94A6',
    borderBottom: tab === k ? '2.5px solid #D4A017' : '2.5px solid transparent',
  })

  return (
    <div style={{ minHeight: '100dvh', background: '#F4F6FA' }} dir="rtl">
      {/* ترويسة */}
      <header style={{ background: '#0A1D33', color: '#fff', padding: '16px 20px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, fontFamily: 'Cairo' }}>{school.name}</div>
            <div style={{ fontSize: 12.5, opacity: .8 }}>بوابة ولي الأمر · {parentName}</div>
          </div>
          <form action="/login" method="get">
            <a href="/login" style={{ background: 'rgba(255,255,255,.12)', color: '#fff', padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>خروج</a>
          </form>
        </div>
      </header>

      <div style={wrap}>
        {msg && <div style={{ ...card_, padding: 12, color: msg.startsWith('✓') ? '#1A7A45' : '#C0392B' }}>{msg}</div>}

        {/* ملخّص */}
        <div style={{ ...card_, background: 'linear-gradient(135deg,#0F2744,#1E5C4E)', color: '#fff' }}>
          <div style={{ fontSize: 13, opacity: .85 }}>إجمالي المتبقّي على أبنائك</div>
          <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'Cairo', margin: '4px 0' }}>{fmt(totalRemaining)} <span style={{ fontSize: 15 }}>{cur}</span></div>
          <div style={{ fontSize: 12.5, opacity: .8, marginBottom: 14 }}>{children_.length} {children_.length === 1 ? 'ابن' : 'أبناء'}</div>
          {/* مؤشّر نسبة الدفع من الإجمالي */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 6 }}>
            <span style={{ opacity: .85 }}>نسبة المدفوع من الإجمالي</span>
            <b style={{ fontSize: 16, color: '#F0C24B' }}>{paidPct}%</b>
          </div>
          <div style={{ height: 12, background: 'rgba(255,255,255,.18)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${paidPct}%`, borderRadius: 99,
              background: paidPct >= 80 ? '#27AE60' : paidPct >= 40 ? '#F0C24B' : '#E8915B',
              transition: 'width .6s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, opacity: .75, marginTop: 6 }}>
            <span>مدفوع: {fmt(totalPaid)} {cur}</span>
            <span>الإجمالي: {fmt(totalAll)} {cur}</span>
          </div>
        </div>

        {/* تبويبات */}
        <div style={{ display: 'flex', background: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
          <button style={tabBtn('overview')} onClick={() => setTab('overview')}>أبنائي</button>
          <button style={tabBtn('fees')} onClick={() => setTab('fees')}>الرسوم</button>
          <button style={tabBtn('receipts')} onClick={() => setTab('receipts')}>الإيصالات</button>
          <button style={tabBtn('certificates')} onClick={() => setTab('certificates')}>الشهادات</button>
          <button style={tabBtn('notifications')} onClick={() => setTab('notifications')}>الإشعارات</button>
        </div>

        {/* أبنائي */}
        {tab === 'overview' && (children_.length ? children_.map((c) => (
          <div key={c.student_id} style={card_}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><b style={{ color: '#0F2744', fontSize: 16 }}>{c.student_name}</b>
                <div style={{ fontSize: 12.5, color: '#8A94A6' }}>{c.grade}{c.section ? ' · ' + c.section : ''}</div></div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12, color: '#8A94A6' }}>المتبقّي</div>
                <b style={{ color: c.remaining > 0 ? '#C0392B' : '#1A7A45', fontSize: 16 }}>{fmt(c.remaining)} {cur}</b>
              </div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8A94A6', marginBottom: 5 }}>
              <span>مدفوع {fmt(c.paid)} من {fmt(c.total)} {cur}</span>
              <b style={{ color: '#1A7A45' }}>{c.total ? Math.round((c.paid / c.total) * 100) : 0}%</b>
            </div>
            <div style={{ height: 9, background: '#EEF1F5', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${c.total ? (c.paid / c.total) * 100 : 0}%`, borderRadius: 99,
                background: (c.total ? (c.paid / c.total) : 0) >= 0.8 ? '#27AE60' : (c.total ? (c.paid / c.total) : 0) >= 0.4 ? '#D4A017' : '#E8915B',
                transition: 'width .6s ease',
              }} />
            </div>
          </div>
        )) : <div style={card_}>لا يوجد أبناء مرتبطون بحسابك. تواصل مع المدرسة لربط أبنائك.</div>)}

        {/* الرسوم + الدفع */}
        {tab === 'fees' && (fees.length ? fees.map((f) => (
          <div key={f.fee_id} style={card_}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div><b style={{ color: '#0F2744' }}>{f.description}</b>
                <div style={{ fontSize: 12.5, color: '#8A94A6' }}>{f.student_name}{f.due_date ? ' · استحقاق ' + new Date(f.due_date).toLocaleDateString('en-GB') : ''}</div></div>
              <div style={{ textAlign: 'left' }}>
                <b style={{ color: f.remaining > 0 ? '#C0392B' : '#1A7A45' }}>{fmt(f.remaining)} {cur}</b>
                <div style={{ fontSize: 11.5, color: '#8A94A6' }}>من {fmt(f.total)}</div>
              </div>
            </div>
            {f.remaining > 0.0005 && (
              <button onClick={() => openPay(f)} style={{ marginTop: 12, width: '100%', padding: 11, background: '#D4A017', color: '#08172B', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                💳 ادفع الآن
              </button>
            )}
          </div>
        )) : <div style={card_}>لا توجد رسوم مستحقّة 🎉</div>)}

        {/* الإيصالات */}
        {tab === 'receipts' && (receipts.length ? receipts.map((r) => (
          <div key={r.payment_id} style={card_}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div><b style={{ color: '#0F2744' }}>{r.description}</b>
                <div style={{ fontSize: 12.5, color: '#8A94A6' }}>{r.student_name} · {METHOD_LABEL[r.method] || r.method} · {new Date(r.paid_at).toLocaleDateString('en-GB')}</div></div>
              <b style={{ color: '#1A7A45' }}>{fmt(r.amount)} {cur}</b>
            </div>
            <button onClick={() => printReport({
              school: { name: school.name, vat: school.vat },
              title: 'إيصال دفع', subtitle: `${r.student_name} — ${r.description}`,
              columns: [{ key: 'k', label: 'البيان' }, { key: 'v', label: 'القيمة' }],
              rows: [
                { k: 'الطالب', v: r.student_name }, { k: 'البند', v: r.description },
                { k: 'المبلغ', v: fmt(r.amount) + ' ' + cur }, { k: 'طريقة الدفع', v: METHOD_LABEL[r.method] || r.method },
                { k: 'التاريخ', v: new Date(r.paid_at).toLocaleDateString('en-GB') },
              ],
            })} style={{ marginTop: 10, padding: '7px 14px', background: '#fff', color: '#0F2744', border: '1.5px solid #DDE3EC', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              🖨 تحميل الإيصال
            </button>
          </div>
        )) : <div style={card_}>لا توجد إيصالات بعد</div>)}

        {/* الشهادات */}
        {tab === 'certificates' && (certificates.length ? certificates.map((c) => (
          <div key={c.id} style={card_}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div><b style={{ color: '#0F2744' }}>{c.title}</b>
                <div style={{ fontSize: 12.5, color: '#8A94A6' }}>{c.student_name} · {c.serial} · {new Date(c.created_at).toLocaleDateString('en-GB')}</div></div>
              {c.kind === 'uploaded'
                ? <button onClick={() => downloadCert(c)} style={{ padding: '7px 14px', background: '#fff', color: '#0F2744', border: '1.5px solid #DDE3EC', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>⬇ تحميل</button>
                : <button onClick={() => printCert(c)} style={{ padding: '7px 14px', background: '#fff', color: '#0F2744', border: '1.5px solid #DDE3EC', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>🖨 طباعة</button>}
            </div>
            {c.body && <div style={{ fontSize: 12.5, color: '#556', marginTop: 8, lineHeight: 1.8 }}>{c.body}</div>}
          </div>
        )) : <div style={card_}>لا توجد شهادات بعد. تصدرها المدرسة عند الحاجة.</div>)}

        {/* الإشعارات */}
        {tab === 'notifications' && (notifications.length ? notifications.map((n) => (
          <div key={n.id} style={{ ...card_, padding: 14 }}>
            <div style={{ fontSize: 14, color: '#1A2530' }}>{n.body}</div>
            <div style={{ fontSize: 11.5, color: '#9AA7B8', marginTop: 4 }}>{new Date(n.created_at).toLocaleDateString('en-GB')}</div>
          </div>
        )) : <div style={card_}>لا توجد إشعارات</div>)}
      </div>

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
              {(['card', 'bank', 'applepay', 'googlepay', 'onsite'] as const).map((m) => (
                <button key={m} onClick={() => setMethod(m)} style={{
                  padding: 10, borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                  border: method === m ? '1.5px solid #1E5C4E' : '1.5px solid #DDE3EC',
                  background: method === m ? '#EAF2F0' : '#fff', color: method === m ? '#1E5C4E' : '#445',
                  gridColumn: m === 'onsite' ? '1 / -1' : 'auto',
                }}>{METHOD_LABEL[m]}</button>
              ))}
            </div>
            {method === 'card' && (
              <>
                <input style={input} placeholder="اسم حامل البطاقة" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} />
                <input style={input} placeholder="4242 4242 4242 4242" inputMode="numeric" value={card.num} onChange={(e) => setCard({ ...card, num: e.target.value })} />
                <div style={{ display: 'flex', gap: 10 }}>
                  <input style={{ ...input, flex: 1 }} placeholder="MM/YY" value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} />
                  <input style={{ ...input, flex: 1 }} placeholder="CVV" type="password" value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value })} />
                </div>
              </>
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
              <button onClick={submitPayment} disabled={busy} style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: '#D4A017', color: '#08172B', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                {busy ? 'جارٍ المعالجة...' : (method === 'onsite' ? 'تسجيل نيّة الدفع' : 'تأكيد الدفع')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
