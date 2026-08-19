"use client";

import { useState } from "react";
import { PAYMENT_CONFIG } from "@/lib/payment-config";

interface Props {
  planName: string;
  amount: number;
}

export default function PaymentDetails({ planName, amount }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const CopyBtn = ({ value, label }: { value: string; label: string }) => (
    <button
      onClick={() => copy(value, label)}
      className="text-xs px-2 py-0.5 rounded border border-gray-200
                 hover:bg-gray-50 transition-colors text-gray-500"
    >
      {copied === label ? "✓ تم النسخ" : "نسخ"}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="text-center p-3 bg-green-50 rounded-xl border border-green-100">
        <p className="text-sm text-green-700">
          المبلغ المطلوب للخطة <strong>{planName}</strong>
        </p>
        <p className="text-3xl font-semibold text-green-800 mt-1">
          {amount.toFixed(3)}{" "}
          <span className="text-lg font-normal">ريال عماني</span>
        </p>
      </div>

      {/* طريقة 1 — تحويل هاتفي */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 flex items-center gap-2 border-b border-gray-200">
          <span className="text-base">📱</span>
          <span className="text-sm font-medium text-gray-700">
            طريقة 1 — تحويل هاتفي
          </span>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">رقم الهاتف</p>
              <p className="text-xl font-semibold tracking-widest text-gray-800 font-mono">
                {PAYMENT_CONFIG.phone.display}
              </p>
            </div>
            <CopyBtn value={PAYMENT_CONFIG.phone.number} label="phone" />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            مدعوم في: Bank Muscat، BankDhofar، NBO، Ahli Bank وغيرها
          </p>
        </div>
      </div>

      {/* طريقة 2 — تحويل بنكي */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 flex items-center gap-2 border-b border-gray-200">
          <span className="text-base">🏦</span>
          <span className="text-sm font-medium text-gray-700">
            طريقة 2 — تحويل بنكي (Bank Muscat)
          </span>
        </div>
        <div className="p-4 space-y-3">
          {[
            { label: "اسم الحساب",   value: PAYMENT_CONFIG.bank.accountName,   key: "name"  },
            { label: "رقم الحساب",   value: PAYMENT_CONFIG.bank.accountNumber,  key: "acc"   },
            { label: "IBAN",          value: PAYMENT_CONFIG.bank.iban,           key: "iban"  },
            { label: "SWIFT Code",    value: PAYMENT_CONFIG.bank.swift,          key: "swift" },
          ].map(({ label, value, key }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className="text-sm font-medium text-gray-800 font-mono">{value}</p>
              </div>
              <CopyBtn value={value.replace(/\s/g, "")} label={key} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
        <span className="text-amber-500 mt-0.5 text-sm">⚠️</span>
        <p className="text-xs text-amber-700 leading-relaxed">
          بعد التحويل، ارفع صورة الإيصال في الخطوة التالية. سيتحقق النظام
          تلقائياً وسيُفعَّل اشتراكك فور التأكيد.
        </p>
      </div>
    </div>
  );
}
