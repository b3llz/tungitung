# WELP v18 — Product Hardening Pass

## Product / UX
- Toast notification redesigned: non-blocking placement, safe-area aware, explicit close action, ARIA live behavior.
- Buttons use explicit button semantics and improved keyboard focus treatment.
- Error boundary no longer exposes raw internal exception messages to end users.
- Receipt layout upgraded for a more premium document hierarchy and cleaner 58–80 mm printing.
- Payroll slip QR no longer embeds employee name, company name, period, or salary amount. It contains only a document reference payload.

## Security hardening
- Production Firestore and Storage rules now require both Firebase Auth and Firebase App Check.
- Client-side attendance evidence remains immutable.
- Attendance evidence upload remains image-only and size limited.
- Client-side deletion of Storage media is disabled.
- Production `.env` is excluded from the distributable project.
- Firebase Web API key is no longer hard-coded as a source fallback.
- A strict future `firestore.enterprise.rules` policy is included for custom-claim tenant isolation.

## Important security status
This is a substantial hardening pass, not a claim of absolute security.
The compatibility tenant rule still needs to be replaced with server-issued Firebase custom claims before WELP is marketed as enterprise-grade.

Required production gate:
`request.auth.token.welpTenant == lic`
plus server-side permission checks for sensitive mutations.
