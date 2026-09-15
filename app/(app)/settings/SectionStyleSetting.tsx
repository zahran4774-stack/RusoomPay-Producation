'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { SECTION_STYLE_META, buildSectionOptions, type SectionStyle } from '@/lib/academic'

const STYLE_KEYS = Object.keys(SECTION_STYLE_META) as SectionStyle[]

export default function SectionStyleSetting({
  initial,
  initialCustomNames = [],
  canEdit,
}: {
  initial: string[]
  initialCustomNames?: string[]
  canEdit: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [styles, setStyles] = useState<string[]>(
    initial && initial.length ? initial : ['ar_letters']
  )
  // الأسماء المخصّصة تُدار كنص خام مفصول بفواصل (سهل الكتابة على الجوال)،
  // ويُحوَّل لمصفوفة فقط عند الحفظ أو المعاينة.
  const [customNamesRaw, setCustomNamesRaw] = useState<string>(
    (initialCustomNames ?? []).join('، ')
  )
  const [saving, setSaving] = useState(false)
  const [savingNames, setSavingNames] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [okNames, setOkNames] = useState(false)

  const customNamesList = customNamesRaw
    .split(/[,،]/)
    .map((s) => s.trim())
    .filter(Boolean)

  const toggle = (key: string) => {
    setOk(false); setErr(null)
    setStyles((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    )
  }

  async function save() {
    setErr(null); setOk(false)
    if (styles.length === 0) {
      setErr('اختر نمطاً واحداً على الأقل')
      return
    }
    if (styles.includes('custom') && customNamesList.length === 0) {
      setErr('أدخل اسماً واحداً على الأقل للشُّعب المخصّصة، أو ألغِ اختيار هذا النمط')
      return
    }
    setSaving(true)
    const { error } = await supabase.rpc('set_section_styles', { p_styles: styles })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setOk(true)
    router.refresh()
  }

  async function saveCustomNames() {
    setErr(null); setOkNames(false)
    if (customNamesList.length === 0) {
      setErr('أدخل اسماً واحداً على الأقل')
      return
    }
    setSavingNames(true)
    const { error } = await supabase.rpc('set_custom_section_names', { p_names: customNamesList })
    setSavingNames(false)
    if (error) { setErr(error.message); return }
    setOkNames(true)
    router.refresh()
  }

  const preview = buildSectionOptions(styles, customNamesList).slice(0, 20)

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid #E3E8EE', borderRadius: 16,
    padding: 22, marginTop: 18,
  }

  return (
    <div style={card}>
      <h3 style={{ color: '#0F2744', margin: '0 0 6px', fontSize: 17 }}>ترميز الشُّعب</h3>
      <p style={{ color: '#667', fontSize: 13, margin: '0 0 16px', lineHeight: 1.8 }}>
        اختر نمط ترميز الشُّعب حسب نظام مدرستك. يمكنك اختيار أكثر من نمط، وستظهر
        كلها كخيارات عند إضافة الطلاب.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {STYLE_KEYS.map((key) => {
          const active = styles.includes(key)
          return (
            <div key={key}>
              <label
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 11,
                  border: `1.5px solid ${active ? '#163B68' : '#E3E8EE'}`,
                  background: active ? '#F0F5FB' : '#fff',
                  cursor: canEdit ? 'pointer' : 'default',
                  opacity: canEdit ? 1 : 0.7,
                }}
              >
                <input
                  type="checkbox"
                  checked={active}
                  disabled={!canEdit}
                  onChange={() => canEdit && toggle(key)}
                  style={{ width: 18, height: 18, accentColor: '#163B68', cursor: canEdit ? 'pointer' : 'default' }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: '#0F2744', fontSize: 14 }}>
                    {SECTION_STYLE_META[key].label}
                  </div>
                  <div style={{ color: '#8A94A6', fontSize: 12, marginTop: 2, direction: key === 'custom' ? 'rtl' : 'ltr', textAlign: 'right' }}>
                    {SECTION_STYLE_META[key].sample}
                  </div>
                </div>
              </label>

              {/* حقل إدخال الأسماء المخصّصة — يظهر فقط عند تفعيل نمط "custom" */}
              {key === 'custom' && active && canEdit && (
                <div style={{ marginTop: 8, marginInlineStart: 30, padding: '12px 14px', background: '#F7F9FC', borderRadius: 11 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: '#0F2744', display: 'block', marginBottom: 6 }}>
                    أسماء الشُّعب (افصل بينها بفاصلة، بأي عدد تريد)
                  </label>
                  <textarea
                    value={customNamesRaw}
                    onChange={(e) => { setCustomNamesRaw(e.target.value); setOkNames(false) }}
                    placeholder="مثال: النور، الأمل، الرواد، الفرسان"
                    rows={2}
                    style={{
                      width: '100%', padding: '9px 11px', borderRadius: 9,
                      border: '1px solid #E3E8EE', fontSize: 14, fontFamily: 'inherit', resize: 'vertical',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <span style={{ fontSize: 11.5, color: '#8A94A6' }}>
                      {customNamesList.length > 0 ? `${customNamesList.length} اسماً` : 'لم تُدخل أسماء بعد'}
                    </span>
                    <button
                      onClick={saveCustomNames}
                      disabled={savingNames}
                      style={{
                        background: savingNames ? '#8AA' : '#0F9D74', color: '#fff', border: 0,
                        padding: '7px 16px', borderRadius: 9, fontWeight: 700, fontSize: 12.5,
                        cursor: savingNames ? 'default' : 'pointer', fontFamily: 'inherit',
                      }}>
                      {savingNames ? 'جارٍ الحفظ…' : okNames ? '✓ حُفظت الأسماء' : 'حفظ الأسماء'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 16, padding: '12px 14px', background: '#F7F9FC', borderRadius: 11 }}>
        <div style={{ fontSize: 12, color: '#667', marginBottom: 6 }}>معاينة خيارات الشُّعب:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {preview.length ? preview.map((v, i) => (
            <span key={i} style={{
              padding: '4px 12px', background: '#fff', border: '1px solid #E3E8EE',
              borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#0F2744',
            }}>{v}</span>
          )) : <span style={{ color: '#B0B8C4', fontSize: 13 }}>—</span>}
        </div>
      </div>

      {err && <div style={{ color: '#C0392B', marginTop: 12, fontSize: 13, fontWeight: 600 }}>⚠ {err}</div>}
      {ok && <div style={{ color: '#067647', marginTop: 12, fontSize: 13, fontWeight: 700 }}>✓ تم الحفظ</div>}

      {canEdit && (
        <button
          onClick={save}
          disabled={saving}
          style={{
            marginTop: 16, background: saving ? '#8AA' : '#163B68', color: '#fff',
            border: 0, padding: '11px 24px', borderRadius: 11, fontWeight: 800,
            fontSize: 14, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {saving ? 'جارٍ الحفظ…' : 'حفظ الأنماط المختارة'}
        </button>
      )}
    </div>
  )
}
