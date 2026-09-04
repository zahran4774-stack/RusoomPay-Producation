'use client'
// بوابة ولي الأمر التفاعلية — أبناؤه، الرسوم، الدفع (5 طرق)، الإيصالات، الإشعارات، طلب الشهادات

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { printReport } from '@/lib/print-report'

type Child = { student_id: string; student_name: string; grade: string; section: string | null; total: number; paid: number; remaining: number; pending?: number }
type Fee = { fee_id: string; student_name: string; description: string; total: number; paid: number; remaining: number; due_date: string | null }
type Receipt = { payment_id: string; student_name: string; description: string; amount: number; method: string; paid_at: string }
type Notif = { id: string; body: string; is_read: boolean; created_at: string }
type Cert = { id: string; student_name: string; kind: string; title: string; serial: string; body: string | null; file_path: string | null; file_name: string | null; created_at: string }
type CertRequest = { id: string; student_name: string; kind: string; status: string; reason: string | null; created_at: string; reviewed_at: string | null }
type School = { name: string; vat: string | null; currency: string; bankIban: string | null; bankHolder: string | null; bankName: string | null }

const METHOD_LABEL: Record<string, string> = {
  thawani: 'دفع إلكتروني', bank: 'تحويل بنكي', applepay: 'Apple Pay', googlepay: 'Google Pay', onsite: 'نقداً عند المدرسة',
}

const CERT_KIND_LABEL: Record<string, string> = {
  enrollment: 'شهادة قيد', clearance: 'براءة ذمة مالية', fees_statement: 'إفادة رسوم',
}

const REQ_STATUS_LABEL: Record<string, { t: string; c: string; bg: string }> = {
  pending: { t: 'قيد المراجعة', c: '#8A6D0F', bg: '#FBF3D5' },
  approved: { t: 'اعتُمد', c: '#1A7A45', bg: '#E6F4EC' },
  rejected: { t: 'مرفوض', c: '#C0392B', bg: '#FBEAE8' },
}

const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

export default function ParentPortal({ parentName, school, children_, fees, receipts, notifications, certificates, certificateRequests }: {
  parentName: string; school: School
  children_: Child[]; fees: Fee[]; receipts: Receipt[]; notifications: Notif[]; certificates: Cert[]; certificateRequests: CertRequest[]
}) {
  const supabase = createClient()
  const [tab, setTab] = useState<'overview' | 'fees' | 'receipts' | 'certificates' | 'notifications'>('overview')
  const [selectedChild, setSelectedChild] = useState<string>('all') // 'all' أو student_name
  const [payFee, setPayFee] = useState<Fee | null>(null)
  const [method, setMethod] = useState('thawani')
  const [amount, setAmount] = useState('')
  const [bankRef, setBankRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [reqBusyId, setReqBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [redirecting, setRedirecting] = useState(false)

  // ينشئ جلسة دفع ثواني ويحوّل المستخدم لصفحة الدفع المستضافة —
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
      if (!json.ok) { setMsg('تعذّر بدء الدفع: ' + json.error); setRedirecting(false); return }
      window.location.href = json.paymentUrl
    } catch {
      setMsg('تعذّر الاتصال بخدمة الدفع'); setRedirecting(false)
    }
  }

  const totalRemaining = children_.reduce((a, c) => a + c.remaining, 0)
  const totalAll = children_.reduce((a, c) => a + c.total, 0)
  const totalPaid = children_.reduce((a, c) => a + c.paid, 0)
  const totalPending = children_.reduce((a, c) => a + (c.pending || 0), 0)
  const paidPct = totalAll > 0 ? Math.round((totalPaid / totalAll) * 100) : 0
  const cur = school.currency === 'OMR' ? 'ر.ع' : school.currency

  // فلترة حسب الطفل المختار — تعمل على أي عنصر يحمل student_name
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
    try {
      const { error } = await supabase.rpc('submit_payment', {
        p_fee_id: payFee.fee_id, p_amount: amt, p_method: method,
        p_bank_ref: method === 'bank' ? bankRef.trim() : null,
      })
      if (error) { setMsg('تعذّر الإرسال: ' + error.message); setBusy(false); return }
      setBusy(false); setPayFee(null)
      setMsg(method === 'onsite' ? '✓ سُجّلت نيّة الدفع — ادفع عند المحاسب' : '✓ تم استلام دفعتك — بانتظار اعتماد المحاسب')
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      // انقطاع اتصال قبل وصول الرد — بلا هذا يبقى الزر عالقاً على "جارٍ الإرسال" للأبد
      setMsg('تعذّر الاتصال — تحقّق من الإنترنت وحاول مجدداً')
      setBusy(false)
    }
  }

  async function requestCert(studentId: string, kind: string) {
    setReqBusyId(studentId + kind); setMsg('')
    try {
      const { error } = await supabase.rpc('request_certificate', { p_student_id: studentId, p_kind: kind })
      if (error) { setMsg('تعذّر إرسال الطلب: ' + error.message); setReqBusyId(null); return }
      setMsg('✓ أُرسل طلبك — بانتظار اعتماد المدرسة')
      setTimeout(() => window.location.reload(), 1200)
    } catch {
      setMsg('تعذّر الاتصال — تحقّق من الإنترنت وحاول مجدداً')
      setReqBusyId(null)
    }
  }

  async function downloadCert(c: Cert) {
    if (!c.file_path) return
    try {
      const { data, error } = await supabase.storage.from('certificates').createSignedUrl(c.file_path, 120)
      if (error || !data?.signedUrl) { setMsg('تعذّر تحميل الشهادة — حاول مجدداً'); return }
      window.open(data.signedUrl, '_blank')
    } catch {
      setMsg('تعذّر الاتصال — تحقّق من الإنترنت وحاول مجدداً')
    }
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
  const childPill = (active: boolean): React.CSSProperties => ({
    flexShrink: 0, padding: '8px 16px', borderRadius: 99, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
    border: active ? '1.5px solid #1E5C4E' : '1.5px solid #DDE3EC',
    background: active ? '#1E5C4E' : '#fff',
    color: active ? '#fff' : '#556',
    transition: 'all .2s ease',
  })
  const pendingBadge: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, fontWeight: 600, color: '#F0C24B',
    background: 'rgba(240,194,75,.15)', padding: '7px 12px',
    borderRadius: 9, width: 'fit-content',
  }
  const btnReq: React.CSSProperties = {
    padding: '8px 14px', background: '#EEF2F9', color: '#163B68', border: 'none',
    borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
  }

  // هل يوجد طلب معلّق لهذا الطالب/النوع؟
  const hasPendingReq = (studentName: string, kind: string) =>
    certificateRequests.some((r) => r.student_name === studentName && r.kind === kind && r.status === 'pending')

  return (
    <div style={{ minHeight: '100dvh', background: '#F4F6FA' }} dir="rtl">
      {/* ترويسة */}
      <header style={{ background: '#0A1D33', color: '#fff', padding: '16px 20px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, fontFamily: 'Cairo' }}>{school.name}</div>
            <div style={{ fontSize: 12.5, opacity: .8 }}>بوابة ولي الأمر · {parentName}</div>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
            style={{ background: 'rgba(255,255,255,.12)', color: '#fff', padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, border: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
            خروج
          </button>
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

          {/* شارة: مبالغ قيد الاعتماد */}
          {totalPending > 0.0005 && (
            <div style={{ ...pendingBadge, marginTop: 12 }}>
              ⏳ {fmt(totalPending)} {cur} قيد الاعتماد
            </div>
          )}
        </div>

        {/* تبويبات */}
        <div className="module-tabs" role="tablist" aria-label="أقسام بوابة ولي الأمر" style={{ marginBottom: 14 }}>
          <button role="tab" aria-selected={tab === 'overview'} className={`module-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>أبنائي</button>
          <button role="tab" aria-selected={tab === 'fees'} className={`module-tab ${tab === 'fees' ? 'active' : ''}`} onClick={() => setTab('fees')}>الرسوم</button>
          <button role="tab" aria-selected={tab === 'receipts'} className={`module-tab ${tab === 'receipts' ? 'active' : ''}`} onClick={() => setTab('receipts')}>الإيصالات</button>
          <button role="tab" aria-selected={tab === 'certificates'} className={`module-tab ${tab === 'certificates' ? 'active' : ''}`} onClick={() => setTab('certificates')}>الشهادات</button>
          <button role="tab" aria-selected={tab === 'notifications'} className={`module-tab ${tab === 'notifications' ? 'active' : ''}`} onClick={() => setTab('notifications')}>الإشعارات</button>
        </div>

        {/* محدد الطفل — يظهر فقط عند وجود أكثر من ابن */}
        {children_.length > 1 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 14, paddingBottom: 2 }}>
            <button style={childPill(selectedChild === 'all')} onClick={() => setSelectedChild('all')}>الكل</button>
            {children_.map((c) => (
              <button key={c.student_id} style={childPill(selectedChild === c.student_name)} onClick={() => setSelectedChild(c.student_name)}>
                {c.student_name}
              </button>
            ))}
          </div>
        )}

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
            {/* شارة قيد الاعتماد لهذا الابن تحديداً */}
            {(c.pending || 0) > 0.0005 && (
              <div style={{ ...pendingBadge, marginTop: 10 }}>
                ⏳ {fmt(c.pending || 0)} {cur} قيد الاعتماد
              </div>
            )}
          </div>
        )) : <div style={card_}>لا يوجد أبناء مرتبطون بحسابك. تواصل مع المدرسة لربط أبنائك.</div>)}

        {/* الرسوم + الدفع — نعرض المستحقّة فقط؛ المدفوعة بالكامل تظهر بتبويب "الإيصالات" */}
        {tab === 'fees' && (byChild(fees).filter((f) => f.remaining > 0.0005).length ? byChild(fees).filter((f) => f.remaining > 0.0005).map((f) => (
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
        {tab === 'receipts' && (byChild(receipts).length ? byChild(receipts).map((r) => (
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
        {tab === 'certificates' && (
          <>
            {/* طلب شهادة قيد لكل ابن */}
            {children_.length > 0 && (
              <div style={card_}>
                <b style={{ color: '#0F2744', display: 'block', marginBottom: 10 }}>طلب شهادة قيد</b>
                {byChild(children_).map((c) => {
                  const pending = hasPendingReq(c.student_name, 'enrollment')
                  return (
                    <div key={c.student_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '8px 0', borderBottom: '1px solid #F2F5F8' }}>
                      <span style={{ fontSize: 13.5, color: '#0F2744', fontWeight: 600 }}>{c.student_name}</span>
                      {pending ? (
                        <span style={{ ...REQ_STATUS_LABEL.pending, fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 99, background: REQ_STATUS_LABEL.pending.bg, color: REQ_STATUS_LABEL.pending.c }}>
                          ⏳ طلبك قيد المراجعة
                        </span>
                      ) : (
                        <button style={btnReq} onClick={() => requestCert(c.student_id, 'enrollment')} disabled={reqBusyId === c.student_id + 'enrollment'}>
                          {reqBusyId === c.student_id + 'enrollment' ? '...' : '📋 طلب شهادة قيد'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* طلباتي السابقة */}
            {byChild(certificateRequests).length > 0 && (
              <div style={card_}>
                <b style={{ color: '#0F2744', display: 'block', marginBottom: 10 }}>طلباتي</b>
                {byChild(certificateRequests).map((r) => {
                  const s = REQ_STATUS_LABEL[r.status] || REQ_STATUS_LABEL.pending
                  return (
                    <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid #F2F5F8' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontSize: 13, color: '#0F2744' }}>{CERT_KIND_LABEL[r.kind] || r.kind} · {r.student_name}</span>
                        <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: s.bg, color: s.c }}>{s.t}</span>
                      </div>
                      {r.status === 'rejected' && r.reason && <div style={{ fontSize: 12, color: '#C0392B', marginTop: 4 }}>السبب: {r.reason}</div>}
                    </div>
                  )
                })}
              </div>
            )}

            {byChild(certificates).length ? byChild(certificates).map((c) => (
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
            )) : <div style={card_}>لا توجد شهادات صادرة بعد.</div>}
          </>
        )}

        {/* الإشعارات */}
        {tab === 'notifications' && (notifications.length ? notifications.map((n) => (
          <div key={n.id} style={{ ...card_, padding: 14 }}>
            <div style={{ fontSize: 14, color: '#1A2530' }}>{n.body}</div>
            <div style={{ fontSize: 11.5, color: '#9AA7B8', marginTop: 4 }}>{new Date(n.created_at).toLocaleDateString('en-GB')}</div>
          </div>
        )) : <div style={card_}>لا توجد إشعارات</div>)}
      </div>
      {/* طبقة تحميل مركزية أثناء الانتقال لثواني */}
      {redirecting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,15,27,.7)', display: 'grid', placeItems: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div className="lp-spin" style={{ width: 34, height: 34, borderWidth: 3.5, borderColor: 'rgba(20,58,49,.18)', borderTopColor: '#1E5C4E' }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F2744' }}>جارٍ نقلك لصفحة الدفع الآمنة…</div>
          </div>
        </div>
      )}


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
                {redirecting ? 'جارٍ التحويل لثواني...' : busy ? 'جارٍ المعالجة...' : method === 'onsite' ? 'تسجيل نيّة الدفع' : method === 'thawani' ? 'ادفع الآن' : 'تأكيد الدفع'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
