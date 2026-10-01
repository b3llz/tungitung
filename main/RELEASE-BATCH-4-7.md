# WELP — Batch 4-7 Release

## Batch 4 — Database lockdown
- deny-by-default Firestore rules
- tenant claim isolation
- permission gates for employee, attendance, payroll, settings, branches, inventory, sales and audit
- client delete restrictions
- enterprise Storage rules

## Batch 5 — Attendance
- trusted backend attendance submission endpoint
- identity/tenant/permission checks
- GPS validation
- capture ID idempotency
- evidence fingerprint validation
- server timestamp

## Batch 6 — Product UX
- touch target/accessibility primitives
- safe-area notification stack
- skeleton and empty state primitives
- reduced motion
- print hardening
- receipt/payslip privacy guidance

## Batch 7 — Reliability
- security smoke test
- GitHub Actions security/build gate
- Cloud Functions health endpoint
- operational monitoring/backup/restore guidance

## Verification
Static checks passed locally:
- `npm run security:smoke`
- `node --check functions/index.js`
- `node --check scripts/security-smoke.mjs`

A full Vite build must still be run in the user's Codespace/CI because dependency installation in the isolated build environment timed out.
