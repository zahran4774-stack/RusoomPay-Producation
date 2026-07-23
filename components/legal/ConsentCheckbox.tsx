'use client';

import Link from 'next/link';
import { LEGAL_VERSIONS } from '@/lib/legal';

type Props = {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
};

export default function ConsentCheckbox({ checked, onChange, disabled }: Props) {
  return (
    <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
        required
      />
      <span>
        أوافق على{' '}
        <Link
          href="/terms"
          target="_blank"
          className="underline text-[var(--brand)]"
        >
          شروط الخدمة
        </Link>{' '}
        و{' '}
        <Link
          href="/privacy"
          target="_blank"
          className="underline text-[var(--brand)]"
        >
          سياسة الخصوصية
        </Link>
        <span className="block text-xs text-gray-400 mt-0.5">
          النسخة {LEGAL_VERSIONS.terms}
        </span>
      </span>
    </label>
  );
}
