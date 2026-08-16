// netlify/functions/create-templates.mts
//
// دالة مؤقتة لإنشاء قوالب WhatsApp الستة عبر Twilio Content API.
//
// طريقة الاستخدام:
// 1) أضف هذا الملف لمستودعك بالمسار: netlify/functions/create-templates.mts
// 2) اعمل Commit/Push — Netlify بينشره تلقائياً.
// 3) افتح الرابط التالي من متصفح جوالك (استبدل SECRET_KEY بالقيمة اللي حطيتها تحت):
//      https://rusoompay.com/.netlify/functions/create-templates?secret=SECRET_KEY
// 4) بعد ما تشوف النتيجة، احذف هذا الملف من المستودع فوراً (أمان).

import type { Context, Config } from "@netlify/functions";

const SECRET_KEY = "rusoom-templates-2026-x9k";


type TemplateDef = {
  friendly_name: string;
  category: "UTILITY" | "MARKETING";
  body: string;
  variables: Record<string, string>;
};

const templates: TemplateDef[] = [
  {
    friendly_name: "fee_reminder_ar",
    category: "UTILITY",
    body:
      "مدرسة {{1}} عبر RusoomPay\n\n" +
      "عزيزنا {{2}}،\n" +
      "نود تذكيركم بوجود رسوم مستحقة على الطالب {{3}} بمبلغ {{4}} ر.ع.\n" +
      "نأمل التكرم بالسداد في أقرب وقت ممكن.\n\n" +
      "شاكرين لكم حسن تعاونكم.",
    variables: { "1": "نور العلم", "2": "زهران الدغاري", "3": "خالد زهران", "4": "1,157.000" },
  },
  {
    friendly_name: "payment_full_ar",
    category: "UTILITY",
    body:
      "مدرسة {{1}} عبر RusoomPay\n\n" +
      "عزيزنا {{2}}،\n" +
      "نفيدكم بأنه تم استلام مبلغ {{3}} ر.ع ({{4}}) لصالح الطالب {{5}}.\n\n" +
      "✅ تم سداد الفاتورة بالكامل.\n\n" +
      "نشكر لكم التزامكم وحسن تعاونكم معنا.",
    variables: { "1": "نور العلم", "2": "زهران", "3": "900.000", "4": "نقداً", "5": "سمية" },
  },
  {
    friendly_name: "payment_partial_ar",
    category: "UTILITY",
    body:
      "مدرسة {{1}} عبر RusoomPay\n\n" +
      "عزيزنا {{2}}،\n" +
      "نفيدكم بأنه تم استلام مبلغ {{3}} ر.ع ({{4}}) لصالح الطالب {{5}}.\n\n" +
      "المبلغ المتبقي على الفاتورة: {{6}} ر.ع.\n\n" +
      "نشكر لكم التزامكم، ونذكّركم بمتابعة سداد المبلغ المتبقي.",
    variables: {
      "1": "نور العلم",
      "2": "زهران",
      "3": "50.000",
      "4": "نقداً",
      "5": "ريما الدغاري",
      "6": "299.300",
    },
  },
  {
    friendly_name: "parent_invite_ar",
    category: "UTILITY",
    body:
      "السلام عليكم {{1}}،\n\n" +
      "يسرّ مدرسة {{2}} دعوتكم لتفعيل حسابكم في بوابة أولياء الأمور، لمتابعة رسوم أبنائكم وفواتيرهم إلكترونياً بكل سهولة عبر RusoomPay.\n\n" +
      "للتسجيل، يرجى زيارة الرابط التالي:\n" +
      "https://rusoompay.com/parent-register\n\n" +
      "استخدموا رقم هاتفكم ({{3}}) عند التسجيل، وسيتم ربط حسابكم بأبنائكم تلقائياً.\n\n" +
      "نتطلع لتعاونكم معنا.",
    variables: { "1": "زهران", "2": "نور العلم", "3": "95476649" },
  },
  {
    friendly_name: "admin_new_sub_ar",
    category: "UTILITY",
    body:
      "🔔 اشتراك جديد بانتظار الاعتماد\n\n" +
      "المدرسة: {{1}}\n" +
      "الباقة: {{2}}\n" +
      "طريقة الدفع: {{3}}\n\n" +
      "يرجى مراجعة الإيصال واعتماد الاشتراك من لوحة تحكم المنصة.",
    variables: { "1": "غبرة نزوى", "2": "الأساسية", "3": "تحويل بنكي" },
  },
  {
    friendly_name: "general_reminder_ar",
    category: "UTILITY",
    body:
      "مدرسة {{1}} عبر RusoomPay\n\n" +
      "عزيزنا ولي الأمر،\n" +
      "نود تذكيركم بمتابعة سداد الرسوم الدراسية المستحقة في أقرب وقت ممكن.\n\n" +
      "شاكرين لكم حسن تعاونكم.",
    variables: { "1": "نور العلم" },
  },
];

async function createContent(accountSid: string, authToken: string, tpl: TemplateDef) {
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const createRes = await fetch("https://content.twilio.com/v1/Content", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      friendly_name: tpl.friendly_name,
      language: "ar",
      variables: tpl.variables,
      types: {
        "twilio/text": {
          body: tpl.body,
        },
      },
    }),
  });

  const createData = await createRes.json();

  if (!createRes.ok) {
    return { name: tpl.friendly_name, error: createData };
  }

  const contentSid = createData.sid;

  const approvalRes = await fetch(
    `https://content.twilio.com/v1/Content/${contentSid}/ApprovalRequests/whatsapp`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: tpl.friendly_name,
        category: tpl.category,
      }),
    }
  );

  const approvalData = await approvalRes.json();

  return {
    name: tpl.friendly_name,
    contentSid,
    approvalStatus: approvalRes.ok ? approvalData.status : approvalData,
  };
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");

  if (secret !== SECRET_KEY) {
    return new Response(JSON.stringify({ error: "غير مصرح" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const accountSid = Netlify.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Netlify.env.get("TWILIO_AUTH_TOKEN");

  if (!accountSid || !authToken) {
    return new Response(
      JSON.stringify({ error: "متغيرات TWILIO غير موجودة في Netlify" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const results = [];
  for (const tpl of templates) {
    const result = await createContent(accountSid, authToken, tpl);
    results.push(result);
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};

export const config: Config = {
  path: "/.netlify/functions/create-templates",
};
