'use client'
// دعوة أولياء الأمور لتفعيل حساباتهم — عبر واتساب برسالة جاهزة.
// لا إرسال تلقائي: يفتح محادثة واتساب بنصّ معدّ، والإداري يضغط إرسال.
// هذا يجعل الدعوة مجانية وفورية، ويناسب سلوك المستخدم الخليجي.
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { MessageCircle, Copy, Check, Users, RefreshCw } from 'lucide-react'

type Guardian = {
  phone: string
  guardian_name: string
  children_count: number
  children: string
}

export default function InviteParents({ schoolName }: { schoolName?: string }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<Guardian[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [sent, setSent] = useState<Set<string>>(new Set())

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://rusoompay.com'
  const registerUrl = `${siteUrl}/parent-register`

  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc('unlinked_guardians')
    const res = (data ?? {}) as { ok?: boolean; guardians?: Guardian[] }
    setList(res.ok && res.guardians ? res.guardians : [])
    setLoading(false)
  }

  useEffect(() => { if (open) load() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // نصّ الرسالة — واضح، بلا حشو، يشرح الخطوة الواحدة المطلوبة
  function messageFor(g: Guardian): string {
    const school = schoolName ? `مدرسة ${schoolName}` : 'مدرستكم'
    const kids = g.children_count === 1 ? 'ابنكم/ابنتكم' : `أبنائكم (${g.children_count})`
    return (
      `السلام عليكم ${g.guardian_name}\n\n` +
      `يسرّ ${school} دعوتكم لتفعيل حسابكم في بوابة أولياء الأمور، لمتابعة رسوم ${kids} وفواتيرهم إلكترونياً.\n\n` +
      `للتسجيل:\n${registerUrl}\n\n` +
      `أدخلوا رقم هاتفكم هذا (${g.phone.replace(/^968/, '')}) — سيربط النظام حسابكم بأبنائكم تلقائياً.`
    )
  }

  function waLink(g: Guardian): string {
    return `https://wa.me/${g.phone}?text=${encodeURIComponent(messageFor(g))}`
  }

  async function copyMsg(g: Guardian) {
    try {
      await navigator.clipboard.writeText(messageFor(g))
      setCopied(g.phone)
      setTimeout(() => setCopied(null), 1800)
    } catch { /* المتصفح منع النسخ */ }
  }

  function markSent(phone: string) {
    setSent((prev) => new Set(prev).add(phone))
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ background: '#F2F5F8', color: '#0F2744', border: '1px solid #E3E8EE', padding: '10px 18px', borderRadius: 11, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <MessageCircle size={17} strokeWidth={2} /> دعوة أولياء الأمور
      </button>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 16, padding: 22, marginBottom: 16, boxShadow: '0 10px 30px -18px rgba(10,37,64,.3)' }} dir="rtl">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <b style={{ color: '#0F2744', fontSize: 16 }}>دعوة أولياء الأمور لتفعيل حساباتهم</b>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 0, fontSize: 21, cursor: 'pointer', color: '#667' }}>×</button>
      </div>
      <p style={{ color: '#667', fontSize: 13.5, margin: '0 0 16px', lineHeight: 1.85 }}>
        هؤلاء أولياء أمور لم يُفعّلوا حساباتهم بعد. اضغط زر واتساب — تُفتح المحادثة برسالة جاهزة،
        وأنت تضغط إرسال. <b>لا يُرسل شيء تلقائياً.</b>
      </p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <button onClick={load} disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F2F5F8', border: '1px solid #E3E8EE', borderRadius: 9, padding: '7px 13px', fontSize: 13, fontWeight: 600, color: '#0F2744', cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          <RefreshCw size={14} strokeWidth={2} /> تحديث القائمة
        </button>
        {!loading && (
          <span style={{ fontSize: 13, color: '#667', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Users size={15} strokeWidth={2} /> {list.length} ولي أمر
          </span>
        )}
      </div>

      {loading && <div style={{ color: '#8A94A6', fontSize: 14, padding: '14px 0' }}>جارٍ التحميل…</div>}

      {!loading && list.length === 0 && (
        <div style={{ background: '#EAF7F0', border: '1px solid #BFE5D0', borderRadius: 12, padding: '16px 18px', color: '#15803D', fontSize: 14, fontWeight: 600 }}>
          ✓ كل أولياء الأمور فعّلوا حساباتهم — لا دعوات معلّقة.
        </div>
      )}

      {!loading && list.length > 0 && (
        <div style={{ border: '1px solid #EEF1F5', borderRadius: 12, overflow: 'hidden', maxHeight: 420, overflowY: 'auto' }}>
          {list.map((g, i) => {
            const isSent = sent.has(g.phone)
            return (
              <div key={g.phone} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px',
                borderTop: i === 0 ? 'none' : '1px solid #F2F5F8',
                background: isSent ? '#F7FBF9' : '#fff',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: '#0F2744' }}>
                    {g.guardian_name}
                    <span style={{ color: '#8A94A6', fontWeight: 400, fontSize: 12.5 }}> · {g.phone}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#667', marginTop: 2 }}>
                    {g.children_count} {g.children_count === 1 ? 'ابن' : 'أبناء'} — {g.children}
                  </div>
                </div>

                <button onClick={() => copyMsg(g)} title="نسخ نصّ الرسالة"
                  style={{ flexShrink: 0, background: '#F2F5F8', border: '1px solid #E3E8EE', borderRadius: 9, padding: '8px 10px', cursor: 'pointer', color: copied === g.phone ? '#15803D' : '#475569', display: 'grid', placeItems: 'center' }}>
                  {copied === g.phone ? <Check size={16} strokeWidth={2.4} /> : <Copy size={16} strokeWidth={2} />}
                </button>

                <a href={waLink(g)} target="_blank" rel="noopener noreferrer" onClick={() => markSent(g.phone)}
                  style={{
                    flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: isSent ? '#EAF7F0' : '#25D366', color: isSent ? '#15803D' : '#fff',
                    border: isSent ? '1px solid #BFE5D0' : 0,
                    borderRadius: 9, padding: '9px 15px', textDecoration: 'none',
                    fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
                  }}>
                  <MessageCircle size={16} strokeWidth={2.2} />
                  {isSent ? 'أُرسلت' : 'واتساب'}
                </a>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ fontSize: 12, color: '#8A94A6', marginTop: 12, lineHeight: 1.8 }}>
        💡 يختفي ولي الأمر من القائمة تلقائياً بمجرّد تسجيله. اضغط «تحديث القائمة» للتحقّق.
      </div>
    </div>
  )
}
