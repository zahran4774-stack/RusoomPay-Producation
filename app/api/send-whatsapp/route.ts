// app/api/send-whatsapp/route.ts — إرسال رسائل واتساب عبر Twilio
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { to, body } = await req.json()

    if (!to || !body) {
      return NextResponse.json({ error: 'missing to or body' }, { status: 400 })
    }

    const sid = process.env.TWILIO_ACCOUNT_SID!
    const token = process.env.TWILIO_AUTH_TOKEN!
    const from = process.env.TWILIO_WHATSAPP_FROM!

    const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`

    const params = new URLSearchParams()
    params.append('To', toFormatted)
    params.append('From', from)
    params.append('Body', body)

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    )

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || 'twilio error', code: data.code },
        { status: res.status }
      )
    }

    return NextResponse.json({ success: true, sid: data.sid, status: data.status })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
