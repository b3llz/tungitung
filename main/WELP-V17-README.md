# WELP v17 Platform

## Three applications, one platform

WELP is intentionally separated into three user experiences while keeping one shared codebase/backend:

- **WELP POS**: `/pos` or `/?app=pos`
- **WELP Employee**: `/employee` or `/?app=employee`
- **WELP Management**: `/management` or `/?app=management`

Legacy `?absen=1` continues to open WELP Employee.

### WELP POS
Kasir, transaksi, HPP, riwayat transaksi, kas keluar, diskon, payment, hardware and stock-at-counter workflows.

### WELP Employee
Login employee, verified attendance, location/evidence, payslip, leave/request, documents and profile.

### WELP Management
Company dashboard, branches, employees, attendance monitoring, payroll, reports, inventory controls, outlet monitoring and settings.

## Important architecture decision

These are **not three independent projects**. They are three frontends/experiences over the same WELP platform. Shared auth, tenant model, data layer and design system remain centralized.

## Production gate

Before selling to large enterprises, complete:

1. Server-side authorization for sensitive writes.
2. Tenant isolation with custom claims/backend checks.
3. Attendance liveness/device attestation/anti-replay.
4. SSO + MFA.
5. Immutable audit trail.
6. Automated tenant-isolation/security tests.
7. Backups, restore procedure, monitoring and incident response.
8. Subscription/seat/branch entitlements.

Do not market the current client-side checks as a 100% anti-fraud guarantee.
