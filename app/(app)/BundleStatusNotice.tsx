// شريط حالة "دمج النقل والتغذية" — يظهر أعلى صفحتي النقل والتغذية
// يقرأ الإعداد الحي من schools.bundle_transport_meals (يُمرَّر من مكوّن الخادم)،
// فيعكس أي تفعيل/تعطيل من الإعدادات فور فتح الصفحة.
import Link from 'next/link'

type Service = 'transport' | 'cafeteria'

const TEXT: Record<Service, { on: string; off: string }> = {
  transport: {
    on: 'رسم النقل يُدرج ضمن الفاتورة السنوية الموحّدة عند تسجيل الطالب (يُختار مسار الباص من نموذج «إضافة طالب»). لا توجد فوترة شهرية منفصلة للنقل.',
    off: 'لا يُضاف رسم النقل إلى الفاتورة السنوية عند التسجيل، وخيار النقل في نموذج «إضافة طالب» مجمّد. الاشتراك هنا لتنظيم المسارات وقوائم المشتركين فقط، ولا تصدر به فاتورة تلقائياً.',
  },
  cafeteria: {
    on: 'باقة التغذية المختارة عند تسجيل طالب جديد تُضاف إلى فاتورته السنوية الموحّدة. أما الاشتراك من هذه الصفحة (للطلاب الحاليين أو اشتراك إضافي) فيُصدر فاتورة تغذية مستقلة.',
    off: 'خيار التغذية في نموذج «إضافة طالب» مجمّد. يتم الاشتراك من هذه الصفحة، وتصدر لكل اشتراك فاتورة تغذية مستقلة عن الفاتورة السنوية.',
  },
}

export default function BundleStatusNotice({ enabled, service }: { enabled: boolean; service: Service }) {
  return (
    <div
      dir="rtl"
      style={{
        background: enabled ? '#F0F9F4' : '#F6F7F9',
        border: `1px solid ${enabled ? '#BFE5D0' : '#E3E8EE'}`,
        borderRadius: 12, padding: '12px 14px', marginBottom: 16, fontSize: 13,
        color: enabled ? '#1A5C3A' : '#556',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <b style={{ color: '#0F2744' }}>دمج النقل والتغذية ضمن الرسوم الدراسية</b>
        <span
          style={{
            fontSize: 11.5, fontWeight: 700, borderRadius: 99, padding: '2px 10px',
            background: enabled ? '#1A7A45' : '#CBD3DD', color: enabled ? '#fff' : '#334',
          }}
        >
          {enabled ? 'مفعّل' : 'معطّل'}
        </span>
        <Link href="/settings" style={{ marginInlineStart: 'auto', fontSize: 12.5, fontWeight: 700, color: '#163B68', textDecoration: 'underline' }}>
          تغيير الإعداد
        </Link>
      </div>
      <div style={{ lineHeight: 1.8 }}>{enabled ? TEXT[service].on : TEXT[service].off}</div>
      <div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 4 }}>
        يُطبَّق الدمج على الطلاب الجدد فقط من تاريخ التفعيل — فواتير الطلاب الحاليين لا تتغيّر.
      </div>
    </div>
  )
}
