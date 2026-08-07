// lib/invoice-html.ts
// مولّد فاتورة بـHTML + طباعة المتصفّح — يدعم العربية وخط Cairo بشكل كامل

export type InvoiceData = {
  school: {
    name: string
    vat?: string | null
    address?: string | null
    phone?: string | null
    logoUrl?: string | null
    branch?: string | null
  }
  invoiceNo: string
  paidAt: string
  studentName: string
  studentCode?: string | null
  feeDescription: string
  amount: number
  method: string
  currency?: string
  remaining?: number | null
}

const methodLabel = (m: string) => ({
  bank: 'تحويل بنكي', cash: 'نقداً', card: 'بطاقة', cheque: 'شيك', online: 'دفع إلكتروني',
}[m] ?? m)

export function generateInvoice(d: InvoiceData) {
  const cur = d.currency ?? 'OMR'
  const fmt = (n: number) => new Intl.NumberFormat('ar-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n)
  const date = (() => {
    try { return new Date(d.paidAt).toLocaleDateString('ar-OM', { year: 'numeric', month: 'long', day: 'numeric' }) }
    catch { return d.paidAt }
  })()

  // شعار المدرسة الفعلي، وإلا أول حرف من اسمها كبديل
  const initial = (d.school.name || 'م').trim().charAt(0)
  const logoBlock = d.school.logoUrl
    ? `<img class="logo-img" src="${d.school.logoUrl}" alt="" />`
    : `<div class="logo">${initial}</div>`

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>فاتورة ${d.invoiceNo}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=block" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;font-family:'Cairo',Tahoma,sans-serif}
  body{padding:38px 34px;color:#1a2530;background:#fff}

  /* ═══ الترويسة ═══ */
  .head{display:flex;justify-content:space-between;align-items:flex-start;gap:22px;border-bottom:2px solid #0A1D33;padding-bottom:20px;margin-bottom:28px;position:relative}
  .head::after{content:'';position:absolute;bottom:-2px;right:0;width:110px;height:2px;background:#C9A227}
  .brand{display:flex;gap:14px;align-items:center}
  .logo{width:56px;height:56px;border-radius:14px;background:#0A1D33;color:#fff;display:grid;place-items:center;font-size:1.6rem;font-weight:800;flex-shrink:0}
  .logo-img{width:56px;height:56px;border-radius:14px;object-fit:contain;background:#fff;border:1px solid #E6EBF1;flex-shrink:0}
  .school{font-size:1.32rem;font-weight:800;color:#0A1D33;line-height:1.3}
  .branch{font-size:.84rem;color:#5A6B7E;font-weight:500;margin-top:1px}
  .meta{font-size:.76rem;color:#8A94A6;margin-top:4px;line-height:1.75}
  .inv-title{text-align:left;flex-shrink:0}
  .inv-title h1{font-size:1.55rem;color:#0A1D33;font-weight:800;letter-spacing:.5px}
  .inv-title .no{font-size:.8rem;color:#8A94A6;margin-top:6px;line-height:1.7}
  .inv-badge{display:inline-block;margin-top:8px;background:#F2F5F9;border-right:3px solid #C9A227;padding:4px 12px;border-radius:7px;font-size:.75rem;color:#0A1D33;font-weight:700}

  /* ═══ البطاقات ═══ */
  .row{display:flex;gap:16px;margin-bottom:24px}
  .box{flex:1;background:#FAFBFD;border:1px solid #E6EBF1;border-radius:12px;padding:15px 17px}
  .box h3{font-size:.71rem;color:#8A94A6;font-weight:700;margin-bottom:7px;letter-spacing:.5px}
  .box .v{font-size:1rem;font-weight:700;color:#0A1D33}
  .box .s{font-size:.78rem;color:#5A6B7E;margin-top:3px}

  /* ═══ الجدول ═══ */
  table{width:100%;border-collapse:separate;border-spacing:0;margin-bottom:20px;border:1px solid #E6EBF1;border-radius:10px;overflow:hidden}
  thead{background:#0A1D33;color:#fff}
  th{padding:12px 15px;text-align:right;font-size:.82rem;font-weight:600;letter-spacing:.2px}
  td{padding:14px 15px;font-size:.9rem;color:#26333F}

  /* ═══ الإجمالي ═══ */
  .total{background:#0A1D33;border-radius:12px;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;color:#fff;position:relative;overflow:hidden}
  .total::before{content:'';position:absolute;top:0;right:0;width:4px;height:100%;background:#C9A227}
  .total .lbl{font-size:.92rem;font-weight:600;opacity:.9}
  .total .amt{font-size:1.5rem;font-weight:800;letter-spacing:.3px}
  .rem{margin-top:12px;padding:12px 18px;background:#FFF8EA;border:1px solid #EAD9A0;border-radius:10px;color:#8A6D0F;font-size:.86rem;font-weight:600}

  /* ═══ التذييل ═══ */
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
      <h1>فاتورة</h1>
      <div class="no">رقم: ${d.invoiceNo}<br>${date}</div>
      <div class="inv-badge">مدفوعة</div>
    </div>
  </div>

  <div class="row">
    <div class="box">
      <h3>الطالب</h3>
      <div class="v">${d.studentName}</div>
      ${d.studentCode ? `<div class="s">الرقم المدرسي: ${d.studentCode}</div>` : ''}
    </div>
    <div class="box">
      <h3>طريقة الدفع</h3>
      <div class="v">${methodLabel(d.method)}</div>
      <div class="s">${date}</div>
    </div>
  </div>

  <table>
    <thead><tr><th>البيان</th><th style="text-align:left">المبلغ (${cur})</th></tr></thead>
    <tbody>
      <tr>
        <td>${d.feeDescription}</td>
        <td style="text-align:left;font-weight:700">${fmt(d.amount)}</td>
      </tr>
    </tbody>
  </table>

  <div class="total">
    <span class="lbl">المبلغ المدفوع</span>
    <span class="amt">${fmt(d.amount)} ${cur}</span>
  </div>

  ${d.remaining && d.remaining > 0 ? `<div class="rem">المتبقّي من الرسوم: ${fmt(d.remaining)} ${cur}</div>` : ''}

  <div class="foot">
    <span class="foot-dot"></span>هذه فاتورة صادرة إلكترونياً من نظام <span class="foot-brand">RusoomPay</span> ولا تحتاج توقيعاً<br>
    شكراً لثقتكم · ${d.school.name}
  </div>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) { alert('يرجى السماح بالنوافذ المنبثقة لطباعة الفاتورة'); return }
  w.document.write(html)
  w.document.close()

  // انتظر تحميل الخط والشعار قبل الطباعة — بدون ذلك يطبع بخط بديل أو بشعار فارغ
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
