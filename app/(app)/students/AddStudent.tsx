'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { GULF_COUNTRIES, DEFAULT_COUNTRY, cleanLocalNumber, isValidLocalNumber, GRADES } from '@/lib/academic'

type Bus = { id: string; routes_label: string; fee: number }
type MealPlan = { id: string; name: string; fee: number }

const SPECIAL_CASE_SUGGESTIONS = ['ابن موظف', 'صدقة', 'مساعدة لوجه الله', 'أسرة محتاجة', 'أخرى']

export default function AddStudent({ sectionOptions, buses = [] }: { sectionOptions: string[]; buses?: Bus[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
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

  const [bundleEnabled, setBundleEnabled] = useState<boolean | null>(null)
  const [bundleMealPlanId, setBundleMealPlanId] = useState('')
  const [bundleBusId, setBundleBusId] = useState('')

  const [isExempt, setIsExempt] = useState(false)
  const [hasSpecialCase, setHasSpecialCase] = useState(false)
  const [specialCaseReason, setSpecialCaseReason] = useState('')

  const [hasRegistrationFee, setHasRegistrationFee] = useState(false)
  const [registrationFee, setRegistrationFee] = useState('')
  const [registrationRecurrence, setRegistrationRecurrence] = useState<'once' | 'yearly'>('once')

  const [gradeFees, setGradeFees] = useState<Record<string, number>>({})

  useEffect(() => {
    supabase.rpc('cafeteria_plans').then(({ data }) => { if (data) setMealPlans(data) })
    supabase.rpc('grade_fees_list').then(({ data }) => {
      if (data) setGradeFees(Object.fromEntries(data.map((g: { grade: string; annual_fee: number }) => [g.grade, g.annual_fee])))
    })
    supabase.from('schools').select('bundle_transport_meals').single().then(({ data }) => {
      setBundleEnabled(!!data?.bundle_transport_meals)
    })
  }, [supabase])

  const [f, setF] = useState({
    full_name: '', grade: '', section: '', guardian_name: '',
    guardian_phone: '', guardian_email: '', birth_date: '', gender: '',
    code: '', annual_fee: '', discount_amount: '',
  })
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY)
  const country = GULF_COUNTRIES.find((c) => c.code === countryCode)
  const phoneValid = f.guardian_phone !== '' && isValidLocalNumber(f.guardian_phone, countryCode)

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))
  const onPhoneChange = (raw: string) => {
    set('guardian_phone', cleanLocalNumber(raw).slice(0, country?.localLen ?? 9))
  }

  // القيم المحسوبة
  const annualFee = parseFloat(f.annual_fee) || 0
  const discountAmt = parseFloat(f.discount_amount) || 0
  const discountPct = annualFee > 0 && discountAmt > 0
    ? Math.min((discountAmt / annualFee) * 100, 100)
    : 0
  const netFee = Math.max(annualFee - discountAmt, 0)

  function applyGrade(grade: string) {
    set('grade', grade)
    const price = gradeFees[grade]
    if (price !== undefined) {
      set('annual_fee', price.toFixed(3))
    }
  }

  function toggleSpecialCase(checked: boolean) {
    setHasSpecialCase(checked)
    if (!checked) {
      setSpecialCaseReason('')
      set('discount_amount', '')
    }
  }

  function toggleRegistrationFee(checked: boolean) {
    setHasRegistrationFee(checked)
    if (!checked) { setRegistrationFee(''); setRegistrationRecurrence('once') }
  }

  const bundleMealFee = bundleMealPlanId ? (mealPlans.find((p) => p.id === bundleMealPlanId)?.fee ?? 0) : 0
  const bundleBusFee = bundleBusId ? (buses.find((b) => b.id === bundleBusId)?.fee ?? 0) : 0
  const estimatedGrandTotal = netFee + bundleMealFee + bundleBusFee

  async function submit() {
    setErr(null); setOk(false)
    if (!f.full_name.trim()) { setErr('اسم الطالب مطلوب'); return }
    if (!f.grade.trim()) { setErr('الصف/المرحلة مطلوب'); return }
    if (!f.section.trim()) { setErr('الشعبة مطلوبة'); return }
    if (!f.guardian_phone.trim()) { setErr('رقم ولي الأمر مطلوب'); return }
    if (!phoneValid) { setErr('رقم ولي الأمر غير مكتمل أو غير صالح لهذه الدولة'); return }
    if (!isExempt && (!f.annual_fee || annualFee <= 0) && !bundleMealPlanId && !bundleBusId) {
      setErr('الرسوم السنوية مطلوبة ويجب أن تكون أكبر من صفر'); return
    }
    if (discountAmt > annualFee + bundleMealFee + bundleBusFee) {
      setErr('مبلغ التخفيض لا يمكن أن يتجاوز إجمالي الرسوم'); return
    }
    if (hasSpecialCase && !specialCaseReason.trim()) {
      setErr('حدد سبب الحالة الخاصة'); return
    }
    if (hasSpecialCase && discountAmt <= 0) {
      setErr('حدد مبلغ التخفيض المرتبط بالحالة الخاصة'); return
    }
    if (hasRegistrationFee && (!registrationFee || Number(registrationFee) <= 0)) {
      setErr('أدخل مبلغ رسوم التسجيل أو ألغِ تفعيلها'); return
    }
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
      p_annual_fee: isExempt ? 0 : annualFee,
      p_discount_amount: discountAmt,
      p_transport_type: (bundleEnabled && bundleBusId) || (!bundleEnabled && wantsTransport && selectedBus) ? 'school' : 'none',
      p_is_exempt: isExempt,
      p_special_case_reason: hasSpecialCase ? specialCaseReason.trim() : null,
      p_bundle_meal_plan_id: bundleEnabled && bundleMealPlanId ? bundleMealPlanId : null,
      p_bundle_bus_id: bundleEnabled && bundleBusId ? bundleBusId : null,
      p_registration_fee: hasRegistrationFee ? Number(registrationFee) : 0,
      p_registration_recurrence: hasRegistrationFee ? registrationRecurrence : null,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setOk(true)
    if (newId && !bundleEnabled) {
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
    setSelectedMeals({}); setWantsTransport(false); setSelectedBus('')
    setBundleMealPlanId(''); setBundleBusId('')
    setIsExempt(false); setHasSpecialCase(false); setSpecialCaseReason('')
    setHasRegistrationFee(false); setRegistrationFee(''); setRegistrationRecurrence('once')
    setF({ full_name: '', grade: '', section: '', guardian_name: '', guardian_phone: '', guardian_email: '', birth_date: '', gender: '', code: '', annual_fee: '', discount_amount: '' })
    setCountryCode(DEFAULT_COUNTRY)
    router.refresh()
    setTimeout(() => { setOk(false); setOpen(false) }, 1200)
  }

  const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#0F2744', marginBottom: 5, display: 'block' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #E3E8EE', fontSize: 14, fontFamily: 'inherit' }
  const autoInput: React.CSSProperties = { ...inputStyle, background: '#F0F7F5', border: '1.5px solid #CDE8E1', color: '#0D7D6B', fontWeight: 700 }
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
          <input style={inputStyle} value={f.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="محمد أحمد الكندي" />
        </div>
        <div style={cell}>
          <label style={label}>الصف / المرحلة *</label>
          <select style={inputStyle} value={f.grade} onChange={(e) => applyGrade(e.target.value)}>
            <option value="">— اختر الصف —</option>
            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div style={cell}>
          <label style={label}>الشعبة *</label>
          <select style={inputStyle} value={f.section} onChange={(e) => set('section', e.target.value)}>
            <option value="">— اختر الشعبة —</option>
            {sectionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={cell}>
          <label style={label}>الرقم المدرسي (تلقائي إن تُرك فارغاً)</label>
          <input style={inputStyle} value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="STU-001" />
        </div>
        <div style={cell}>
          <label style={label}>اسم ولي الأمر</label>
          <input style={inputStyle} value={f.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} placeholder="أحمد الكندي" />
        </div>
        <div style={cell}>
          <label style={label}>رقم ولي الأمر *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={countryCode} onChange={(e) => { setCountryCode(e.target.value); set('guardian_phone', '') }}
              style={{ ...inputStyle, flex: '0 0 108px', cursor: 'pointer', padding: '0 8px' }}>
              {GULF_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} +{c.code}</option>)}
            </select>
            <input
              style={{ ...inputStyle, direction: 'ltr', textAlign: 'right', borderColor: f.guardian_phone && !phoneValid ? '#E0A3A3' : '#E3E8EE' }}
              value={f.guardian_phone} onChange={(e) => onPhoneChange(e.target.value)}
              inputMode="numeric" placeholder={country?.code === '968' ? '9xxxxxxx' : 'xxxxxxxx'} dir="ltr" />
          </div>
          {f.guardian_phone && !phoneValid && (
            <div style={{ color: '#C0392B', fontSize: 12, marginTop: 4 }}>رقم غير مكتمل أو غير صالح لهذه الدولة</div>
          )}
        </div>
        <div style={cell}>
          <label style={label}>بريد ولي الأمر</label>
          <input style={inputStyle} value={f.guardian_email} onChange={(e) => set('guardian_email', e.target.value)} placeholder="parent@email.com" dir="ltr" />
        </div>
        <div style={cell}>
          <label style={label}>تاريخ الميلاد</label>
          <input type="date" style={inputStyle} value={f.birth_date} onChange={(e) => set('birth_date', e.target.value)} dir="ltr" />
        </div>
        <div style={cell}>
          <label style={label}>الجنس</label>
          <select style={inputStyle} value={f.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="">—</option>
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </select>
        </div>

        {/* معفى بالكامل */}
        <div style={{ flex: '1 1 100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid #E3E8EE', borderRadius: 10, background: isExempt ? '#F4F8F6' : '#fff' }}>
            <input type="checkbox" checked={isExempt} onChange={(e) => setIsExempt(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#0F2744' }}>🎗️ معفى بالكامل من الرسوم</span>
          </div>
          {isExempt && <div style={{ color: '#0F9D74', fontSize: 12, marginTop: 4 }}>لن يُنشأ أي رسم دراسي لهذا الطالب.</div>}
        </div>

        {/* الرسوم والتخفيض */}
        <div style={cell}>
          <label style={label}>الرسوم السنوية (ر.ع) {isExempt ? '' : '*'}</label>
          <input type="number" step="0.001" style={{ ...inputStyle, opacity: isExempt ? 0.5 : 1 }}
            value={f.annual_fee} onChange={(e) => set('annual_fee', e.target.value)}
            placeholder="0.000" dir="ltr" disabled={isExempt} />
        </div>

        <div style={cell}>
          <label style={label}>مبلغ التخفيض (ر.ع)</label>
          <input type="number" step="0.001" style={{ ...inputStyle, opacity: isExempt ? 0.5 : 1 }}
            value={f.discount_amount} onChange={(e) => set('discount_amount', e.target.value)}
            placeholder="0.000" dir="ltr" disabled={isExempt} />
        </div>

        {/* نسبة التخفيض تلقائية */}
        {discountPct > 0 && !isExempt && (
          <div style={cell}>
            <label style={{ ...label, color: '#0D7D6B' }}>نسبة التخفيض (تلقائي)</label>
            <input style={autoInput} value={discountPct.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + '%'} readOnly tabIndex={-1} dir="ltr" />
          </div>
        )}

        {/* صافي الرسوم */}
        {!isExempt && annualFee > 0 && (
          <div style={{ flex: '1 1 100%', background: '#F4F8F6', border: '1px solid #BFE5D0', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ color: '#0F2744' }}>
                <b>صافي الرسوم الدراسية:</b>{' '}
                <span style={{ fontSize: 16, fontWeight: 800, color: '#0F9D74' }}>{fmt(netFee)} ر.ع</span>
                {discountAmt > 0 && (
                  <span style={{ color: '#667', fontWeight: 400, fontSize: 12, marginRight: 8 }}>
                    ({fmt(annualFee)} − {fmt(discountAmt)})
                  </span>
                )}
              </div>
              {(bundleMealFee > 0 || bundleBusFee > 0) && (
                <div style={{ color: '#0F2744', fontSize: 12 }}>
                  <b>الإجمالي شاملاً الخدمات:</b> {fmt(estimatedGrandTotal)} ر.ع
                  {bundleMealFee > 0 && <span> + تغذية {fmt(bundleMealFee)}</span>}
                  {bundleBusFee > 0 && <span> + نقل {fmt(bundleBusFee)}</span>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* حالة خاصة */}
        {!isExempt && (
          <div style={{ flex: '1 1 100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid #E3E8EE', borderRadius: 10, background: hasSpecialCase ? '#FDF8ED' : '#fff' }}>
              <input type="checkbox" checked={hasSpecialCase} onChange={(e) => toggleSpecialCase(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#0F2744' }}>⭐ حالة خاصة (تخفيض بسبب موثّق)</span>
            </div>
            {hasSpecialCase && (
              <div style={{ marginTop: 8 }}>
                <label style={label}>سبب الحالة الخاصة *</label>
                <input style={inputStyle} value={specialCaseReason}
                  onChange={(e) => setSpecialCaseReason(e.target.value)}
                  placeholder="مثال: ابن موظف" list="special-case-suggestions" />
                <datalist id="special-case-suggestions">
                  {SPECIAL_CASE_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
                </datalist>
                <div style={{ color: '#8A6D0F', fontSize: 12, marginTop: 4 }}>
                  أدخل مبلغ التخفيض في الحقل أعلاه — ستظهر النسبة تلقائياً.
                </div>
              </div>
            )}
          </div>
        )}

        {/* رسوم التسجيل */}
        {!isExempt && (
          <div style={{ flex: '1 1 100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid #E3E8EE', borderRadius: 10, background: hasRegistrationFee ? '#EEF2F9' : '#fff' }}>
              <input type="checkbox" checked={hasRegistrationFee} onChange={(e) => toggleRegistrationFee(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#0F2744' }}>📝 رسوم التسجيل (اختياري)</span>
            </div>
            {hasRegistrationFee && (
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: '1 1 160px' }}>
                  <label style={label}>المبلغ (ر.ع) *</label>
                  <input type="number" style={inputStyle} value={registrationFee} onChange={(e) => setRegistrationFee(e.target.value)} placeholder="0" dir="ltr" />
                  <div style={{ color: '#8A94A6', fontSize: 11, marginTop: 4 }}>مبلغ ثابت — لا يخضع للتخفيض أعلاه.</div>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={label}>التكرار</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['once', 'yearly'] as const).map((v) => (
                      <button key={v} type="button" onClick={() => setRegistrationRecurrence(v)}
                        style={{ flex: 1, padding: '10px', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
                          border: `1.5px solid ${registrationRecurrence === v ? '#163B68' : '#E3E8EE'}`,
                          background: registrationRecurrence === v ? '#F0F5FB' : '#fff',
                          color: registrationRecurrence === v ? '#163B68' : '#667' }}>
                        {v === 'once' ? 'لمرة واحدة' : 'سنوياً'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* النقل والتغذية */}
        {bundleEnabled === false && (
          <div style={{ flex: '1 1 100%', background: '#F7F9FC', border: '1px dashed #DCE3EC', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: '#8A94A6' }}>
            🔒 التغذية والنقل مجمّدان — فعّلهما من «الإعدادات» أو أضفهما لاحقاً من صفحتيهما.
          </div>
        )}

        {bundleEnabled === true && mealPlans.length > 0 && !isExempt && (
          <div style={cell}>
            <label style={label}>باقة التغذية (اختياري)</label>
            <select style={inputStyle} value={bundleMealPlanId} onChange={(e) => setBundleMealPlanId(e.target.value)}>
              <option value="">— بدون —</option>
              {mealPlans.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmt(p.fee)} ر.ع</option>)}
            </select>
          </div>
        )}

        {bundleEnabled === true && buses.length > 0 && !isExempt && (
          <div style={cell}>
            <label style={label}>مسار النقل (اختياري)</label>
            <select style={inputStyle} value={bundleBusId} onChange={(e) => setBundleBusId(e.target.value)}>
              <option value="">— بدون —</option>
              {buses.map((b) => <option key={b.id} value={b.id}>{b.routes_label} — {fmt(b.fee)} ر.ع</option>)}
            </select>
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
