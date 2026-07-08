'use client'
// مكوّن الدعم والملاحظات التفاعلي — إرسال شكوى + عرض السجلّ
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type FB = {
  id: string; kind: string; priority: string; body: string
  status: string; reply: string | null; created_at: string
}

const KIND_LABEL: Record<string, string> = {
  complaint: 'شكوى', bug: 'مشكلة في البرنامج', suggestion: 'اقتراح / تحسين', question: 'استفسار',
}
const PRIORITY_LABEL: Record<string, string> = {
  normal: 'عادية', important: 'مهمة', urgent: 'عاجلة',
}

export default function FeedbackClient({ initialItems }: { initialItems: FB[] }) {
  const supabase = createClient()
  const [items, setItems] = useState<FB[]>(initialItems)
  const [kind, setKind] = useState('complaint')
  const [priority, setPriority] = useState('normal')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function submit() {
    if (!body.trim()) { setMsg('يرجى كتابة تفاصيل البلاغ'); return }
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('submit_feedback', {
      p_kind: kind, p_priority: priority, p_body: body.trim(),
    })
    if (error) { setMsg('تعذّر الإرسال: ' + error.message); setBusy(false); return }
    // إعادة جلب السجلّ
    const { data } = await supabase.rpc('my_school_feedback')
    setItems(data || [])
    setBody(''); setMsg('✓ تم إرسال بلاغك لفريق RusoomPay'); setBusy(false)
  }

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid #E6EBF1', borderRadius: 14,
    padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.05)',
  }
  const field: React.CSSProperties = { marginBottom: 14 }
  const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#445', marginBottom: 6 }
  const input: React.CSSProperties = {
    width: '100%', padding: 11, borderRadius: 10, border: '1.5px solid #DDE3EC',
    fontFamily: 'inherit', fontSize: 14, background: '#fff',
  }

  return (
    <>
      <div style={card}>
        <h3 style={{ margin: '0 0 4px', color: '#0F2744' }}>💬 إرسال شكوى أو ملاحظة</h3>
        <p style={{ fontSize: 13, color: '#667', margin: '0 0 16px' }}>
          بلاغك يصل مباشرة لفريق منصة RusoomPay ويظهر في مركز تحكّم المنصة
        </p>
        <div style={field}>
          <label style={label}>نوع البلاغ</label>
          <select style={input} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="complaint">شكوى</option>
            <option value="bug">مشكلة في البرنامج</option>
            <option value="suggestion">اقتراح / تحسين</option>
            <option value="question">استفسار</option>
          </select>
        </div>
        <div style={field}>
          <label style={label}>الأولوية</label>
          <select style={input} value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="normal">عادية</option>
            <option value="important">مهمة</option>
            <option value="urgent">عاجلة</option>
          </select>
        </div>
        <div style={field}>
          <label style={label}>التفاصيل</label>
          <textarea style={{ ...input, minHeight: 96, resize: 'vertical' }} rows={4}
            placeholder="اكتب شكواك أو ملاحظتك بالتفصيل..."
            value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        {msg && <div style={{ fontSize: 13, marginBottom: 12, color: msg.startsWith('✓') ? '#1A7A45' : '#C0392B' }}>{msg}</div>}
        <button onClick={submit} disabled={busy}
          style={{
            width: '100%', padding: 13, borderRadius: 11, border: 'none', cursor: busy ? 'wait' : 'pointer',
            background: '#D4A017', color: '#08172B', fontWeight: 700, fontSize: 15, fontFamily: 'inherit',
          }}>
          {busy ? 'جارٍ الإرسال...' : 'إرسال البلاغ'}
        </button>
      </div>

      {items.length > 0 && (
        <div style={{ ...card, marginTop: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#0F2744' }}>بلاغاتك السابقة ({items.length})</h3>
          {items.map((f) => (
            <div key={f.id} style={{ padding: '12px 0', borderBottom: '1px solid #F2F5F8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <b style={{ fontSize: 14, color: '#0F2744' }}>
                  {KIND_LABEL[f.kind] || f.kind} · {PRIORITY_LABEL[f.priority] || f.priority}
                </b>
                <span style={{
                  background: f.status === 'closed' ? '#E6F4EC' : '#FBF3D5',
                  color: f.status === 'closed' ? '#1A7A45' : '#8A6D0F',
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                }}>{f.status === 'closed' ? 'مغلق' : 'مفتوح'}</span>
              </div>
              <div style={{ fontSize: 13, color: '#556', marginTop: 5 }}>{f.body}</div>
              {f.reply && (
                <div style={{ fontSize: 13, color: '#2E5EA8', marginTop: 6, background: '#EEF3FA', padding: 8, borderRadius: 8 }}>
                  ردّ RusoomPay: {f.reply}
                </div>
              )}
              <div style={{ fontSize: 11, color: '#9AA7B8', marginTop: 4 }}>
                {new Date(f.created_at).toLocaleDateString('en-GB')}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
