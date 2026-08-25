'use client'
// دعوة أولياء الأمور لتفعيل حساباتهم — ترسل عبر رقم واتساب المدرسة الرسمي (Twilio API)
// يُحفظ تاريخ آخر إرسال في قاعدة البيانات (guardian_invites) — يبقى ظاهراً حتى بعد إغلاق الصفحة،
// حتى يسجّل ولي الأمر فعلياً (عندها يختفي تلقائياً من القائمة عبر unlinked_guardians).
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { MessageCircle, Copy, Check, Users, RefreshCw } from 'lucide-react'

type Guardian = {
  phone: string
  guardian_name: string
  children_count: number
  children: string
  invited_at: string | null
}

export default function InviteParents({ schoolName }: { schoolName?: string }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<Guardian[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)

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

  function messageFor(g: Guardian): string {
    const raw = (schoolName || '').trim()
    const school = raw ? (raw.startsWith('مدرسة') ? raw : `مدرسة ${raw}`) : 'مدرستكم'
    const kids = g.children_count === 1 ? 'ابنكم/ابنتكم' : `أبنائكم (${g.children_count})`
    return (
      `السلام عليكم ${g.guardian_name}\n\n` +
      `يسرّ ${school} دعوتكم لتفعيل حسابكم في بوابة أولياء الأمور، لمتابعة رسوم ${kids} وفواتيرهم إلكترونياً.\n\n` +
      `للتسجيل:\n${registerUrl}\n\n` +
      `أدخلوا رقم هاتفكم هذا (${g.phone.replace(/^968/, '')}) — سيربط النظام حسابكم بأبنائكم تلقائياً.`
    )
  }

  // يحوّل الأرقام العربية-هندية (٠-٩) إلى إنجليزية
  function toEnglishDigits(s: string): string {
    return s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  }

  // رموز دول الخليج وطول الرقم المحلي المتوقع بعد الرمز
  const GCC_CODES: Record<string, number> = {
    '968': 8, // عُمان
    '971': 9, // الإمارات
    '966': 9, // السعودية
    '965': 8, // الكويت
    '973': 8, // البحرين
    '974': 8, // قطر
  }

  // تطبيع صارم لرقم هاتف خليجي: يعيد null صراحة إذا كان الرقم غير صالح
  // بدل تمرير رقم مشوّه لـ Twilio يفشل بصمت. يقبل:
  //   - رقم يبدأ برمز دولة خليجي صريح ويطابق الطول المحلي المتوقع لتلك الدولة
  //   - أو 8 خانات بدون رمز دولة → يُفترض عُماني (الحالة الافتراضية التاريخية لقاعدة بياناتنا)
  // ملاحظة: رقم محلي بدون رمز دولة من غير عُمان (مثال: إماراتي مكتوب كـ 0501234567)
  // لا يمكن تمييزه تقنياً عن رقم عُماني ناقص — الحل الصحيح لهذا يتطلب حقل "الدولة"
  // منفصلاً في بيانات ولي الأمر، وهو خارج نطاق هذه الدالة.
  function normalizePhone(raw: string): string | null {
    let p = toEnglishDigits(raw || '').replace(/[\s\-()]/g, '')
    if (p.startsWith('+')) p = p.slice(1)
    if (p.startsWith('00')) p = p.slice(2)
    p = p.replace(/\D/g, '') // إزالة أي حرف غير رقمي متبقٍ

    for (const [code, localLen] of Object.entries(GCC_CODES)) {
      if (p.startsWith(code) && p.length === code.length + localLen) return p
    }

    if (p.length === 8) return '968' + p // بدون رمز دولة: افتراض عُماني فقط

    return null // رقم غير صالح أو رقم محلي من دولة خليجية أخرى بلا رمز دولة
  }

  // يزيل رمز الدولة الخليجي (أياً كان) من رقم مطبَّع مسبقاً، لعرضه كرقم محلي
  function stripGccCode(normalized: string): string {
    for (const code of Object.keys(GCC_CODES)) {
      if (normalized.startsWith(code)) return normalized.slice(code.length)
    }
    return normalized
  }

  async function copyMsg(g: Guardian) {
    try {
      await navigator.clipboard.writeText(messageFor(g))
      setCopied(g.phone)
      setTimeout(() => setCopied(null), 1800)
    } catch { /* المتصفح منع النسخ */ }
  }

  // إرسال عبر رقم المدرسة الرسمي (Twilio) + تسجيل وقت الإرسال في قاعدة البيانات (يبقى دائماً)
  // ملاحظة: نستخدم قالب واتساب معتمد (Content API) وليس نصاً حراً — لأن أولياء الأمور
  // الذين لم يفعّلوا حسابهم بعد لم يراسلوا رقم المدرسة من قبل، فهم خارج نافذة الـ24 ساعة
  // التي يسمح فيها واتساب بالنص الحر. القالب هو الطريقة الصحيحة الوحيدة لأول تواصل.
  async function sendInvite(g: Guardian) {
    const normalized = normalizePhone(g.phone)
    if (!normalized) {
      alert(`رقم هاتف غير صالح لولي الأمر "${g.guardian_name}": ${g.phone}\nصحح الرقم في بيانات الطالب أولاً (يجب أن يكون 8 أرقام عُمانية أو رقم خليجي كامل برمز الدولة).`)
      return
    }
    setSending(g.phone)
    try {
      const to = `+${normalized}`
      const res = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          template: 'parent_invite',
          variables: {
            // {{1}} = اسم المدرسة — التطبيع (إزالة بادئة "مدرسة") يتم مركزياً في /api/send-whatsapp
            '1': schoolName || 'مدرستكم',
            // {{2}} = رقم محلي بدون رمز الدولة — أيا كانت دولة الخليج
            '2': stripGccCode(normalized),
          },
        }),
      })
      const data = await res.json()
      if (data.success) {
        // تحذير إذا قبِل Twilio الطلب لكن حالة التسليم غير مبشّرة
        if (data.status && !['queued', 'sent', 'delivered', 'accepted'].includes(data.status)) {
          alert(`تم إرسال الطلب لكن حالته: ${data.status}\nSID: ${data.sid}\nراجع Twilio → Monitor → Logs → Messages وابحث عن هذا SID`)
        } else {
          alert('تم الإرسال بنجاح ✅')
        }
        // تسجيل دائم في قاعدة البيانات — يبقى حتى لو أُغلقت الصفحة
        await supabase.rpc('mark_guardian_invited', { p_phone: g.phone })
        setList((prev) => prev.map((x) => x.phone === g.phone ? { ...x, invited_at: new Date().toISOString() } : x))
      } else {
        // نعرض رمز خطأ Twilio إن وُجد — يساعد على التشخيص السريع
        // (63016 = خارج نافذة 24 ساعة، 63040 = قالب مرفوض/غير معتمد، 21211 = رقم غير صالح)
        const code = data.code ? ` (رمز ${data.code})` : ''
        alert('فشل الإرسال: ' + (data.error || 'خطأ غير معروف') + code)
      }
    } catch {
      alert('تعذّر الاتصال بالخادم، حاول مجدداً')
    } finally {
      setSending(null)
    }
  }

  // نص نسبي لوقت آخر دعوة ("اليوم"، "أمس"، "منذ 5 أيام"...)
  function invitedLabel(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime()
    const days = Math.floor(diffMs / 86400000)
    if (days <= 0) return 'اليوم'
    if (days === 1) return 'أمس'
    return `منذ ${days} أيام`
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
        هؤلاء أولياء أمور لم يُفعّلوا حساباتهم بعد. اضغط زر واتساب — تُرسل الدعوة مباشرة
        من رقم المدرسة الرسمي في المنظومة. <b>لا حاجة لاستخدام واتساب هاتفك الشخصي.</b>
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
            const isSending = sending === g.phone
            const wasInvited = !!g.invited_at
            return (
              <div key={g.phone} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px',
                borderTop: i === 0 ? 'none' : '1px solid #F2F5F8',
                background: wasInvited ? '#FBFAF5' : '#fff',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: '#0F2744' }}>
                    {g.guardian_name}
                    <span style={{ color: '#8A94A6', fontWeight: 400, fontSize: 12.5 }}> · {g.phone}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#667', marginTop: 2 }}>
                    {g.children_count} {g.children_count === 1 ? 'ابن' : 'أبناء'} — {g.children}
                  </div>
                  {wasInvited && (
                    <div style={{ fontSize: 11.5, color: '#B54708', marginTop: 4, fontWeight: 600 }}>
                      ⏱ تم إرسال دعوة {invitedLabel(g.invited_at as string)} — لم يُفعّل الحساب بعد
                    </div>
                  )}
                </div>

                <button onClick={() => copyMsg(g)} title="نسخ نصّ الرسالة"
                  style={{ flexShrink: 0, background: '#F2F5F8', border: '1px solid #E3E8EE', borderRadius: 9, padding: '8px 10px', cursor: 'pointer', color: copied === g.phone ? '#15803D' : '#475569', display: 'grid', placeItems: 'center' }}>
                  {copied === g.phone ? <Check size={16} strokeWidth={2.4} /> : <Copy size={16} strokeWidth={2} />}
                </button>

                <button
                  onClick={() => sendInvite(g)}
                  disabled={isSending}
                  style={{
                    flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: wasInvited ? '#FFF6ED' : '#25D366',
                    color: wasInvited ? '#B54708' : '#fff',
                    border: wasInvited ? '1px solid #F3D9B0' : 'none',
                    borderRadius: 9, padding: '9px 15px',
                    fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
                    cursor: isSending ? 'default' : 'pointer',
                    opacity: isSending ? 0.7 : 1,
                    fontFamily: 'inherit',
                  }}>
                  <MessageCircle size={16} strokeWidth={2.2} />
                  {isSending ? 'جارٍ الإرسال…' : wasInvited ? 'إعادة الإرسال' : 'إرسال واتساب'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ fontSize: 12, color: '#8A94A6', marginTop: 12, lineHeight: 1.8 }}>
        💡 يختفي ولي الأمر من القائمة تلقائياً بمجرّد تسجيله. القائمة تُبقي "تم الإرسال" ظاهراً
        حتى يفعّل حسابه فعلياً — حتى لو أعدت فتح هذه الصفحة لاحقاً.
      </div>
    </div>
  )
}
      
