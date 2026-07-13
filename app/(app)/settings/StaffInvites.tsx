'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

type Invite = { id: string; email: string; role: string; full_name: string | null; status: string }

export default function StaffInvites() {
  const supabase = createClient()
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [f, setF] = useState({ email: '', role: 'accountant', full_name: '' })

  async function load() {
    const { data } = await supabase.from('staff_invites')
      .select('id, email, role, full_name, status').order('created_at', { ascending: false })
    setInvites(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function invite() {
    setErr(null); setOk(null)
    if (!f.email.trim()) { setErr('البريد مطلوب'); return }
    setSaving(true)
    const { error } = await supabase.rpc('invite_staff', {
      p_email: f.email, p_role: f.role, p_full_name: f.full_name || null,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setOk('تمت الدعوة. أخبر الشخص بتسجيل حساب بنفس البريد، وسيُربط تلقائياً بدوره.')
    setF({ email: '', role: 'accountant', full_name: '' })
    load()
  }

  async function remove(id: string) {
    await supabase.from('staff_invites').delete().eq('id', id)
    load()
  }

  const roleLabel = (r: string) => r === 'admin' ? 'إداري' : r === 'accountant' ? 'محاسب' : r
  const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#0F2744', marginBottom: 5, display: 'block' }
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #E3E8EE', fontSize: 14, fontFamily: 'inherit' }

  return (
    <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 18, padding: 24, marginTop: 18 }}>
      <h3 style={{ color: '#0F2744', margin: '0 0 6px', fontSize: 18 }}>طاقم المدرسة (محاسب / إداري)</h3>
      <p style={{ color: '#667', fontSize: 13, margin: '0 0 18px' }}>
        ادعُ أعضاء طاقمك ببريدهم. يسجّلون حساباً بنفس البريد، فيُربطون تلقائياً بدورهم في مدرستك.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 220px' }}>
          <label style={label}>بريد العضو *</label>
          <input style={input} value={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} placeholder="staff@email.com" dir="ltr" />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={label}>الاسم</label>
          <input style={input} value={f.full_name} onChange={(e) => setF((p) => ({ ...p, full_name: e.target.value }))} placeholder="الاسم الكامل" />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label style={label}>الدور</label>
          <select style={input} value={f.role} onChange={(e) => setF((p) => ({ ...p, role: e.target.value }))}>
            <option value="accountant">محاسب</option>
            <option value="admin">إداري</option>
          </select>
        </div>
        <button onClick={invite} disabled={saving}
          style={{ background: saving ? '#8AA' : '#163B68', color: '#fff', border: 0, padding: '11px 24px', borderRadius: 11, fontWeight: 800, fontSize: 14, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', height: 42 }}>
          {saving ? '…' : 'دعوة'}
        </button>
      </div>

      {err && <div style={{ color: '#C0392B', marginTop: 12, fontWeight: 600, fontSize: 14 }}>⚠ {err}</div>}
      {ok && <div style={{ color: '#067647', marginTop: 12, fontWeight: 600, fontSize: 14 }}>✓ {ok}</div>}

      <div style={{ marginTop: 20 }}>
        {loading ? <div style={{ color: '#667', fontSize: 14 }}>جارٍ التحميل…</div>
          : invites.length === 0 ? <div style={{ color: '#8A94A6', fontSize: 14 }}>لا أعضاء بعد.</div>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'right', color: '#667', fontSize: 12 }}>
                  <th style={{ padding: '8px 6px' }}>البريد</th>
                  <th style={{ padding: '8px 6px' }}>الاسم</th>
                  <th style={{ padding: '8px 6px' }}>الدور</th>
                  <th style={{ padding: '8px 6px' }}>الحالة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invites.map((v) => (
                  <tr key={v.id} style={{ borderTop: '1px solid #F2F5F8' }}>
                    <td style={{ padding: '10px 6px', direction: 'ltr', textAlign: 'right' }}>{v.email}</td>
                    <td style={{ padding: '10px 6px' }}>{v.full_name ?? '—'}</td>
                    <td style={{ padding: '10px 6px' }}>{roleLabel(v.role)}</td>
                    <td style={{ padding: '10px 6px' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 100,
                        background: v.status === 'accepted' ? '#E4F7EF' : '#FFF6E6',
                        color: v.status === 'accepted' ? '#067647' : '#B54708' }}>
                        {v.status === 'accepted' ? 'مفعّل' : 'بانتظار التسجيل'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 6px', textAlign: 'left' }}>
                      <button onClick={() => remove(v.id)} style={{ background: 'none', border: 0, color: '#C0392B', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>حذف</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}
