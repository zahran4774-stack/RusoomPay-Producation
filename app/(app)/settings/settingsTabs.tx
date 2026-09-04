'use client'
// مفتاح تبويب لصفحة الإعدادات — كل الأقسام مكوّنات موجودة على نفس الصفحة (لا مسارات
// منفصلة)، فالتبديل هنا حالة عميل بسيطة، بعكس ModuleTabs (الذي يتنقّل بين مسارات فعلية).
// نُبقي كل الأقسام في الـ DOM ونُخفي غير النشط منها (hidden) بدل إزالتها — حتى لا
// تُفقد أي بيانات مدخلة في نموذج عند التنقّل بين التبويبات ثم العودة إليه.
import { useState } from 'react'

export type SettingsTab = { id: string; label: string; content: React.ReactNode }

export default function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id)

  return (
    <div>
      <div className="module-tabs" role="tablist" aria-label="أقسام الإعدادات">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            className={`module-tab ${active === t.id ? 'active' : ''}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  )
}
