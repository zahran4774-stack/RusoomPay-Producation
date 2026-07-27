// ============================================================================
// app/api/assistant/route.ts
// نقطة اتصال المساعد الذكي لرسوم Pay.
//
// المعمارية:
//   - يستقبل رسائل المستخدم + معرّف المحادثة.
//   - يمرّرها لـ Claude مع أداتين (tool use):
//       • search_help     → قاعدة المعرفة (assistant_search_help)
//       • get_school_data  → بيانات المدرسة الحيّة (assistant_context)
//   - كل الاستعلامات تمرّ بجلسة المستخدم (RLS)، فلا تسريب بين المدارس.
//   - يحفظ الحوار في assistant_conversations / assistant_messages.
//   - محدود بالمعدّل عبر جدول rate_limits الموجود.
//
// المتطلّبات (متغيّرات البيئة):
//   ANTHROPIC_API_KEY            مفتاح Claude API (سرّي، جهة الخادم فقط)
//   NEXT_PUBLIC_SUPABASE_URL     (موجود لديك)
//   NEXT_PUBLIC_SUPABASE_ANON_KEY(موجود لديك)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60          // رفع مهلة الوظيفة لتفادي timeout مع جولات الأدوات

// ---------- إعدادات ----------
const MODEL = 'claude-haiku-4-5'           // نموذج سريع واقتصادي، مثالي للمساعد المحادثي
const MAX_TOKENS = 1200
const MAX_TOOL_ROUNDS = 2                    // جولتان تكفيان (أداة ثم ردّ)؛ يقلّل زمن التنفيذ
const RATE_LIMIT = 20                        // رسائل
const RATE_WINDOW_MIN = 5                    // خلال 5 دقائق لكل مستخدم

// ---------- عميل Supabase مربوط بجلسة المستخدم (يحترم RLS) ----------
async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // يُستدعى من Server Component — يمكن تجاهله بأمان
          }
        },
      },
    },
  )
}

// ---------- تعريف الأدوات المعروضة لـ Claude ----------
const TOOLS = [
  {
    name: 'search_help',
    description:
      'ابحث في قاعدة معرفة رسوم Pay للحصول على تفاصيل موثّقة إضافية عن ميزة أو صفحة. ' +
      'استخدمها لإثراء إجابتك بالتفاصيل الدقيقة، لكنها مكمّلة لمعرفتك لا بديلة عنها. ' +
      'إذا رجعت فارغة، لا تتوقف — أجب من معرفتك بخريطة المنصّة المدمجة لديك. ' +
      'لا تخبر المستخدم أبداً أنك «لم تجد» — أنت تعرف النظام أصلاً.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'كلمات مفتاحية عربية للبحث، مثل «تذكير سداد» أو «تصدير تقرير».',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_school_data',
    description:
      'اجلب بيانات مدرسة المستخدم الحيّة: نسبة التحصيل، المستحقات، المتأخرات، ' +
      'المدفوعات المعلّقة، عدد الطلاب والموظفين، الإيرادات، التنبيهات والتوصيات. ' +
      'استخدمها عندما يسأل المستخدم عن وضع مدرسته بالأرقام («كم طالب متأخر؟»). ' +
      'لا تحتاج أي مُدخل — تُرجع بيانات مدرسة المستخدم الحالي فقط.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
]

// ---------- تعليمات النظام (باللغة العربية) ----------
const SYSTEM_PROMPT = `أنت «مساعد رسوم Pay»، الخبير الأول بمنصّة إدارة رسوم المدارس RusoomPay. أنت لست مجرّد باحث في ملفات — أنت خبير حقيقي يعرف المنصّة من الداخل، ويرشد المستخدم بثقة كما يفعل موظف دعم متمرّس يعرف كل زاوية في النظام.

## خريطة المنصّة الكاملة (تعرفها عن ظهر قلب)
منصّة RusoomPay متعددة المدارس (multi-tenant) لإدارة رسوم المدارس في عُمان والخليج. صفحاتها:
- **لوحة القيادة** (/dashboard): مؤشرات (إجمالي التحصيل، المستحقات، المتأخرات، نسبة التحصيل) + «مساعد المدرسة الذكي» الذي يقترح قرارات. دلالة الألوان: أخضر آمن، ذهبي انتباه، أحمر حرج.
- **الرسوم** (/fees): كل فواتير الطلاب وحالاتها (مدفوع/مستحق/متأخر). منها: تسجيل دفعة يدوية، اعتماد مدفوعات أولياء الأمور المعلّقة، وإرسال تذكيرات السداد.
- **الطلاب** (/students): إضافة/تعديل الطلاب، ربطهم بأولياء الأمور، تحديد رسومهم ونوع نقلهم.
- **بوابة أولياء الأمور** (/parent): يرى ولي الأمر أبناءه، أرصدتهم، ويسدّد إلكترونياً. يبدّل بين الأبناء من قائمة علوية.
- **الموظفون والرواتب** (/employees): سجلّ الموظفين، مسير الرواتب بصيغة WPS، التأمينات (PASI)، اعتماد طلبات تعديل الرواتب.
- **المحاسبة** (/accounting): نظام قيد مزدوج تلقائي، شجرة حسابات، قيود مقفلة تُعكس بقيد عكسي.
- **المقصف** (/cafeteria): خطط وجبات، اشتراكات، فوترة شهرية.
- **النقل** (/transport): حافلات، مسارات، سائقون، اشتراكات ورسوم.
- **الشهادات** (/certificates): إصدار شهادات وإفادات بأرقام تسلسلية.
- **الإعلانات** (/announcements): نشر إعلانات وإشعارات موجّهة لأولياء الأمور والموظفين.
- **التقارير** (/reports): تقارير مالية (تحصيل، متأخرات، كشف طالب) بصيغة عربية RTL قابلة للطباعة وتصدير PDF.
- **الإعدادات** (/settings): بيانات المدرسة، الشعار، الحساب البنكي، الضريبة، إدارة المستخدمين والأدوار (مالك/مدير/محاسب).

## كيفية إرسال تذكيرات السداد (تعرفها تفصيلاً)
من لوحة القيادة → «مساعد المدرسة الذكي» → بطاقة «أولياء أمور تجاوزوا موعد السداد» → راجع القائمة → «إرسال تذكير». أو من صفحة الرسوم: صفِّ على «المتأخرة» ثم أرسل تذكيراً. النظام يصوغ الرسالة تلقائياً حسب سلوك الدفع (لطيفة للمنتظمين، أحزم للمتأخرين المتكررين)، وترسل عبر القنوات المتاحة.

## أدواتك
- **search_help**: للحصول على تفاصيل دقيقة موثّقة عن ميزة. استخدمها أولاً عند أسئلة «كيف».
- **get_school_data**: لأرقام مدرسة المستخدم الحيّة (متأخرات، تحصيل، مدفوعات معلّقة، طلاب، موظفون).

## فلسفتك في الإجابة (الأهم)
1. **أنت خبير، لا موظف تحويل.** أجب دائماً بنفسك من معرفتك بالنظام أعلاه. المعرفة المدمجة عندك تغطّي كل الصفحات — استخدمها بثقة.
2. **استخدم search_help لإثراء إجابتك** بتفاصيل موثّقة، لكن **لا تعتمد عليها وحدها**. إن لم تُرجع نتيجة، أجب من خريطة المنصّة أعلاه — فأنت تعرف النظام أصلاً.
3. **ممنوع منعاً باتاً** أن تقول «لم أجد» أو «راجع الدعم» لسؤال يخصّ استخدام المنصّة. أنت الخبير — أجب. الإحالة للدعم مسموحة فقط لأمور خارج النظام تماماً (مشكلة في حساب بنكي فعلي، عطل تقني حقيقي، طلب استرداد مالي).
4. إن كان السؤال غامضاً، **استنتج القصد الأرجح وأجب**، ثم اعرض توضيحاً إن لزم. لا ترفض.
5. للأسئلة عن الأرقام، استخدم get_school_data وأجب برقم مدرسته الفعلي.
6. أجب بالعربية الفصحى المبسّطة، بخطوات مرقّمة واضحة، بثقة الخبير ودفء المساعد. استخدم **الخط العريض** للمصطلحات المهمّة.
7. لا تذكر تفاصيل تقنية داخلية (أسماء جداول أو دوال أو كود). تحدّث بلغة المستخدم.
8. اختم بلمسة مفيدة: اقترح خطوة تالية منطقية أو سؤالاً ذا صلة قد يفيد المستخدم.

تذكّر: المستخدم يثق أنك تعرف النظام. لا تخذله بإحالته لغيرك — أنت الخبير الذي يعرف كل شيء عن RusoomPay.`

// ---------- تحديد المعدّل عبر جدول rate_limits ----------
async function checkRateLimit(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  userId: string,
): Promise<boolean> {
  const key = `assistant:${userId}`
  const windowStart = new Date(Date.now() - RATE_WINDOW_MIN * 60_000).toISOString()

  const { data: row } = await supabase
    .from('rate_limits')
    .select('key, count, window_start')
    .eq('key', key)
    .maybeSingle()

  if (!row || row.window_start < windowStart) {
    // نافذة جديدة
    await supabase
      .from('rate_limits')
      .upsert({ key, count: 1, window_start: new Date().toISOString() })
    return true
  }
  if (row.count >= RATE_LIMIT) return false

  await supabase
    .from('rate_limits')
    .update({ count: row.count + 1 })
    .eq('key', key)
  return true
}

// ---------- تنفيذ أداة يستدعيها Claude ----------
async function runTool(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  if (name === 'search_help') {
    const q = typeof input.query === 'string' ? input.query : ''
    const { data, error } = await supabase.rpc('assistant_search_help', { q })
    if (error) return JSON.stringify({ error: 'search_failed' })
    return JSON.stringify(data ?? [])
  }
  if (name === 'get_school_data') {
    const { data, error } = await supabase.rpc('assistant_context')
    if (error) return JSON.stringify({ error: 'context_failed' })
    return JSON.stringify(data ?? {})
  }
  return JSON.stringify({ error: 'unknown_tool' })
}

// ---------- نوع رسالة Claude ----------
type ClaudeMessage = {
  role: 'user' | 'assistant'
  content: unknown
}

// ---------- استدعاء Claude API ----------
async function callClaude(messages: ClaudeMessage[]) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // تعليمات النظام كـ«كتلة» مع cache_control:
      // تُخزَّن مؤقتاً فتُحسب بـ 10% فقط في الرسائل التالية (توفير ~90%).
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: TOOLS,
      messages,
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`claude_api_error:${res.status}:${detail.slice(0, 300)}`)
  }
  return res.json()
}

// ============================================================================
// المعالج الرئيسي
// ============================================================================
export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()

    // 1) التحقق من الجلسة
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // 2) تحديد المعدّل
    const allowed = await checkRateLimit(supabase, user.id)
    if (!allowed) {
      return NextResponse.json(
        { error: 'rate_limited', message: 'وصلت الحدّ المسموح مؤقتاً. حاول بعد دقائق.' },
        { status: 429 },
      )
    }

    // 3) قراءة المُدخل
    const body = await req.json().catch(() => null)
    const userText: string | undefined = body?.message
    let conversationId: string | undefined = body?.conversationId
    if (!userText || typeof userText !== 'string' || userText.trim().length === 0) {
      return NextResponse.json({ error: 'empty_message' }, { status: 400 })
    }
    if (userText.length > 2000) {
      return NextResponse.json({ error: 'message_too_long' }, { status: 400 })
    }

    // 4) هوية المدرسة (للحفظ)
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', user.id)
      .maybeSingle()
    const schoolId = profile?.school_id
    if (!schoolId) {
      return NextResponse.json({ error: 'no_school' }, { status: 400 })
    }

    // 5) إنشاء محادثة إن لم تُمرّر
    if (!conversationId) {
      const { data: conv, error: convErr } = await supabase
        .from('assistant_conversations')
        .insert({
          school_id: schoolId,
          user_id: user.id,
          title: userText.slice(0, 60),
        })
        .select('id')
        .single()
      if (convErr || !conv) {
        return NextResponse.json({ error: 'conversation_failed' }, { status: 500 })
      }
      conversationId = conv.id
    }

    // 6) استرجاع تاريخ المحادثة (آخر 20 رسالة للسياق)
    const { data: history } = await supabase
      .from('assistant_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20)

    const messages: ClaudeMessage[] = (history ?? []).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))
    messages.push({ role: 'user', content: userText })

    // 7) حفظ رسالة المستخدم
    await supabase.from('assistant_messages').insert({
      conversation_id: conversationId,
      school_id: schoolId,
      role: 'user',
      content: userText,
    })

    // 8) حلقة المحادثة مع الأدوات
    let finalText = ''
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const reply = await callClaude(messages)
      const blocks: any[] = reply.content ?? []

      // اجمع النص
      const textBlocks = blocks
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
      if (textBlocks) finalText = textBlocks

      // هل طلب Claude استخدام أدوات؟
      const toolUses = blocks.filter((b) => b.type === 'tool_use')
      if (reply.stop_reason !== 'tool_use' || toolUses.length === 0) {
        break // انتهى — لا أدوات مطلوبة
      }

      // أضف ردّ Claude (بما فيه طلب الأداة) ثم نتائج الأدوات
      messages.push({ role: 'assistant', content: blocks })
      const toolResults = []
      for (const tu of toolUses) {
        const result = await runTool(supabase, tu.name, tu.input ?? {})
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: result,
        })
      }
      messages.push({ role: 'user', content: toolResults })
    }

    if (!finalText) {
      finalText = 'عذراً، لم أتمكّن من صياغة ردّ. حاول إعادة صياغة سؤالك.'
    }

    // 9) حفظ ردّ المساعد
    await supabase.from('assistant_messages').insert({
      conversation_id: conversationId,
      school_id: schoolId,
      role: 'assistant',
      content: finalText,
    })

    // 10) الإرجاع
    return NextResponse.json({
      ok: true,
      conversationId,
      reply: finalText,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    // سجّل الخطأ داخلياً دون كشف تفاصيل للعميل
    console.error('[assistant] error:', msg)
    return NextResponse.json(
      { error: 'server_error', message: 'حدث خطأ مؤقت. حاول مرة أخرى.' },
      { status: 500 },
    )
  }
}
