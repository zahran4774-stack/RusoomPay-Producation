7:13:35 AM: Failed during stage 'building site': Build script returned non-zero exit code: 2 (https://ntl.fyi/exit-code-2)
7:13:35 AM: Failed to compile.
7:13:35 AM: 
7:13:35 AM: ./app/(app)/fees/FeesManager.tsx:184:37
7:13:35 AM: Type error: Cannot find name 'supabase'.
7:13:35 AM:   182 |     setToast(null)
7:13:35 AM:   183 |     try {
7:13:35 AM: > 184 |       const { data, error } = await supabase.rpc('monthly_payment_report')
7:13:35 AM:       |                                     ^
7:13:35 AM:   185 |       if (error || !data?.ok) {
7:13:35 AM:   186 |         setToast({ text: error?.message || 'تعذّر إنشاء التقرير', ok: false })
7:13:35 AM:   187 |         return
7:13:35 AM: Next.js build worker exited with code: 1 and signal: null
7:13:35 AM: ​
7:13:35 AM: "build.command" failed                                        
7:13:35 AM: ────────────────────────────────────────────────────────────────
7:13:35 AM: ​
7:13:35 AM:   Error message
7:13:35 AM:   Command failed with exit code 1: npm run build (https://ntl.fyi/exit-code-1)
7:13:35 AM: ​
7:13:35 AM:   Error location
7:13:35 AM:   In build.command from netlify.toml:
7:13:35 AM:   npm run build
7:13:35 AM: ​
7:13:35 AM:   Resolved config
7:13:35 AM:   build:
7:13:35 AM:     command: npm run build
7:13:35 AM:     commandOrigin: config
7:13:35 AM:     environment:
7:13:35 AM:       - BYZANTIUM_SUPABASE_ANON_KEY
7:13:35 AM:       - BYZANTIUM_SUPABASE_URL
7:13:35 AM:       - CRON_SECRET
7:13:35 AM:       - NEXT_PUBLIC_APP_URL
7:13:35 AM:       - NEXT_PUBLIC_SENTRY_DSN
7:13:35 AM:       - NEXT_PUBLIC_SUPABASE_ANON_KEY
7:13:35 AM:       - NEXT_PUBLIC_SUPABA
