'use client'
// app/(app)/InvoiceButton.tsx
// زرّ تنزيل فاتورة PDF فوري — يُستخدم في صفحة الرسوم وبوابة ولي الأمر.
import { useState } from 'react'
import { generateInvoicePDF, type InvoiceData } from '@/lib/invoice-pdf'

export default function InvoiceButton({ data, label = 'تنزيل الفاتورة PDF' }: {
  data: InvoiceData
  label?: string
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function handle() {
    setBusy(true); setErr('')
    try {
      await generateInvoicePDF(data)
    } catch {
      setErr('تعذّر إنشاء الفاتورة، حاول مجدداً')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button
        onClick={handle}
        disabled={busy}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#1E5C4E', color: '#fff', border: 'none',
          borderRadius: 10, padding: '9px 16px', fontWeight: 600, fontSize: 14,
          cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? (
          <span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'ivspin .7s linear infinite' }} />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
        )}
        {busy ? 'جارٍ الإنشاء…' : label}
      </button>
      {err && <span style={{ color: '#B42318', fontSize: 12 }}>{err}</span>}
      <style>{`@keyframes ivspin{to{transform:rotate(360deg)}}`}</style>
    </span>
  )
}
