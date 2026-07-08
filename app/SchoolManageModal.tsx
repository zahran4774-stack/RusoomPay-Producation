'use client'
// نافذة إدارة مدرسة لمالك المنصة — دخول للدعم: قراءة تفصيلية + تعديل محدود + سجل التدقيق
// كل دخول وتعديل يُسجّل في Audit Log (شفافية كاملة)
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

export default function SchoolManageModal({ schoolId, schoolName, onClose }: {
  schoolId: string; schoolName: string; onClose: () => void
}) {
  const supabase = createClient()
  const [tab, setTab] = useState<'overview' | 'edit' | 'audit'>('overview')
  const [detail, setDetail] = useState<any>(null)
  const [audit, setAudit] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  // حقول التعديل
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' })

  // تحميل البيانات عند الفتح (يُسجّل دخول الدعم في Audit Log)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('platform_school_detail', { p_school_id: schoolId })
      if (error) { setMsg('تعذّر التحميل: ' + error.message); setLoading(false); return }
      setDetail(data)
      if (data?.school) setForm({
        name: data.school.name ?? '', phone: data.school.phone ?? '',
        email: data.school.email ?? '', address: data.school.address ?? '',
      })
      const { data: a } = await supabase.rpc('platform_school_audit', { p_school_id: schoolId, p_limit: 60 })
      setAudit(a || [])
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId])

  async function saveEdit() {
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('platform_update_school', {
      p_school_id: schoolId, p_name: form.name, p_phone: form.phone,
      p_email: form.email, p_address: form.address,
    })
    setBusy(false)
    setMsg(error ? 'تعذّر الحفظ: ' + error.message : '✓ حُفظت التعديلات وسُجّلت في سجل التدقيق')
  }

  async function toggleUser(userId: string, active: boolean) {
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('platform_set_user_active', { p_user_id: userId, p_active: active })
    if (error) { setMsg('تعذّر التحديث: ' + error.message); setBusy(false); return }
    // تحديث الحالة محلياً + إعادة جلب التفاصيل
    setDetail((d: any) => ({
      ...d,
      users: (d.users || []).map((u: any) => (u.id === userId ? { ...u, active } : u)),
    }))
    setMsg(active ? '✓ فُعّل المستخدم وسُجّل في سجل التدقيق' : '✓ أُوقف المستخدم وسُجّل في سجل التدقيق')
    setBusy(false)
  }

  const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(8,15,27,.6)', display: 'grid', placeItems: 'center', zIndex: 200, padding: 16 }
  const panel: React.CSSProperties = { background: '#F4F6FA', borderRadius: 16, maxWidth: 720, width: '100%', maxHeight: '92dvh', overflowY: 'auto' }
  const head: React.CSSProperties = { background: '#0A1D33', color: '#fff', padding: '16px 20px', borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 2 }
  const body: React.CSSProperties = { padding: 20 }
  const tabBtn = (k: string): React.CSSProperties => ({
    padding: '9px 16px', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
    background: tab === k ? '#D4A017' : '#fff', color: tab === k ? '#08172B' : '#445',
  })
  const cardS: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,.05)' }
  const input: React.CSSProperties = { width: '100%', padding: 11, borderRadius: 10, border: '1.5px solid #DDE3EC', fontFamily: 'inherit', fontSize: 14, marginBottom: 10 }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()} dir="rtl">
        <div style={head}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{schoolName}</div>
            <div style={{ fontSize: 12, opacity: .75 }}>دخول دعم — كل عملية مُسجّلة في سجل التدقيق</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        <div style={body}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button style={tabBtn('overview')} onClick={() => setTab('overview')}>📊 نظرة عامة</button>
            <button style={tabBtn('edit')} onClick={() => setTab('edit')}>✏️ تعديل البيانات</button>
            <button style={tabBtn('audit')} onClick={() => setTab('audit')}>📜 سجل المدرسة</button>
          </div>

          {msg && <div style={{ ...cardS, color: msg.startsWith('✓') ? '#1A7A45' : '#C0392B' }}>{msg}</div>}
          {loading ? <div style={cardS}>جارٍ التحميل...</div> : (
            <>
              {tab === 'overview' && detail && (
                <>
                  <div style={cardS}>
                    <b style={{ color: '#0F2744' }}>ملخّص المدرسة</b>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12, marginTop: 12 }}>
                      <Stat label="الطلاب" v={detail.counts?.students ?? 0} />
                      <Stat label="الموظفون" v={detail.counts?.employees ?? 0} />
                      <Stat label="المستخدمون" v={detail.counts?.users ?? 0} />
                      <Stat label="الفواتير" v={detail.counts?.fees ?? 0} />
                    </div>
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F2F5F8', display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                      <span style={{ color: '#667' }}>إجمالي الرسوم: <b style={{ color: '#0F2744' }}>{fmt(detail.counts?.fees_total ?? 0)}</b></span>
                      <span style={{ color: '#667' }}>المحصّل: <b style={{ color: '#1A7A45' }}>{fmt(detail.counts?.fees_paid ?? 0)}</b></span>
                    </div>
                  </div>
                  <div style={cardS}>
                    <b style={{ color: '#0F2744' }}>الاشتراك</b>
                    <div style={{ fontSize: 13.5, color: '#556', marginTop: 8 }}>
                      الباقة: {detail.subscription?.plan ?? '—'} · الحالة: {detail.subscription?.status ?? '—'}
                    </div>
                  </div>
                  {detail.users?.length > 0 && (
                    <div style={cardS}>
                      <b style={{ color: '#0F2744' }}>المستخدمون ({detail.users.length})</b>
                      {detail.users.map((u: any, i: number) => (
                        <div key={u.id ?? i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F4F6FA', fontSize: 13.5, gap: 8 }}>
                          <span style={{ flex: 1 }}>
                            {u.full_name} <span style={{ color: '#8A94A6', fontSize: 12 }}>({u.role})</span>
                            {u.phone && <span style={{ color: '#9AA7B8', fontSize: 11.5, display: 'block' }} dir="ltr">{u.phone}</span>}
                          </span>
                          <span style={{ color: u.active ? '#1A7A45' : '#C0392B', fontSize: 12, fontWeight: 600, minWidth: 44 }}>
                            {u.active ? 'نشط' : 'موقوف'}
                          </span>
                          {u.role !== 'owner' ? (
                            u.active ? (
                              <button onClick={() => toggleUser(u.id, false)} disabled={busy}
                                style={{ background: '#fff', color: '#C0392B', border: '1px solid #EAD1CC', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                إيقاف
                              </button>
                            ) : (
                              <button onClick={() => toggleUser(u.id, true)} disabled={busy}
                                style={{ background: '#E6F4EC', color: '#1A7A45', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                تفعيل
                              </button>
                            )
                          ) : (
                            <span style={{ fontSize: 11, color: '#9AA7B8', minWidth: 56, textAlign: 'center' }}>المدير</span>
                          )}
                        </div>
                      ))}
                      <p style={{ fontSize: 12, color: '#8A94A6', marginTop: 10 }}>💡 لا يمكن إيقاف مدير المدرسة حمايةً للوصول. كل عملية تُسجّل في سجل التدقيق.</p>
                    </div>
                  )}
                </>
              )}

              {tab === 'edit' && (
                <div style={cardS}>
                  <b style={{ color: '#0F2744', display: 'block', marginBottom: 14 }}>تعديل بيانات المدرسة (معالجة)</b>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>اسم المدرسة</label>
                  <input style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <label style={{ fontSize: 13, fontWeight: 600 }}>الهاتف</label>
                  <input style={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  <label style={{ fontSize: 13, fontWeight: 600 }}>البريد</label>
                  <input style={input} dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <label style={{ fontSize: 13, fontWeight: 600 }}>العنوان</label>
                  <input style={input} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                  <button onClick={saveEdit} disabled={busy} style={{ background: '#D4A017', color: '#08172B', border: 'none', borderRadius: 10, padding: '11px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {busy ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
                  </button>
                  <p style={{ fontSize: 12, color: '#8A94A6', marginTop: 10 }}>💡 كل تعديل يُسجّل في سجل تدقيق المدرسة بشفافية.</p>
                </div>
              )}

              {tab === 'audit' && (
                <div style={cardS}>
                  <b style={{ color: '#0F2744', display: 'block', marginBottom: 12 }}>سجل عمليات المدرسة ({audit.length})</b>
                  {audit.length === 0 ? <div style={{ color: '#8A94A6' }}>لا عمليات</div> : audit.map((a) => (
                    <div key={a.id} style={{ padding: '9px 0', borderBottom: '1px solid #F4F6FA', fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <b style={{ color: '#0F2744' }}>{a.action}</b>
                        <span style={{ color: '#9AA7B8', fontSize: 11.5 }}>{a.created_at?.slice(0, 10)}</span>
                      </div>
                      <div style={{ color: '#667', fontSize: 12.5 }}>{a.actor_name} {a.details ? '· ' + a.details : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div style={{ background: '#F7F9FC', borderRadius: 10, padding: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#0F2744' }}>{v}</div>
      <div style={{ fontSize: 12, color: '#8A94A6' }}>{label}</div>
    </div>
  )
}
