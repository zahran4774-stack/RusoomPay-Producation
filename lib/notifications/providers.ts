// lib/notifications/providers.ts
// طبقة تجريد لمزوّدي الإشعارات — Email / SMS / WhatsApp / Push
// كل مزوّد يُرجع نتيجة موحّدة. غير المُهيّأ يُرجع "not_configured" بصدق بدل التظاهر بالنجاح.
import 'server-only' // درع: أسرار المزوّدين (Twilio/FCM...) لا تصل العميل أبداً

export type Channel = 'email' | 'sms' | 'whatsapp' | 'push'

export type SendResult =
  | { ok: true; providerId: string }
  | { ok: false; error: string; retryable: boolean }

export interface NotificationJob {
  channel: Channel
  recipient: string
  payload: { subject?: string; body: string; template?: string; vars?: Record<string, unknown> }
}

// --- Email (مثال: Resend / SendGrid) ---
async function sendEmail(job: NotificationJob): Promise<SendResult> {
  const key = process.env.EMAIL_API_KEY
  if (!key) return { ok: false, error: 'EMAIL_API_KEY غير مُهيّأ', retryable: false }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'RusoomPay <noreply@edupay.app>',
        to: job.recipient,
        subject: job.payload.subject || 'إشعار من RusoomPay',
        text: job.payload.body,
      }),
    })
    if (!res.ok) {
      const retryable = res.status >= 500 || res.status === 429
      return { ok: false, error: `Email ${res.status}`, retryable }
    }
    const data = await res.json()
    return { ok: true, providerId: data.id ?? 'email' }
  } catch (e) {
    return { ok: false, error: `Email network: ${(e as Error).message}`, retryable: true }
  }
}

// --- SMS (مثال: Twilio) ---
async function sendSms(job: NotificationJob): Promise<SendResult> {
  const sid = process.env.TWILIO_SID, token = process.env.TWILIO_TOKEN, from = process.env.TWILIO_FROM
  if (!sid || !token || !from) return { ok: false, error: 'Twilio غير مُهيّأ', retryable: false }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: job.recipient, From: from, Body: job.payload.body }),
    })
    if (!res.ok) return { ok: false, error: `SMS ${res.status}`, retryable: res.status >= 500 }
    const data = await res.json()
    return { ok: true, providerId: data.sid ?? 'sms' }
  } catch (e) {
    return { ok: false, error: `SMS network: ${(e as Error).message}`, retryable: true }
  }
}

// --- WhatsApp (مثال: WhatsApp Cloud API) ---
async function sendWhatsApp(job: NotificationJob): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN, phoneId = process.env.WHATSAPP_PHONE_ID
  if (!token || !phoneId) return { ok: false, error: 'WhatsApp غير مُهيّأ', retryable: false }
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: job.recipient,
        type: 'text', text: { body: job.payload.body },
      }),
    })
    if (!res.ok) return { ok: false, error: `WhatsApp ${res.status}`, retryable: res.status >= 500 }
    const data = await res.json()
    return { ok: true, providerId: data.messages?.[0]?.id ?? 'whatsapp' }
  } catch (e) {
    return { ok: false, error: `WhatsApp network: ${(e as Error).message}`, retryable: true }
  }
}

// --- Push (مثال: Web Push / FCM) ---
async function sendPush(job: NotificationJob): Promise<SendResult> {
  const key = process.env.FCM_SERVER_KEY
  if (!key) return { ok: false, error: 'FCM غير مُهيّأ', retryable: false }
  try {
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: { Authorization: `key=${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: job.recipient, notification: { title: job.payload.subject, body: job.payload.body } }),
    })
    if (!res.ok) return { ok: false, error: `Push ${res.status}`, retryable: res.status >= 500 }
    return { ok: true, providerId: 'push' }
  } catch (e) {
    return { ok: false, error: `Push network: ${(e as Error).message}`, retryable: true }
  }
}

const dispatch: Record<Channel, (j: NotificationJob) => Promise<SendResult>> = {
  email: sendEmail, sms: sendSms, whatsapp: sendWhatsApp, push: sendPush,
}

export async function deliver(job: NotificationJob): Promise<SendResult> {
  const fn = dispatch[job.channel]
  if (!fn) return { ok: false, error: `قناة غير مدعومة: ${job.channel}`, retryable: false }
  return fn(job)
}
