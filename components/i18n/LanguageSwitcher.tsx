'use client'

import { ENGLISH_ENABLED } from '@/lib/i18n'
import { useLanguage } from './LanguageProvider'

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage()
  if (!ENGLISH_ENABLED) return null
  const isEnglish = language === 'en'

  return (
    <div
      data-i18n-ignore="true"
      role="group"
      aria-label="Language"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: compact ? '3px' : '4px',
        borderRadius: 999,
        border: '1px solid rgba(148,163,184,.28)',
        background: 'rgba(255,255,255,.92)',
        boxShadow: '0 2px 10px rgba(15,39,68,.08)',
      }}
    >
      <button
        type="button"
        onClick={() => setLanguage('ar')}
        aria-pressed={!isEnglish}
        style={{
          border: 0,
          borderRadius: 999,
          padding: compact ? '5px 9px' : '6px 11px',
          background: !isEnglish ? '#0F9D74' : 'transparent',
          color: !isEnglish ? '#fff' : '#334155',
          fontWeight: 700,
          fontSize: compact ? 11 : 12,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        العربية
      </button>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        aria-pressed={isEnglish}
        style={{
          border: 0,
          borderRadius: 999,
          padding: compact ? '5px 9px' : '6px 11px',
          background: isEnglish ? '#0F9D74' : 'transparent',
          color: isEnglish ? '#fff' : '#334155',
          fontWeight: 700,
          fontSize: compact ? 11 : 12,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        English
      </button>
    </div>
  )
}
