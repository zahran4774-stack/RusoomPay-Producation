function exportPDF() {
    if (!rows || rows.length === 0) return
    const kindLabel = KINDS.find((k) => k.key === kind)!.label
    const period = kind === 'balance' ? `كما في ${to}` : `من ${from} إلى ${to}`
    const initial = (school.name || 'م').trim().charAt(0)

    // بناء رؤوس وصفوف الجدول حسب نوع التقرير
    let thead = ''
    let tbody = ''

    if (kind === 'trial') {
      const totD = rows.reduce((s, r) => s + (r.debit as number), 0)
      const totC = rows.reduce((s, r) => s + (r.credit as number), 0)
      thead = '<th>الرمز</th><th>الحساب</th><th>مدين</th><th>دائن</th>'
      tbody = rows.map((r) =>
        `<tr><td>${r.code}</td><td>${r.name}</td><td class="n">${fmt(r.debit as number)}</td><td class="n">${fmt(r.credit as number)}</td></tr>`
      ).join('')
      tbody += `<tr class="tot"><td colspan="2">الإجمالي</td><td class="n">${fmt(totD)}</td><td class="n">${fmt(totC)}</td></tr>`
    } else if (kind === 'journal') {
      thead = '<th>التاريخ</th><th>المرجع</th><th>الحساب</th><th>مدين</th><th>دائن</th>'
      tbody = rows.map((r) =>
        `<tr><td>${r.entry_date}</td><td>${r.reference ?? '—'}</td><td>${r.account_name}</td><td class="n">${fmt(r.debit as number)}</td><td class="n">${fmt(r.credit as number)}</td></tr>`
      ).join('')
    } else if (kind === 'vat') {
      const r = rows[0] as { applies: boolean; vat_rate: number; revenue_total: number; vat_amount: number }
      if (!r?.applies) {
        thead = '<th>البيان</th>'
        tbody = '<tr><td>الضريبة غير مطبّقة على هذه المدرسة</td></tr>'
      } else {
        thead = '<th>البند</th><th>القيمة</th>'
        tbody =
          `<tr><td>نسبة الضريبة</td><td class="n">${r.vat_rate}%</td></tr>` +
          `<tr><td>إجمالي الإيرادات (قبل الضريبة)</td><td class="n">${fmt(r.revenue_total)} ${sym}</td></tr>` +
          `<tr class="tot"><td>قيمة الضريبة المستحقّة</td><td class="n">${fmt(r.vat_amount)} ${sym}</td></tr>`
      }
    } else {
      const valKey = kind === 'income' ? 'amount' : 'balance'
      thead = `<th>القسم</th><th>الحساب</th><th>القيمة (${sym})</th>`
      tbody = rows.map((r) =>
        `<tr><td>${typeLabel(r.section as string)}</td><td>${r.name}</td><td class="n">${fmt(r[valKey] as number)}</td></tr>`
      ).join('')
    }

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${kindLabel}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Cairo',Tahoma,sans-serif}
body{padding:28px;color:#1a2530}
.h{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0F2744;padding-bottom:16px}
.b{display:flex;gap:12px;align-items:center}
.lg{width:46px;height:46px;border-radius:11px;background:#0F2744;color:#fff;display:grid;place-items:center;font-size:1.4rem;font-weight:800}
.sn{font-size:1.25rem;font-weight:800;color:#0F2744}
.vt{font-size:.8rem;color:#667;margin-top:2px}
.m{text-align:left}
.tl{font-size:1.1rem;font-weight:700;color:#1E5C4E}
.pd{font-size:.82rem;color:#667;margin-top:3px}
.ct{font-size:.8rem;color:#8A94A6;margin:12px 0}
table{width:100%;border-collapse:collapse;font-size:.85rem}
th{background:#0F2744;color:#fff;padding:9px 11px;text-align:right;font-weight:600}
td{padding:8px 11px;border-bottom:1px solid #E6EBF1;text-align:right}
td.n{direction:ltr;text-align:left;font-variant-numeric:tabular-nums}
tr:nth-child(even) td{background:#F7F9FC}
tr.tot td{font-weight:800;background:#EEF3F9;border-top:2px solid #0F2744}
.f{margin-top:24px;padding-top:12px;border-top:1px solid #ccc;font-size:.72rem;color:#9AA7B8;text-align:center}
@media print{body{padding:0}}
</style></head><body>
<div class="h">
  <div class="b"><div class="lg">${initial}</div>
    <div><div class="sn">${school.name}</div>${school.vat_number ? `<div class="vt">الرقم الضريبي: ${school.vat_number}</div>` : ''}</div>
  </div>
  <div class="m"><div class="tl">${kindLabel}</div><div class="pd">${period}</div></div>
</div>
<div class="ct">عدد السجلات: ${rows.length}</div>
<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
<div class="f">صادر عن نظام RusoomPay المحاسبي للمدارس · ${new Date().getFullYear()}</div>
</body></html>`

    const win = window.open('', '_blank', 'width=900,height=650')
    if (!win) { alert('فعّل النوافذ المنبثقة للطباعة'); return }
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 400)
  }
