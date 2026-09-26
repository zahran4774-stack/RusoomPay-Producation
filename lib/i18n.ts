// RusoomPay bilingual presentation layer.
// IMPORTANT: This module translates UI text only. It does not touch database/business data.
export type Language = 'ar' | 'en'

export const DEFAULT_LANGUAGE: Language = 'ar'
export const LANGUAGE_STORAGE_KEY = 'rusoompay-language'

// English is shipped behind a flag until translation coverage is complete.
// Enable on Netlify: NEXT_PUBLIC_ENABLE_ENGLISH=true (requires a rebuild).
export const ENGLISH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ENGLISH === 'true'

const exact: Record<string, string> = {
  'العربية': 'Arabic',
  'English': 'English',
  'لوحة التحكم': 'Dashboard',
  'الطلاب': 'Students',
  'الطالب': 'Student',
  'طلاب': 'Students',
  'الرسوم والفواتير': 'Fees & Invoices',
  'الرسوم': 'Fees',
  'رسوم': 'Fee',
  'الفاتورة': 'Invoice',
  'فاتورة': 'Invoice',
  'الفواتير': 'Invoices',
  'الموظفون والرواتب': 'Employees & Payroll',
  'الموظفون': 'Employees',
  'الموظف': 'Employee',
  'دورات الرواتب': 'Payroll Cycles',
  'الرواتب': 'Payroll',
  'الخدمات المدرسية': 'School Services',
  'التغذية المدرسية': 'School Nutrition',
  'النقل المدرسي': 'School Transport',
  'المشتريات والمخزون': 'Purchases & Inventory',
  'المحاسبة والتقارير': 'Accounting & Reports',
  'نظرة عامة': 'Overview',
  'ميزان المراجعة': 'Trial Balance',
  'القيود': 'Journal Entries',
  'التقارير الدورية': 'Period Reports',
  'التوقعات': 'Forecast',
  'سجل النشاط': 'Activity Log',
  'اشتراك المنصة': 'Platform Subscription',
  'الدعم والملاحظات': 'Support & Feedback',
  'الإعدادات والأمان': 'Settings & Security',
  'تسجيل الخروج': 'Log out',
  'فتح القائمة': 'Open menu',
  'حفظ': 'Save',
  'حفظ التعديلات': 'Save changes',
  'إغلاق': 'Close',
  'إلغاء': 'Cancel',
  'حذف': 'Delete',
  'تعديل': 'Edit',
  'إضافة': 'Add',
  'نسخ': 'Copy',
  'إظهار': 'Show',
  'إخفاء': 'Hide',
  'بحث': 'Search',
  'تصفية': 'Filter',
  'تطبيق': 'Apply',
  'إعادة تعيين': 'Reset',
  'تأكيد': 'Confirm',
  'اعتماد': 'Approve',
  'رفض': 'Reject',
  'تفعيل': 'Activate',
  'تعطيل': 'Deactivate',
  'مسودة': 'Draft',
  'معتمدة': 'Approved',
  'ملغى': 'Cancelled',
  'ملغاة': 'Cancelled',
  'نشط': 'Active',
  'نشطة': 'Active',
  'موقوف': 'Suspended',
  'مغلق': 'Closed',
  'مفتوح': 'Open',
  'منتهٍ': 'Expired',
  'تجريبي': 'Trial',
  'مجانية': 'Free',
  'شهري': 'Monthly',
  'سنوي': 'Annual',
  'اليوم': 'Today',
  'أمس': 'Yesterday',
  'الآن': 'Now',
  'التاريخ': 'Date',
  'البداية': 'Start',
  'النهاية': 'End',
  'الإجمالي': 'Total',
  'المبلغ': 'Amount',
  'المبلغ الإجمالي': 'Total amount',
  'الإجمالي المدفوع': 'Total paid',
  'صافي المستحق': 'Net due',
  'إجمالي الرسوم': 'Total fees',
  'إجمالي الإيرادات': 'Total revenue',
  'إجمالي المصروفات': 'Total expenses',
  'الإيرادات': 'Revenue',
  'المصروفات': 'Expenses',
  'صافي الربح': 'Net profit',
  'الكمية': 'Quantity',
  'التكلفة': 'Cost',
  'سعر البيع': 'Selling price',
  'قيمة المخزون': 'Inventory value',
  'الحالة': 'Status',
  'التفاصيل': 'Details',
  'رقم الحساب': 'Account number',
  'اسم الحساب': 'Account name',
  'الحساب': 'Account',
  'حساب': 'Account',
  'البند': 'Item',
  'الصنف': 'Item',
  'الفئة': 'Category',
  'النوع': 'Type',
  'الرقم': 'Number',
  'اسم الطالب مطلوب': 'Student name is required',
  'الاسم الكامل مطلوب': 'Full name is required',
  'الشعبة مطلوبة': 'Class is required',
  'الصف/المرحلة مطلوب': 'Grade/stage is required',
  'رقم ولي الأمر مطلوب': 'Parent/guardian number is required',
  'أدخل مبلغاً صحيحاً': 'Enter a valid amount',
  'مبلغ غير صحيح': 'Invalid amount',
  'خطأ غير معروف': 'Unknown error',
  'كلمتا المرور غير متطابقتين': 'Passwords do not match',
  'كلمة المرور 8 أحرف على الأقل': 'Password must be at least 8 characters',
  'أعد إدخال كلمة المرور': 'Re-enter the password',
  'أدخل الرمز المكوّن من 6 أرقام': 'Enter the 6-digit code',
  'الرمز غير صحيح، حاول مجدداً': 'Invalid code. Please try again',
  'تعذّر الاتصال — تحقّق من الإنترنت وحاول مجدداً': 'Connection failed — check your internet connection and try again',
  'تعذّر الحفظ: ': 'Unable to save: ',
  'تعذّر التحديث: ': 'Unable to update: ',
  'تعذّر الرفض: ': 'Unable to reject: ',
  'تعذّر الاعتماد: ': 'Unable to approve: ',
  'تعذّر الرفع: ': 'Unable to upload: ',
  'تعذّر الإرسال: ': 'Unable to send: ',
  'فشل الإرسال: ': 'Send failed: ',
  'فشل الجلب': 'Failed to load',
  'تعذّر إنشاء التقرير': 'Unable to create the report',
  'تعذّر رفع الإيصال: ': 'Unable to upload the receipt: ',
  'تعذّر إتمام الاشتراك: ': 'Unable to complete subscription: ',
  'جارٍ الحفظ…': 'Saving…',
  'جارٍ الحفظ': 'Saving',
  'جارٍ الإرسال…': 'Sending…',
  'جارٍ الإرسال...': 'Sending...',
  'جارٍ الإنشاء…': 'Creating…',
  'جارٍ التنفيذ…': 'Processing…',
  'جارٍ التحضير…': 'Preparing…',
  'جارٍ التحقّق…': 'Verifying…',
  'جارٍ…': 'Loading…',
  'جار…': 'Loading…',
  'تم الإرسال': 'Sent',
  'تم الإرسال بنجاح ✅': 'Sent successfully ✅',
  '✓ حُفظ': '✓ Saved',
  '✓ متوازن': '✓ Balanced',
  '⚠️ غير متوازن': '⚠️ Unbalanced',
  'بانتظار الاعتماد': 'Pending approval',
  'مدفوعات معلّقة': 'Pending payments',
  'غير مسدّدة': 'Unpaid',
  'نقداً': 'Cash',
  'نقداً عند المدرسة': 'Cash at school',
  'تحويل بنكي': 'Bank transfer',
  'بنك': 'Bank',
  'بنك مسقط': 'Bank Muscat',
  'مدين': 'Debit',
  'دائن': 'Credit',
  'أصول': 'Assets',
  'خصوم': 'Liabilities',
  'حقوق ملكية': 'Equity',
  'قائمة الدخل': 'Income statement',
  'اشتراك': 'Subscription',
  'الباقة': 'Plan',
  'المشتركون': 'Subscribers',
  'السائق': 'Driver',
  'المحصّل': 'Collector',
  'مدير المدرسة': 'School manager',
  'المشرفة': 'Supervisor',
  'المسارات': 'Routes',
  'نسبة التحصيل': 'Collection rate',
  'الرسوم السنوية': 'Annual fees',
  'الرسوم الدراسية السنوية': 'Annual tuition fees',
  'الاسم الكامل': 'Full name',
  'اسم الطالب': 'Student name',
  'ولي الأمر': 'Parent/Guardian',
  'المدرسة': 'School',
  'مدرسة': 'School',
  'مدرستكم': 'Your school',
  'الدولة': 'Country',
  'الصف': 'Grade',
  'الشعبة': 'Class',
  'طالب': 'Student',
  'المستخدم': 'User',
  'مالك': 'Owner',
  'محاسب': 'Accountant',
  'إداري': 'Administrator',
  'مدير': 'Manager',
  'دعوة': 'Invitation',
  'شهادة قيد': 'Enrollment certificate',
  'إفادة رسوم': 'Fee statement',
  'النص': 'Text',
  'بطاقة': 'Card',
  'الكل': 'All',
  'أخرى': 'Other',
  'لا': 'No',
  'نعم': 'Yes',
  'إلى': 'To',
  'من': 'From',
  'أو': 'Or',
  'على': 'On',
  'حسب': 'According to',
  'مرحبا': 'Hello',
  'مساء الخير': 'Good evening',
  'مرحبا، أحتاج مساعدة بخصوص نظام RusoomPay': 'Hello, I need help with RusoomPay',
  'خدمة واتساب قيد التفعيل': 'WhatsApp service is being activated',
  'فعّل النوافذ المنبثقة للطباعة': 'Enable pop-ups to print',
  'ر.ع': 'OMR',
  ' ر.ع': ' OMR',
  'ر.س': 'SAR',
  'د.إ': 'AED',
  'ر.ق': 'QAR',
  'د.ك': 'KWD',
  'د.ب': 'BHD',
  'يناير': 'January',
  'فبراير': 'February',
  'مارس': 'March',
  'أبريل': 'April',
  'مايو': 'May',
  'يونيو': 'June',
  'يوليو': 'July',
  'أغسطس': 'August',
  'سبتمبر': 'September',
  'أكتوبر': 'October',
  'نوفمبر': 'November',
  'ديسمبر': 'December',
  'منتظم': 'Regular',
  'منسحب': 'Withdrawn',
  'منقول': 'Transferred',
  'متخرج': 'Graduated',
  'وافد': 'Expatriate',
  'ابن موظف': 'Employee child',
  'مساعدة لوجه الله': 'Charitable assistance',
  'أسرة محتاجة': 'Needy family',
  'صدقة': 'Charity',
  'مهمة': 'Task',
  'شكوى': 'Complaint',
  'استفسار': 'Inquiry',
  'معلومة': 'Information',
  'تحذير': 'Warning',
  'عاجلة': 'Urgent',
  'عالية': 'High',
  'متوسّطة': 'Medium',
  'عادية': 'Normal',
  'مصروفة': 'Disbursed',
  'إدارة': 'Management',
  'التحصيل': 'Collection',
  'الاعتماد': 'Approval',
  'المراجعة': 'Review',
  'تسجيل الدخول': 'Log in',
  'البريد الإلكتروني': 'Email',
  'كلمة المرور': 'Password',
  'التحقّق بخطوتين': 'Two-factor verification',
  'رمز التحقّق': 'Verification code',
  'تحقّق ودخول': 'Verify & log in',
  'سجّل دخولك للوصول إلى حسابك': 'Sign in to access your account',
  'إدارة مدرستك بكل سهولة وأمان': 'Manage your school with ease and security',
  'أدخل الرمز من تطبيق المصادقة': 'Enter the code from your authenticator app',
  'التحقّق': 'Verify',
  'الرسوم السنوية مطلوبة ويجب أن تكون أكبر من صفر': 'Annual fees are required and must be greater than zero',
  'المبلغ الإجمالي غير صحيح': 'Total amount is invalid',
  'لا يوجد رقم لولي الأمر': 'No parent/guardian number is available',
  'لا يوجد رقم ولي أمر لهذا الطالب': 'No parent/guardian number is available for this student',
  'رقم ولي الأمر غير مكتمل أو غير صالح لهذه الدولة': 'Parent/guardian number is incomplete or invalid for this country',
  'يرجى إكمال التحقق الأمني (CAPTCHA)': 'Please complete the security verification (CAPTCHA)',
  'أدخل الإجمالي المدفوع أو تكلفة الوحدة': 'Enter the total paid or unit cost',
  'حدد سبب الحالة الخاصة': 'Select the reason for the special status',
  'حدد مبلغ التخفيض المرتبط بالحالة الخاصة': 'Specify the discount amount associated with the special status',
  '8 أحرف على الأقل': 'At least 8 characters',
  'عدد الوجبات مطلوب': 'Number of meals is required',
  'اتركه فارغاً لاستخدام الآيبان': 'Leave blank to use the IBAN',
  'السائق مباشرة': 'Driver directly',
  'اشتراك الموظفين': 'Employee subscription',
  'إجمالي الرواتب': 'Total payroll',
  'حصة صاحب العمل': 'Employer share',
  'مثال: ابن موظف': 'Example: employee child',
  'دفع': 'Payment',
  'دفعة': 'Payment',
  'جزئي': 'Partial',
  'دائم': 'Permanent',
  'شيك': 'Cheque',
  'وحدة': 'Unit',
  'جملة': 'Wholesale',
  'غداء': 'Lunch',
  'عصير': 'Juice',
  'أرز': 'Rice',
  'دجاج': 'Chicken',
  'لحوم': 'Meat',
  'السعة': 'Capacity',
  'عدد': 'Count',
  'البريد': 'Email',
  'الدخول': 'Login',
  'تسجيل': 'Registration',
  'العمل': 'Work',
  'الوحدة': 'Unit',
  'الصفحة': 'Page',
  'البيانات': 'Data',
  'قائمة': 'List',
  'تقرير': 'Report',
  'التقرير': 'Report',
  'الاشتراك': 'Subscription',
  'إيرادات': 'Revenue',
  'مصروفات': 'Expenses',
  'سبب': 'Reason',

  // --- مساعد رسوم Pay (AiAssistant.tsx) ---
  'المساعد الذكي': 'AI Assistant',
  'افتح المساعد الذكي': 'Open AI Assistant',
  'مساعد رسوم Pay': 'RusoomPay Assistant',
  'يعرف بيانات مدرستك': "Knows your school's data",
  'محادثة جديدة': 'New chat',
  'بدء محادثة جديدة': 'Start a new chat',
  'اكتب سؤالك…': 'Type your question…',
  'إرسال': 'Send',
  'مدعوم بالذكاء الاصطناعي · قد يخطئ، تحقّق من المعلومات المهمة':
    'Powered by AI · It may make mistakes, verify important information',
  'مرحباً 👋 أنا مساعد رسوم Pay. أشرح لك أي صفحة في النظام، وأجيب عن أسئلتك حول بيانات مدرستك. اسألني ما تشاء.':
    "Hi 👋 I'm the RusoomPay Assistant. I can explain any page in the system and answer questions about your school's data. Ask me anything.",
  'أعطني نبذة عن برنامج RusoomPay': 'Give me an overview of RusoomPay',
  'ما هي صلاحيات مستخدمي RusoomPay؟': "What are RusoomPay users' permissions?",
  'كم طالب متأخر عن السداد؟': 'How many students are overdue on payment?',
  'كيف أرسل تذكير دفع؟': 'How do I send a payment reminder?',
  'كيف أصدّر تقريراً مالياً؟': 'How do I export a financial report?',
  'اشرح لي نسبة التحصيل': 'Explain the collection rate to me',
  'وصلت الحدّ المسموح مؤقتاً. حاول بعد قليل.': "You've temporarily hit the limit. Try again shortly.",
  'الطلب استغرق وقتاً طويلاً. حاول بسؤال أقصر.': 'The request took too long. Try a shorter question.',
  'لم يصل رد صالح. حاول مرة أخرى.': "No valid reply came back. Please try again.",
  'تعذّر الاتصال بالخادم. حاول مجدداً بعد لحظات.': 'Could not reach the server. Please try again shortly.',
}

// A conservative word-level fallback is used only for UI-looking strings that contain
// known product vocabulary. It intentionally does not translate arbitrary database data.
const words: Record<string, string> = {
  'المدرسة': 'school',
  'مدرسة': 'school',
  'الطالب': 'student',
  'طالب': 'student',
  'الطلاب': 'students',
  'طلاب': 'students',
  'ولي': 'parent',
  'الأمر': 'guardian',
  'الموظف': 'employee',
  'الموظفون': 'employees',
  'الموظفين': 'employees',
  'الرواتب': 'payroll',
  'الرسوم': 'fees',
  'رسوم': 'fee',
  'الفاتورة': 'invoice',
  'فاتورة': 'invoice',
  'الفواتير': 'invoices',
  'الدفع': 'payment',
  'دفع': 'pay',
  'المدفوعات': 'payments',
  'المبلغ': 'amount',
  'الإجمالي': 'total',
  'إجمالي': 'total',
  'المستحق': 'due',
  'التاريخ': 'date',
  'البداية': 'start',
  'النهاية': 'end',
  'الحالة': 'status',
  'التفاصيل': 'details',
  'الاسم': 'name',
  'اسم': 'name',
  'الرقم': 'number',
  'رقم': 'number',
  'الحساب': 'account',
  'حساب': 'account',
  'البند': 'item',
  'الصنف': 'item',
  'الفئة': 'category',
  'النوع': 'type',
  'الكمية': 'quantity',
  'التكلفة': 'cost',
  'سعر': 'price',
  'البيع': 'sale',
  'المخزون': 'inventory',
  'القيمة': 'value',
  'الإيرادات': 'revenue',
  'المصروفات': 'expenses',
  'الربح': 'profit',
  'صافي': 'net',
  'المحاسبة': 'accounting',
  'التقارير': 'reports',
  'التقرير': 'report',
  'تقرير': 'report',
  'المراجعة': 'review',
  'القيود': 'journal entries',
  'التوقعات': 'forecast',
  'الاشتراك': 'subscription',
  'اشتراك': 'subscription',
  'الباقة': 'plan',
  'المشتركون': 'subscribers',
  'النقل': 'transport',
  'السائق': 'driver',
  'المسارات': 'routes',
  'التغذية': 'nutrition',
  'المشتريات': 'purchases',
  'الخدمات': 'services',
  'الإعدادات': 'settings',
  'الأمان': 'security',
  'الدعم': 'support',
  'الملاحظات': 'feedback',
  'التحصيل': 'collection',
  'نسبة': 'rate',
  'الاعتماد': 'approval',
  'اعتماد': 'approve',
  'الرفض': 'rejection',
  'رفض': 'reject',
  'الحفظ': 'saving',
  'حفظ': 'save',
  'التعديل': 'edit',
  'تعديل': 'edit',
  'الحذف': 'delete',
  'حذف': 'delete',
  'إضافة': 'add',
  'تفعيل': 'activate',
  'تعطيل': 'deactivate',
  'إرسال': 'send',
  'الإرسال': 'sending',
  'الرفع': 'upload',
  'التحديث': 'update',
  'الإنشاء': 'creation',
  'إنشاء': 'create',
  'التحقق': 'verification',
  'تحقّق': 'verify',
  'التحضير': 'preparation',
  'التنفيذ': 'processing',
  'الخطأ': 'error',
  'خطأ': 'error',
  'غير': 'not',
  'صحيح': 'valid',
  'مطلوب': 'required',
  'معلومة': 'information',
  'تحذير': 'warning',
  'نعم': 'yes',
  'لا': 'no',
  'الكل': 'all',
  'أخرى': 'other',
  'من': 'from',
  'إلى': 'to',
  'في': 'in',
  'على': 'on',
  'مع': 'with',
  'بدون': 'without',
  'أو': 'or',
  'و': 'and',
  'هذا': 'this',
  'هذه': 'this',
  'ذلك': 'that',
  'ثم': 'then',
  'بعد': 'after',
  'قبل': 'before',
  'الآن': 'now',
  'اليوم': 'today',
  'أمس': 'yesterday',
  'غداً': 'tomorrow',
  'شهري': 'monthly',
  'سنوي': 'annual',
  'سنوية': 'annual',
  'يومي': 'daily',
  'نشط': 'active',
  'نشطة': 'active',
  'موقوف': 'suspended',
  'مغلق': 'closed',
  'مفتوح': 'open',
  'منتهٍ': 'expired',
  'ملغى': 'cancelled',
  'مسودة': 'draft',
  'معتمدة': 'approved',
  'بانتظار': 'pending',
  'نقداً': 'cash',
  'نقدا': 'cash',
  'تحويل': 'transfer',
  'بنكي': 'bank',
  'بنك': 'bank',
  'مدين': 'debit',
  'دائن': 'credit',
  'أصول': 'assets',
  'خصوم': 'liabilities',
  'حقوق': 'equity',
  'ملكية': 'equity',
  'المستخدم': 'user',
  'المستخدمين': 'users',
  'مدير': 'manager',
  'مالك': 'owner',
  'محاسب': 'accountant',
  'إداري': 'administrator',
  'الدولة': 'country',
  'الصف': 'grade',
  'الشعبة': 'class',
  'بطاقة': 'card',
  'شهادة': 'certificate',
  'قيد': 'enrollment',
  'دعوة': 'invitation',
  'الكامل': 'full',
  'البريد': 'email',
  'الإلكتروني': 'electronic',
  'كلمة': 'password',
  'المرور': 'password',
  'الرمز': 'code',
  'المشكلة': 'problem',
  'سبب': 'reason',
  'حالة': 'status',
  'مهمة': 'task',
  'شكوى': 'complaint',
  'استفسار': 'inquiry',
  'مبلغ': 'amount',
  'دفعة': 'payment',
  'جزئي': 'partial',
  'دائم': 'permanent',
  'شيك': 'cheque',
  'وحدة': 'unit',
  'جملة': 'wholesale',
  'غداء': 'lunch',
  'عصير': 'juice',
  'أرز': 'rice',
  'دجاج': 'chicken',
  'لحوم': 'meat',
  'السعة': 'capacity',
  'عدد': 'count',
  'فشل': 'failed',
  'نجاح': 'success',
  'بنجاح': 'successfully',
  'يرجى': 'please',
  'أدخل': 'enter',
  'اختر': 'select',
  'حدد': 'specify',
  'حاول': 'try',
  'مجدداً': 'again',
  'إعادة': 'again',
  'تأكيد': 'confirmation',
  'نسخ': 'copy',
  'إخفاء': 'hide',
  'إظهار': 'show',
  'تطبيق': 'apply',
  'إلغاء': 'cancel',
  'إغلاق': 'close',
  'فتح': 'open',
  'القائمة': 'menu',
  'المزيد': 'more',
  'العودة': 'back',
  'التالي': 'next',
  'السابق': 'previous',
  'الأقل': 'minimum',
  'أكبر': 'greater',
  'صفر': 'zero',
  'بيانات': 'data',
  'قائمة': 'list',
  'صفحة': 'page',
  'العمل': 'work',
  'مباشرة': 'directly',
  'الخاصة': 'special',
  'مثال': 'example',
  'المدرسية': 'school',
  'السنوية': 'annual',
  'المشرفة': 'supervisor',
  'المحصّل': 'collector',

}

const productHints = [
  'المدرسة','مدرسة','الطالب','الطلاب','ولي','الأمر','الرسوم','فاتورة','الفاتورة','الموظف','الموظفون','الرواتب',
  'الدفع','المدفوعات','الحساب','التقرير','التقارير','المحاسبة','الاشتراك','الباقة','النقل','التغذية','المشتريات',
  'المخزون','الإعدادات','الدعم','التحصيل','الحفظ','الإرسال','الرفع','التحديث','الإنشاء','التحقق','المبلغ','الإجمالي',
  'التاريخ','الحالة','الكمية','التكلفة','الاسم','الرقم','الحساب','البريد','كلمة','المرور','الرمز','الصف','الشعبة',
  'السائق','المسارات','الاعتماد','الرفض','التفعيل','التعطيل','التقرير','التقارير'
]

// ─────────────────────────────────────────────────────────────
// Translation engine (safe mode)
// Rules:
//  1. Whole-word matching only — never replaces letters inside another word
//     (prevents outputs like "بDate" or "الAccountantي").
//  2. All-or-nothing — if any Arabic word in the text cannot be translated,
//     the ORIGINAL Arabic text is returned unchanged. This protects
//     names/school names/DB values from half-translated gibberish.
//  3. Arabic-Indic digits and punctuation are normalised in English only
//     (same value, Latin glyphs). Numbers are never altered.
// ─────────────────────────────────────────────────────────────

// Arabic letters + diacritics + tatweel (excludes Arabic digits and punctuation)
const AR_WORD = /[\u0620-\u065F\u066E-\u06D3\u06D5\u06FA-\u06FF]+/g
const AR_LETTER = /[\u0620-\u065F\u066E-\u06D3\u06D5\u06FA-\u06FF]/

const AR_DIGITS: Record<string, string> = {
  '\u0660': '0', '\u0661': '1', '\u0662': '2', '\u0663': '3', '\u0664': '4',
  '\u0665': '5', '\u0666': '6', '\u0667': '7', '\u0668': '8', '\u0669': '9',
  '\u066B': '.', '\u066C': ',', '\u060C': ',', '\u061B': ';', '\u061F': '?', '\u066A': '%',
}

// ← and → are not bidi-mirrored: an arrow meaning "forward" in RTL (←) must become → in LTR.
// (‹ › are mirrored automatically by the browser, so they are left as is.)
const ARROWS: Record<string, string> = { '\u2190': '\u2192', '\u2192': '\u2190' }

function normalisePunctuation(value: string): string {
  return value
    .replace(/[\u0660-\u0669\u066B\u066C\u060C\u061B\u061F\u066A]/g, (ch) => AR_DIGITS[ch] ?? ch)
    .replace(/[\u2190\u2192]/g, (ch) => ARROWS[ch] ?? ch)
}

// Multi-word phrases from the exact dictionary, indexed by word count.
const phraseIndex: Map<string, string> = new Map()
let maxPhraseWords = 1
for (const [ar, en] of Object.entries(exact)) {
  const key = ar.trim().split(/\s+/).join(' ')
  if (!key) continue
  phraseIndex.set(key, en)
  const count = key.split(' ').length
  if (count > maxPhraseWords) maxPhraseWords = count
}

// Particles whose English depends on context ("من 100" = "out of 100", not "From 100").
// Translated only when they are the entire text (e.g. a "من / إلى" date label).
export const STANDALONE_ONLY = new Set(['من', 'إلى', 'و', 'أو', 'في', 'على', 'عن', 'مع'])

const cache = new Map<string, string>()
const CACHE_LIMIT = 5000

type Token = { text: string; arabic: boolean }

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let last = 0
  for (const match of input.matchAll(AR_WORD)) {
    const start = match.index ?? 0
    if (start > last) tokens.push({ text: input.slice(last, start), arabic: false })
    tokens.push({ text: match[0], arabic: true })
    last = start + match[0].length
  }
  if (last < input.length) tokens.push({ text: input.slice(last), arabic: false })
  return tokens
}

function translateUncached(input: string): string {
  const trimmed = input.trim()
  if (exact[trimmed] !== undefined) return input.replace(trimmed, exact[trimmed])

  const tokens = tokenize(input)
  // Single-word dictionary is used ONLY when the text is one Arabic word
  // (e.g. a label). Word-by-word translation of phrases is disabled because
  // Arabic word order differs from English ("اسم الموظف" ≠ "name Employee").
  const arabicWordCount = tokens.filter((t) => t.arabic).length
  const allowWordFallback = arabicWordCount === 1
  const out: string[] = []
  // Only ONE dictionary unit per text. Joining two units ("رسوم" + "النقل المدرسي")
  // would produce Arabic word order in English ("Fee School Transport").
  let units = 0

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (!token.arabic) {
      out.push(normalisePunctuation(token.text))
      continue
    }

    // Longest phrase first: Arabic words separated only by whitespace.
    let matched = false
    for (let n = maxPhraseWords; n >= 2; n--) {
      const lastIndex = i + (n - 1) * 2
      if (lastIndex >= tokens.length) continue
      const parts: string[] = []
      let valid = true
      for (let k = 0; k < n; k++) {
        const t = tokens[i + k * 2]
        const sep = k < n - 1 ? tokens[i + k * 2 + 1] : null
        if (!t || !t.arabic || (sep && (sep.arabic || !/^\s+$/.test(sep.text)))) { valid = false; break }
        parts.push(t.text)
      }
      if (!valid) continue
      const hit = phraseIndex.get(parts.join(' '))
      if (hit !== undefined) {
        if (++units > 1) return input
        out.push(hit)
        i = lastIndex
        matched = true
        break
      }
    }
    if (matched) continue

    if (STANDALONE_ONLY.has(token.text)) return input
    let single = phraseIndex.get(token.text)
    if (single === undefined && allowWordFallback && token.text.length > 1 && words[token.text] !== undefined) {
      const w = words[token.text]
      single = w.charAt(0).toUpperCase() + w.slice(1)
    }
    if (single === undefined) return input // all-or-nothing
    if (++units > 1) return input
    out.push(single)
  }

  const result = out.join('')
  return AR_LETTER.test(result) ? input : result
}

export function translateText(input: string, language: Language): string {
  if (language === 'ar' || !input) return input
  if (!AR_LETTER.test(input) && !/[\u0660-\u0669\u066B\u066C\u060C\u061B\u061F\u066A]/.test(input)) return input
  const hit = cache.get(input)
  if (hit !== undefined) return hit
  const result = translateUncached(input)
  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(input, result)
  return result
}
