'use client'
// إدارة الفروع — للمالك فقط. تعرض كل الفروع (المدارس) التي يملك فيها عضوية
// فعّالة، وتتيح إضافة فرع جديد عبر add_branch() (ينشئ منظمة تلقائياً عند أول
// فرع إضافي، وينسخ شجرة الحسابات من الفرع الحالي).
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Building2, Plus, CheckCircle2 } from 'lucide-react'

type BranchRow = {
  school_id: string
  school_name: string
  branch: string | null
  role: string
  is_active_context: boolean
}

const roleLabel: Record<string, string> = {
  owner: 'مالك', admin: 'إداري', accountant: 'محاسب',
  parent: 'ولي أمر', student: 'طالب', platform_admin: 'مدير المنصة',
}

export default function BranchManager() {
  const supabase = createClient()
  const [branches, setBranches] = useState<BranchRow[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [branch, setBranch] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('my_schools')
    setBranches((data as BranchRow[]) ?? [])
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true); setMsg(null)
    const { error } = await supabase.rpc('add_branch', {
      p_name: name.trim(),
      p_branch: branch.trim() || null,
    })
    setBusy(false)
    if (error) {
      setMsg({ ok: false, text: 'تعذّرت إضافة الفرع: ' + error.message })
      return
    }
    setMsg({ ok: true, text: `تمت إضافة فرع «${name.trim()}» بنجاح.` })
    setName(''); setBranch(''); setShowForm(false)
    load()
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 16, padding: 22 }} dir="rtl">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Building2 size={20} color="#0F2744" strokeWidth={2} />
        <b style={{ color: '#0F2744', fontSize: 16 }}>الفروع</b>
      </div>
      <p style={{ color: '#667', fontSize: 13.5, margin: '0 0 16px', lineHeight: 1.85 }}>
        كل فرع مدرسة مستقلة تماماً (طلابها، رسومها، حساباتها) — يمكنك التنقّل بينها من الشريط الجانبي بمجرد إضافة أكثر من فرع.
      </p>

      {branches === null ? (
        <div style={{ color: '#8A94A6', fontSize: 13.5 }}>جارٍ التحميل…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {branches.map((b) => (
            <div key={b.school_id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              border: '1px solid #E3E8EE', borderRadius: 11, padding: '10px 14px',
              background: b.is_active_context ? '#F4F9FF' : '#fff',
            }}>
              <Building2 size={16} strokeWidth={2} style={{ color: '#8A94A6', flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: '#0F2744' }}>
                {b.school_name}{b.branch ? ` — ${b.branch}` : ''}
              </div>
              <span style={{ fontSize: 12, color: '#667', background: '#F0F3F7', borderRadius: 999, padding: '3px 10px' }}>
                {roleLabel[b.role] ?? b.role}
              </span>
              {b.is_active_context && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#15803D', fontWeight: 700 }}>
                  <CheckCircle2 size={14} strokeWidth={2} /> نشط الآن
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {!showForm ? (
        <button onClick={() => setShowForm(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#163B68', color: '#fff', border: 0,
            padding: '11px 22px', borderRadius: 11, fontWeight: 700, fontSize: 14.5,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
          <Plus size={17} strokeWidth={2} /> إضافة فرع جديد
        </button>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 380 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0F2744', marginBottom: 6 }}>اسم المدرسة</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              placeholder="مثال: مدارس النور الخاصة"
              style={{ width: '100%', border: '1px solid #E3E8EE', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0F2744', marginBottom: 6 }}>اسم الفرع (اختياري)</label>
            <input value={branch} onChange={(e) => setBranch(e.target.value)}
              placeholder="مثال: نزوى"
              style={{ width: '100%', border: '1px solid #E3E8EE', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={busy}
              style={{
                background: busy ? '#8AA' : '#163B68', color: '#fff', border: 0,
                padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 14,
                cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
              }}>
              {busy ? 'جارٍ الإضافة…' : 'إضافة الفرع'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setMsg(null) }}
              style={{ background: '#F0F3F7', color: '#0F2744', border: 0, padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              إلغاء
            </button>
          </div>
        </form>
      )}

      {msg && (
        <div style={{
          marginTop: 14, borderRadius: 10, padding: '11px 14px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.7,
          background: msg.ok ? '#EAF7F0' : '#FDECEA',
          border: `1px solid ${msg.ok ? '#BFE5D0' : '#F3C9C2'}`,
          color: msg.ok ? '#15803D' : '#A5331F',
        }}>{msg.text}</div>
      )}
    </div>
  )
}
