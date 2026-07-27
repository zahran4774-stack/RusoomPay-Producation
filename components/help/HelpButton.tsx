'use client'

// ============================================================================
// components/help/HelpButton.tsx
// زر مساعدة سياقي (؟) يُوضع بجانب أي عنصر في أي صفحة.
// عند الضغط يفتح لوحة تعرض شرح المقال المطابق للـ slug من قاعدة المعرفة.
//
// الاستخدام داخل أي صفحة:
//   <HelpButton slug="kpi-collection-rate" />
//   <HelpButton slug="record-payment" label="كيف أسجّل دفعة؟" />
//
// يجلب المحتوى من نفس مسار المساعد عبر RPC (assistant_search_help) بالـ slug،
// أو يمكن تمرير المحتوى مباشرة عبر props لتفادي نداء الشبكة.
// ============================================================================

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Article = {
  slug: string
  title: string
  summary: string
  body: string
  steps: string[]
}

export default function HelpButton({
  slug,
  label,
}: {
  slug: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setOpen(true)
    if (article) return // محمّل مسبقاً
    setLoading(true)
    setError(false)
    try {
      const supabase = createClient()
      // نجلب بالـ slug مباشرة (RLS يضمن أن دور المستخدم يسمح برؤيته)
      const { data, error: qErr } = await supabase
        .from('help_articles')
        .select('slug, title, summary, body, steps')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle()
      if (qErr || !data) {
        setError(true)
      } else {
        setArticle({
          ...data,
          steps: Array.isArray(data.steps) ? (data.steps as string[]) : [],
        })
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [slug, article])

  return (
    <>
      <button
        onClick={load}
        aria-label={label || 'ما هذا؟'}
        title={label || 'ما هذا؟'}
        style={label ? BTN.labeled : BTN.dot}
      >
        {label ? (
          <>
            <span style={{ fontWeight: 700 }}>؟</span> {label}
          </>
        ) : (
          '؟'
        )}
      </button>

      <div
        onClick={() => setOpen(false)}
        style={{ ...BTN.scrim, ...(open ? BTN.scrimOpen : {}) }}
        aria-hidden={!open}
      />

      <aside
        role="dialog"
        aria-modal="true"
        style={{ ...BTN.drawer, ...(open ? BTN.drawerOpen : {}) }}
      >
        <header style={BTN.head}>
          <div>
            <div style={BTN.eyebrow}>دليل مصوّر</div>
            <h3 style={BTN.title}>{article?.title || 'المساعدة'}</h3>
          </div>
          <button onClick={() => setOpen(false)} aria-label="إغلاق" style={BTN.x}>
            ✕
          </button>
        </header>

        <div style={BTN.body}>
          {loading && <p style={BTN.muted}>جارِ التحميل…</p>}
          {error && (
            <p style={BTN.muted}>
              لم نعثر على شرح لهذا العنصر. تواصل مع الدعم إن احتجت مساعدة.
            </p>
          )}
          {article && !loading && (
            <>
              <p style={BTN.summary}>{article.summary}</p>
              {article.body.split('\n').map(
                (para, i) =>
                  para.trim() && (
                    <p key={i} style={BTN.para}>
                      {para}
                    </p>
                  ),
              )}
              {article.steps.length > 0 && (
                <ol style={BTN.steps}>
                  {article.steps.map((s, i) => (
                    <li key={i} style={BTN.step}>
                      <span style={BTN.stepNum}>{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      </aside>

      <style>{`@media (prefers-reduced-motion: reduce){[role="dialog"]{transition:none!important}}`}</style>
    </>
  )
}

const BRAND = '#0d7d6b'
const BRAND_SOFT = '#e6f4f1'
const BRAND_DEEP = '#095a4e'
const INK = '#0A1D33'

const BTN: Record<string, React.CSSProperties> = {
  dot: {
    width: 22, height: 22, borderRadius: '50%',
    border: `1.5px solid ${BRAND}`, color: BRAND, background: BRAND_SOFT,
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    display: 'inline-grid', placeItems: 'center', verticalAlign: 'middle',
    fontFamily: 'var(--font-cairo), sans-serif', padding: 0,
  },
  labeled: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    border: `1px solid ${BRAND}`, color: BRAND, background: BRAND_SOFT,
    borderRadius: 8, padding: '5px 11px', fontSize: 13, cursor: 'pointer',
    fontFamily: 'var(--font-cairo), sans-serif',
  },
  scrim: {
    position: 'fixed', inset: 0, background: 'rgba(10,29,51,.42)',
    opacity: 0, pointerEvents: 'none', transition: 'opacity .25s', zIndex: 9998,
  },
  scrimOpen: { opacity: 1, pointerEvents: 'auto' },
  drawer: {
    position: 'fixed', top: 0, insetInlineStart: 0, height: '100%',
    width: 420, maxWidth: '90vw', background: '#fff', zIndex: 9999,
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 16px 56px rgba(10,29,51,.22)',
    transform: 'translateX(105%)', transition: 'transform .3s cubic-bezier(.4,0,.2,1)',
    fontFamily: 'var(--font-cairo), sans-serif',
  },
  drawerOpen: { transform: 'translateX(0)' },
  head: {
    padding: '20px 22px', borderBottom: '1px solid #e3e9f0',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 12, background: `linear-gradient(180deg,${BRAND_SOFT},transparent)`,
  },
  eyebrow: { fontSize: 12, color: BRAND_DEEP, fontWeight: 600, marginBottom: 4 },
  title: { fontSize: 19, fontWeight: 700, color: INK, margin: 0 },
  x: {
    border: 'none', background: '#e3e9f0', width: 32, height: 32,
    borderRadius: 8, cursor: 'pointer', fontSize: 15, color: INK, flexShrink: 0,
  },
  body: { padding: 22, overflowY: 'auto', flex: 1 },
  muted: { fontSize: 14, color: '#5a6b7f' },
  summary: { fontSize: 15, fontWeight: 600, color: INK, marginBottom: 14, lineHeight: 1.7 },
  para: { fontSize: 14.5, color: INK, marginBottom: 12, lineHeight: 1.8 },
  steps: { listStyle: 'none', padding: 0, margin: '8px 0 0', counterReset: 'step' },
  step: {
    display: 'flex', gap: 12, alignItems: 'flex-start',
    padding: '10px 0', borderBottom: '1px dashed #e3e9f0', fontSize: 14,
  },
  stepNum: {
    flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
    background: BRAND, color: '#fff', fontSize: 13, fontWeight: 700,
    display: 'grid', placeItems: 'center',
  },
}
