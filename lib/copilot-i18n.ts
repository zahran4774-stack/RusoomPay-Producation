// lib/copilot-i18n.ts
// ترجمة نصوص المساعد التنفيذي (School Copilot) القادمة من دوال قاعدة البيانات
// (school_copilot / smart_recommendations). هذه النصوص قوالب عربية تحمل أرقاماً،
// والقاموس العام (lib/i18n.ts) لا يترجم الجملة التي تحتوي رقماً، فنطابقها هنا بالقالب.
// ⚠️ لا تغيير في قاعدة البيانات: أي نص لا يطابق قالباً معروفاً يبقى كما هو (آمن).

const plural = (n: string | number, one: string, many: string) => (Number(n) === 1 ? one : many)

const EXACT: Record<string, string> = {
  // تنبيهات (alerts.detail / action_label)
  'رسوم تجاوزت تاريخ استحقاقها': 'Fees past their due date',
  'مدفوعات أرسلها أولياء الأمور': 'Payments submitted by guardians',
  'تعديلات رواتب معلّقة': 'Pending salary changes',
  'أصناف تحتاج إعادة تعبئة': 'Items that need restocking',
  'التحصيل أقلّ من المستهدف': 'Collection is below target',
  'عرض الفواتير المتأخرة': 'View overdue invoices',
  'مراجعة المدفوعات': 'Review payments',
  'مراجعة الرواتب': 'Review salaries',
  'مراجعة المخزون': 'Review inventory',
  'متابعة الرسوم': 'Follow up on fees',
  // اقتراحات احتياطية (recommendations)
  'إرسال تذكيرات السداد': 'Send payment reminders',
  'تحسين التحصيل وتقليل المتأخرات': 'Improve collection and reduce arrears',
  'إرسال التذكيرات': 'Send reminders',
  'اعتماد مدفوعات أولياء الأمور': 'Approve guardian payments',
  'تحديث الحسابات وإصدار الفواتير': 'Update accounts and issue invoices',
  'فتح المدفوعات': 'Open payments',
  'اعتماد طلبات الرواتب': 'Approve salary requests',
  'إتمام مسير الرواتب في وقته': 'Complete payroll on time',
  'فتح الرواتب': 'Open payroll',
  'متابعة الرسوم المستحقّة': 'Follow up on outstanding fees',
  'تعزيز السيولة النقدية': 'Improve cash liquidity',
  'عرض الرسوم': 'View fees',
  // توصيات ذكية (smart_recommendations)
  'إرسال تذكير جماعي': 'Send bulk reminder',
  'عرض المدفوعات الجزئية': 'View partial payments',
  'هؤلاء الطلاب لا فواتير لهم — قد يكون دخلاً غير محصّل أو بيانات ناقصة.':
    'These students have no invoices — this may be uncollected income or incomplete data.',
  'مراجعة الطلاب': 'Review students',
  'أولياء أمور لم يُفعّلوا حساباتهم بعد — تفعيلهم يقلّل المتابعة اليدوية ويسرّع السداد الذاتي.':
    "Guardians haven't activated their accounts yet — activating them reduces manual follow-up and speeds up self-service payment.",
  'دعوة أولياء الأمور': 'Invite guardians',
  // حالة الصحة (health.status)
  'لا توجد بيانات كافية': 'Not enough data',
  'ممتاز': 'Excellent',
  'جيّد': 'Good',
  'متوسّط': 'Fair',
  'يحتاج انتباهاً': 'Needs attention',
}

const PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  // تنبيهات
  [/^(\d+) فاتورة متأخرة عن السداد$/, (m) => `${m[1]} overdue ${plural(m[1], 'invoice', 'invoices')}`],
  [/^(\d+) دفعة بانتظار اعتمادك$/, (m) => `${m[1]} ${plural(m[1], 'payment', 'payments')} awaiting your approval`],
  [/^(\d+) طلب راتب بانتظار الاعتماد$/, (m) => `${m[1]} salary ${plural(m[1], 'request', 'requests')} awaiting approval`],
  [/^(\d+) صنف مخزون منخفض أو نفد$/, (m) => `${m[1]} inventory ${plural(m[1], 'item', 'items')} low or out of stock`],
  [/^نسبة التحصيل منخفضة \((.+)%\)$/, (m) => `Collection rate is low (${m[1]}%)`],
  // اقتراحات احتياطية
  [/^(\d+) فاتورة متأخرة$/, (m) => `${m[1]} overdue ${plural(m[1], 'invoice', 'invoices')}`],
  [/^(\d+) دفعة معلّقة$/, (m) => `${m[1]} pending ${plural(m[1], 'payment', 'payments')}`],
  [/^(\d+) طلب معلّق$/, (m) => `${m[1]} pending ${plural(m[1], 'request', 'requests')}`],
  [/^مستحقات قائمة بقيمة (.+)$/, (m) => `Outstanding dues worth ${m[1]}`],
  // توصيات ذكية
  [/^أرسل تذكير سداد لـ (\d+) ولي أمر متأخّر$/, (m) => `Send a payment reminder to ${m[1]} overdue ${plural(m[1], 'guardian', 'guardians')}`],
  [/^لديهم فواتير تجاوزت موعد استحقاقها بمبلغ إجمالي (.+) — التذكير المبكّر يرفع التحصيل\.$/,
    (m) => `They have invoices past their due date totaling ${m[1]} — early reminders improve collection.`],
  [/^تابع (\d+) دفعة جزئية لم تكتمل$/, (m) => `Follow up on ${m[1]} incomplete partial ${plural(m[1], 'payment', 'payments')}`],
  [/^بدأ أولياء الأمور السداد ولم يكملوا — متبقٍّ (.+)\. متابعتهم أسهل من البدء من الصفر\.$/,
    (m) => `Guardians started paying but didn't finish — ${m[1]} remaining. Following up is easier than starting from zero.`],
  [/^(\d+) طالب بلا رسوم مسجّلة$/, (m) => `${m[1]} ${plural(m[1], 'student', 'students')} with no fees recorded`],
  [/^ادعُ (\d+) ولي أمر لتفعيل حسابهم$/, (m) => `Invite ${m[1]} ${plural(m[1], 'guardian', 'guardians')} to activate their accounts`],
]

/** يترجم نص المساعد التنفيذي القادم من قاعدة البيانات إلى الإنجليزية؛ وإلا يعيد الأصل. */
export function translateCopilotText(text: string): string {
  if (!text) return text
  const t = text.trim()
  if (EXACT[t] !== undefined) return EXACT[t]
  for (const [re, fn] of PATTERNS) {
    const m = t.match(re)
    if (m) return fn(m)
  }
  return text
}

const PLAN_LABELS: Record<string, string> = {
  'البداية': 'Starter', 'بداية': 'Starter',
  'الصغيرة': 'Small', 'صغيرة': 'Small',
  'الأساسية': 'Basic', 'أساسية': 'Basic',
  'المتقدمة': 'Advanced', 'المتقدّمة': 'Advanced', 'متقدمة': 'Advanced', 'متقدّمة': 'Advanced',
  'المؤسسية': 'Enterprise', 'مؤسسية': 'Enterprise',
}

/** اسم الباقة (plan_label) بالإنجليزية؛ إن لم يُعرف يُعاد كما هو. */
export function translatePlanLabel(label: string | undefined): string {
  if (!label) return ''
  return PLAN_LABELS[label.trim()] ?? label
}
