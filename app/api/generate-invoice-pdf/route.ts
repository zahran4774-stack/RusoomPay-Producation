// app/api/generate-invoice-pdf/route.ts
// يولّد فاتورة PDF عربية (RTL) فعلية من بيانات دفعة حقيقية، ويرفعها لـ bucket خاص (invoices).
// يُستدعى داخلياً بعد نجاح record_payment/approve_payment — لا يُستدعى مباشرة من واجهة عامة.
//
// المكتبة: pdfmake (خالصة JavaScript، بلا اعتماد على Chromium/PhantomJS —
// أكثر توافقاً مع بيئة Netlify Functions المحدودة من حيث الحجم والذاكرة والوقت).
// RTL يُفعَّل يدوياً (pdfmake لا يدعمه تلقائياً): كل نص عربي يُعكَس اتجاهه بمحاذاة يمين،
// وخط Cairo (نفس خط الواجهة) يُحمَل من public/fonts لضمان عرض عربي سليم بلا تربيعات.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs' // pdfmake يحتاج بيئة Node كاملة، لا Edge Runtime

// ---------- تحميل pdfmake وخط Cairo مرّة واحدة فقط (كسول، خارج المعالج) ----------
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake')

const FONT_DIR = process.cwd() + '/public/fonts'
const fonts = {
  Cairo: {
    normal: FONT_DIR + '/Cairo-Regular.ttf',
    bold: FONT_DIR + '/Cairo-Bold.ttf',
    italics: FONT_DIR + '/Cairo-Regular.ttf',
    bolditalics: FONT_DIR + '/Cairo-Bold.ttf',
  },
}

type InvoiceData = {
  schoolName: string
  schoolVat?: string | null
  studentName: string
  studentCode?: string | null
  feeDescription: string
  amount: number
  method: string
  paidAt: string
  remaining: number
  currency: string
  invoiceRef: string
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'نقداً', bank: 'تحويل بنكي', card: 'بطاقة', onsite: 'عند المدرسة',
  applepay: 'Apple Pay', googlepay: 'Google Pay',
}

// بناء وثيقة pdfmake — كل نص عربي بمحاذاة يمين (alignment: 'right') لمحاكاة RTL يدوياً
function buildDocDefinition(d: InvoiceData) {
  const sym = d.currency === 'OMR' ? 'ر.ع' : d.currency
  const fmt = (n: number) => n.toFixed(3)

  return {
    defaultStyle: { font: 'Cairo', alignment: 'right' as const },
    pageMargins: [40, 50, 40, 40] as [number, number, number, number],
    content: [
      { text: d.schoolName, style: 'header' },
      d.schoolVat ? { text: `الرقم الضريبي: ${d.schoolVat}`, style: 'sub' } : {},
      { text: ' ', margin: [0, 10, 0, 0] },
      { text: 'إيصال سداد رسوم', style: 'title' },
      { text: `رقم الإيصال: ${d.invoiceRef}`, style: 'sub' },
      { text: `التاريخ: ${d.paidAt}`, style: 'sub' },
      { canvas: [{ type: 'line', x1: 0, y1: 10, x2: 515, y2: 10, lineWidth: 1, lineColor: '#DDE3EC' }] },

      {
        table: {
          widths: ['*', '*'],
          body: [
            [{ text: 'الطالب', style: 'label' }, { text: d.studentName, style: 'value' }],
            ...(d.studentCode ? [[{ text: 'الرقم الأكاديمي', style: 'label' }, { text: d.studentCode, style: 'value' }]] : []),
            [{ text: 'البند', style: 'label' }, { text: d.feeDescription, style: 'value' }],
            [{ text: 'طريقة الدفع', style: 'label' }, { text: METHOD_LABEL[d.method] || d.method, style: 'value' }],
          ],
        },
        layout: 'noBorders',
        margin: [0, 15, 0, 15] as [number, number, number, number],
      },

      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#DDE3EC' }] },
      {
        columns: [
          { text: `${fmt(d.amount)} ${sym}`, style: 'amount' },
          { text: 'المبلغ المدفوع', style: 'amountLabel' },
        ],
        margin: [0, 15, 0, 5] as [number, number, number, number],
      },
      d.remaining > 0.0005
        ? { text: `المتبقّي على الفاتورة: ${fmt(d.remaining)} ${sym}`, style: 'remaining' }
        : { text: 'تم سداد الفاتورة بالكامل ✓', style: 'paidFull' },

      { text: ' ', margin: [0, 20, 0, 0] },
      { text: 'شكراً لتعاونكم وحسن التزامكم', style: 'footer' },
      { text: 'هذا الإيصال صادر إلكترونياً عبر منصّة RusoomPay', style: 'footerSmall' },
    ],
    styles: {
      header: { fontSize: 16, bold: true, color: '#0A1D33' },
      sub: { fontSize: 10, color: '#5A6B7B', margin: [0, 2, 0, 0] as [number, number, number, number] },
      title: { fontSize: 13, bold: true, color: '#0D7D6B', margin: [0, 12, 0, 4] as [number, number, number, number] },
      label: { fontSize: 10, color: '#8A94A6' },
      value: { fontSize: 11, bold: true, color: '#0F1B2D' },
      amount: { fontSize: 20, bold: true, color: '#0D7D6B', alignment: 'left' as const },
      amountLabel: { fontSize: 11, color: '#5A6B7B' },
      remaining: { fontSize: 11, color: '#B54708', bold: true },
      paidFull: { fontSize: 11, color: '#1A7A45', bold: true },
      footer: { fontSize: 11, color: '#0F1B2D' },
      footerSmall: { fontSize: 8, color: '#B0B8C4', margin: [0, 4, 0, 0] as [number, number, number, number] },
    },
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      feeId, schoolName, schoolVat, studentName, studentCode,
      feeDescription, amount, method, paidAt, remaining, currency, schoolId,
    } = body || {}

    if (!feeId || !schoolId || !studentName || !amount) {
      return NextResponse.json({ success: false, error: 'بيانات الفاتورة ناقصة' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'غير مصادَق' }, { status: 401 })

    const invoiceRef = 'INV-' + String(feeId).slice(0, 8).toUpperCase()

    const printer = new PdfPrinter(fonts)
    const docDefinition = buildDocDefinition({
      schoolName: schoolName || 'مدرسة', schoolVat, studentName, studentCode,
      feeDescription: feeDescription || 'رسوم دراسية', amount: Number(amount),
      method: method || 'bank', paidAt: paidAt || new Date().toISOString().slice(0, 10),
      remaining: Number(remaining || 0), currency: currency || 'OMR', invoiceRef,
    })

    const pdfDoc = printer.createPdfKitDocument(docDefinition)
    const chunks: Buffer[] = []
    const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
      pdfDoc.on('data', (c: Buffer) => chunks.push(c))
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
      pdfDoc.on('error', reject)
      pdfDoc.end()
    })

    // رفع للـ bucket الخاص — مسار فريد لكل دفعة (يمنع التصادم بين عدة دفعات لنفس الفاتورة)
    const path = `${schoolId}/${feeId}-${Date.now()}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(path, pdfBuffer, { contentType: 'application/pdf', upsert: false })

    if (uploadError) {
      return NextResponse.json({ success: false, error: 'تعذّر رفع الفاتورة: ' + uploadError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, path })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'خطأ غير معروف بتوليد الفاتورة' },
      { status: 500 },
    )
  }
}

