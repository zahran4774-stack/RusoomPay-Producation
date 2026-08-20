// lib/payment-config.ts — بيانات استلام مدفوعات اشتراكات المدارس في RusoomPay
// ⚠️ بيانات حقيقية تُعرض للعملاء — راجعها مقابل كشف حسابك البنكي قبل النشر.
// يستهلكها: components/PaymentDetails.tsx

export const PAYMENT_CONFIG = {
  // التحويل الهاتفي (Mobile Transfer عبر بنوك عُمان)
  phone: {
    number: '96890000000',        // ← رقمك بصيغة دولية بدون + (يُستخدم عند النسخ)
    display: '9000 0000',         // ← الشكل المعروض على الشاشة
  },

  // التحويل البنكي — Bank Muscat
  bank: {
    accountName: 'RusoomPay',                        // ← اسم الحساب كما هو في البنك بالضبط
    accountNumber: '0000000000',                     // ← رقم الحساب
    iban: 'OM00 0000 0000 0000 0000 000',            // ← IBAN عُماني (23 خانة، المسافات للعرض فقط)
    swift: 'BMUSOMRX',                               // ← SWIFT/BIC لفرعك
  },
} as const
