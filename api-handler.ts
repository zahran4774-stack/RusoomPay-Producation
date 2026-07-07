// lib/api-handler.ts
// غلاف موحّد للتعامل الرشيق مع أخطاء مسارات API.
// يلتقط أي استثناء، يسجّله، ويُرجع ردّاً نظيفاً بلا تسريب تفاصيل داخلية للعميل.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'

type Handler = (req: NextRequest, ctx: { requestId: string }) => Promise<NextResponse>

export function withErrorHandling(handler: Handler) {
  return async (req: NextRequest) => {
    const requestId = crypto.randomUUID()
    try {
      return await handler(req, { requestId })
    } catch (e) {
      const err = e as Error
      // سجّل الخطأ كاملاً في الخادم، وأرجع رسالة عامة للعميل
      try {
        const supabase = createServiceClient()
        await supabase.from('error_log').insert({
          source: 'api', severity: 'error',
          message: err.message,
          context: { path: req.nextUrl.pathname, method: req.method },
          request_id: requestId,
        })
      } catch { /* تسجيل الخطأ فشل — لا نُسقط الردّ */ }

      return NextResponse.json(
        { error: 'حدث خطأ غير متوقّع. تم تسجيله وفريقنا يتابعه.', requestId },
        { status: 500 }
      )
    }
  }
}
