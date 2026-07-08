'use client'
// زر "شهادات" لكل طالب يفتح سجلّ الشهادات
import { useState } from 'react'
import CertificatesModal from './CertificatesModal'

type School = { name: string; vat: string | null }

export default function CertificatesButton({ studentId, studentName, school }: {
  studentId: string; studentName: string; school: School
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: '#fff', color: '#0F2744', border: '1px solid #DDE3EC', borderRadius: 8,
          padding: '5px 12px', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        📜 شهادات
      </button>
      {open && (
        <CertificatesModal
          studentId={studentId}
          studentName={studentName}
          school={school}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
