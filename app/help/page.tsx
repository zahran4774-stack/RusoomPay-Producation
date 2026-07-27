'use client'

// ============================================================================
// app/help/page.tsx
// مركز المساعدة الكامل — يعرض كل مقالات قاعدة المعرفة المسموح بها لدور المستخدم،
// مصنّفة وقابلة للبحث. يجلب من help_articles عبر RLS (يرى ما يخصّ دوره فقط).
// ============================================================================

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '../../lib/supabase-client'

type Article = {
  slug: string
  category: string
  title: string
  summary: string
  body: string
  steps: string[]
}

export default function HelpCenterPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Article | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('help_articles')
          .select('slug, category, title, summary, body, steps')
          .eq('is_published', true)
          .order('category', { ascending: true })
          .order('sort_order', { ascending: true })
        setArticles(
          (data ?? []).map((a: { slug: string; category: string; title: string; summary: string; body: string; steps: unknown }) => ({
            ...a,
            steps: Array.isArray(a.steps) ? (a.steps as string[]) : [],
          })),
        )
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return articles
    return articles.filter(
      (a) =>
        a.title.includes(q) ||
        a.summary.includes(q) ||
        a.body.includes(q) ||
        a.category.includes(q),
    )
  }, [articles, query])

  const byCategory = useMemo(() => {
    const map = new Map<string, Article[]>()
    for (const a of filtered) {
      if (!map.has(a.category)) map.set(a.category, [])
      map.get(a.category)!.push(a)
    }
    return Array.from(map.entries())
  }, [filtered])

  return (
    <div style={P.wrap}>
      {/* البطل */}
      <div style={P.hero}>
        <h1 style={P.heroTitle}>كيف نقدر نساعدك؟</h1>
        <p style={P.heroText}>
          أدلّة خطوة بخطوة لكل صفحات رسوم Pay. ابحث عن سؤالك أو تصفّح الأقسام.
        </p>
        <div style={P.search}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث… مثال: كيف أرسل تذكير دفع؟"
            style={P.searchInput}
          />
        </div>
      </div>

      {loading && <p style={P.muted}>جارِ تحميل المقالات…</p>}

      {!loading && filtered.length === 0 && (
        <p style={P.muted}>لا توجد نتائج مطابقة لبحثك.</p>
      )}

      {/* الأقسام */}
      {byCategory.map(([cat, list]) => (
        <section key={cat} style={P.section}>
          <h2 style={P.catTitle}>{cat}</h2>
          <div style={P.grid}>
            {list.map((a) => (
              <button key={a.slug} onClick={() => setSelected(a)} style={P.card}>
                <h3 style={P.cardTitle}>{a.title}</h3>
                <p style={P.cardSummary}>{a.summary}</p>
                {a.steps.length > 0 && (
                  <span style={P.badge}>{toAr(a.steps.length)} خطوات</span>
                )}
              </button>
            ))}
          </div>
        </section>
      ))}

      {/* لوحة المقال المفتوح */}
      <div
        onClick={() => setSelected(null)}
        style={{ ...P.scrim, ...(selected ? P.scrimOpen : {}) }}
        aria-hidden={!selected}
      />
      <aside
        role="dialog"
        aria-modal="true"
        style={{ ...P.drawer, ...(selected ? P.drawerOpen : {}) }}
      >
        {selected && (
          <>
            <header style={P.drawerHead}>
              <div>
                <div style={P.eyebrow}>{selected.category}</div>
                <h3 style={P.drawerTitle}>{selected.title}</h3>
              </div>
              <button onClick={() => setSelected(null)} aria-label="إغلاق" style={P.x}>
                ✕
              </button>
            </header>
            <div style={P.drawerBody}>
              <p style={P.summary}>{selected.summary}</p>
              {selected.body.split('\n').map(
                (para, i) =>
                  para.trim() && (
                    <p key={i} style={P.para}>
                      {para}
                    </p>
                  ),
              )}
              {selected.steps.length > 0 && (
                <ol style={P.steps}>
                  {selected.steps.map((s, i) => (
                    <li key={i} style={P.step}>
                      <span style={P.stepNum}>{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

const toAr = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d])

const BRAND = '#0d7d6b'
const BRAND_SOFT = '#e6f4f1'
const BRAND_DEEP = '#095a4e'
const INK = '#0A1D33'

const P: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 1000, margin: '0 auto', padding: 24,
    fontFamily: 'var(--font-cairo), sans-serif', color: INK,
  },
  hero: {
    background: `linear-gradient(135deg,${INK},#122a44)`, color: '#fff',
    borderRadius: 14, padding: '32px 28px', marginBottom: 24, position: 'relative',
    overflow: 'hidden',
  },
  heroTitle: { fontSize: 24, fontWeight: 700, margin: '0 0 8px', color: '#fff' },
  heroText: { color: '#b8ccd6', fontSize: 14.5, margin: 0, maxWidth: 520 },
  search: {
    marginTop: 18, display: 'flex', background: '#fff', borderRadius: 10,
    padding: 4, maxWidth: 440,
  },
  searchInput: {
    flex: 1, border: 'none', outline: 'none', padding: '10px 14px',
    fontFamily: 'inherit', fontSize: 14, background: 'transparent', color: INK,
  },
  muted: { fontSize: 14, color: '#5a6b7f', textAlign: 'center', padding: 20 },
  section: { marginBottom: 28 },
  catTitle: {
    fontSize: 17, fontWeight: 700, margin: '0 0 14px', color: INK,
    paddingBottom: 8, borderBottom: '2px solid #e6f4f1',
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14,
  },
  card: {
    background: '#fff', border: '1px solid #e3e9f0', borderRadius: 14,
    padding: 18, cursor: 'pointer', textAlign: 'start' as const,
    fontFamily: 'inherit', transition: 'all .2s',
  },
  cardTitle: { fontSize: 15.5, fontWeight: 700, margin: '0 0 4px', color: INK },
  cardSummary: { fontSize: 13, color: '#5a6b7f', margin: 0, lineHeight: 1.6 },
  badge: {
    display: 'inline-block', marginTop: 10, fontSize: 12, color: BRAND,
    fontWeight: 600, background: BRAND_SOFT, padding: '3px 9px', borderRadius: 20,
  },
  scrim: {
    position: 'fixed', inset: 0, background: 'rgba(10,29,51,.42)',
    opacity: 0, pointerEvents: 'none', transition: 'opacity .25s', zIndex: 9998,
  },
  scrimOpen: { opacity: 1, pointerEvents: 'auto' },
  drawer: {
    position: 'fixed', top: 0, insetInlineStart: 0, height: '100%',
    width: 460, maxWidth: '92vw', background: '#fff', zIndex: 9999,
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 16px 56px rgba(10,29,51,.22)',
    transform: 'translateX(105%)', transition: 'transform .3s cubic-bezier(.4,0,.2,1)',
  },
  drawerOpen: { transform: 'translateX(0)' },
  drawerHead: {
    padding: '20px 22px', borderBottom: '1px solid #e3e9f0',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 12, background: `linear-gradient(180deg,${BRAND_SOFT},transparent)`,
  },
  eyebrow: { fontSize: 12, color: BRAND_DEEP, fontWeight: 600, marginBottom: 4 },
  drawerTitle: { fontSize: 19, fontWeight: 700, margin: 0, color: INK },
  x: {
    border: 'none', background: '#e3e9f0', width: 32, height: 32,
    borderRadius: 8, cursor: 'pointer', fontSize: 15, color: INK, flexShrink: 0,
  },
  drawerBody: { padding: 22, overflowY: 'auto', flex: 1 },
  summary: { fontSize: 15, fontWeight: 600, color: INK, marginBottom: 14, lineHeight: 1.7 },
  para: { fontSize: 14.5, color: INK, marginBottom: 12, lineHeight: 1.8 },
  steps: { listStyle: 'none', padding: 0, margin: '8px 0 0' },
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
