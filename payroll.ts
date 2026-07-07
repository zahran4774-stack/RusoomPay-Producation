// lib/payroll.ts
// منطق حساب الرواتب والتأمينات الاجتماعية — مشترك بين الخادم والعميل.
// (نُقل من صفحة employees لأن Next.js يمنع التصديرات غير القياسية في ملفات الصفحات.)

export type InsRates = { emp: number; er: number; cap: number | null; expatExempt: boolean }

// حساب قسيمة الراتب بنسب المدرسة (عُمان افتراضياً، قابلة للتخصيص لباقي الخليج)
export function payslip(basic: number, allow: number, nat: string, rates: InsRates) {
  const gross = basic + allow
  const base = rates.cap != null ? Math.min(gross, rates.cap) : gross
  const exempt = nat !== 'om' && rates.expatExempt
  const empContrib = exempt ? 0 : Math.round(base * rates.emp * 1000) / 1000
  const erContrib = exempt ? 0 : Math.round(base * rates.er * 1000) / 1000
  const net = Math.round((gross - empContrib) * 1000) / 1000
  return { gross, empContrib, erContrib, net }
}
