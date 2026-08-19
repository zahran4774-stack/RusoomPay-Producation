"use client";

import { useState, useRef } from "react";

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
    features: ["كل مميزات البداية", "كشف رواتب الموظفين", "نظام المقصف", "تقارير متقدمة", "دعم أولوية"],
    badge: "الأكثر طلباً",
  },
];

const PAYMENT_PHONE = "95476649";
const PAYMENT_PHONE_D = "9547 6649";
const BANK = {
  name: "ZAHRAN ZAHIR HAMED AL DAGHARI",
  number: "0368 0016 6281 0033",
  iban: "OM670270368001662810033",
  swift: "BMUSOMRXXXX",
  bank: "Bank Muscat",
};

function StepBar({ step }: { step: number }) {
  const steps = ["اختيار الخطة", "الدفع", "رفع الإيصال"];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <div key={n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                  ${done ? "bg-green-500 text-white"
                  : active ? "bg-green-600 text-white ring-4 ring-green-100"
                  : "bg-gray-100 text-gray-400"}`}
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
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value.replace(/\s/g, "")); setDone(true); setTimeout(() => setDone(false), 2000); }}
      className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors shrink-0"
    >
      {done ? "✓ تم" : "نسخ"}
    </button>
  );
}

function Step1({ selected, onSelect, onNext }: { selected: string; onSelect: (id: string) => void; onNext: () => void }) {
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
              key={plan.id}
              onClick={() => onSelect(plan.id)}
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
                {plan.price > 0 && <span className="text-sm text-gray-500">ريال / سنوياً</span>}
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
      <button
        onClick={onNext}
        disabled={!selected}
        className="w-full py-3 rounded-xl bg-green-600 text-white font-medium
                   disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
      >
        {selected === "البداية" ? "تفعيل مجاني ←" : "التالي — تفاصيل الدفع ←"}
      </button>
    </div>
  );
}

function Step2({ plan, amount, onNext, onBack }: { plan: string; amount: number; onNext: () => void; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">تفاصيل الدفع</h2>
        <p className="text-sm text-gray-500 mt-0.5">حوّل المبلغ بأي طريقة تناسبك ثم ارفع الإيصال</p>
      </div>
      <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-center">
        <p className="text-sm text-green-700 mb-1">المبلغ المطلوب — خطة {plan}</p>
        <p className="text-4xl font-bold text-green-800">
          {amount.toFixed(3)}
          <span className="text-lg font-normal mr-2">ريال عماني</span>
        </p>
      </div>

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
          <p className="text-xs text-gray-400 mt-2">مدعوم في Bank Muscat، BankDhofar، NBO، Ahli Bank وغيرها</p>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center gap-2">
          <span>🏦</span>
          <span className="text-sm font-medium text-gray-700">طريقة 2 — تحويل بنكي ({BANK.bank})</span>
        </div>
        <div className="p-4 space-y-3">
          {[
            { label: "اسم الحساب", value: BANK.name },
            { label: "رقم الحساب", value: BANK.number },
            { label: "IBAN", value: BANK.iban },
            { label: "SWIFT Code", value: BANK.swift },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="text-sm font-medium font-mono text-gray-800 break-all">{value}</p>
              </div>
              <CopyBtn value={value} />
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

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm">
          → رجوع
        </button>
        <button onClick={onNext} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-colors">
          التالي — رفع الإيصال ←
        </button>
      </div>
    </div>
  );
}

function Step3({
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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">رفع إيصال الدفع</h2>
        <p className="text-sm text-gray-500 mt-0.5">ارفع صورة واضحة — سيتحقق النظام تلقائياً</p>
      </div>

      {!preview ? (
        <div
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
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
          <p className="mt-1 text-xs text-gray-400 text-center">{file?.name}</p>
        </div>
      )}

      {result && (
        <div className={`p-4 rounded-xl border text-sm leading-relaxed
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
            <p className="mt-2">يرجى التحقق من الإيصال وإعادة المحاولة، أو تواصل معنا على واتساب.</p>
          )}
        </div>
      )}

      <div className="flex gap-3">
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
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              جاري التحقق...
            </span>
          ) : "إرسال وتفعيل الاشتراك ✓"}
        </button>
      </div>
    </div>
  );
}

export default function SubscribePage() {
  const [step, setStep] = useState(1);
  const [plan, setPlan] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: string; reason: string } | null>(null);

  const selectedPlan = PLANS.find((p) => p.id === plan);
  const amount = selectedPlan?.price ?? 0;

  const handleStep1Next = () => {
    if (plan === "البداية") {
      handleFreeActivation();
    } else {
      setStep(2);
    }
  };

  const handleFreeActivation = async () => {
    setLoading(true);
    const fd = new FormData();
    fd.append("plan", plan);
    await fetch("/api/schools/register", { method: "POST", body: fd });
    setLoading(false);
    setStep(4);
  };

  const handleReceiptSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    const fd = new FormData();
    fd.append("plan", plan);
    fd.append("receipt", file);
    const res = await fetch("/api/schools/register", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);
    setResult({
      status: data.verificationStatus ?? (res.ok ? "approved" : "rejected"),
      reason: data.reason ?? data.error ?? "",
    });
  };

  if (step === 4) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">تم تفعيل الخطة المجانية!</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            حسابك جاهز الآن. يمكنك الدخول للوحة التحكم مباشرة.
          </p>
          <a href="/dashboard" className="mt-6 inline-block py-3 px-8 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors">
            الدخول للوحة التحكم ←
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4" dir="rtl">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-2xl">🏫</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">تفعيل الاشتراك</h1>
          <p className="text-sm text-gray-500 mt-1">اختر خطتك وفعّل مدرستك على مدارسي</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {step <= 3 && <StepBar step={step} />}
          {step === 1 && <Step1 selected={plan} onSelect={setPlan} onNext={handleStep1Next} />}
          {step === 2 && <Step2 plan={plan} amount={amount} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
          {step === 3 && (
            <Step3
              file={file}
              setFile={(f) => { setFile(f); setResult(null); }}
              loading={loading}
              result={result}
              onSubmit={handleReceiptSubmit}
              onBack={() => setStep(2)}
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
