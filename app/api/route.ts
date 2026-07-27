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

// ---------- إعدادات ----------
const MODEL = 'claude-sonnet-4-6'          // نموذج نشط، مثالي للمحادثة و RAG
const MAX_TOKENS = 1024
const MAX_TOOL_ROUNDS = 4                    // سقف جولات استدعاء الأدوات (حماية)
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
        setAll: (list) => {
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
      'ابحث في قاعدة معرفة رسوم Pay عن شرح صفحة أو ميزة أو خطوات تنفيذ مهمة. ' +
      'استخدمها عندما يسأل المستخدم «كيف أفعل كذا؟» أو عن طريقة استخدام أي صفحة. ' +
      'تُرجع مقالات مطابقة (عنوان، ملخّص، محتوى، خطوات) يسمح دور المستخدم برؤيتها.',
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
const SYSTEM_PROMPT = `أنت «مساعد رسوم Pay»، مساعد ذكي داخل منصّة إدارة رسوم المدارس RusoomPay.
مهمّتك مساعدة مستخدمي المنصّة (مالك المدرسة، المدير، المحاسب، ولي الأمر) على فهم النظام واستخدامه، والإجابة عن أسئلتهم حول بيانات مدرستهم.

القواعد:
- أجب دائماً بالعربية الفصحى المبسّطة، بأسلوب ودود ومباشر.
- إذا سُئلت «كيف أستخدم/أفعل كذا؟» استخدم أداة search_help أولاً ثم أجب من نتائجها فقط. لا تخترع خطوات غير موجودة.
- إذا سُئلت عن أرقام مدرسة المستخدم (متأخرات، تحصيل، مدفوعات معلّقة...) استخدم أداة get_school_data.
- إذا احتاج السؤال الأمرين معاً، استخدم الأداتين.
- كن موجزاً: خطوات مرقّمة عند الحاجة، وجُمل قصيرة.
- إذا لم تجد المعلومة في قاعدة المعرفة، قل ذلك بصدق واقترح التواصل مع الدعم، ولا تخمّن.
- لا تذكر تفاصيل تقنية داخلية (أسماء جداول، دوال، كود). تحدّث بلغة المستخدم لا لغة النظام.
- لا تكشف بيانات مالية حسّاسة لمن لا يخصّه دوره؛ النظام يقيّد ذلك تلقائياً، فاكتفِ بما تُعيده الأدوات.`

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
      system: SYSTEM_PROMPT,
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

    const messages: ClaudeMessage[] = (history ?? []).map((m) => ({
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
