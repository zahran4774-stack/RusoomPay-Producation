{branches.map((b) => (
              <button
                key={b.school_id}
                type="button"
                onClick={() => { setOpen(false); switchTo(b.school_id) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'right', padding: '10px 12px',
                  background: b.is_active_context ? 'var(--brand-tint-08)' : '#fff',
                  border: 0, borderBottom: '1px solid #F0F3F7', cursor: 'pointer',
                  font: 'inherit', fontSize: 13.5, fontWeight: b.is_active_context ? 700 : 500,
                  color: '#0F2744',
                }}
              >
                {b.school_name}{b.branch ? ` — ${b.branch}` : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* رابط النظرة التجميعية — حكرًا على المالك الحقيقي فقط (org_overview مقيّدة بنفس الشرط في الخلفية) */}
      {active.role === 'owner' && (
        <Link
          href="/organization"
          style={{
            display: 'flex', alignItems: 'center', gap: 7, marginTop: 6,
            padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
            color: pathname === '/organization' ? 'var(--brand)' : '#D4A017',
            textDecoration: 'none',
          }}
        >
          <LayoutGrid size={14} strokeWidth={2} />
          نظرة عامة على كل الفروع
        </Link>
      )}
    </div>
