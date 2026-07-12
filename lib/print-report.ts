// lib/invoice-html.ts
// مولّد فاتورة بـHTML + طباعة المتصفّح — يدعم العربية وخط Cairo بشكل كامل
// (بديل jsPDF الذي لا يدعم الخطوط العربية)

export type InvoiceData = {
  school: { name: string; vat?: string | null; address?: string | null; phone?: string | null }
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

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>فاتورة ${d.invoiceNo}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;font-family:'Cairo',Tahoma,sans-serif}
  body{padding:36px;color:#1a2530;background:#fff}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0F2744;padding-bottom:18px;margin-bottom:26px}
  .brand{display:flex;gap:13px;align-items:center}
  .logo{width:50px;height:50px;border-radius:12px;background:#0F2744;color:#fff;display:grid;place-items:center;font-size:1.5rem;font-weight:800}
  .school{font-size:1.3rem;font-weight:800;color:#0F2744}
  .meta{font-size:.8rem;color:#667;margin-top:3px;line-height:1.7}
  .inv-title{text-align:left}
  .inv-title h1{font-size:1.6rem;color:#0F2744;font-weight:800}
  .inv-title .no{font-size:.85rem;color:#667;margin-top:4px}
  .row{display:flex;gap:20px;margin-bottom:24px}
  .box{flex:1;background:#F7FAFC;border:1px solid #E3E8EE;border-radius:12px;padding:16px}
  .box h3{font-size:.75rem;color:#8A94A6;font-weight:700;margin-bottom:8px;letter-spacing:.4px}
  .box .v{font-size:1rem;font-weight:700;color:#0F2744}
  .box .s{font-size:.8rem;color:#667;margin-top:3px}
  table{width:100%;border-collapse:collapse;margin-bottom:22px}
  thead{background:#0F2744;color:#fff}
  th{padding:12px 14px;text-align:right;font-size:.82rem;font-weight:700}
  td{padding:14px;border-bottom:1px solid #EDF1F5;font-size:.9rem}
  .total{background:#0F2744;color:#fff;border-radius:12px;padding:18px 22px;display:flex;justify-content:space-between;align-items:center}
  .total .lbl{font-size:.95rem;font-weight:600}
  .total .amt{font-size:1.5rem;font-weight:800}
  .rem{margin-top:12px;padding:12px 18px;background:#FFF6E6;border:1px solid #FFE0A3;border-radius:10px;color:#B54708;font-size:.88rem;font-weight:600}
  .foot{margin-top:34px;padding-top:16px;border-top:1px solid #E3E8EE;text-align:center;color:#8A94A6;font-size:.75rem;line-height:1.9}
  @media print{body{padding:16px}@page{margin:12mm}}
</style></head><body>
  <div class="head">
    <div class="brand">
      <div class="logo">R</div>
      <div>
        <div class="school">${d.school.name}</div>
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
    هذه فاتورة صادرة إلكترونياً من نظام RusoomPay ولا تحتاج توقيعاً<br>
    شكراً لثقتكم · ${d.school.name}
  </div>

  <script>window.onload = () => { window.print(); }</script>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) { alert('يرجى السماح بالنوافذ المنبثقة لطباعة الفاتورة'); return }
  w.document.write(html)
  w.document.close()
}
