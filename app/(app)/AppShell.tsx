'use client'
// قشرة التطبيق — لوحي+: شريط جانبي ثابت · جوال: درج منزلق مع همبرغر وخلفية معتمة
// هوية المدرسة: لون brandColor يُحقن كمتغيّرات CSS فيلوّن الرابط النشط والشعار.
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { Role } from '@/lib/roles'
import { isStaff, canAccessFinance, isOwner } from '@/lib/roles'
import { LogoMark } from '../Logo'
import {
  LayoutDashboard, GraduationCap, ReceiptText, Users, Apple, Bus,
  Package, BarChart3, ClipboardList, Gem, MessageCircle, Settings, Wallet, type LucideIcon,
} from 'lucide-react'

type NavItem = { href: string; icon: LucideIcon; label: string; show: (r: Role) => boolean }

const NAV: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'لوحة التحكم', show: () => true },
  { href: '/students', icon: GraduationCap, label: 'الطلاب', show: (r) => isStaff(r) },
  { href: '/fees', icon: ReceiptText, label: 'الرسوم والفواتير', show: (r) => isStaff(r) },
  { href: '/employees', icon: Users, label: 'الموظفون والرواتب', show: (r) => isStaff(r) },
  { href: '/payroll', icon: Wallet, label: 'دورات الرواتب', show: (r) => canAccessFinance(r) },
  { href: '/cafeteria', icon: Apple, label: 'التغذية المدرسية', show: (r) => isStaff(r) },
  { href: '/transport', icon: Bus, label: 'النقل المدرسي', show: (r) => isStaff(r) },
  { href: '/inventory', icon: Package, label: 'المخزون', show: (r) => isStaff(r) },
  { href: '/accounting', icon: BarChart3, label: 'المحاسبة والتقارير', show: (r) => canAccessFinance(r) },
  { href: '/activity', icon: ClipboardList, label: 'سجل النشاط', show: (r) => isOwner(r) },
  { href: '/subscription', icon: Gem, label: 'اشتراك المنصة', show: (r) => isOwner(r) },
  { href: '/feedback', icon: MessageCircle, label: 'الدعم والملاحظات', show: (r) => isStaff(r) },
  { href: '/settings', icon: Settings, label: 'الإعدادات والأمان', show: () => true },
]

// رقم دعم واتساب
const WA_NUM = '96895476649'
const WA_MSG = encodeURIComponent('مرحباً، أحتاج مساعدة بخصوص نظام RusoomPay')
const WA_LINK = `https://wa.me/${WA_NUM}?text=${WA_MSG}`

const DEFAULT_BRAND = '#0F9D74'

// تحويل #RRGGBB إلى "r,g,b" — لبناء درجات شفافة
function toRgb(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

// درجة أفتح من اللون — لنصّ الرابط النشط فوق خلفية داكنة (تباين مقروء)
function lighten(hex: string, amount = 0.45): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return '#6FE0B8'
  const n = parseInt(m[1], 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255)
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

export default function AppShell({ role, brandColor, schoolLogo, schoolName, children }: {
  role: Role
  brandColor?: string | null
  schoolLogo?: string | null
  schoolName?: string | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  // زر الرجوع الذكي: يظهر فقط في الصفحات الفرعية العميقة.
  // المسار /students → مستوى أول (لا رجوع). /students/xxx → فرعي (رجوع للأب).
  // نحسب الأب بحذف آخر جزء من المسار.
  const segments = pathname.split('/').filter(Boolean)
  const showBack = segments.length >= 2   // مثل ['payroll','xxx'] أو ['students','xxx']
  const parentPath = '/' + segments.slice(0, -1).join('/')
  const [open, setOpen] = useState(false)
  const items = NAV.filter((n) => n.show(role))
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // إغلاق الدرج عند تغيير الصفحة
  useEffect(() => { setOpen(false) }, [pathname])
  // منع تمرير الخلفية عند فتح الدرج
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // بناء متغيّرات اللون — تتجاوز قيم :root الافتراضية
  const brand = (brandColor && toRgb(brandColor)) ? brandColor.trim() : DEFAULT_BRAND
  const rgb = toRgb(brand) ?? '15,157,116'
  const brandVars = {
    '--brand': brand,
    '--brand-soft': lighten(brand),
    '--brand-tint-22': `rgba(${rgb},.22)`,
    '--brand-tint-08': `rgba(${rgb},.08)`,
  } as React.CSSProperties

  return (
    <div className="layout" style={brandVars}>
      {/* شريط علوي للجوال */}
      <header className="app-header">
        <div className="topbar">
          <div className="brand"><LogoMark size={30} /> <span>Rusoom<span style={{ color: 'var(--brand)' }}>Pay</span></span></div>
          <button className="menu-btn" onClick={() => setOpen(true)} aria-label="فتح القائمة">☰</button>
        </div>
      </header>

      {/* خلفية معتمة (جوال) — الإغلاق بالنقر خارج الدرج */}
      <div className={`drawer-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />

      {/* الشريط الجانبي / الدرج */}
      <aside className={`app-sidebar ${open ? 'open' : ''}`}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
          <div className="side-brand"><LogoMark size={32} /> <span>Rusoom<span style={{ color: 'var(--brand)' }}>Pay</span></span></div>

          {/* هوية المدرسة — شعارها واسمها، حاضران في كل صفحة */}
          {(schoolLogo || schoolName) && (
            <div className="school-identity">
              {schoolLogo
                ? <img src={schoolLogo} alt="" className="school-logo" />
                : (
                  <span className="school-logo school-logo-fallback" style={{ background: 'var(--brand)' }}>
                    {(schoolName ?? '').trim().charAt(0) || '؟'}
                  </span>
                )}
              {schoolName && <span className="school-name" title={schoolName}>{schoolName}</span>}
            </div>
          )}

          <nav className="side-nav">
            {items.map((n) => (
              <Link key={n.href} href={n.href} className={`side-link ${isActive(n.href) ? 'active' : ''}`}>
                <span className="ic">{(() => { const Icon = n.icon; return <Icon size={19} strokeWidth={2} /> })()}</span> {n.label}
              </Link>
            ))}

            {/* رابط دعم واتساب — Help (يفتح محادثة واتساب في تبويب جديد) */}
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="side-link">
              <span className="ic" style={{ color: '#25D366' }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.04zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
              </span> Help
            </a>
          </nav>

          <div className="side-foot">
            <Link href="/login" className="side-link">
              <span className="ic">⎋</span> تسجيل الخروج
            </Link>
          </div>
        </div>
      </aside>

      {/* المحتوى */}
      <main className="app-main">
        {showBack && (
          <button onClick={() => router.push(parentPath)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fff', border: '1px solid #E3E8EE', borderRadius: 10, padding: '8px 15px', marginBottom: 16, cursor: 'pointer', color: '#0F2744', fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit', boxShadow: '0 1px 3px rgba(10,37,64,.06)' }}>
            <span style={{ fontSize: 17, lineHeight: 1, color: 'var(--brand)' }}>→</span> رجوع
          </button>
        )}
        {children}
      </main>
    </div>
  )
}
