'use client'
// RusoomNavMenu.tsx — قائمة تنقّل احترافية للجوال (RusoomPay School ERP)
// أيقونات Lucide · تأثير زجاجي · تدرّج تركوازي داكن · ذهبي ناعم.
// الاستخدام: <RusoomNavMenu active="attendance" onSelect={(key)=>router.push(...)} />

import type React from 'react'

import {
  UserCheck, Bus, Apple, Package,
  GraduationCap, Users, UserRound, School,
  Wallet, CreditCard, BarChart3, Bell,
  CalendarDays, Clock3, ClipboardCheck, BookOpen,
  Settings, Building2, BriefcaseBusiness, LayoutDashboard,
  ChevronLeft, type LucideIcon,
} from 'lucide-react'

export type NavKey =
  | 'dashboard' | 'attendance' | 'transport' | 'meals' | 'inventory'
  | 'students' | 'teachers' | 'parents' | 'classes' | 'finance'
  | 'fees' | 'reports' | 'notifications' | 'calendar' | 'timetable'
  | 'exams' | 'library' | 'settings' | 'profile' | 'staff'

type Item = { key: NavKey; icon: LucideIcon; title: string; sub: string }

// الوحدات الأساسية المطلوبة (الأربع) — أولاً، ثم البقية قابلة للإظهار
const ITEMS: Item[] = [
  { key: 'attendance', icon: UserCheck, title: 'الحضور والغياب', sub: 'تسجيل ومتابعة حضور الطلاب' },
  { key: 'transport', icon: Bus, title: 'النقل المدرسي', sub: 'الحافلات والمسارات والاشتراكات' },
  { key: 'meals', icon: Apple, title: 'الوجبات المدرسية', sub: 'المقصف والقوائم والطلبات' },
  { key: 'inventory', icon: Package, title: 'المخزون', sub: 'الأصناف والكميات والحركة' },
]

// خريطة أيقونات كاملة لبقية الوحدات (للتوسّع دون إعادة تصميم)
export const NAV_ICONS: Record<NavKey, LucideIcon> = {
  dashboard: LayoutDashboard, attendance: UserCheck, transport: Bus, meals: Apple,
  inventory: Package, students: GraduationCap, teachers: Users, parents: UserRound,
  classes: School, finance: Wallet, fees: CreditCard, reports: BarChart3,
  notifications: Bell, calendar: CalendarDays, timetable: Clock3, exams: ClipboardCheck,
  library: BookOpen, settings: Settings, profile: Building2, staff: BriefcaseBusiness,
}

export default function RusoomNavMenu({
  items = ITEMS,
  active,
  onSelect,
  schoolName = 'إدارة مدرسة النور الخاصة',
}: {
  items?: Item[]
  active?: NavKey
  onSelect?: (key: NavKey) => void
  schoolName?: string
}) {
  return (
    <div dir="rtl" style={S.root}>
      <div style={S.wrap}>
        <header style={S.head}>
          <div style={S.mark}>
            <svg viewBox="0 0 100 100" width={30} height={30} aria-hidden>
              <path d="M30 24 h30 a22 22 0 0 1 0 44 h-8 l26 28 h-21 l-24 -26 v26 h-17 v-72 z M30 39 v16 h27 a8 8 0 0 0 0 -16 z" fill="#fff" />
            </svg>
          </div>
          <div>
            <h1 style={S.h1}>Rusoom<span style={{ color: '#5FD0A8' }}>Pay</span></h1>
            <p style={S.sub}>{schoolName}</p>
          </div>
        </header>

        <div style={S.sectionLabel}>الوحدات</div>

        <nav style={S.menu}>
          {items.map((it) => {
            const Icon = it.icon
            const sel = active === it.key
            return (
              <button
                key={it.key}
                onClick={() => onSelect?.(it.key)}
                aria-current={sel ? 'page' : undefined}
                style={{ ...S.item, ...(sel ? S.itemSel : null) }}
              >
                <span style={{ ...S.ic, ...(sel ? S.icSel : null) }}>
                  <Icon size={26} strokeWidth={2} color="#D6B06A" />
                </span>
                <span style={S.label}>
                  <span style={S.title}>{it.title}</span>
                  <span style={S.subText}>{it.sub}</span>
                </span>
                <ChevronLeft size={20} strokeWidth={2} color={sel ? '#D6B06A' : 'rgba(255,255,255,.35)'} />
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  root: {
    fontFamily: "'Cairo','IBM Plex Sans Arabic','Noto Kufi Arabic',sans-serif",
    background: 'linear-gradient(155deg,#083A40 0%,#0D4D55 100%)',
    minHeight: '100dvh', color: 'rgba(255,255,255,.9)',
    padding: '28px 18px', WebkitFontSmoothing: 'antialiased',
  },
  wrap: { maxWidth: 440, margin: '0 auto' },
  head: { display: 'flex', alignItems: 'center', gap: 13, marginBottom: 30, padding: '4px 6px' },
  mark: {
    width: 46, height: 46, borderRadius: 13, flexShrink: 0,
    background: 'linear-gradient(135deg,#2E8B6F,#0B6E5F)',
    display: 'grid', placeItems: 'center', boxShadow: '0 6px 18px rgba(0,0,0,.25)',
  },
  h1: { fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-.3px', lineHeight: 1.1 },
  sub: { fontSize: '.78rem', fontWeight: 400, color: 'rgba(255,255,255,.55)', marginTop: 2 },
  sectionLabel: {
    fontSize: '.74rem', fontWeight: 600, color: 'rgba(255,255,255,.4)',
    letterSpacing: '1.5px', margin: '6px 8px 14px', textTransform: 'uppercase',
  },
  menu: { display: 'flex', flexDirection: 'column', gap: 14 },
  item: {
    display: 'flex', alignItems: 'center', gap: 16, width: '100%', textAlign: 'right',
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 24, padding: '14px 16px', cursor: 'pointer', color: 'inherit',
    fontFamily: 'inherit', transition: 'background .22s, transform .14s, border-color .22s, box-shadow .22s',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  },
  itemSel: {
    background: 'rgba(255,255,255,.10)', borderColor: 'rgba(214,176,106,.30)',
    boxShadow: '0 10px 30px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.06)',
  },
  ic: {
    width: 56, height: 56, borderRadius: 16, flexShrink: 0, display: 'grid', placeItems: 'center',
    background: 'linear-gradient(145deg,rgba(255,255,255,.10),rgba(255,255,255,.03))',
    border: '1px solid rgba(255,255,255,.10)',
    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.10)',
  },
  icSel: {
    background: 'linear-gradient(145deg,rgba(214,176,106,.20),rgba(214,176,106,.06))',
    borderColor: 'rgba(214,176,106,.28)',
  },
  label: { flex: 1, display: 'flex', flexDirection: 'column' },
  title: { fontSize: '1.02rem', fontWeight: 600, lineHeight: 1.25 },
  subText: { fontSize: '.76rem', fontWeight: 400, color: 'rgba(255,255,255,.5)', marginTop: 3 },
}
