// أداة طباعة التقارير — تفتح نافذة نظيفة بترويسة المدرسة
// تُستخدم في كل الصفحات لطباعة الجداول كتقارير رسمية

export type SchoolHeader = {
  name: string
  vat?: string | null
  logoUrl?: string | null
  branch?: string | null
}

export type Column = { key: string; label: string }

export function printReport(opts: {
  school: SchoolHeader
  title: string
  subtitle?: string
  columns: Column[]
  rows: Record<string, string | number>[]
}) {
  const { school, title, subtitle, columns, rows } = opts
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB') + ' — ' + now.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })
  const initial = (school.name || 'م').trim().charAt(0)

  // الشعار الفعلي إن وُجد، وإلا الحرف الأول كبديل
  const logoBlock = school.logoUrl
    ? `<img class="rep-logo-img" src="${school.logoUrl}" alt="" />`
    : `<div class="rep-logo">${initial}</div>`

  const thead = columns.map((c) => `<th>${c.label}</th>`).join('')
  const tbody = rows.map((r) =>
    '<tr>' + columns.map((c) => `<td>${r[c.key] ?? '—'}</td>`).join('') + '</tr>'
  ).join('')

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=block" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Cairo',Tahoma,sans-serif}
body{padding:32px 30px;color:#1a2530;background:#fff}

/* ═══ الترويسة ═══ */
.rep-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding-bottom:18px;border-bottom:2px solid #0A1D33;position:relative}
.rep-head::after{content:'';position:absolute;bottom:-2px;right:0;width:96px;height:2px;background:#C9A227}
.rep-brand{display:flex;gap:13px;align-items:center}
.rep-logo{width:52px;height:52px;border-radius:13px;background:#0A1D33;color:#fff;display:grid;place-items:center;font-size:1.5rem;font-weight:800;flex-shrink:0}
.rep-logo-img{width:52px;height:52px;border-radius:13px;object-fit:contain;background:#fff;border:1px solid #E6EBF1;flex-shrink:0}
.rep-school{font-size:1.3rem;font-weight:800;color:#0A1D33;line-height:1.3}
.rep-branch{font-size:.82rem;color:#5A6B7E;margin-top:1px;font-weight:500}
.rep-vat{font-size:.75rem;color:#8A94A6;margin-top:3px;letter-spacing:.2px}
.rep-meta{text-align:left;flex-shrink:0}
.rep-title{font-size:1.05rem;font-weight:800;color:#0A1D33;padding:5px 14px;background:#F2F5F9;border-radius:8px;border-right:3px solid #C9A227;display:inline-block}
.rep-date{font-size:.76rem;color:#8A94A6;margin-top:7px;letter-spacing:.2px}

/* ═══ سطر السياق ═══ */
.rep-context{display:flex;justify-content:space-between;align-items:baseline;margin:18px 0 12px;gap:16px}
.rep-sub{font-size:.95rem;color:#0A1D33;font-weight:700}
.rep-count{font-size:.76rem;color:#8A94A6;background:#F7F9FC;padding:4px 11px;border-radius:20px;white-space:nowrap}

/* ═══ الجدول ═══ */
table{width:100%;border-collapse:separate;border-spacing:0;font-size:.85rem;border:1px solid #E6EBF1;border-radius:10px;overflow:hidden}
th{background:#0A1D33;color:#fff;padding:11px 13px;text-align:right;font-weight:600;font-size:.83rem;letter-spacing:.2px}
th:not(:last-child){border-left:1px solid rgba(255,255,255,.13)}
td{padding:10px 13px;border-bottom:1px solid #EDF1F6;text-align:right;color:#26333F}
tr:last-child td{border-bottom:none}
tbody tr:nth-child(even) td{background:#FAFBFD}

/* ═══ التذييل ═══ */
.rep-foot{margin-top:28px;padding-top:13px;border-top:1px solid #E6EBF1;display:flex;justify-content:space-between;align-items:center;font-size:.7rem;color:#9AA7B8;gap:12px}
.rep-foot-brand{font-weight:600;color:#5A6B7E}
.rep-foot-dot{width:5px;height:5px;border-radius:50%;background:#C9A227;display:inline-block;margin-left:6px;vertical-align:middle}

@media print{
  body{padding:0}
  table{page-break-inside:auto}
  tr{page-break-inside:avoid;page-break-after:auto}
  thead{display:table-header-group}
}
</style></head><body>
<div class="rep-head">
  <div class="rep-brand">${logoBlock}
    <div>
      <div class="rep-school">${school.name}</div>
      ${school.branch ? `<div class="rep-branch">${school.branch}</div>` : ''}
      ${school.vat ? `<div class="rep-vat">الرقم الضريبي: ${school.vat}</div>` : ''}
    </div>
  </div>
  <div class="rep-meta"><div class="rep-title">${title}</div><div class="rep-date">${dateStr}</div></div>
</div>
<div class="rep-context">
  <div class="rep-sub">${subtitle ?? ''}</div>
  <div class="rep-count">عدد السجلات: ${rows.length}</div>
</div>
<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
<div class="rep-foot">
  <span><span class="rep-foot-dot"></span><span class="rep-foot-brand">RusoomPay</span> — النظام المحاسبي للمدارس</span>
  <span>${now.getFullYear()} · ${school.name}</span>
</div>
</body></html>`

  const win = window.open('', '_blank', 'width=900,height=650')
  if (!win) { alert('فعّل النوافذ المنبثقة للطباعة'); return }
  win.document.write(html)
  win.document.close()

  // انتظر تحميل خط Cairo والشعار فعلياً قبل الطباعة
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
  // احتياط: اطبع بعد 3 ثوانٍ على أي حال
  setTimeout(doPrint, 3000)
}
