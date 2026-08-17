// lib/print-student-card.ts
// طباعة بطاقة تعليق صدر للطالب — بطاقة واحدة أو دفعة كاملة (شعبة).
// المقاس محسوب هندسياً على ورق A4: عمودين × 3 صفوف = 6 بطاقات بالضبط لكل
// صفحة، بدون أي هدر بالورق:
//   210mm (عرض A4) = 10mm هامش + 92.5mm بطاقة + 5mm فراغ + 92.5mm بطاقة + 10mm هامش
//   297mm (طول A4) = 10mm هامش + 89mm×3 بطاقات + 5mm×2 فراغ + 10mm هامش
// لو عدد الطلاب أكثر من 6، نقسّمهم لصفحات A4 منفصلة صراحة (page-break-after)
// بدل الاعتماد على تكسير الشبكة التلقائي، لأنه غير موثوق بكل المتصفحات.

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
const CARDS_PER_PAGE = 6 // 2 عمود × 3 صفوف على A4

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

// يقسّم مصفوفة الطلاب لصفحات A4، كل صفحة فيها 6 بطاقات بالضبط (أو أقل بآخر صفحة)
function paginate(school: SchoolBrand, students: CardStudent[]): string {
  const pages: CardStudent[][] = []
  for (let i = 0; i < students.length; i += CARDS_PER_PAGE) {
    pages.push(students.slice(i, i + CARDS_PER_PAGE))
  }
  return pages
    .map((pageStudents, i) => {
      const cards = pageStudents.map((s) => cardHtml(school, s)).join('')
      const lastPage = i === pages.length - 1
      return `<div class="page"${lastPage ? '' : ' style="page-break-after:always"'}>${cards}</div>`
    })
    .join('')
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
html,body{background:#EDF0F5}
body{padding:10mm;display:flex;flex-direction:column;align-items:flex-start;gap:0}

/* صفحة A4 واحدة = شبكة 2×3 بطاقات، مقاس محسوب بالضبط بدون هدر ورق */
.page{
  display:grid;
  grid-template-columns:repeat(2,92.5mm);
  grid-template-rows:repeat(3,89mm);
  gap:5mm;
}

.card{
  width:92.5mm;height:89mm;
  background:linear-gradient(180deg,${gradTop} 0%,${gradBottom} 100%);
  border-radius:4mm;overflow:hidden;position:relative;color:${primaryText};
  display:flex;flex-direction:column;break-inside:avoid;page-break-inside:avoid;
}
.hole{position:absolute;top:2.5mm;left:50%;transform:translateX(-50%);width:11mm;height:1.6mm;background:rgba(0,0,0,.35);border-radius:1.5mm;z-index:5}
.card-header{padding:4mm 3mm 1.5mm;text-align:center}
.logo-fallback{width:7mm;height:7mm;background:${accent};border-radius:1.6mm;margin:0 auto 1.3mm;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:3.2mm;color:${accentText}}
.logo-img{width:7mm;height:7mm;border-radius:1.6mm;object-fit:contain;background:#fff;margin:0 auto 1.3mm;display:block}
.school-name{font-size:2.3mm;font-weight:700;color:${mutedOnPrimary};letter-spacing:.1mm}
.photo-wrap{width:22mm;height:22mm;border-radius:2.5mm;background:${shade(primary, 0.12)};border:0.6mm solid ${accent};margin:0.5mm auto 0;display:flex;align-items:center;justify-content:center;color:${mutedOnPrimary};font-size:2mm;text-align:center;padding:1mm}
.student-name{text-align:center;font-size:3.6mm;font-weight:800;margin:2mm 0 0.5mm;line-height:1.2}
.class-badge{text-align:center;margin-bottom:1.8mm}
.class-badge span{background:${accent};color:${accentText};font-weight:800;font-size:2.5mm;padding:0.8mm 3mm;border-radius:3.5mm;display:inline-block}
.body{background:#F4F6FA;color:#1a2530;border-radius:4mm 4mm 0 0;flex:1;padding:2.5mm 3.2mm;display:flex;flex-direction:column;gap:1.6mm;justify-content:center}
.row{display:flex;justify-content:space-between;align-items:center;border-bottom:0.25mm solid #E3E8EE;padding-bottom:1.3mm}
.row:last-child{border-bottom:none}
.row-label{font-size:1.9mm;color:#8A94A6;font-weight:700}
.row-value{font-size:2.3mm;font-weight:700;color:#0F2744}

@media screen{
  /* معاينة على الشاشة — نفس المقاس الفعلي (المتصفح يحوّل mm إلى px تلقائياً) */
  body{background:#EDF0F5;flex-direction:row;flex-wrap:wrap}
  .page{margin-bottom:10mm;box-shadow:0 4px 16px rgba(10,29,51,.12);background:#fff}
}
@media print{
  @page{size:A4;margin:0}
  html,body{background:#fff}
  body{padding:10mm}
  .page{box-shadow:none}
}
`
}

function openPrintWindow(school: SchoolBrand, title: string, bodyHtml: string) {
  const win = window.open('', '_blank', 'width=1000,height=700')
  if (!win) { alert('فعّل النوافذ المنبثقة للطباعة'); return }
  win.document.write('<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"></head><body></body></html>')

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=block" rel="stylesheet">
<style>${buildStyle(school)}</style></head><body>${bodyHtml}</body></html>`

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

/** طباعة بطاقة طالب واحد — بنفس مقاس صفحة الـA4 (بطاقة وحدة أعلى الصفحة) */
export function printStudentCard(school: SchoolBrand, student: CardStudent) {
  openPrintWindow(school, `بطاقة ${student.full_name}`, paginate(school, [student]))
}

/** طباعة بطاقات كل طلاب شعبة — 6 بطاقات بالضبط لكل صفحة A4، وتُكمل صفحات إضافية تلقائياً لو أكثر */
export function printClassCards(school: SchoolBrand, students: CardStudent[], classLabel: string) {
  if (students.length === 0) { alert('لا يوجد طلاب لطباعتهم'); return }
  openPrintWindow(school, `بطاقات ${classLabel}`, paginate(school, students))
}
