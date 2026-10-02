# WELP Enterprise Platform

## Product structure

WELP is one platform/codebase with three user-facing applications:

1. **WELP POS** — cashier/terminal: sales, HPP, shift/cash, discounts, POS history, payment and hardware.
2. **WELP Employee** — employee self-service: attendance, verified evidence, payslip, leave/request, profile and documents.
3. **WELP Management** — owner/manager/HR/finance: branches, employees, attendance monitoring, payroll, reports, company settings, inventory control and outlet monitoring.

The three applications share the same Firebase/backend, tenant model, authentication and design system. They are not three unrelated codebases.

## Entry points

- `/pos` or `/?app=pos`
- `/employee` or `/?app=employee`
- `/management` or `/?app=management`

`?absen=1` remains as a compatibility alias for Employee.

## Enterprise next steps

### P0
- Move sensitive writes to server-side functions/API.
- Close tenant Firestore/Storage access with server authorization/custom claims.
- Add automated tenant-isolation tests.
- Add monitoring, backups and restore procedure.

### P1
- SSO (OIDC/SAML), MFA and session/device management.
- Immutable audit trail for sensitive business actions.
- Attendance liveness + device attestation + anti-replay.
- Subscription/plan/seat/branch entitlements.

### P2
- Public API and webhooks.
- Executive analytics and anomaly/fraud detection.
- AI business analyst over tenant data.

## Security principle

Client-side UI is never the authority for identity, tenant, role, permission, payroll, financial data or verified attendance. The server must validate those operations.
