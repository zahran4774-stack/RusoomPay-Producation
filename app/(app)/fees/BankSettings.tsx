'use client'
// إعدادات الحساب البنكي للمدرسة — للمدير فقط
// يُربط بخيارات دفع رسوم الطلاب: عند تفعيله، يرى ولي الأمر هذا الحساب للتحويل
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

type Bank = {
  bank_name: string | null; bank_account: string | null
  bank_iban: string | null; bank_holder: string | null; bank_enabled: boolean
}

export default function BankSettings({ bank }: { bank: Bank }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({
    bank_name: bank.bank_name ?? '', bank_account: bank.bank_account ?? '',
    bank_iban: bank.bank_iban ?? '', bank_holder: bank.bank_holder ?? '',
    enabled: bank.bank_enabled,
  })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string | boolean) => setF({ ...f, [k]: v })

  async function save() {
    setMsg('')
    if (f.enabled && !f.bank_account.trim()) { setMsg('لا يمكن تفعيل الدفع بلا رقم حساب'); return }
    setBusy(true)
    const { error } = await supabase.rpc('update_school_bank', {
      p_bank_name: f.bank_name, p_bank_account: f.bank_account,
      p_bank_iban: f.bank_iban, p_bank_holder: f.bank_holder, p_enabled: f.enabled,
    })
    setBusy(false)
    if (error) { setMsg('تعذّر الحفظ: ' + error.message); return }
    setMsg('✓ تم حفظ بيانات الحساب البنكي')
    setOpen(false)
    router.refresh()
  }

  const configured = bank.bank_account && bank.bank_enabled
  const inp = { width: '100%', padding: 11, margin: '5px 0 14px', borderRadius: 10, border: '1.5px solid #DDE3EC', fontFamily: 'inherit', fontSize: 14 }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 18, marginBottom: 18, boxShadow: '0 1px 4px rgba(0,0,0,.08)', border: configured ? '1px solid #BFE3CD' : '1px solid #F0D9A8' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, color: '#0F2744', display: 'flex', alignItems: 'center', gap: 8 }}>
            🏦 حساب المدرسة لتحصيل الرسوم
            {configured
              ? <span style={{ background: '#E6F4EC', color: '#1A7A45', fontSize: 12, fontWeight: 700, padding: '3px 11px', borderRadius: 99 }}>مُفعّل</span>
              : <span style={{ background: '#FBF3D5', color: '#8A6D0F', fontSize: 12, fontWeight: 700, padding: '3px 11px', borderRadius: 99 }}>غير مُفعّل</span>}
          </div>
          <div style={{ fontSize: 13, color: '#667', marginTop: 4 }}>
            {configured
              ? `${bank.bank_name || 'بنك'} · ${bank.bank_account}`
              : 'أضف حساب مدرستك ليتمكّن أولياء الأمور من تحويل الرسوم إليه مباشرة'}
          </div>
        </div>
        <button onClick={() => { setOpen(!open); setMsg('') }}
          style={{ background: '#163B68', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          {open ? 'إغلاق' : configured ? 'تعديل' : 'إضافة حساب'}
        </button>
      </div>

      {msg && <div style={{ marginTop: 12, padding: 10, borderRadius: 9, fontSize: 14, background: msg.startsWith('✓') ? '#E6F4EC' : '#FCE9E6', color: msg.startsWith('✓') ? '#1A7A45' : '#C0392B' }}>{msg}</div>}

      {open && (
        <div style={{ marginTop: 16, borderTop: '1px solid #EEF2F1', paddingTop: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>اسم البنك</label>
          <input value={f.bank_name} onChange={(e) => set('bank_name', e.target.value)} placeholder="مثال: بنك مسقط" style={inp} />

          <label style={{ fontSize: 13, fontWeight: 600 }}>رقم الحساب *</label>
          <input value={f.bank_account} onChange={(e) => set('bank_account', e.target.value)} placeholder="رقم حساب المدرسة" style={{ ...inp, direction: 'ltr', textAlign: 'right' }} />

          <label style={{ fontSize: 13, fontWeight: 600 }}>الآيبان (IBAN)</label>
          <input value={f.bank_iban} onChange={(e) => set('bank_iban', e.target.value)} placeholder="OM.. .... ...." style={{ ...inp, direction: 'ltr', textAlign: 'right' }} />

          <label style={{ fontSize: 13, fontWeight: 600 }}>اسم صاحب الحساب</label>
          <input value={f.bank_holder} onChange={(e) => set('bank_holder', e.target.value)} placeholder="اسم المدرسة أو الجهة المالكة" style={inp} />

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: '#F4F8F7', padding: 12, borderRadius: 10, marginBottom: 14 }}>
            <input type="checkbox" checked={f.enabled} onChange={(e) => set('enabled', e.target.checked)} style={{ width: 18, height: 18, accentColor: '#163B68' }} />
            <span style={{ fontSize: 14 }}>تفعيل هذا الحساب في خيارات دفع رسوم الطلاب</span>
          </label>

          <button onClick={save} disabled={busy}
            style={{ width: '100%', padding: 13, background: '#163B68', color: '#fff', border: 'none', borderRadius: 11, fontWeight: 700, cursor: 'pointer' }}>
            {busy ? 'جارٍ الحفظ…' : 'حفظ بيانات الحساب'}
          </button>
        </div>
      )}
    </div>
  )
}
