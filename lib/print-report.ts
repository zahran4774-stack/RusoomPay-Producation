// أداة طباعة التقارير — تفتح نافذة نظيفة بترويسة المدرسة
// تُستخدم في كل الصفحات لطباعة الجداول كتقارير رسمية

export type SchoolHeader = {
  name: string
  vat?: string | null
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

  const thead = columns.map((c) => `<th>${c.label}</th>`).join('')
  const tbody = rows.map((r) =>
    '<tr>' + columns.map((c) => `<td>${r[c.key] ?? '—'}</td>`).join('') + '</tr>'
  ).join('')

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif}
body{padding:28px;color:#1a2530}
.rep-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0F2744;padding-bottom:16px}
.rep-brand{display:flex;gap:12px;align-items:center}
.rep-logo{width:46px;height:46px;border-radius:11px;background:#0F2744;color:#fff;display:grid;place-items:center;font-size:1.4rem;font-weight:800}
.rep-school{font-size:1.25rem;font-weight:800;color:#0F2744}
.rep-vat{font-size:.8rem;color:#667;margin-top:2px}
.rep-meta{text-align:left}
.rep-title{font-size:1.1rem;font-weight:700;color:#1E5C4E}
.rep-date{font-size:.8rem;color:#667;margin-top:3px}
.rep-sub{font-size:.9rem;color:#445;margin:10px 0 4px;font-weight:600}
.rep-count{font-size:.8rem;color:#8A94A6;margin-bottom:12px}
table{width:100%;border-collapse:collapse;margin-top:10px;font-size:.85rem}
th{background:#0F2744;color:#fff;padding:9px 11px;text-align:right;font-weight:600}
td{padding:8px 11px;border-bottom:1px solid #E6EBF1;text-align:right}
tr:nth-child(even) td{background:#F7F9FC}
.rep-foot{margin-top:24px;padding-top:12px;border-top:1px solid #ccc;font-size:.72rem;color:#9AA7B8;text-align:center}
@media print{body{padding:0}}
</style></head><body>
<div class="rep-head">
  <div class="rep-brand"><div class="rep-logo">${initial}</div>
    <div><div class="rep-school">${school.name}</div>${school.vat ? `<div class="rep-vat">الرقم الضريبي: ${school.vat}</div>` : ''}</div>
  </div>
  <div class="rep-meta"><div class="rep-title">${title}</div><div class="rep-date">${dateStr}</div></div>
</div>
${subtitle ? `<div class="rep-sub">${subtitle}</div>` : ''}
<div class="rep-count">عدد السجلات: ${rows.length}</div>
<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
<div class="rep-foot">صادر عن نظام RusoomPay المحاسبي للمدارس · ${now.getFullYear()}</div>
</body></html>`

  const win = window.open('', '_blank', 'width=900,height=650')
  if (!win) { alert('فعّل النوافذ المنبثقة للطباعة'); return }
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 350)
}
