// مكتبة المحاسبة المشتركة — حساب الأرصدة والتنسيق
// المنطق مطابق للمحرّك في النموذج، لكن البيانات تأتي من قاعدة البيانات

export type Account = { id: string; code: string; name: string; type: string }
export type JournalLine = { account_id: string; debit: number; credit: number }
export type JournalEntry = {
  id: string; entry_date: string; description: string | null; reference: string | null
  journal_lines: JournalLine[]
}

// طبيعة الحساب: المدين موجب للأصول والمصروفات، الدائن موجب للباقي
export const DEBIT_NATURE: Record<string, number> = {
  asset: 1, expense: 1, liability: -1, equity: -1, revenue: -1,
}

// رصيد حساب واحد (مدين - دائن) عبر كل القيود
export function accountBalance(accountId: string, entries: JournalEntry[]): number {
  let bal = 0
  for (const e of entries) {
    for (const l of e.journal_lines) {
      if (l.account_id === accountId) bal += l.debit - l.credit
    }
  }
  return Math.round(bal * 1000) / 1000
}

// رصيد نوع حساب كامل (بحسب طبيعته)
export function typeBalance(type: string, accounts: Account[], entries: JournalEntry[]): number {
  let bal = 0
  for (const a of accounts.filter((x) => x.type === type)) {
    bal += accountBalance(a.id, entries) * DEBIT_NATURE[type]
  }
  return Math.round(bal * 1000) / 1000
}

// التحقق من توازن قيد (مجموع المدين = مجموع الدائن)
export function isBalanced(lines: { debit: number; credit: number }[]): boolean {
  const d = lines.reduce((s, l) => s + l.debit, 0)
  const c = lines.reduce((s, l) => s + l.credit, 0)
  return Math.abs(d - c) < 0.0005
}

// تنسيق العملة حسب خاناتها
const CUR_DEC: Record<string, number> = { OMR: 3, KWD: 3, BHD: 3, SAR: 2, AED: 2, QAR: 2 }
const CUR_SYM: Record<string, string> = { OMR: 'ر.ع', SAR: 'ر.س', AED: 'د.إ', QAR: 'ر.ق', KWD: 'د.ك', BHD: 'د.ب' }

export function fmtCurrency(n: number, currency: string): string {
  const d = CUR_DEC[currency] ?? 3
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
export function curSymbol(currency: string): string {
  return CUR_SYM[currency] ?? 'ر.ع'
}

// المؤشرات المالية للوحة
export function financialSummary(accounts: Account[], entries: JournalEntry[]) {
  const revenue = typeBalance('revenue', accounts, entries)
  const expense = typeBalance('expense', accounts, entries)
  const cash = accounts
    .filter((a) => a.code === '1110' || a.code === '1120')
    .reduce((s, a) => s + accountBalance(a.id, entries), 0)
  const ar = accounts.filter((a) => a.code === '1210').reduce((s, a) => s + accountBalance(a.id, entries), 0)
  const vat = -accounts.filter((a) => a.code === '2210').reduce((s, a) => s + accountBalance(a.id, entries), 0)
  return { revenue, expense, profit: revenue - expense, cash, ar, vat }
}
