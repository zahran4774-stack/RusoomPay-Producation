'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { GULF_COUNTRIES, DEFAULT_COUNTRY, cleanLocalNumber, isValidLocalNumber, GRADES } from '@/lib/academic'

type Bus = { id: string; routes_label: string; fee: number }

export default function AddStudent({ sectionOptions, buses = [] }: { sectionOptions: string[]; buses?: Bus[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const [mealPlans, setMealPlans] = useState<{ id: string; name: string; fee: number }[]>([])
  const [selectedMeals, setSelectedMeals] = useState<Record<string, string>>({})
  const toggleMealPlan = (planId: string) => {
    setSelectedMeals((prev) => {
      const next = { ...prev }
      if (planId in next) delete next[planId]
      else next[planId] = ''
      return next
    })
  }

  const [wantsTransport, setWantsTransport] = useState(false)
  const [selectedBus, setSelectedBus] = useState('')

  // تسعير المراحل — من الإعدادات، لتعبئة الرسوم تلقائياً عند اختيار المرحلة
  const [gradeFees, setGradeFees] = useState<Record<string, number>>({})
  const [basePrice, setBasePrice] = useState<number | null>(null)

  useEffect(() => {
    supabase.rpc('cafeteria_plans').then(({ data }) => { if (data) setMealPlans(data) })
    supabase.rpc('grade_fees_list').then(({ data }) => {
      if (data) setGradeFees(Object.fromEntries(data.map((g: { grade: string; annual_fee: number }) => [g.grade, g.annual_fee])))
    })
  }, [supabase])

  const [f, setF] = useState({
    full_name: '', grade: '', section: '', guardian_name: '',
    guardian_phone: '', guardian_email: '', birth_date: '', gender: '',
    code: '', annual_fee: '', discount_pct: '0',
  })
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY)
  const country = GULF_COUNTRIES.find((c) => c.code === countryCode)
  const phoneValid = f.guardian_phone !== '' && isValidLocalNumber(f.guardian_phone, countryCode)

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))
  const onPhoneChange = (raw: string) => {
    set('guardian_phone', cleanLocalNumber(raw).slice(0, country?.localLen ?? 9))
  }

  // احتساب الرسوم من سعر المرحلة والتخفيض — يبقى الحقل قابلاً للتعديل اليدوي بعدها
  function applyGrade(grade: string) {
    set('grade', grade)
    const price = gradeFees[grade]
    if (price !== undefined) {
      setBasePrice(price)
      const discount = Number(f.discount_pct) || 0
      set('annual_fee', (price * (1 - discount / 100)).toFixed(3))
    } else {
      setBasePrice(null)
    }
  }
  function applyDiscount(v: string) {
    set('discount_pct', v)
    if (basePrice !== null) {
      const discount = Number(v) || 0
      set('annual_fee', (basePrice * (1 - discount / 100)).toFixed(3))
    }
  }

  async function submit() {
    setErr(null); setOk(false)
    if (!f.full_name.trim()) { setErr('اسم الطالب مطلوب'); return }
    if (!f.grade.trim()) { setErr('الصف/المرحلة مطلوب'); return }
    if (!f.section.trim()) { setErr('الشعبة مطلوبة'); return }
    if (!f.guardian_phone.trim()) { setErr('رقم ولي الأمر مطلوب'); return }
    if (!phoneValid) { setErr('رقم ولي الأمر غير مكتمل أو غير صالح لهذه الدولة'); return }
    if (!f.annual_fee || Number(f.annual_fee) <= 0) { setErr('الرسوم السنوية مطلوبة ويجب أن تكون أكبر من صفر'); return }
    setSaving(true)
    const fullPhone = `+${countryCode}${f.guardian_phone}`
    const { data: newId, error } = await supabase.rpc('add_student', {
      p_full_name: f.full_name,
      p_grade: f.grade,
      p_section: f.section || null,
      p_guardian_name: f.guardian_name || null,
      p_guardian_phone: fullPhone,
      p_guardian_email: f.guardian_email || null,
      p_birth_date: f.birth_date || null,
      p_gender: f.gender || null,
      p_code: f.code || null,
      p_annual_fee: Number(f.annual_fee),
      p_discount_pct: Number(f.discount_pct) || 0,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setOk(true)
    if (newId) {
      for (const [planId, amount] of Object.entries(selectedMeals)) {
        if (Number(amount) > 0) {
          await supabase.rpc('add_annual_meal_fee', {
            p_student: newId, p_plan: planId, p_annual_amount: Number(amount),
          })
        }
      }
      if (wantsTransport && selectedBus) {
        await supabase.rpc('subscribe_bus', { p_student: newId, p_bus: selectedBus })
      }
    }
    setSelectedMeals({})
    setWantsTransport(false)
    setSelectedBus('')
    setF({ full_name: '', grade: '', section: '', guardian_name: '', guardian_phone: '', guardian_email: '', birth_date: '', gender: '', code: '', annual_fee: '', discount_pct: '0' })
    setBasePrice(null)
    setCountryCode(DEFAULT_COUNTRY)
    router.refresh()
    setTimeout(() => { setOk(false); setOpen(false) }, 1200)
  }

  const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#0F2744', marginBottom: 5, display: 'block' }
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #E3E8EE', fontSize: 14, fontFamily: 'inherit' }
  const cell: React.CSSProperties = { flex: '1 1 220px' }
  const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ background: '#163B68', color: '#fff', border: 0, padding: '12px 22px', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
        ＋ إضافة طالب جديد
      </button>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 18, padding: 24, marginBottom: 18, boxShadow: '0 12px 34px -20px rgba(10,37,64,.25)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h3 style={{ color: '#0F2744', margin: 0, fontSize: 18 }}>إضافة طالب جديد</h3>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 0, fontSize: 22, cursor: 'pointer', color: '#667' }}>×</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <div style={cell}>
          <label style={label}>الاسم الكامل *</label>
          <input style={input} value={f.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="محمد أحمد الكندي" />
        </div>
        <div style={cell}>
          <label style={label}>الصف / المرحلة *</label>
          <select style={input} value={f.grade} onChange={(e) => applyGrade(e.target.value)}>
            <option value="">— اختر الصف —</option>
            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div style={cell}>
          <label style={label}>الشعبة *</label>
          <select style={input} value={f.section} onChange={(e) => set('section', e.target.value)}>
            <option value="">— اختر الشعبة —</option>
            {sectionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={cell}>
          <label style={label}>الرقم المدرسي (تلقائي إن تُرك فارغاً)</label>
          <input style={input} value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="STU-001" />
        </div>
        <div style={cell}>
          <label style={label}>اسم ولي الأمر</label>
          <input style={input} value={f.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} placeholder="أحمد الكندي" />
        </div>
        <div style={cell}>
          <label style={label}>رقم ولي الأمر *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={countryCode}
              onChange={(e) => { setCountryCode(e.target.value); set('guardian_phone', '') }}
              style={{ ...input, flex: '0 0 108px', cursor: 'pointer', padding: '0 8px' }}
            >
              {GULF_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} +{c.code}</option>
              ))}
            </select>
            <input
              style={{ ...input, direction: 'ltr', textAlign: 'right', borderColor: f.guardian_phone && !phoneValid ? '#E0A3A3' : '#E3E8EE' }}
              value={f.guardian_phone} onChange={(e) => onPhoneChange(e.target.value)}
              inputMode="numeric" placeholder={country?.code === '968' ? '9xxxxxxx' : 'xxxxxxxx'} dir="ltr"
            />
          </div>
          {f.guardian_phone && !phoneValid && (
            <div style={{ color: '#C0392B', fontSize: 12, marginTop: 4 }}>رقم غير مكتمل أو غير صالح لهذه الدولة</div>
          )}
        </div>
        <div style={cell}>
          <label style={label}>بريد ولي الأمر</label>
          <input style={input} value={f.guardian_email} onChange={(e) => set('guardian_email', e.target.value)} placeholder="parent@email.com" dir="ltr" />
        </div>
        <div style={cell}>
          <label style={label}>تاريخ الميلاد</label>
          <input type="date" style={input} value={f.birth_date} onChange={(e) => set('birth_date', e.target.value)} dir="ltr" />
        </div>
        <div style={cell}>
          <label style={label}>الجنس</label>
          <select style={input} value={f.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="">—</option>
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </select>
        </div>
        <div style={cell}>
          <label style={label}>الرسوم السنوية (ر.ع) *</label>
          <input type="number" style={input} value={f.annual_fee} onChange={(e) => set('annual_fee', e.target.value)} placeholder="0" dir="ltr" />
          {basePrice !== null && (
            <div style={{ color: '#8A94A6', fontSize: 11.5, marginTop: 4 }}>السعر الأساسي للمرحلة: {basePrice.toLocaleString('en-US', { minimumFractionDigits: 3 })} ر.ع</div>
          )}
        </div>
        <div style={cell}>
          <label style={label}>التخفيض ٪</label>
          <input type="number" min={0} max={100} style={input} value={f.discount_pct} onChange={(e) => applyDiscount(e.target.value)} placeholder="0" dir="ltr" />
        </div>
        {mealPlans.length > 0 && (
          <div style={{ flex: '1 1 100%' }}>
            <label style={label}>باقات التغذية (سنوية — تُضاف للرسوم، يمكن اختيار أكثر من باقة)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mealPlans.map((p) => {
                const checked = p.id in selectedMeals
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid #E3E8EE', borderRadius: 10, background: checked ? '#F4F8F6' : '#fff' }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleMealPlan(p.id)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#0F2744' }}>{p.name}</span>
                    {checked && (
                      <input
                        type="number" style={{ ...input, width: 130 }} dir="ltr"
                        value={selectedMeals[p.id]}
                        onChange={(e) => setSelectedMeals((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder="المبلغ السنوي (ر.ع)"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {buses.length > 0 && (
          <div style={{ flex: '1 1 100%' }}>
            <label style={label}>النقل المدرسي</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid #E3E8EE', borderRadius: 10, background: wantsTransport ? '#F4F8F6' : '#fff' }}>
              <input type="checkbox" checked={wantsTransport} onChange={(e) => { setWantsTransport(e.target.checked); if (!e.target.checked) setSelectedBus('') }} style={{ width: 18, height: 18, cursor: 'pointer' }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#0F2744' }}>اشتراك بالنقل المدرسي</span>
              {wantsTransport && (
                <select style={{ ...input, width: 260 }} value={selectedBus} onChange={(e) => setSelectedBus(e.target.value)}>
                  <option value="">— اختر المسار/الباص —</option>
                  {buses.map((b) => <option key={b.id} value={b.id}>{b.routes_label} — {fmt(b.fee)} ر.ع</option>)}
                </select>
              )}
            </div>
            {wantsTransport && !selectedBus && (
              <div style={{ color: '#8A6D1D', fontSize: 12, marginTop: 4 }}>اختر مساراً ليُربط الطالب بالباص عند الحفظ</div>
            )}
          </div>
        )}
      </div>

      {err && <div style={{ color: '#C0392B', marginTop: 14, fontWeight: 600, fontSize: 14 }}>⚠ {err}</div>}
      {ok && <div style={{ color: '#067647', marginTop: 14, fontWeight: 700, fontSize: 14 }}>✓ أُضيف الطالب بنجاح</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button onClick={submit} disabled={saving}
          style={{ background: saving ? '#8AA' : '#163B68', color: '#fff', border: 0, padding: '12px 26px', borderRadius: 11, fontWeight: 800, fontSize: 15, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'جارٍ الحفظ…' : 'حفظ الطالب'}
        </button>
        <button onClick={() => setOpen(false)}
          style={{ background: '#F2F5F8', color: '#0F2744', border: 0, padding: '12px 22px', borderRadius: 11, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
          إلغاء
        </button>
      </div>
    </div>
  )
}
