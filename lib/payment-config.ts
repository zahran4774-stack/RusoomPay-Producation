// lib/payment-config.ts — بيانات استلام مدفوعات اشتراكات المدارس + أسعار الباقات
// يستهلكها: components/PaymentDetails.tsx و lib/receipt-verifier.ts
//
// مصدر البيانات البنكية: نص التحقق داخل lib/receipt-verifier.ts (بيانات فعلية).
// مصدر الأسعار: جدول plans في Supabase (price_omr) — بتاريخ 2026-08-20.

export const PAYMENT_CONFIG = {
  // التحويل الهاتفي (Mobile Transfer عبر بنوك عُمان)
  phone: {
    number: '95476649',
    display: '9547 6649',
    // صيغ يقارن بها نص الإيصال بعد التطبيع (إزالة المسافات/الشرطات وتحويل الأرقام العربية)
    variants: [
      '95476649',
      '+96895476649',
      '96895476649',
      '0096895476649',
    ],
  },

  // التحويل البنكي — Bank Muscat
  bank: {
    accountName: 'ZAHRAN ZAHIR HAMED AL DAGHARI',
    accountNumber: '0368 0016 6281 0033',
    iban: 'OM670270368001662810033',
    swift: 'BMUSOMRXXXX',
    bankName: 'Bank Muscat',
    // صيغ يُقارن بها نص الإيصال
    variants: [
      'OM670270368001662810033',
      '0368001662810033',
      '0368 0016 6281 0033',
      'ZAHRAN ZAHIR HAMED AL DAGHARI',
      'ZAHRAN ZAHIR',
      'AL DAGHARI',
    ],
  },
} as const

// أسعار الباقات بالريال العُماني — مطابقة لعمود price_omr في جدول plans
// ملاحظة: النوع Record<string, number> مقصود لأن receipt-verifier يُفهرس بـ planName من نوع string
export const PLAN_PRICES: Record<string, number> = {
  starter: 0,
  small: 90,
  basic: 180,
  advanced: 320,
  enterprise: 550,
}
