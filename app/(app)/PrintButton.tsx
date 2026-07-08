'use client'
// زر طباعة عام — يطبع جدول بيانات كتقرير رسمي بترويسة المدرسة
import { printReport, type Column, type SchoolHeader } from '@/lib/print-report'

export default function PrintButton({ school, title, subtitle, columns, rows, label = '🖨 طباعة' }: {
  school: SchoolHeader
  title: string
  subtitle?: string
  columns: Column[]
  rows: Record<string, string | number>[]
  label?: string
}) {
  return (
    <button
      onClick={() => printReport({ school, title, subtitle, columns, rows })}
      style={{
        background: '#fff', color: '#0F2744', border: '1.5px solid #DDE3EC',
        borderRadius: 10, padding: '9px 16px', fontWeight: 600, fontSize: 14,
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}
