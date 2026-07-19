'use client'
// قشرة التطبيق — لوحي+: شريط جانبي ثابت · جوال: درج منزلق مع همبرغر وخلفية معتمة
// هوية المدرسة: لون brandColor يُحقن كمتغيّرات CSS فيلوّن الرابط النشط والشعار.
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Role } from '@/lib/roles'
import { isStaff, canAccessFinance, isOwner } from '@/lib/roles'
import WhatsAppSupport from './WhatsAppSupport'
import { LogoMark } from '../Logo'
import {
  LayoutDashboard, GraduationCap, ReceiptText, Users, Apple, Bus,
  Package, BarChart3, ClipboardList, Gem, MessageCircle, Settings,Wallets,type LucideIcon,
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
  { href: '/accounting', icon: BarChart3, label: 'المحاسبة', show: (r) => canAccessFinance(r) },
  { href: '/activity', icon: ClipboardList, label: 'سجل النشاط', show: (r) => isOwner(r) },
  { href: '/subscription', icon: Gem, label: 'اشتراك المنصة', show: (r) => isOwner(r) },
  { href: '/feedback', icon: MessageCircle, label: 'الدعم والملاحظات', show: (r) => isStaff(r) },
  { href: '/settings', icon: Settings, label: 'الإعدادات والأمان', show: () => true },
]

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
  /** لون هوية المدرسة من الإعدادات (#RRGGBB) — يُستخدم للتمييز */
  brandColor?: string | null
  /** شعار المدرسة المرفوع من الإعدادات */
  schoolLogo?: string | null
  /** اسم المدرسة — يظهر تحت الشعار */
  schoolName?: string | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
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
          </nav>
          <div className="side-foot">
            <Link href="/login" className="side-link">
              <span className="ic">⎋</span> تسجيل الخروج
            </Link>
          </div>
        </div>
      </aside>

      {/* المحتوى */}
      <main className="app-main">{children}</main>
      <WhatsAppSupport />
    </div>
  )
}
