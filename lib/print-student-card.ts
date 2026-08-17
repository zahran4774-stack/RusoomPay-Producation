// lib/print-student-card.ts
// طباعة بطاقة تعليق صدر للطالب — بطاقة واحدة أو دفعة كاملة (شعبة).
// يتبع نفس نمط lib/print-report.ts: نافذة تُفتح فوراً، نكتب HTML فيها،
// ننتظر تحميل الخط والصور، ثم نطبع. الألوان قابلة للتعديل من إعدادات
// المدرسة (schools.color و schools.card_accent_color) — راجع migration 36.

export type SchoolBrand = {
  name: string
  logoUrl?: string | null
  /** اللون الأساسي (خلفية البطاقة) — افتراضي كحلي RusoomPay لو ما تحدّد */
  primaryColor?: string | null
  /** اللون الثانوي (الشارة، الحدود، الشعار الاحتياطي) — افتراضي ذهبي */
  accentColor?: string | null
}

export type CardStudent = {
  full_name: string
  grade: string
  section: string | null
  father_phone?: string | null
  mother_phone?: string | null
  bus_label?: string | null      // مثال: "خط 3"
  bus_supervisor?: string | null // اسم المشرفة/المشرف
}

const DEFAULT_PRIMARY = '#0F2744'
const DEFAULT_ACCENT = '#B08D2E'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// hex → أفتح/أغمق بنسبة معيّنة (لتدرّج الخلفية العلوي/السفلي من نفس اللون
// الأساسي، بدل تدرّج ثابت لا يتبع لون المدرسة المختار)
function shade(hex: string, percent: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const num = parseInt(m[1], 16)
  const clamp = (v: number) => Math.max(0, Math.min(255, v))
  const r = clamp(((num >> 16) & 0xff) + Math.round(255 * percent))
  const g = clamp(((num >> 8) & 0xff) + Math.round(255 * percent))
  const b = clamp((num & 0xff) + Math.round(255 * percent))
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

/**
 * يحدّد لون نص واضح (أبيض أو كحلي غامق) حسب نسبة التباين الفعلية (WCAG
 * relative luminance) — يقارن تباين الأبيض والغامق مع اللون المُعطى ويختار
 * الأعلى تبايناً، بدل عتبة سطوع تقريبية قد تُخطئ في الألوان المتوسطة
 * (كاللون الذهبي الافتراضي، اللي يحتاج نص كحلي غامق لا أبيض ليكون مقروءاً).
 */
export function readableTextColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return '#ffffff'
  const num = parseInt(m[1], 16)
  const r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff

  const toLinear = (c: number) => {
    const cs = c / 255
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4)
  }
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)

  const contrastWithWhite = 1.05 / (L + 0.05)      // أبيض luminance = 1
  const contrastWithDark = (L + 0.05) / 0.05        // كحلي غامق luminance ≈ 0
  return contrastWithDark >= contrastWithWhite ? '#12202E' : '#ffffff'
}

function isValidHex(hex?: string | null): hex is string {
  return !!hex && /^#[0-9a-f]{6}$/i.test(hex.trim())
}

function cardHtml(school: SchoolBrand, s: CardStudent): string {
  const initial = (school.name || 'م').trim().charAt(0)
  const logoBlock = school.logoUrl
    ? `<img class="logo-img" src="${escapeHtml(school.logoUrl)}" alt="" />`
    : `<div class="logo-fallback">${escapeHtml(initial)}</div>`

  const busRow = s.bus_label
    ? `<div class="row"><span class="row-label">الباص</span><span class="row-value">${escapeHtml(s.bus_label)}${s.bus_supervisor ? ' — ' + escapeHtml(s.bus_supervisor) : ''}</span></div>`
    : ''
  const fatherRow = s.father_phone
    ? `<div class="row"><span class="row-label">هاتف الأب</span><span class="row-value" dir="ltr">${escapeHtml(s.father_phone)}</span></div>`
    : ''
  const motherRow = s.mother_phone
    ? `<div class="row"><span class="row-label">هاتف الأم</span><span class="row-value" dir="ltr">${escapeHtml(s.mother_phone)}</span></div>`
    : ''

  return `
  <div class="card">
    <div class="hole"></div>
    <div class="card-header">
      ${logoBlock}
      <div class="school-name">${escapeHtml(school.name)}</div>
    </div>
    <div class="photo-wrap">صورة الطالب</div>
    <div class="student-name">${escapeHtml(s.full_name)}</div>
    <div class="class-badge"><span>${escapeHtml(s.grade)}${s.section ? ' — ' + escapeHtml(s.section) : ''}</span></div>
    <div class="body">
      ${busRow}
      ${fatherRow}
      ${motherRow}
    </div>
  </div>`
}

// يبني CSS البطاقة مبنياً على ألوان المدرسة الفعلية — يُستدعى مرّة واحدة
// لكل جلسة طباعة (نفس الألوان لكل البطاقات بالدفعة، لا حاجة لتكراره لكل طالب)
function buildStyle(school: SchoolBrand): string {
  const primary = isValidHex(school.primaryColor) ? school.primaryColor : DEFAULT_PRIMARY
  const accent = isValidHex(school.accentColor) ? school.accentColor : DEFAULT_ACCENT
  const primaryText = readableTextColor(primary)
  const accentText = readableTextColor(accent)
  const gradTop = shade(primary, 0.06)
  const gradBottom = shade(primary, -0.05)
  // لون خافت للنص الثانوي فوق الخلفية الأساسية (اسم المدرسة) — امزج مع لون النص المقروء
  const mutedOnPrimary = primaryText === '#ffffff' ? 'rgba(255,255,255,.78)' : 'rgba(18,32,46,.72)'

  return `
*{margin:0;padding:0;box-sizing:border-box;font-family:'Cairo',Tahoma,Arial,sans-serif}
body{background:#EDF0F5;padding:24px;display:flex;flex-wrap:wrap;gap:20px;justify-content:center}
.card{
  width:340px;background:linear-gradient(180deg,${gradTop} 0%,${gradBottom} 100%);
  border-radius:22px;overflow:hidden;position:relative;color:${primaryText};
  display:flex;flex-direction:column;break-inside:avoid;page-break-inside:avoid;
}
.hole{position:absolute;top:14px;left:50%;transform:translateX(-50%);width:46px;height:8px;background:rgba(0,0,0,.35);border-radius:6px;z-index:5}
.card-header{padding:26px 20px 12px;text-align:center}
.logo-fallback{width:38px;height:38px;background:${accent};border-radius:10px;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px;color:${accentText}}
.logo-img{width:38px;height:38px;border-radius:10px;object-fit:contain;background:#fff;margin:0 auto 8px;display:block}
.school-name{font-size:13px;font-weight:700;color:${mutedOnPrimary};letter-spacing:.3px}
.photo-wrap{width:132px;height:132px;border-radius:14px;background:${shade(primary, 0.12)};border:3px solid ${accent};margin:4px auto 0;display:flex;align-items:center;justify-content:center;color:${mutedOnPrimary};font-size:11px}
.student-name{text-align:center;font-size:20px;font-weight:800;margin:13px 0 2px}
.class-badge{text-align:center;margin-bottom:13px}
.class-badge span{background:${accent};color:${accentText};font-weight:800;font-size:14px;padding:4px 16px;border-radius:20px;display:inline-block}
.body{background:#F4F6FA;color:#1a2530;border-radius:22px 22px 0 0;flex:1;padding:16px 18px;display:flex;flex-direction:column;gap:9px}
.row{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #E3E8EE;padding-bottom:7px}
.row:last-child{border-bottom:none}
.row-label{font-size:10.5px;color:#8A94A6;font-weight:700}
.row-value{font-size:13px;font-weight:700;color:#0F2744}
@media print{
  body{background:#fff;padding:0;gap:14px}
  .card{box-shadow:none}
}
`
}

function openPrintWindow(school: SchoolBrand, title: string, cardsHtml: string) {
  const win = window.open('', '_blank', 'width=1000,height=700')
  if (!win) { alert('فعّل النوافذ المنبثقة للطباعة'); return }
  win.document.write('<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"></head><body></body></html>')

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=block" rel="stylesheet">
<style>${buildStyle(school)}</style></head><body>${cardsHtml}</body></html>`

  win.document.open()
  win.document.write(html)
  win.document.close()

  const doPrint = () => { try { win.focus(); win.print() } catch { /* نافذة أُغلقت */ } }

  const waitForImages = (): Promise<void> => {
    const imgs = Array.from(win.document.images)
    if (imgs.length === 0) return Promise.resolve()
    return Promise.all(
      imgs.map((img) => img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res() })
      )
    ).then(() => undefined)
  }

  const fonts = (win.document as Document & { fonts?: FontFaceSet }).fonts
  const fontsReady = fonts && fonts.ready ? fonts.ready.then(() => undefined) : Promise.resolve()

  Promise.all([fontsReady, waitForImages()]).then(() => setTimeout(doPrint, 150))
  setTimeout(doPrint, 3000)
}

/** طباعة بطاقة طالب واحد */
export function printStudentCard(school: SchoolBrand, student: CardStudent) {
  openPrintWindow(school, `بطاقة ${student.full_name}`, cardHtml(school, student))
}

/** طباعة بطاقات كل طلاب شعبة دفعة واحدة — صفحة واحدة فيها كل البطاقات، جاهزة للقص */
export function printClassCards(school: SchoolBrand, students: CardStudent[], classLabel: string) {
  if (students.length === 0) { alert('لا يوجد طلاب لطباعتهم'); return }
  const cards = students.map((s) => cardHtml(school, s)).join('')
  openPrintWindow(school, `بطاقات ${classLabel}`, cards)
}
