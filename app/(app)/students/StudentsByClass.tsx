
8:15:39 AM: Failed during stage 'building site': Build script returned non-zero exit code: 2
8:15:38 AM: Failed to compile.
8:15:38 AM: 
8:15:38 AM: ./app/(app)/students/StudentsByClass.tsx:330:10
8:15:38 AM: Type error: Property 'school' is missing in type '{ studentId: string; studentName: string; onClose: () => void; }' but required in type '{ studentId: string; studentName: string; studentCode?: string | null | undefined; school: SchoolInfo; currency?: string | undefined; onClose: () => void; }'.
8:15:38 AM:   328 |
8:15:38 AM:   329 |       {trackerStudent && (
8:15:38 AM: > 330 |         <PaymentTracker
8:15:38 AM:       |          ^
8:15:38 AM:   331 |           studentId={trackerStudent.id}
8:15:38 AM:   332 |           studentName={trackerStudent.full_name}
8:15:38 AM:   333 |           onClose={() => setTrackerStudent(null)}
8:15:38 AM: Next.js build worker exited with code: 1 and signal: null
8:15:39 AM: ​
8:15:39 AM: "build.command" failed                                        
8:15:39 AM: ────────────────────────────────────────────────────────────────
8:15:39 AM: ​
8:15:39 AM:   Error message
8:15:39 AM:   Command failed with exit code 1: npm run build
8:15:39 AM: ​
8:15:39 AM:   Error location
8:15:39 AM:   In build.command from netlify.toml:
8:15:39 AM:   npm run build
8:15:39 AM: ​
8:15:39 AM:   Resolved config
8:15:39 AM:   build:
8:15:39 AM:     command: npm run build
8:15:39 AM:     commandOrigin: config
8:15:39 AM:     environment:
8:15:39 AM:       - BYZANTIUM_SUPABASE_ANON_KEY
8:15:39 AM:       - BYZANTIUM_SUPABASE_URL
8:15:39 AM:       - CRON_SECRET
8:15:39 AM:       - NEXT_PUBLIC_APP_URL
8:15:39 AM:       - NEXT_PUBLIC_SENTRY_DSN
8:15:39 AM:       - NEXT_PUBLIC_SUP
