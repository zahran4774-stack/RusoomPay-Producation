// صفحة المحاسبة — دليل الحسابات + ميزان المراجعة + قائمة الدخل
// الأرصدة تُحسب في قاعدة البيانات (لحظية مهما تراكمت القيود)
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { fmtCurrency, curSymbol, type Account } from '@/lib/accounting'
import { canAccessFinance, type Role } from '@/lib/roles'
import JournalForm from './JournalForm'
import PrintButton from '../PrintButton'
import PeriodReports from './PeriodReports'
import JournalList from './JournalList'
import ForecastPanel from './ForecastPanel'

export default async function AccountingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // الصلاحية: المدير والمحاسب فقط
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!canAccessFinance(profile?.role as Role)) redirect('/dashboard')

  const { data: school } = await supabase.from('schools').select('name, vat_number, currency').single()
  const currency = school?.currency ?? 'OMR'

  // الأرصthe والملخّص والقيود — تُجلb معاً بالتوازي (أسرع من التسلسل)
  const [balancesRes, summaryRes, entriesRes] = await Promise.all([
    supabase.rpc('account_balances'),
    supabase.rpc('financial_summary').single(),
    supabase
      .from('journal_entries')
      .select('id, entry_date, description, reference, reversed_by_entry, reverses_entry, journal_lines(debit)')
      .order('entry_date', { ascending: false })
      .limit(10),
  ])
  const balances = balancesRes.data
  const summary = summaryRes.data
  const entries = entriesRes.data

  const bal = (balances ?? []) as { account_id: string; code: string; name: string; type: string; balance: number }[]
  // قائمة الحسابات لنموذج القيد (مشتقّة من نتيجة الأرصدة)
  const acc = bal.map((b) => ({ id: b.account_id, code: b.code, name: b.name, type: b.type })) as Account[]
  const ent = (entries ?? []) as { id: string; entry_date: string; description: string | null; reference: string | null; reversed_by_entry: string | null; reverses_entry: string | null; journal_lines: { debit: number }[] }[]
  const s = (summary ?? { revenue: 0, expense: 0, profit: 0, cash: 0, receivables: 0, vat: 0 }) as {
    revenue: number; expense: number; profit: number; cash: number; receivables: number; vat: number
  }
  const fin = { revenue: s.revenue, expense: s.expense, profit: s.profit, cash: s.cash }
  const fmt = (n: number) => fmtCurrency(n, currency)
  const sym = curSymbol(currency)
  const typeLabel = (t: string) => ({ asset: 'أصول', liability: 'خصوم', equity: 'حقوق ملكية', revenue: 'إيرادات', expense: 'مصروفات' } as Record<string, string>)[t] || t

  // ميزان المراجعة — من الأرصدة المحسوبة خادمياً
  const trial = bal.map((a) => ({
    id: a.account_id, code: a.code, name: a.name, type: a.type,
    debit: a.balance > 0 ? a.balance : 0,
    credit: a.balance < 0 ? -a.balance : 0,
  }))
  const totalDebit = trial.reduce((sum, r) => sum + r.debit, 0)
  const totalCredit = trial.reduce((sum, r) => sum + r.credit, 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.0005

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }} dir="rtl">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ color: '#0F2744', marginBottom: 4 }}>المحاسبة</h1>
          <p style={{ color: '#667', fontSize: 14, marginBottom: 20 }}>قيد مزدوج · ميزان مراجعة · قائمة الدخل</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <PrintButton
            school={{ name: school?.name ?? 'مدرسة', vat: school?.vat_number }}
            title="ميزان المراجعة"
            subtitle={balanced ? 'الدفاتر متوازنة ✓' : 'تحذير: الدفاتر غير متوازنة'}
            columns={[
              { key: 'code', label: 'الرمز' }, { key: 'name', label: 'الحساب' },
              { key: 'debit', label: 'مدين' }, { key: 'credit', label: 'دائن' },
            ]}
            rows={trial.map((r) => ({ code: r.code, name: r.name, debit: r.debit.toFixed(3), credit: r.credit.toFixed(3) }))}
            label="🖨 طباعة ميزان المراجعة"
          />
          <PrintButton
            school={{ name: school?.name ?? 'مدرسة', vat: school?.vat_number }}
            title="قائمة الدخل"
            columns={[{ key: 'item', label: 'البند' }, { key: 'amount', label: 'المبلغ' }]}
            rows={[
              { item: 'إجمالي الإيرادات', amount: fin.revenue.toFixed(3) },
              { item: 'إجمالي المصروفات', amount: fin.expense.toFixed(3) },
              { item: 'صافي الربح', amount: fin.profit.toFixed(3) },
            ]}
            label="🖨 طباعة قائمة الدخل"
          />
        </div>
      </div>

      {/* المؤشرات المالية */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 13, marginBottom: 22 }}>
        <KPI label="الإيرادات" v={fmt(fin.revenue)} sym={sym} color="#1E8E5A" />
        <KPI label="المصروفات" v={fmt(fin.expense)} sym={sym} color="#C0392B" />
        <KPI label="صافي الربح" v={fmt(fin.profit)} sym={sym} color="#163B68" />
        <KPI label="النقدية والبنوك" v={fmt(fin.cash)} sym={sym} color="#D4A017" />
      </div>

      {/* إدخال قيد جديد */}
      <JournalForm accounts={acc} currency={currency} />

      {/* (acc مشتقّة من الأرصدة) */}

      {/* الحسابات والأرصدة — بلغة واضحة لغير المحاسبين */}
      <h2 style={{ color: '#0F2744', fontSize: 18, margin: '24px 0 4px' }} title="يعرض جميع الحسابات المالية مع أرصدتها الحالية وكامل الحركات المرتبطة بكل حساب.">الحسابات والأرصدة</h2>
      <p style={{ color: '#667', fontSize: 13.5, marginBottom: 12 }}>استعرض جميع الحسابات المالية، الأرصدة الحالية، والحركات المالية لكل حساب في مكان واحد.</p>
      {bal.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: 28, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
          <div style={{ fontWeight: 700, color: '#0F2744', marginBottom: 4 }}>لا توجد حسابات حتى الآن</div>
          <div style={{ color: '#8A94A6', fontSize: 13.5 }}>ستظهر هنا جميع الحسابات وأرصدتها بمجرد تسجيل أول عملية مالية.</div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,.08)', marginBottom: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#F4F8F7', color: '#0F2744', textAlign: 'right' }}>
                <th style={{ padding: 11 }}>الرمز</th><th style={{ padding: 11 }}>الحساب</th>
                <th style={{ padding: 11 }}>النوع</th><th style={{ padding: 11 }}>الرصيد الحالي</th>
              </tr>
            </thead>
            <tbody>
              {bal.map((b) => (
                <tr key={b.account_id} style={{ borderBottom: '1px solid #EEF2F1' }}>
                  <td style={{ padding: 10, fontWeight: 700 }}>{b.code}</td>
                  <td style={{ padding: 10 }}>{b.name}</td>
                  <td style={{ padding: 10, color: '#8A94A6', fontSize: 13 }}>{typeLabel(b.type)}</td>
                  <td style={{ padding: 10, direction: 'ltr', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(b.balance)} {sym}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ميزان المراجعة */}
      <h2 style={{ color: '#0F2744', fontSize: 18, margin: '24px 0 12px' }}>ميزان المراجعة</h2>
      <div style={{ background: '#fff', borderRadius: 14, overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#0F2744', color: '#fff', textAlign: 'right' }}>
              <th style={{ padding: 12 }}>الرمز</th><th style={{ padding: 12 }}>الحساب</th>
              <th style={{ padding: 12 }}>مدين</th><th style={{ padding: 12 }}>دائن</th>
            </tr>
          </thead>
          <tbody>
            {trial.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #EEF2F1' }}>
                <td style={{ padding: 10, fontWeight: 700 }}>{r.code}</td>
                <td style={{ padding: 10 }}>{r.name}</td>
                <td style={{ padding: 10 }}>{r.debit ? fmt(r.debit) : '—'}</td>
                <td style={{ padding: 10 }}>{r.credit ? fmt(r.credit) : '—'}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid #0F2744', fontWeight: 700, background: balanced ? '#E6F4EC' : '#FCE9E6' }}>
              <td style={{ padding: 12 }} colSpan={2}>الإجمالي {balanced ? '✓ متوازن' : '⚠️ غير متوازن'}</td>
              <td style={{ padding: 12 }}>{fmt(totalDebit)}</td>
              <td style={{ padding: 12 }}>{fmt(totalCredit)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* قائمة الدخل المبسّطة */}
      <h2 style={{ color: '#0F2744', fontSize: 18, margin: '24px 0 12px' }}>قائمة الدخل</h2>
      <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
        <Row label="إجمالي الإيرادات" v={fmt(fin.revenue)} sym={sym} />
        <Row label="إجمالي المصروفات" v={`(${fmt(fin.expense)})`} sym={sym} />
        <div style={{ borderTop: '2px solid #0F2744', marginTop: 8, paddingTop: 8 }}>
          <Row label="صافي الربح / الخسارة" v={fmt(fin.profit)} sym={sym} bold color={fin.profit >= 0 ? '#1A7A45' : '#C0392B'} />
        </div>
      </div>

      {/* آخر القيود */}
      <h2 style={{ color: '#0F2744', fontSize: 18, margin: '24px 0 12px' }}>آخر القيود</h2>
      <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
        <JournalList
          entries={ent}
          currency={currency}
          canReverse={['owner', 'accountant'].includes(profile?.role ?? '')}
        />
      </div>

      <PeriodReports school={{ name: school?.name ?? 'مدرسة', vat_number: school?.vat_number ?? null, currency }} />
      <ForecastPanel currency={currency} />
    </div>
  )
}

function KPI({ label, v, sym, color }: { label: string; v: string; sym: string; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,.08)', borderTop: `3px solid ${color}` }}>
      <div style={{ color: '#667', fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#0F2744', marginTop: 6, fontFamily: 'Cairo' }}>{v} <span style={{ fontSize: 13, color: '#889' }}>{sym}</span></div>
    </div>
  )
}

function Row({ label, v, sym, bold, color }: { label: string; v: string; sym: string; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 15, fontWeight: bold ? 700 : 400, color: color ?? '#1A2530' }}>
      <span>{label}</span><span>{v} {sym}</span>
    </div>
  )
}
