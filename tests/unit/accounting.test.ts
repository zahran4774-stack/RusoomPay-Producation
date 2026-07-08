// tests/unit/accounting.test.ts
// اختبارات وحدوية لمنطق المحاسبة — قلب EduPay (قيد مزدوج، أرصدة، توازن)
import { describe, it, expect } from 'vitest'
import {
  accountBalance, typeBalance, isBalanced, fmtCurrency, curSymbol,
  type Account, type JournalEntry,
} from '@/lib/accounting'

const accounts: Account[] = [
  { id: 'cash', code: '1110', name: 'النقد', type: 'asset' },
  { id: 'ar', code: '1210', name: 'ذمم أولياء الأمور', type: 'asset' },
  { id: 'rev', code: '4100', name: 'إيرادات الرسوم', type: 'revenue' },
  { id: 'exp', code: '5100', name: 'رواتب', type: 'expense' },
]

// قيد: تحصيل رسوم 1000 (نقد مدين / إيراد دائن)
const entries: JournalEntry[] = [
  {
    id: 'e1', entry_date: '2026-02-01', description: 'رسوم', reference: 'JV-1',
    journal_lines: [
      { account_id: 'cash', debit: 1000, credit: 0 },
      { account_id: 'rev', debit: 0, credit: 1000 },
    ],
  },
  {
    id: 'e2', entry_date: '2026-02-02', description: 'راتب', reference: 'JV-2',
    journal_lines: [
      { account_id: 'exp', debit: 800, credit: 0 },
      { account_id: 'cash', debit: 0, credit: 800 },
    ],
  },
]

describe('accountBalance', () => {
  it('يحسب رصيد النقد = مدين - دائن (1000 - 800 = 200)', () => {
    expect(accountBalance('cash', entries)).toBe(200)
  })
  it('يحسب رصيد الإيراد (دائن 1000 → -1000 بطبيعة المدين)', () => {
    expect(accountBalance('rev', entries)).toBe(-1000)
  })
  it('يُرجع صفراً لحساب بلا حركات', () => {
    expect(accountBalance('ar', entries)).toBe(0)
  })
})

describe('typeBalance', () => {
  it('رصيد الإيرادات موجب بطبيعته (1000)', () => {
    expect(typeBalance('revenue', accounts, entries)).toBe(1000)
  })
  it('رصيد المصروفات موجب بطبيعته (800)', () => {
    expect(typeBalance('expense', accounts, entries)).toBe(800)
  })
})

describe('isBalanced — جوهر القيد المزدوج', () => {
  it('قيد متوازن (مدين = دائن)', () => {
    expect(isBalanced([{ debit: 500, credit: 0 }, { debit: 0, credit: 500 }])).toBe(true)
  })
  it('قيد غير متوازن يُرفض', () => {
    expect(isBalanced([{ debit: 500, credit: 0 }, { debit: 0, credit: 400 }])).toBe(false)
  })
  it('يتسامح مع فروق التقريب الدقيقة (< 0.0005)', () => {
    expect(isBalanced([{ debit: 100.0001, credit: 0 }, { debit: 0, credit: 100 }])).toBe(true)
  })
})

describe('fmtCurrency — تنسيق العملات الخليجية', () => {
  it('الريال العُماني 3 خانات', () => {
    expect(fmtCurrency(1200.5, 'OMR')).toBe('1,200.500')
  })
  it('الريال السعودي خانتان', () => {
    expect(fmtCurrency(1200.5, 'SAR')).toBe('1,200.50')
  })
  it('عملة غير معروفة → 3 خانات افتراضياً', () => {
    expect(fmtCurrency(50, 'XXX')).toBe('50.000')
  })
})

describe('curSymbol', () => {
  it('رمز الريال العُماني', () => expect(curSymbol('OMR')).toBe('ر.ع'))
  it('رمز افتراضي للمجهول', () => expect(curSymbol('XXX')).toBe('ر.ع'))
})
