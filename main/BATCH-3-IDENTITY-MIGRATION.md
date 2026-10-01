# WELP Batch 3 — Server-side Identity Migration

Batch 3 introduces Firebase Authentication as the preferred identity source for WELP accounts.

## What changed
- Owner accounts can be provisioned as Firebase Auth email/password identities.
- Custom claims carry tenant, role, branch and permissions.
- `getWelpSession` validates the authenticated identity against the tenant license on the server.
- Enterprise sessions (`authVersion: 2`) are revalidated on application restore; localStorage alone cannot restore them.
- Logout signs out Firebase for enterprise sessions.
- Legacy ID Toko/password/PIN login remains available only as a migration path.
- Developer tenant registration now asks for an owner email and provisions the owner identity server-side.

## Required deployment configuration
Create `functions/.env` locally (never commit it):

```env
WELP_BOOTSTRAP_EMAILS=your-developer-email@example.com
```

The email must be a verified Firebase Authentication account used by the Developer Console.

## Migration flow
1. Deploy Functions.
2. Configure `functions/.env`.
3. Register a new tenant from Developer Console with Owner email.
4. Send/complete email verification for the owner.
5. Owner logs in through the `Akun` tab.
6. Verify role/tenant/branch claims from Firebase Authentication.
7. Only after migration tests pass should enterprise Firestore rules replace compatibility rules.

Do not remove legacy login until all existing tenants have been migrated.

## Verification-link note
The developer console can generate a Firebase verification link for the owner. Treat that link like a credential: send it only to the intended owner and do not publish it in tickets, screenshots or source control.
