// lib/invoice-pdf.ts
// مولّد فاتورة PDF فوري قابل للتنزيل — بترويسة المدرسة وتفاصيل الدفع وضريبة القيمة المضافة.
// يُحمّل jsPDF كسولاً من CDN عند أوّل استخدام فقط (لا يثقل حزمة التطبيق).
// يعمل في المتصفّح فقط (client-side).

export type InvoiceData = {
  school: { name: string; vat?: string | null; address?: string | null; phone?: string | null }
  invoiceNo: string
  paidAt: string            // ISO أو نص جاهز
  studentName: string
  studentCode?: string | null
  feeDescription: string
  amount: number            // المبلغ المدفوع
  method: string            // bank / cash / card...
  currency?: string         // OMR افتراضياً
  remaining?: number | null // المتبقّي بعد الدفع (اختياري)
}

// تحميل jsPDF كسولاً (مرّة واحدة)
let _jsPDFPromise: Promise<any> | null = null
function loadJsPDF(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('client-only'))
  if ((window as any).jspdf?.jsPDF) return Promise.resolve((window as any).jspdf.jsPDF)
  if (!_jsPDFPromise) {
    _jsPDFPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      s.onload = () => resolve((window as any).jspdf.jsPDF)
      s.onerror = () => reject(new Error('تعذّر تحميل مولّد PDF'))
      document.head.appendChild(s)
    })
  }
  return _jsPDFPromise
}

const METHOD_AR: Record<string, string> = {
  bank: 'تحويل بنكي', cash: 'نقداً', card: 'بطاقة', thawani: 'ثواني', online: 'دفع إلكتروني',
}

// صياغة رقم بثلاث خانات عشرية (ريال عُماني)
function money(n: number, cur = 'OMR'): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' ' + cur
}

export async function generateInvoicePDF(data: InvoiceData): Promise<void> {
  const jsPDF = await loadJsPDF()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const cur = data.currency || 'OMR'
  const green = [30, 92, 78] as const
  const navy = [15, 39, 68] as const
  const gray = [120, 132, 147] as const

  // ترويسة خضراء بشعار نصّي
  doc.setFillColor(...green)
  doc.rect(0, 0, W, 32, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22)
  doc.text('RusoomPay', 14, 15)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text('SCHOOL FEE PAYMENTS', 14, 22)
  // رقم الفاتورة يمين
  doc.setFontSize(10)
  doc.text('INVOICE / فاتورة', W - 14, 13, { align: 'right' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
  doc.text('#' + data.invoiceNo, W - 14, 20, { align: 'right' })

  // بيانات المدرسة
  let y = 44
  doc.setTextColor(...navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
  doc.text(data.school.name, 14, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...gray)
  y += 6
  if (data.school.vat) { doc.text('VAT: ' + data.school.vat, 14, y); y += 5 }
  if (data.school.address) { doc.text(data.school.address, 14, y); y += 5 }
  if (data.school.phone) { doc.text('Tel: ' + data.school.phone, 14, y); y += 5 }

  // تاريخ الدفع (يمين)
  doc.setTextColor(...gray)
  doc.text('Date: ' + new Date(data.paidAt).toLocaleDateString('en-GB'), W - 14, 44, { align: 'right' })

  // خط فاصل
  y += 3
  doc.setDrawColor(225, 231, 238); doc.setLineWidth(0.4)
  doc.line(14, y, W - 14, y); y += 10

  // بيانات الطالب
  doc.setTextColor(...navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('Student / الطالب', 14, y)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 68, 82)
  doc.text(data.studentName + (data.studentCode ? '  (' + data.studentCode + ')' : ''), 14, y + 6)
  y += 16

  // جدول البند
  doc.setFillColor(...navy); doc.rect(14, y, W - 28, 9, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text('DESCRIPTION / البند', 18, y + 6)
  doc.text('AMOUNT / المبلغ', W - 18, y + 6, { align: 'right' })
  y += 9

  doc.setFillColor(247, 249, 251); doc.rect(14, y, W - 28, 11, 'F')
  doc.setTextColor(...navy); doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  doc.text(data.feeDescription, 18, y + 7)
  doc.setFont('helvetica', 'bold')
  doc.text(money(data.amount, cur), W - 18, y + 7, { align: 'right' })
  y += 18

  // الإجمالي المدفوع (صندوق أخضر)
  doc.setFillColor(...green); doc.roundedRect(W - 90, y, 76, 16, 2, 2, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text('PAID / المدفوع', W - 86, y + 6)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
  doc.text(money(data.amount, cur), W - 18, y + 12, { align: 'right' })
  y += 22

  // طريقة الدفع + المتبقّي
  doc.setTextColor(...gray); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text('Method / طريقة الدفع: ' + (METHOD_AR[data.method] || data.method), 14, y); y += 6
  if (data.remaining != null && data.remaining > 0) {
    doc.setTextColor(180, 60, 40)
    doc.text('Remaining / المتبقّي: ' + money(data.remaining, cur), 14, y); y += 6
  } else if (data.remaining != null && data.remaining <= 0) {
    doc.setTextColor(...green)
    doc.text('FULLY PAID / مسدّد بالكامل', 14, y); y += 6
  }

  // تذييل
  const footY = 280
  doc.setDrawColor(225, 231, 238); doc.line(14, footY - 6, W - 14, footY - 6)
  doc.setTextColor(...gray); doc.setFontSize(8)
  doc.text('تم إصدار هذه الفاتورة إلكترونياً عبر RusoomPay · This invoice was generated electronically', W / 2, footY, { align: 'center' })
  doc.text('RusoomPay © ' + new Date().getFullYear(), W / 2, footY + 5, { align: 'center' })

  // تنزيل
  const safe = (data.studentName || 'invoice').replace(/[^\w\u0600-\u06FF]+/g, '_')
  doc.save('RusoomPay_' + safe + '_' + data.invoiceNo + '.pdf')
}
