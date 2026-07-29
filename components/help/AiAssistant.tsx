'use client'

// ============================================================================
// components/help/AiAssistant.tsx
// المساعد الذكي المحادثي لرسوم Pay.
// يفتح كلوحة جانبية، يتصل بـ /api/assistant، ويعرض المحادثة بدعم RTL.
// يعتمد على متغيّر الخط --font-cairo المعرّف في layout.
// لا يعتمد أي مكتبة خارجية — أيقونات SVG مضمّنة.
// يُخفى تلقائياً في صفحات المصادقة (تسجيل الدخول/الإنشاء) — لا يظهر إلا بعد الدخول.
// ============================================================================

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'

type Msg = { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'كم طالب متأخر عن السداد؟',
  'كيف أرسل تذكير دفع؟',
  'كيف أصدّر تقريراً مالياً؟',
  'اشرح لي نسبة التحصيل',
]

// المسارات التي لا يظهر فيها المساعد (صفحات عامة/مصادقة قبل الدخول)
const HIDDEN_PATHS = ['/', '/login', '/signup', '/register', '/forgot-password', '/reset-password', '/auth']

export default function AiAssistant() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()
  const bodyRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // تمرير لأسفل عند كل رسالة جديدة
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [messages, loading])

  // إغلاق بمفتاح Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim()
      if (!clean || loading) return

      setMessages((m) => [...m, { role: 'user', content: clean }])
      setInput('')
      setLoading(true)

      try {
        const res = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: clean, conversationId }),
        })
        // قد تكون الاستجابة ليست JSON (مثل صفحة خطأ 504/502 عند تجاوز المهلة)
        let data: { message?: string; reply?: string; conversationId?: string; error?: string } = {}
        const raw = await res.text()
        try {
          data = raw ? JSON.parse(raw) : {}
        } catch {
          // استجابة غير JSON — الوظيفة انهارت أو تجاوزت المهلة
          data = {}
        }
        if (!res.ok) {
          const msg =
            data?.message ||
            (res.status === 429
              ? 'وصلت الحدّ المسموح مؤقتاً. حاول بعد قليل.'
              : res.status === 504 || res.status === 502
                ? 'الطلب استغرق وقتاً طويلاً. حاول بسؤال أقصر.'
                : `حدث خطأ (${res.status}). حاول مرة أخرى.`)
          setMessages((m) => [...m, { role: 'assistant', content: msg }])
        } else if (!data.reply) {
          setMessages((m) => [
            ...m,
            { role: 'assistant', content: 'لم يصل ردّ صالح. حاول مرة أخرى.' },
          ])
        } else {
          if (data.conversationId) setConversationId(data.conversationId)
          setMessages((m) => [...m, { role: 'assistant', content: data.reply as string }])
        }
      } catch {
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: 'تعذّر الاتصال بالخادم. حاول مجدداً بعد لحظات.' },
        ])
      } finally {
        setLoading(false)
        taRef.current?.focus()
      }
    },
    [conversationId, loading],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  // إخفاء المساعد في صفحات المصادقة/العامة — بعد كل الـ hooks (قاعدة React)
  if (HIDDEN_PATHS.includes(pathname || '')) return null

  return (
    <>
      {/* زر الفتح العائم */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="افتح المساعد الذكي"
          style={S.fab}
        >
          <SparkIcon />
          <span style={S.fabText}>المساعد الذكي</span>
        </button>
      )}

      {/* الغطاء */}
      <div
        onClick={() => setOpen(false)}
        style={{ ...S.scrim, ...(open ? S.scrimOpen : {}) }}
        aria-hidden={!open}
      />

      {/* اللوحة */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="المساعد الذكي"
        style={{ ...S.panel, ...(open ? S.panelOpen : {}) }}
      >
        {/* الرأس */}
        <header style={S.head}>
          <div style={S.headWho}>
            <div style={S.avatar}>
              <SparkIcon />
            </div>
            <div>
              <div style={S.headTitle}>مساعد رسوم Pay</div>
              <div style={S.headStatus}>يعرف بيانات مدرستك</div>
            </div>
          </div>
          <button onClick={() => setOpen(false)} aria-label="إغلاق" style={S.xBtn}>
            ✕
          </button>
        </header>

        {/* جسم المحادثة */}
        <div ref={bodyRef} style={S.body}>
          {messages.length === 0 && (
            <div style={S.welcome}>
              <div style={{ ...S.msg, ...S.msgBot }}>
                مرحباً 👋 أنا مساعد رسوم Pay. أشرح لك أي صفحة في النظام، وأجيب عن أسئلتك
                حول بيانات مدرستك. اسألني ما تشاء.
              </div>
              <div style={S.chips}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} style={S.chip}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                ...S.msg,
                ...(m.role === 'user' ? S.msgUser : S.msgBot),
              }}
            >
              {renderContent(m.content)}
            </div>
          ))}

          {loading && (
            <div style={{ ...S.msg, ...S.msgBot, ...S.typing }}>
              <Dot /> <Dot d={0.2} /> <Dot d={0.4} />
            </div>
          )}
        </div>

        {/* الإدخال */}
        <div style={S.inputBar}>
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="اكتب سؤالك بالعربي…"
            rows={1}
            style={S.textarea}
            disabled={loading}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            aria-label="إرسال"
            style={{
              ...S.send,
              ...(loading || !input.trim() ? S.sendDisabled : {}),
            }}
          >
            ↑
          </button>
        </div>
        <div style={S.foot}>مدعوم بالذكاء الاصطناعي · قد يخطئ، تحقّق من المعلومات المهمة</div>
      </aside>

      <style>{keyframes}</style>
    </>
  )
}

// ---------- تحويل **نص** إلى خطّ عريض فعلي ----------
function renderInline(text: string) {
  // نقسم على **...** ونجعل الأجزاء المحاطة عريضة
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/)
    if (m) {
      return (
        <strong key={i} style={{ fontWeight: 700, color: '#095a4e' }}>
          {m[1]}
        </strong>
      )
    }
    return <span key={i}>{part}</span>
  })
}

// ---------- عرض المحتوى مع دعم أسطر وقوائم بسيطة ----------
function renderContent(text: string) {
  // نتجاهل خطوط الفصل --- ونحوّل ## عناوين لأسطر عادية عريضة
  const lines = text
    .split('\n')
    .filter((l) => l.trim().length > 0 && l.trim() !== '---')
  return lines.map((line, i) => {
    // عنوان ## → سطر عريض
    const heading = line.match(/^\s*#{1,4}\s+(.*)$/)
    if (heading) {
      return (
        <p key={i} style={{ margin: '8px 0 4px', fontWeight: 700, color: '#095a4e' }}>
          {renderInline(heading[1])}
        </p>
      )
    }
    const numbered = /^\s*\d+[.)]\s+/.test(line)
    const bullet = /^\s*[-•]\s+/.test(line)
    if (numbered || bullet) {
      const content = line.replace(/^\s*(\d+[.)]|[-•])\s+/, '')
      return (
        <div key={i} style={{ display: 'flex', gap: 8, margin: '4px 0' }}>
          <span style={{ color: '#0d7d6b', fontWeight: 700 }}>
            {numbered ? line.match(/^\s*(\d+)/)?.[1] : '•'}
          </span>
          <span>{renderInline(content)}</span>
        </div>
      )
    }
    return (
      <p key={i} style={{ margin: '4px 0' }}>
        {renderInline(line)}
      </p>
    )
  })
}

// ---------- أيقونات ومكوّنات صغيرة ----------
function SparkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"
        fill="currentColor"
      />
    </svg>
  )
}
function Dot({ d = 0 }: { d?: number }) {
  return <span style={{ ...S.dot, animationDelay: `${d}s` }} />
}

// ---------- الأنماط (كائن مضمّن — بلا اعتماديات) ----------
const BRAND = '#0d7d6b'
const BRAND_DEEP = '#095a4e'
const INK = '#0A1D33' // لون علامتك من layout

const S: Record<string, React.CSSProperties> = {
  fab: {
    position: 'fixed', insetInlineStart: 20, bottom: 96, zIndex: 9998,
    display: 'flex', alignItems: 'center', gap: 8,
    background: BRAND, color: '#fff', border: 'none', borderRadius: 30,
    padding: '13px 20px', fontFamily: 'var(--font-cairo), sans-serif',
    fontSize: 14.5, fontWeight: 600, cursor: 'pointer',
    boxShadow: '0 8px 28px rgba(13,125,107,.45)',
  },
  fabText: { whiteSpace: 'nowrap' },
  scrim: {
    position: 'fixed', inset: 0, background: 'rgba(10,29,51,.42)',
    opacity: 0, pointerEvents: 'none', transition: 'opacity .25s', zIndex: 9998,
  },
  scrimOpen: { opacity: 1, pointerEvents: 'auto' },
  panel: {
    position: 'fixed', top: 0, insetInlineStart: 0, height: '100%',
    width: 440, maxWidth: '94vw', background: '#fff', zIndex: 9999,
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 16px 56px rgba(10,29,51,.22)',
    transform: 'translateX(105%)', transition: 'transform .32s cubic-bezier(.4,0,.2,1)',
    fontFamily: 'var(--font-cairo), sans-serif',
  },
  panelOpen: { transform: 'translateX(0)' },
  head: {
    padding: '16px 18px', borderBottom: '1px solid #e3e9f0',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'linear-gradient(180deg,#e6f4f1,transparent)',
  },
  headWho: { display: 'flex', alignItems: 'center', gap: 11 },
  avatar: {
    width: 40, height: 40, borderRadius: 11,
    background: `linear-gradient(135deg,${BRAND},${BRAND_DEEP})`,
    display: 'grid', placeItems: 'center', color: '#fff',
  },
  headTitle: { fontSize: 15.5, fontWeight: 700, color: INK },
  headStatus: { fontSize: 12, color: BRAND_DEEP },
  xBtn: {
    border: 'none', background: '#e3e9f0', width: 32, height: 32,
    borderRadius: 8, cursor: 'pointer', fontSize: 15, color: INK,
  },
  body: {
    flex: 1, overflowY: 'auto', padding: 18,
    display: 'flex', flexDirection: 'column', gap: 12, background: '#f6f8fb',
  },
  welcome: { display: 'flex', flexDirection: 'column', gap: 12 },
  msg: {
    maxWidth: '88%', fontSize: 14, padding: '11px 14px',
    borderRadius: 16, lineHeight: 1.7, wordBreak: 'break-word',
  },
  msgBot: {
    background: '#fff', border: '1px solid #e3e9f0',
    alignSelf: 'flex-start', borderBottomRightRadius: 5, color: INK,
  },
  msgUser: {
    background: BRAND, color: '#fff',
    alignSelf: 'flex-end', borderBottomLeftRadius: 5,
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    background: '#fff', border: '1px solid #e3e9f0', borderRadius: 20,
    padding: '7px 13px', fontSize: 12.5, color: INK, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  typing: { display: 'flex', gap: 5, alignItems: 'center' },
  dot: {
    width: 7, height: 7, borderRadius: '50%', background: '#5a6b7f',
    display: 'inline-block', animation: 'asstBlink 1.2s infinite',
  },
  inputBar: {
    padding: '12px 14px', borderTop: '1px solid #e3e9f0', background: '#fff',
    display: 'flex', gap: 9, alignItems: 'flex-end',
  },
  textarea: {
    flex: 1, border: '1px solid #e3e9f0', borderRadius: 12, padding: '11px 13px',
    fontFamily: 'inherit', fontSize: 14, resize: 'none', outline: 'none',
    maxHeight: 110, lineHeight: 1.6,
  },
  send: {
    border: 'none', background: BRAND, color: '#fff', width: 42, height: 42,
    borderRadius: 11, cursor: 'pointer', fontSize: 17, flexShrink: 0,
  },
  sendDisabled: { opacity: 0.4, cursor: 'default' },
  foot: {
    textAlign: 'center', fontSize: 11, color: '#5a6b7f', padding: 6,
    background: '#fff',
  },
}

const keyframes = `
@keyframes asstBlink {
  0%,60%,100% { opacity:.3; transform:translateY(0) }
  30% { opacity:1; transform:translateY(-3px) }
}
@media (prefers-reduced-motion: reduce) {
  [role="dialog"] { transition: none !important }
}
`
