// lib/payment-tracker-print.ts
// طباعة سجل الدفعات الشهري الكامل للعام الدراسي — نفس أسلوب invoice-html.ts
// تماماً (HTML + طباعة المتصفّح، خط Cairo، انتظار تحميل الخط/الشعار قبل الطباعة).

export type TrackerMonthRow = {
  month_label: string
  month_key: string
  paid_amount: number
  has_payment: boolean
  cumulative_remaining: number
  last_payment_date: string | null
}

export type TrackerPrintData = {
  school: {
    name: string
    vat?: string | null
    address?: string | null
    phone?: string | null
    logoUrl?: string | null
    branch?: string | null
  }
  studentName: string
  studentCode?: string | null
  currency?: string
  months: TrackerMonthRow[]
}

export function printPaymentTracker(d: TrackerPrintData) {
  const cur = d.currency ?? 'OMR'
  const fmt = (n: number) => new Intl.NumberFormat('ar-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n || 0)
  const today = new Date().toLocaleDateString('ar-OM', { year: 'numeric', month: 'long', day: 'numeric' })

  const initial = (d.school.name || 'م').trim().charAt(0)
  const logoBlock = d.school.logoUrl
    ? `<img class="logo-img" src="${d.school.logoUrl}" alt="" />`
    : `<div class="logo">${initial}</div>`

  const totalPaid = d.months.reduce((a, m) => a + (m.paid_amount || 0), 0)
  const paidMonthsCount = d.months.filter((m) => m.has_payment).length
  const finalRemaining = d.months.length > 0 ? d.months[d.months.length - 1].cumulative_remaining : 0

  const rows = d.months.map((m) => {
    const lastDate = m.last_payment_date
      ? new Date(m.last_payment_date).toLocaleDateString('ar-OM', { year: 'numeric', month: 'short', day: 'numeric' })
      : '—'
    return `<tr>
      <td>${m.month_label}</td>
      <td style="text-align:center">
        <span class="status-badge ${m.has_payment ? 'ok' : 'no'}">${m.has_payment ? 'مدفوع ✓' : 'غير مدفوع'}</span>
      </td>
      <td style="text-align:left">${m.has_payment ? fmt(m.paid_amount) : '—'}</td>
      <td style="text-align:center">${lastDate}</td>
      <td style="text-align:left">${fmt(m.cumulative_remaining)}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>سجل الدفعات الشهري — ${d.studentName}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=block" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;font-family:'Cairo',Tahoma,sans-serif}
  body{padding:38px 34px;color:#1a2530;background:#fff}

  .head{display:flex;justify-content:space-between;align-items:flex-start;gap:22px;border-bottom:2px solid #0A1D33;padding-bottom:20px;margin-bottom:28px;position:relative}
  .head::after{content:'';position:absolute;bottom:-2px;right:0;width:110px;height:2px;background:#C9A227}
  .brand{display:flex;gap:14px;align-items:center}
  .logo{width:56px;height:56px;border-radius:14px;background:#0A1D33;color:#fff;display:grid;place-items:center;font-size:1.6rem;font-weight:800;flex-shrink:0}
  .logo-img{width:56px;height:56px;border-radius:14px;object-fit:contain;background:#fff;border:1px solid #E6EBF1;flex-shrink:0}
  .school{font-size:1.32rem;font-weight:800;color:#0A1D33;line-height:1.3}
  .branch{font-size:.84rem;color:#5A6B7E;font-weight:500;margin-top:1px}
  .meta{font-size:.76rem;color:#8A94A6;margin-top:4px;line-height:1.75}
  .inv-title{text-align:left;flex-shrink:0}
  .inv-title h1{font-size:1.4rem;color:#0A1D33;font-weight:800;letter-spacing:.3px}
  .inv-title .no{font-size:.8rem;color:#8A94A6;margin-top:6px;line-height:1.7}

  .row{display:flex;gap:16px;margin-bottom:24px}
  .box{flex:1;background:#FAFBFD;border:1px solid #E6EBF1;border-radius:12px;padding:15px 17px}
  .box h3{font-size:.71rem;color:#8A94A6;font-weight:700;margin-bottom:7px;letter-spacing:.5px}
  .box .v{font-size:1rem;font-weight:700;color:#0A1D33}
  .box .s{font-size:.78rem;color:#5A6B7E;margin-top:3px}

  table{width:100%;border-collapse:separate;border-spacing:0;margin-bottom:20px;border:1px solid #E6EBF1;border-radius:10px;overflow:hidden}
  thead{background:#0A1D33;color:#fff}
  th{padding:11px 14px;text-align:right;font-size:.8rem;font-weight:600;letter-spacing:.2px}
  td{padding:11px 14px;font-size:.86rem;color:#26333F;border-top:1px solid #EEF2F1}
  tbody tr:nth-child(even){background:#FAFBFD}

  .status-badge{display:inline-block;padding:3px 11px;border-radius:20px;font-size:.76rem;font-weight:700}
  .status-badge.ok{background:#E6F4EC;color:#1A7A45}
  .status-badge.no{background:#FCE9E6;color:#C0392B}

  .total{background:#0A1D33;border-radius:12px;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;color:#fff;position:relative;overflow:hidden}
  .total::before{content:'';position:absolute;top:0;right:0;width:4px;height:100%;background:#C9A227}
  .total .lbl{font-size:.92rem;font-weight:600;opacity:.9}
  .total .amt{font-size:1.4rem;font-weight:800;letter-spacing:.3px}
  .rem{margin-top:12px;padding:12px 18px;background:#FFF8EA;border:1px solid #EAD9A0;border-radius:10px;color:#8A6D0F;font-size:.86rem;font-weight:600}

  .foot{margin-top:36px;padding-top:16px;border-top:1px solid #E6EBF1;text-align:center;color:#9AA7B8;font-size:.72rem;line-height:2}
  .foot-brand{font-weight:700;color:#5A6B7E}
  .foot-dot{width:5px;height:5px;border-radius:50%;background:#C9A227;display:inline-block;margin-left:6px;vertical-align:middle}

  @media print{body{padding:16px}@page{margin:12mm}}
</style></head><body>
  <div class="head">
    <div class="brand">
      ${logoBlock}
      <div>
        <div class="school">${d.school.name}</div>
        ${d.school.branch ? `<div class="branch">${d.school.branch}</div>` : ''}
        <div class="meta">
          ${d.school.address ? d.school.address + '<br>' : ''}
          ${d.school.phone ? 'هاتف: ' + d.school.phone : ''}
          ${d.school.vat ? ' · الرقم الضريبي: ' + d.school.vat : ''}
        </div>
      </div>
    </div>
    <div class="inv-title">
      <h1>سجل الدفعات الشهري</h1>
      <div class="no">العام الدراسي الحالي<br>${today}</div>
    </div>
  </div>

  <div class="row">
    <div class="box">
      <h3>الطالب</h3>
      <div class="v">${d.studentName}</div>
      ${d.studentCode ? `<div class="s">الرقم المدرسي: ${d.studentCode}</div>` : ''}
    </div>
    <div class="box">
      <h3>ملخّص السداد</h3>
      <div class="v">${paidMonthsCount} من ${d.months.length} شهراً مدفوعاً</div>
      <div class="s">إجمالي المدفوع: ${fmt(totalPaid)} ${cur}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>الشهر</th>
        <th style="text-align:center">الحالة</th>
        <th style="text-align:left">المبلغ المدفوع (${cur})</th>
        <th style="text-align:center">تاريخ آخر دفعة</th>
        <th style="text-align:left">المتبقي التراكمي (${cur})</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="total">
    <span class="lbl">إجمالي المدفوع خلال العام</span>
    <span class="amt">${fmt(totalPaid)} ${cur}</span>
  </div>

  ${finalRemaining > 0.0005 ? `<div class="rem">المتبقي الحالي على إجمالي الرسوم: ${fmt(finalRemaining)} ${cur}</div>` : ''}

  <div class="foot">
    <span class="foot-dot"></span>سجل صادر إلكترونياً من نظام <span class="foot-brand">RusoomPay</span><br>
    ${d.school.name}
  </div>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) { alert('يرجى السماح بالنوافذ المنبثقة للطباعة'); return }
  w.document.write(html)
  w.document.close()

  const doPrint = () => { try { w.focus(); w.print() } catch { /* نافذة أُغلقت */ } }

  const waitForImages = (): Promise<void> => {
    const imgs = Array.from(w.document.images)
    if (imgs.length === 0) return Promise.resolve()
    return Promise.all(
      imgs.map((img) => img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res() })
      )
    ).then(() => undefined)
  }

  const fonts = (w.document as Document & { fonts?: FontFaceSet }).fonts
  const fontsReady = fonts && fonts.ready ? fonts.ready.then(() => undefined) : Promise.resolve()

  Promise.all([fontsReady, waitForImages()]).then(() => setTimeout(doPrint, 150))
  setTimeout(doPrint, 3000)
}
