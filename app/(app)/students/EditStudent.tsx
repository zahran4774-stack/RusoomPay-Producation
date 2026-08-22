'use client'
// تعديل بيانات الطالب الشخصية — لا الرسوم، لا الرقم المدرسي (يُدار من قسم الرسوم)
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { GRADES, SECTIONS, isValidGrade, isValidSection, GULF_COUNTRIES, DEFAULT_COUNTRY, cleanLocalNumber, isValidLocalNumber } from '@/lib/academic'

// يفصل رقماً مخزَّناً (قد يكون بصيغة قديمة محلية بلا كود دولة، أو دولية
// كاملة +XXXXXXXXXXX) إلى {كود الدولة، الرقم المحلي} لعرضهما بحقلين منفصلين.
// بيانات الطلاب الحاليين (قبل هذا الإصلاح) أغلبها مخزّنة كرقم محلي 8 خانات
// بلا كود — لذلك الافتراض الآمن لها هو عُمان (نفس افتراض toE164 السابق).
function splitPhone(stored: string | null): { code: string; local: string } {
  const raw = (stored || '').trim()
  if (!raw) return { code: DEFAULT_COUNTRY, local: '' }
  const digits = raw.startsWith('+') ? raw.slice(1) : raw
  for (const c of GULF_COUNTRIES) {
    if (digits.startsWith(c.code) && digits.length === c.code.length + c.localLen) {
      return { code: c.code, local: digits.slice(c.code.length) }
    }
  }
  // لم يطابق أي كود دولة معروف — نعرضه كما هو تحت الافتراضي، والتحقق
  // البصري (رقم غير صالح) ينبّه الموظف ليصحّحه بنفسه
  return { code: DEFAULT_COUNTRY, local: cleanLocalNumber(digits) }
}

export type StudentEditable = {
  id: string
  full_name: string
  grade: string | null
  section: string | null
  guardian_name: string | null
  guardian_phone: string | null
  guardian_email: string | null
  birth_date: string | null
  gender: string | null
  father_phone?: string | null
  mother_phone?: string | null
  address?: string | null
}

type Bus = { id: string; routes_label: string; fee: number }

export default function EditStudent({ student, buses = [], currentBusId = null }: { student: StudentEditable; buses?: Bus[]; currentBusId?: string | null }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const [f, setF] = useState({
    full_name: student.full_name ?? '',
    grade: student.grade ?? '',
    section: student.section ?? '',
    guardian_name: student.guardian_name ?? '',
    guardian_phone: splitPhone(student.guardian_phone).local,
    guardian_email: student.guardian_email ?? '',
    birth_date: student.birth_date ?? '',
    gender: student.gender ?? '',
    // حقول بسيطة (بدون تقسيم كود دولة) — تُستخدم للعرض على بطاقة الطالب
    // فقط، لا للإرسال الآلي (واتساب/رسائل)، فلا تحتاج نفس تحقّق guardian_phone.
    father_phone: student.father_phone ?? '',
    mother_phone: student.mother_phone ?? '',
    address: student.address ?? '',
  })
  const [countryCode, setCountryCode] = useState(splitPhone(student.guardian_phone).code)
  const country = GULF_COUNTRIES.find((c) => c.code === countryCode)
  const phoneValid = f.guardian_phone === '' || isValidLocalNumber(f.guardian_phone, countryCode)
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))
  const onPhoneChange = (raw: string) => {
    set('guardian_phone', cleanLocalNumber(raw).slice(0, country?.localLen ?? 9))
  }

  // النقل المدرسي — نبدأ من الاشتراك الحالي إن وُجد (currentBusId)
  const [wantsTransport, setWantsTransport] = useState(!!currentBusId)
  const [selectedBus, setSelectedBus] = useState(currentBusId ?? '')

  // حماية: لو حمل الطالب قيمة قديمة غير معتمدة، اعرضها كخيار مؤقت
  // كي لا تختفي القائمة فارغة — يراها المستخدم ويصحّحها.
  const gradeOptions = f.grade && !isValidGrade(f.grade) ? [f.grade, ...GRADES] : [...GRADES]
  const sectionOptions = f.section && !isValidSection(f.section) ? [f.section, ...SECTIONS] : [...SECTIONS]

  async function submit() {
    setErr(null)
    if (!f.full_name.trim()) { setErr('اسم الطالب مطلوب'); return }
    if (!f.grade.trim()) { setErr('الصف/المرحلة مطلوب'); return }
    if (f.guardian_phone && !phoneValid) { setErr('رقم ولي الأمر غير مكتمل أو غير صالح لهذه الدولة'); return }
    setSaving(true)
    const fullPhone = f.guardian_phone ? `+${countryCode}${f.guardian_phone}` : null
    const { error } = await supabase.rpc('update_student', {
      p_student_id: student.id,
      p_full_name: f.full_name,
      p_grade: f.grade,
      p_section: f.section || null,
      p_guardian_name: f.guardian_name || null,
      p_guardian_phone: fullPhone,
      p_guardian_email: f.guardian_email || null,
      p_birth_date: f.birth_date || null,
      p_gender: f.gender || null,
    })
    if (error) { setSaving(false); setErr(error.message); return }

    // حقول العائلة الجديدة — دالة منفصلة (راجع migration 35)
    const { error: famError } = await supabase.rpc('update_student_family_info', {
      p_student_id: student.id,
      p_father_phone: f.father_phone || null,
      p_mother_phone: f.mother_phone || null,
      p_address: f.address || null,
    })
    if (famError) { setSaving(false); setErr(famError.message); return }

    // النقل المدرسي — نغيّر الاشتراك فقط لو تغيّر فعلياً عن الحالة الأصلية
    // (تفادي نداء شبكة زائد لو المستخدم فتح القائمة وما بدّل شيء)
    if (wantsTransport && selectedBus && selectedBus !== currentBusId) {
      const { error: busError } = await supabase.rpc('subscribe_bus', { p_student: student.id, p_bus: selectedBus })
      if (busError) { setSaving(false); setErr(busError.message); return }
    } else if (!wantsTransport && currentBusId) {
      const { error: busError } = await supabase.rpc('unsubscribe_bus', { p_student: student.id })
      if (busError) { setSaving(false); setErr(busError.message); return }
    }

    setSaving(false)
    setOk(true)
    router.refresh()
    setTimeout(() => { setOk(false); setOpen(false) }, 1000)
  }

  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#0F2744', marginBottom: 5, display: 'block' }
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #E3E8EE', fontSize: 14, fontFamily: 'inherit' }
  const select: React.CSSProperties = { ...input, background: '#fff', cursor: 'pointer' }
  const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  const cell: React.CSSProperties = { flex: '1 1 190px' }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} title="تعديل بيانات الطالب"
        style={{ background: '#F2F5F8', color: '#0F2744', border: 0, padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
        ✎ تعديل
      </button>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,37,64,.45)', display: 'grid', placeItems: 'center', zIndex: 999, padding: 16 }}
      onClick={() => !saving && setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 18, padding: 26, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px -20px rgba(10,37,64,.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: '#0F2744' }}>تعديل بيانات الطالب</h3>
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 0, fontSize: 22, cursor: 'pointer', color: '#667' }}>×</button>
        </div>
        <div style={{ color: '#8A94A6', fontSize: 12, marginBottom: 18 }}>
          الرسوم والرقم المدرسي لا يُعدّلان من هنا.
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 13 }}>
          <div style={cell}>
            <label style={label}>الاسم الكامل *</label>
            <input style={input} value={f.full_name} onChange={(e) => set('full_name', e.target.value)} />
          </div>

          {/* قائمة ثابتة — تمنع تكرار الصفوف بصيغ مختلفة */}
          <div style={cell}>
            <label style={label}>الصف / المرحلة *</label>
            <select style={select} value={f.grade} onChange={(e) => set('grade', e.target.value)}>
              <option value="">— اختر الصف —</option>
              {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* قائمة ثابتة — عشر شعب بالترتيب الأبجدي */}
          <div style={cell}>
            <label style={label}>الشعبة</label>
            <select style={select} value={f.section} onChange={(e) => set('section', e.target.value)}>
              <option value="">— اختر الشعبة —</option>
              {sectionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={cell}>
            <label style={label}>اسم ولي الأمر</label>
            <input style={input} value={f.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} />
          </div>
          <div style={cell}>
            <label style={label}>رقم ولي الأمر</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={countryCode}
                onChange={(e) => { setCountryCode(e.target.value); set('guardian_phone', '') }}
                style={{ ...select, flex: '0 0 100px', padding: '0 6px' }}
              >
                {GULF_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.flag} +{c.code}</option>
                ))}
              </select>
              <input
                style={{ ...input, direction: 'ltr', textAlign: 'right', borderColor: f.guardian_phone && !phoneValid ? '#E0A3A3' : '#E3E8EE' }}
                value={f.guardian_phone} onChange={(e) => onPhoneChange(e.target.value)}
                inputMode="numeric" dir="ltr"
              />
            </div>
            {f.guardian_phone && !phoneValid && (
              <div style={{ color: '#C0392B', fontSize: 11, marginTop: 4 }}>رقم غير مكتمل أو غير صالح لهذه الدولة</div>
            )}
          </div>
          <div style={cell}>
            <label style={label}>بريد ولي الأمر</label>
            <input style={input} value={f.guardian_email} onChange={(e) => set('guardian_email', e.target.value)} dir="ltr" />
          </div>
          <div style={cell}>
            <label style={label}>تاريخ الميلاد</label>
            <input type="date" style={input} value={f.birth_date} onChange={(e) => set('birth_date', e.target.value)} dir="ltr" />
          </div>
          <div style={cell}>
            <label style={label}>الجنس</label>
            <select style={select} value={f.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="">—</option>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </div>

          {/* حقول إضافية — تُستخدم أساساً في بطاقة الطالب المطبوعة */}
          <div style={cell}>
            <label style={label}>هاتف الأب</label>
            <input style={{ ...input, direction: 'ltr', textAlign: 'right' }} value={f.father_phone} onChange={(e) => set('father_phone', e.target.value)} inputMode="tel" />
          </div>
          <div style={cell}>
            <label style={label}>هاتف الأم</label>
            <input style={{ ...input, direction: 'ltr', textAlign: 'right' }} value={f.mother_phone} onChange={(e) => set('mother_phone', e.target.value)} inputMode="tel" />
          </div>
          <div style={cell}>
            <label style={label}>السكن</label>
            <input style={input} value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="مثال: الخوض، مسقط" />
          </div>
        </div>

        {buses.length > 0 && (
          <div style={{ marginTop: 13 }}>
            <label style={label}>النقل المدرسي</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid #E3E8EE', borderRadius: 10, background: wantsTransport ? '#F4F8F6' : '#fff' }}>
              <input type="checkbox" checked={wantsTransport} onChange={(e) => { setWantsTransport(e.target.checked); if (!e.target.checked) setSelectedBus('') }} style={{ width: 18, height: 18, cursor: 'pointer' }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#0F2744' }}>اشتراك بالنقل المدرسي</span>
              {wantsTransport && (
                <select style={{ ...select, width: 260 }} value={selectedBus} onChange={(e) => setSelectedBus(e.target.value)}>
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

        {err && <div style={{ color: '#C0392B', marginTop: 14, fontWeight: 600, fontSize: 13 }}>⚠ {err}</div>}
        {ok && <div style={{ color: '#067647', marginTop: 14, fontWeight: 700, fontSize: 13 }}>✓ حُفظت التعديلات</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={submit} disabled={saving}
            style={{ flex: 1, background: saving ? '#8AA' : '#163B68', color: '#fff', border: 0, padding: '12px', borderRadius: 11, fontWeight: 800, fontSize: 15, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}
          </button>
          <button onClick={() => setOpen(false)} disabled={saving}
            style={{ background: '#F2F5F8', color: '#0F2744', border: 0, padding: '12px 20px', borderRadius: 11, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  )
}
