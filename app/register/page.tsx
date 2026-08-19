"use client";

import { useState, useRef } from "react";
import { PLAN_PRICES } from "@/lib/payment-config";

// ─── البيانات ────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: "البداية",
    nameAr: "البداية",
    price: 0,
    students: "حتى 75 طالب",
    features: ["لوحة تحكم أساسية", "إشعارات الرسوم", "تقارير PDF"],
    badge: null,
  },
  {
    id: "المتقدمة",
    nameAr: "المتقدّمة",
    price: 320,
    students: "حتى 1500 طالب",
    features: [
      "كل مميزات البداية",
      "كشف رواتب الموظفين",
      "نظام المقصف",
      "تقارير متقدمة",
      "دعم أولوية",
    ],
    badge: "الأكثر طلباً",
  },
];

const PAYMENT_PHONE   = "95476649";
const PAYMENT_PHONE_D = "9547 6649";
const BANK = {
  name:   "ZAHRAN ZAHIR HAMED AL DAGHARI",
  number: "0368 0016 6281 0033",
  iban:   "OM670270368001662810033",
  swift:  "BMUSOMRXXXX",
  bank:   "Bank Muscat",
};

// ─── مساعدات ─────────────────────────────────────────────────────────────────

function StepBar({ step }: { step: number }) {
  const steps = ["بيانات المدرسة", "اختيار الخطة", "الدفع", "رفع الإيصال"];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const n = i + 1;
        const done   = step > n;
        const active = step === n;
        return (
          <div key={n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                  ${done   ? "bg-green-500 text-white"
                  : active ? "bg-green-600 text-white ring-4 ring-green-100"
                  :          "bg-gray-100 text-gray-400"}`}
              >
                {done ? "✓" : n}
              </div>
              <span className={`text-xs mt-1 whitespace-nowrap ${active ? "text-green-700 font-medium" : "text-gray-400"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-4 ${step > n ? "bg-green-400" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CopyBtn({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value.replace(/\s/g, ""));
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors shrink-0"
    >
      {done ? "✓ تم" : "نسخ"}
    </button>
  );
}

function Field({
  label, name, type = "text", value, onChange, placeholder, required, hint,
}: {
  label: string; name: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; required?: boolean; hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type} name={name} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} required={required}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent
                   placeholder:text-gray-300 bg-white"
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

// ─── الخطوة 1 — بيانات المدرسة ───────────────────────────────────────────────

function Step1({
  data, onChange, onNext,
}: {
  data: Record<string, string>;
  onChange: (k: string, v: string) => void;
  onNext: () => void;
}) {
  const valid = data.schoolName && data.contactName && data.phone;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">بيانات المدرسة</h2>
        <p className="text-sm text-gray-500 mt-0.5">أدخل معلومات المدرسة والمسؤول</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="اسم المدرسة" name="schoolName" value={data.schoolName} onChange={(v) => onChange("schoolName", v)}
          placeholder="مدرسة النور الخاصة" required />
        <Field label="اسم المسؤول" name="contactName" value={data.contactName} onChange={(v) => onChange("contactName", v)}
          placeholder="أحمد الرحبي" required />
        <Field label="رقم الهاتف" name="phone" type="tel" value={data.phone} onChange={(v) => onChange("phone", v)}
          placeholder="+968 9X XXX XXX" required hint="سيُستخدم لإرسال الإشعارات والتواصل" />
        <Field label="البريد الإلكتروني" name="email" type="email" value={data.email} onChange={(v) => onChange("email", v)}
          placeholder="school@example.com" />
        <Field label="المدينة" name="city" value={data.city} onChange={(v) => onChange("city", v)}
          placeholder="مسقط" />
        <Field label="عدد الطلاب التقريبي" name="studentCount" type="number" value={data.studentCount}
          onChange={(v) => onChange("studentCount", v)} placeholder="مثال: 350" />
      </div>

      <div className="pt-2">
        <button
          onClick={onNext} disabled={!valid}
          className="w-full py-3 rounded-xl bg-green-600 text-white font-medium
                     disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
        >
          التالي — اختيار الخطة ←
        </button>
      </div>
    </div>
  );
}

// ─── الخطوة 2 — اختيار الخطة ─────────────────────────────────────────────────

function Step2({
  selected, onSelect, onNext, onBack,
}: {
  selected: string; onSelect: (id: string) => void; onNext: () => void; onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">اختر الخطة المناسبة</h2>
        <p className="text-sm text-gray-500 mt-0.5">يمكنك الترقية في أي وقت لاحقاً</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PLANS.map((plan) => {
          const active = selected === plan.id;
          return (
            <button
              key={plan.id} onClick={() => onSelect(plan.id)}
              className={`text-right p-5 rounded-xl border-2 transition-all w-full
                ${active ? "border-green-500 bg-green-50" : "border-gray-200 bg-white hover:border-green-300"}`}
            >
              {plan.badge && (
                <span className="inline-block text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full mb-2">
                  {plan.badge}
                </span>
              )}
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-2xl font-bold text-gray-800">
                  {plan.price === 0 ? "مجانية" : plan.price.toLocaleString("ar")}
                </span>
                {plan.price > 0 && (
                  <span className="text-sm text-gray-500">ريال / سنوياً</span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">{plan.nameAr}</p>
              <p className="text-xs text-green-600 mb-3">{plan.students}</p>
              <ul className="space-y-1">
                {plan.features.map((f) => (
                  <li key={f} className="text-xs text-gray-600 flex items-center gap-1.5">
                    <span className="text-green-500">✓</span> {f}
                  </li>
                ))}
              </ul>
              {active && (
                <div className="mt-3 text-xs font-medium text-green-700 bg-green-100 rounded-lg py-1 text-center">
                  ✓ الخطة المختارة
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm">
          → رجوع
        </button>
        <button
          onClick={onNext} disabled={!selected}
          className="flex-1 py-3 rounded-xl bg-green-600 text-white font-medium
                     disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
        >
          {selected === "البداية" ? "تفعيل مجاني ←" : "التالي — تفاصيل الدفع ←"}
        </button>
      </div>
    </div>
  );
}

// ─── الخطوة 3 — تفاصيل الدفع ─────────────────────────────────────────────────

function Step3({
  plan, amount, onNext, onBack,
}: {
  plan: string; amount: number; onNext: () => void; onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">تفاصيل الدفع</h2>
        <p className="text-sm text-gray-500 mt-0.5">حوّل المبلغ بأي طريقة تناسبك</p>
      </div>

      {/* المبلغ */}
      <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-center">
        <p className="text-sm text-green-700 mb-1">المبلغ المطلوب — خطة {plan}</p>
        <p className="text-4xl font-bold text-green-800">
          {amount.toFixed(3)}
          <span className="text-lg font-normal mr-1">ريال عماني</span>
        </p>
      </div>

      {/* طريقة 1 */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center gap-2">
          <span>📱</span>
          <span className="text-sm font-medium text-gray-700">طريقة 1 — تحويل هاتفي</span>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">رقم الهاتف</p>
              <p className="text-2xl font-bold font-mono tracking-widest text-gray-800">{PAYMENT_PHONE_D}</p>
            </div>
            <CopyBtn value={PAYMENT_PHONE} />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            مدعوم في Bank Muscat، BankDhofar، NBO، Ahli Bank وغيرها
          </p>
        </div>
      </div>

      {/* طريقة 2 */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center gap-2">
          <span>🏦</span>
          <span className="text-sm font-medium text-gray-700">طريقة 2 — تحويل بنكي ({BANK.bank})</span>
        </div>
        <div className="p-4 space-y-3">
          {[
            { label: "اسم الحساب",  value: BANK.name,   raw: BANK.name   },
            { label: "رقم الحساب",  value: BANK.number, raw: BANK.number },
            { label: "IBAN",         value: BANK.iban,   raw: BANK.iban   },
            { label: "SWIFT Code",   value: BANK.swift,  raw: BANK.swift  },
          ].map(({ label, value, raw }) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="text-sm font-medium font-mono text-gray-800 break-all">{value}</p>
              </div>
              <CopyBtn value={raw} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
        <span className="text-amber-500 shrink-0">⚠️</span>
        <p className="text-xs text-amber-700 leading-relaxed">
          بعد إتمام التحويل، احتفظ بصورة الإيصال وارفعها في الخطوة التالية.
          سيتحقق النظام تلقائياً وسيُفعَّل اشتراكك فور التأكيد.
        </p>
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm">
          → رجوع
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
        >
          التالي — رفع الإيصال ←
        </button>
      </div>
    </div>
  );
}

// ─── الخطوة 4 — رفع الإيصال ──────────────────────────────────────────────────

function Step4({
  file, setFile, loading, result, onSubmit, onBack,
}: {
  file: File | null;
  setFile: (f: File | null) => void;
  loading: boolean;
  result: { status: string; reason: string } | null;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">رفع إيصال الدفع</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          ارفع صورة واضحة للإيصال — سيتحقق النظام تلقائياً
        </p>
      </div>

      {/* منطقة الرفع */}
      {!preview ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-10
                     flex flex-col items-center justify-center gap-3 cursor-pointer
                     hover:border-green-400 hover:bg-green-50 transition-all"
        >
          <span className="text-4xl">🧾</span>
          <p className="text-sm font-medium text-gray-600">اسحب الإيصال هنا أو انقر للاختيار</p>
          <p className="text-xs text-gray-400">JPG، PNG، أو WEBP — بحد أقصى 10 ميغابايت</p>
          <input
            ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      ) : (
        <div className="relative">
          <img src={preview} alt="الإيصال" className="w-full rounded-xl border border-gray-200 max-h-72 object-contain bg-gray-50" />
          <button
            onClick={() => { setFile(null); setPreview(null); }}
            className="absolute top-2 left-2 bg-white border border-gray-200 rounded-full w-7 h-7
                       flex items-center justify-center text-gray-500 hover:text-red-500 text-xs"
          >
            ✕
          </button>
          <div className="mt-2 text-xs text-gray-500 text-center">
            {file?.name} — {((file?.size ?? 0) / 1024).toFixed(0)} KB
          </div>
        </div>
      )}

      {/* نتيجة التحقق */}
      {result && (
        <div
          className={`p-4 rounded-xl border text-sm leading-relaxed
            ${result.status === "approved" ? "bg-green-50 border-green-200 text-green-800"
            : result.status === "suspicious" ? "bg-amber-50 border-amber-200 text-amber-800"
            : "bg-red-50 border-red-200 text-red-800"}`}
        >
          {result.reason}
          {result.status === "approved" && (
            <p className="mt-2 font-medium">🎉 تم تفعيل اشتراكك! ستصلك رسالة واتساب بتفاصيل الدخول.</p>
          )}
          {result.status === "suspicious" && (
            <p className="mt-2">سيراجع الفريق الإيصال ويتواصل معك خلال ساعات.</p>
          )}
          {result.status === "rejected" && (
            <p className="mt-2">يرجى التحقق من الإيصال وإعادة المحاولة، أو تواصل معنا مباشرة.</p>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          onClick={onBack}
          disabled={loading}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm disabled:opacity-40"
        >
          → رجوع
        </button>
        <button
          onClick={onSubmit}
          disabled={!file || loading || result?.status === "approved"}
          className="flex-1 py-3 rounded-xl bg-green-600 text-white font-medium
                     disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              جاري التحقق...
            </span>
          ) : "إرسال وتفعيل الاشتراك ✓"}
        </button>
      </div>
    </div>
  );
}

// ─── الصفحة الرئيسية ──────────────────────────────────────────────────────────

export default function RegisterPage() {
  const [step, setStep]     = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: string; reason: string } | null>(null);
  const [file, setFile]     = useState<File | null>(null);

  const [formData, setFormData] = useState({
    schoolName: "", contactName: "", phone: "",
    email: "", city: "", studentCount: "",
  });
  const [plan, setPlan] = useState("");

  const selectedPlan = PLANS.find((p) => p.id === plan);
  const amount       = selectedPlan?.price ?? 0;

  const updateField = (k: string, v: string) =>
    setFormData((prev) => ({ ...prev, [k]: v }));

  const handleStep2Next = () => {
    if (plan === "البداية") {
      handleFreeSubmit();
    } else {
      setStep(3);
    }
  };

  const handleFreeSubmit = async () => {
    setLoading(true);
    const fd = new FormData();
    Object.entries(formData).forEach(([k, v]) => fd.append(k, v));
    fd.append("plan", plan);

    await fetch("/api/schools/register", { method: "POST", body: fd });
    setLoading(false);
    setStep(5);
  };

  const handleReceiptSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);

    const fd = new FormData();
    Object.entries(formData).forEach(([k, v]) => fd.append(k, v));
    fd.append("plan", plan);
    fd.append("receipt", file);

    const res  = await fetch("/api/schools/register", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);
    setResult({ status: data.verificationStatus ?? (res.ok ? "approved" : "rejected"), reason: data.reason ?? data.error ?? "" });
  };

  // شاشة النجاح النهائية
  if (step === 5) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">تم تسجيل طلبك بنجاح!</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            سنتواصل معك على الرقم {formData.phone} خلال 24 ساعة لتفعيل حساب مدرستك.
          </p>
          <div className="mt-6 p-4 bg-green-50 rounded-xl border border-green-100">
            <p className="text-sm font-medium text-green-700">مدرستك: {formData.schoolName}</p>
            <p className="text-sm text-green-600">الخطة: {plan}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4" dir="rtl">
      <div className="max-w-xl mx-auto">

        {/* الرأس */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-2xl">🏫</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">الاشتراك في مدارسي</h1>
          <p className="text-sm text-gray-500 mt-1">منصة إدارة المدارس الخاصة</p>
        </div>

        {/* البطاقة */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {step <= 4 && <StepBar step={step} />}

          {step === 1 && (
            <Step1 data={formData} onChange={updateField} onNext={() => setStep(2)} />
          )}
          {step === 2 && (
            <Step2 selected={plan} onSelect={setPlan} onNext={handleStep2Next} onBack={() => setStep(1)} />
          )}
          {step === 3 && (
            <Step3 plan={plan} amount={amount} onNext={() => setStep(4)} onBack={() => setStep(2)} />
          )}
          {step === 4 && (
            <Step4
              file={file} setFile={(f) => { setFile(f); setResult(null); }}
              loading={loading} result={result}
              onSubmit={handleReceiptSubmit}
              onBack={() => setStep(3)}
            />
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          هل تحتاج مساعدة؟{" "}
          <a href="https://wa.me/96895476649" className="text-green-600 hover:underline">
            تواصل معنا عبر واتساب
          </a>
        </p>
      </div>
    </main>
  );
}
