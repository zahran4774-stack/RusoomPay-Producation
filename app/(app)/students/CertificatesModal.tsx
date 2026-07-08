'use client'
// سجلّ شهادات الطالب — توليد نصّي (قيد/براءة ذمة/إفادة رسوم) + رفع ملفات + أرشفة + طباعة
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { printReport } from '@/lib/print-report'

type Cert = {
  id: string; kind: string; title: string; serial: string
  body: string | null; file_path: string | null; file_name: string | null; created_at: string
}
type School = { name: string; vat: string | null }

const KIND_BADGE: Record<string, { t: string; bg: string; c: string }> = {
  enrollment: { t: 'شهادة قيد', bg: '#E8EEF8', c: '#2E5EA8' },
  clearance: { t: 'براءة ذمة', bg: '#E6F4EC', c: '#1A7A45' },
  fees_statement: { t: 'إفادة رسوم', bg: '#FBF3D5', c: '#8A6D0F' },
  uploaded: { t: 'ملف مرفوع', bg: '#EDE4F6', c: '#7A2E8F' },
}

export default function CertificatesModal({ studentId, studentName, school, onClose }: {
  studentId: string; studentName: string; school: School; onClose: () => void
}) {
  const supabase = createClient()
  const [certs, setCerts] = useState<Cert[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [upTitle, setUpTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)

  async function load() {
    const { data } = await supabase.rpc('student_certificates', { p_student_id: studentId })
    setCerts(data || []); setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [studentId])

  async function generate(kind: string) {
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('generate_certificate', { p_student_id: studentId, p_kind: kind })
    if (error) { setMsg('تعذّر الإصدار: ' + error.message); setBusy(false); return }
    await load(); setMsg('✓ صدرت الشهادة وحُفظت في السجلّ'); setBusy(false)
  }

  async function upload() {
    if (!file) { setMsg('اختر ملفاً'); return }
    setBusy(true); setMsg('')
    // المسار يجب أن يبدأ بـ school_id (تفرضه سياسة Storage): <school_id>/<student_id>/<ts>_<name>
    const { data: schoolRow } = await supabase.from('schools').select('id').single()
    const fullPath = `${schoolRow?.id}/${studentId}/${Date.now()}_${file.name}`
    const { error: upErr } = await supabase.storage.from('certificates').upload(fullPath, file, { upsert: false })
    if (upErr) { setMsg('تعذّر الرفع: ' + upErr.message); setBusy(false); return }
    const { error } = await supabase.rpc('record_uploaded_certificate', {
      p_student_id: studentId, p_title: upTitle || file.name, p_file_path: fullPath, p_file_name: file.name,
    })
    if (error) { setMsg('رُفع الملف لكن تعذّر تسجيله: ' + error.message); setBusy(false); return }
    setFile(null); setUpTitle(''); await load(); setMsg('✓ رُفعت الشهادة وأُرشفت'); setBusy(false)
  }

  async function download(c: Cert) {
    if (!c.file_path) return
    const { data, error } = await supabase.storage.from('certificates').createSignedUrl(c.file_path, 120)
    if (error || !data) { setMsg('تعذّر فتح الملف'); return }
    window.open(data.signedUrl, '_blank')
  }

  function printCert(c: Cert) {
    printReport({
      school, title: c.title, subtitle: `${studentName} · ${c.serial}`,
      columns: [{ key: 'k', label: 'البند' }, { key: 'v', label: 'التفاصيل' }],
      rows: [
        { k: 'الطالب', v: studentName }, { k: 'نوع الشهادة', v: c.title },
        { k: 'الرقم التسلسلي', v: c.serial },
        { k: 'التاريخ', v: new Date(c.created_at).toLocaleDateString('en-GB') },
        { k: 'النص', v: c.body || '—' },
      ],
    })
  }

  async function remove(id: string) {
    setBusy(true)
    await supabase.rpc('delete_certificate', { p_id: id })
    await load(); setBusy(false)
  }

  const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(8,15,27,.6)', display: 'grid', placeItems: 'center', zIndex: 200, padding: 16 }
  const panel: React.CSSProperties = { background: '#F4F6FA', borderRadius: 16, maxWidth: 680, width: '100%', maxHeight: '92dvh', overflowY: 'auto' }
  const head: React.CSSProperties = { background: '#0A1D33', color: '#fff', padding: '16px 20px', borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0 }
  const cardS: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,.05)' }
  const btnGold: React.CSSProperties = { background: '#D4A017', color: '#08172B', border: 'none', borderRadius: 9, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
  const btnSm: React.CSSProperties = { background: '#fff', color: '#0F2744', border: '1px solid #DDE3EC', borderRadius: 8, padding: '6px 12px', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }
  const input: React.CSSProperties = { width: '100%', padding: 10, borderRadius: 9, border: '1.5px solid #DDE3EC', fontFamily: 'inherit', fontSize: 14, marginBottom: 10 }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()} dir="rtl">
        <div style={head}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>سجلّ شهادات: {studentName}</div>
            <div style={{ fontSize: 12, opacity: .75 }}>توليد · رفع · أرشفة · طباعة</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          {msg && <div style={{ ...cardS, color: msg.startsWith('✓') ? '#1A7A45' : '#C0392B' }}>{msg}</div>}

          {/* توليد شهادة نصّية */}
          <div style={cardS}>
            <b style={{ color: '#0F2744', display: 'block', marginBottom: 12 }}>إصدار شهادة من النظام</b>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={btnGold} onClick={() => generate('enrollment')} disabled={busy}>📋 شهادة قيد</button>
              <button style={btnGold} onClick={() => generate('clearance')} disabled={busy}>✅ براءة ذمة مالية</button>
              <button style={btnGold} onClick={() => generate('fees_statement')} disabled={busy}>💰 إفادة رسوم</button>
            </div>
            <p style={{ fontSize: 12, color: '#8A94A6', marginTop: 10 }}>💡 براءة الذمة تُصدر فقط إذا سدّد الطالب كامل رسومه.</p>
          </div>

          {/* رفع ملف خارجي */}
          <div style={cardS}>
            <b style={{ color: '#0F2744', display: 'block', marginBottom: 12 }}>رفع شهادة خارجية (PDF / صورة)</b>
            <input style={input} placeholder="عنوان الشهادة (اختياري)" value={upTitle} onChange={(e) => setUpTitle(e.target.value)} />
            <input style={{ ...input, padding: 8 }} type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button style={btnGold} onClick={upload} disabled={busy || !file}>⬆ رفع وأرشفة</button>
          </div>

          {/* السجلّ */}
          <div style={cardS}>
            <b style={{ color: '#0F2744', display: 'block', marginBottom: 12 }}>الشهادات المؤرشفة ({certs.length})</b>
            {loading ? <div style={{ color: '#8A94A6' }}>جارٍ التحميل...</div> :
              certs.length === 0 ? <div style={{ color: '#8A94A6' }}>لا توجد شهادات بعد</div> :
                certs.map((c) => {
                  const b = KIND_BADGE[c.kind] || KIND_BADGE.uploaded
                  return (
                    <div key={c.id} style={{ padding: '12px 0', borderBottom: '1px solid #F2F5F8' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <div>
                          <span style={{ background: b.bg, color: b.c, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99 }}>{b.t}</span>
                          <b style={{ color: '#0F2744', marginInlineStart: 8 }}>{c.title}</b>
                          <div style={{ fontSize: 11.5, color: '#9AA7B8', marginTop: 3 }}>{c.serial} · {new Date(c.created_at).toLocaleDateString('en-GB')}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {c.kind === 'uploaded'
                            ? <button style={btnSm} onClick={() => download(c)}>⬇ تحميل</button>
                            : <button style={btnSm} onClick={() => printCert(c)}>🖨 طباعة</button>}
                          <button style={{ ...btnSm, color: '#C0392B', borderColor: '#EAD1CC' }} onClick={() => remove(c.id)} disabled={busy}>حذف</button>
                        </div>
                      </div>
                      {c.body && <div style={{ fontSize: 12.5, color: '#556', marginTop: 6, lineHeight: 1.7 }}>{c.body}</div>}
                    </div>
                  )
                })}
          </div>
        </div>
      </div>
    </div>
  )
}
