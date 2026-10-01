# WELP Batch 4 — Database Lockdown

Production target: `firestore.enterprise.v3.rules` and `storage.enterprise.v3.rules`.

These rules are deny-by-default and use Firebase Auth custom claims for tenant and permission checks. The existing `firestore.rules` remains the compatibility ruleset until all tenants have migrated.

## Cutover gate
1. Every employee/manager/owner has Firebase Auth identity.
2. Every identity has `welpTenant`, `welpRole`, `welpPermissions`.
3. Tenant license documents exist for every active tenant.
4. Run security smoke tests.
5. Test Company A -> Company B access and privilege escalation.
6. Deploy enterprise rules only after tests pass.
