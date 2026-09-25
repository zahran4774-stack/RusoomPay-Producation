// lib/monthly-payment-report-print.ts
// طباعة تقرير الدفع الشهري لكامل المدرسة — قسمان: دفعوا هذا الشهر / لم يدفعوا.
// نفس أسلوب invoice-html.ts وpayment-tracker-print.ts (HTML + طباعة المتصفّح،
// خط Cairo، انتظار تحميل الخط/الشعار قبل الطباعة).

export type PaidRow = {
  student_id: string; full_name: string; code: string
  grade: string; section: string | null
  amount_paid: number; last_payment_date: string | null
}
export type UnpaidRow = {
  student_id: string; full_name: string; code: string
  grade: string; section: string | null
  guardian_phone: string | null
}

export type MonthlyReportData = {
  school: {
    name: string
    vat?: string | null
    address?: string | null
    phone?: string | null
    logoUrl?: string | null
    branch?: string | null
  }
  monthLabel: string
  currency?: string
  paid: PaidRow[]
  unpaid: UnpaidRow[]
}

export function printMonthlyPaymentReport(d: MonthlyReportData) {
  const cur = d.currency ?? 'OMR'
  const fmt = (n: number) => new Intl.NumberFormat('ar-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n || 0)
  const today = new Date().toLocaleDateString('ar-OM', { year: 'numeric', month: 'long', day: 'numeric' })

  const initial = (d.school.name || 'م').trim().charAt(0)
  const logoBlock = d.school.logoUrl
    ? `<img class="logo-img" src="${d.school.logoUrl}" alt="" />`
    : `<div class="logo">${initial}</div>`

  const totalPaid = d.paid.reduce((a, r) => a + (r.amount_paid || 0), 0)

  const paidRows = d.paid.map((r) => {
    const lastDate = r.last_payment_date
      ? new Date(r.last_payment_date).toLocaleDateString('ar-OM', { year: 'numeric', month: 'short', day: 'numeric' })
      : '—'
    return `<tr>
      <td>${r.code}</td>
      <td>${r.full_name}</td>
      <td>${r.grade}${r.section ? ' - ' + r.section : ''}</td>
      <td style="text-align:left">${fmt(r.amount_paid)}</td>
      <td style="text-align:center">${lastDate}</td>
    </tr>`
  }).join('')

  const unpaidRows = d.unpaid.map((r) => `<tr>
    <td>${r.code}</td>
    <td>${r.full_name}</td>
    <td>${r.grade}${r.section ? ' - ' + r.section : ''}</td>
    <td style="direction:ltr;text-align:right">${r.guardian_phone || '—'}</td>
  </tr>`).join('')

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>تقرير الدفع الشهري — ${d.monthLabel}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=block" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;font-family:'Cairo',Tahoma,sans-serif}
  body{padding:34px 30px;color:#1a2530;background:#fff}

  .head{display:flex;justify-content:space-between;align-items:flex-start;gap:22px;border-bottom:2px solid #0A1D33;padding-bottom:18px;margin-bottom:22px;position:relative}
  .head::after{content:'';position:absolute;bottom:-2px;right:0;width:110px;height:2px;background:#C9A227}
  .brand{display:flex;gap:14px;align-items:center}
  .logo{width:52px;height:52px;border-radius:13px;background:#0A1D33;color:#fff;display:grid;place-items:center;font-size:1.5rem;font-weight:800;flex-shrink:0}
  .logo-img{width:52px;height:52px;border-radius:13px;object-fit:contain;background:#fff;border:1px solid #E6EBF1;flex-shrink:0}
  .school{font-size:1.25rem;font-weight:800;color:#0A1D33;line-height:1.3}
  .branch{font-size:.8rem;color:#5A6B7E;font-weight:500;margin-top:1px}
  .meta{font-size:.74rem;color:#8A94A6;margin-top:4px;line-height:1.7}
  .rp-title{text-align:left;flex-shrink:0}
  .rp-title h1{font-size:1.3rem;color:#0A1D33;font-weight:800}
  .rp-title .no{font-size:.78rem;color:#8A94A6;margin-top:5px;line-height:1.6}

  .summary{display:flex;gap:14px;margin-bottom:22px}
  .sbox{flex:1;border-radius:12px;padding:14px 16px}
  .sbox.paid{background:#EAF7F0;border:1px solid #BFE5D0}
  .sbox.unpaid{background:#FCE9E6;border:1px solid #F3C9C2}
  .sbox h3{font-size:.72rem;font-weight:700;margin-bottom:6px}
  .sbox.paid h3{color:#1A7A45}
  .sbox.unpaid h3{color:#C0392B}
  .sbox .v{font-size:1.15rem;font-weight:800;color:#0A1D33}

  h2.sec{font-size:1rem;color:#0A1D33;margin:22px 0 10px;padding-right:10px;border-right:4px solid #C9A227}
  h2.sec.red{border-right-color:#C0392B}

  table{width:100%;border-collapse:separate;border-spacing:0;margin-bottom:8px;border:1px solid #E6EBF1;border-radius:10px;overflow:hidden}
  thead{background:#0A1D33;color:#fff}
  th{padding:9px 12px;text-align:right;font-size:.76rem;font-weight:600}
  td{padding:9px 12px;font-size:.82rem;color:#26333F;border-top:1px solid #EEF2F1}
  tbody tr:nth-child(even){background:#FAFBFD}

  .foot{margin-top:30px;padding-top:14px;border-top:1px solid #E6EBF1;text-align:center;color:#9AA7B8;font-size:.7rem;line-height:2}
  .foot-brand{font-weight:700;color:#5A6B7E}
  .foot-dot{width:5px;height:5px;border-radius:50%;background:#C9A227;display:inline-block;margin-left:6px;vertical-align:middle}

  @media print{
    body{padding:14px}
    @page{margin:10mm}
    table{page-break-inside:auto}
    tr{page-break-inside:avoid;page-break-after:auto}
    thead{display:table-header-group}
    .head{page-break-after:avoid}
    h2.sec{page-break-after:avoid}
    .summary{page-break-inside:avoid}
  }
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
        </div>
      </div>
    </div>
    <div class="rp-title">
      <h1>تقرير الدفع الشهري</h1>
      <div class="no">شهر ${d.monthLabel}<br>تاريخ الإصدار: ${today}</div>
    </div>
  </div>

  <div class="summary">
    <div class="sbox paid">
      <h3>دفعوا هذا الشهر</h3>
      <div class="v">${d.paid.length} طالب — ${fmt(totalPaid)} ${cur}</div>
    </div>
    <div class="sbox unpaid">
      <h3>لم يدفعوا هذا الشهر</h3>
      <div class="v">${d.unpaid.length} طالب</div>
    </div>
  </div>

  <h2 class="sec">✓ دفعوا هذا الشهر (${d.paid.length})</h2>
  <table>
    <thead><tr><th>الرقم</th><th>الطالب</th><th>الصف</th><th style="text-align:left">المبلغ (${cur})</th><th style="text-align:center">آخر دفعة</th></tr></thead>
    <tbody>${paidRows || '<tr><td colspan="5" style="text-align:center;padding:16px;color:#999">لا يوجد</td></tr>'}</tbody>
  </table>

  <h2 class="sec red">✗ لم يدفعوا هذا الشهر (${d.unpaid.length})</h2>
  <table>
    <thead><tr><th>الرقم</th><th>الطالب</th><th>الصف</th><th>رقم ولي الأمر</th></tr></thead>
    <tbody>${unpaidRows || '<tr><td colspan="4" style="text-align:center;padding:16px;color:#999">لا يوجد — الجميع دفع هذا الشهر ✓</td></tr>'}</tbody>
  </table>

  <div class="foot">
    <span class="foot-dot"></span>تقرير صادر إلكترونياً من نظام <span class="foot-brand">RusoomPay</span><br>
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
