# WELP Batch 2 — Backend Authorization Foundation

Batch 2 adds the server-side foundation needed to move WELP away from client-trusted roles.

## Added
- Firebase Cloud Functions v2 in `functions/`
- `setWelpUserClaims` callable for trusted provisioning
- `revokeWelpUserClaims` callable
- custom claims: `welpTenant`, `welpRole`, `welpBranch`, `welpPermissions`, `welpCanDelete`, `welpClaimsVersion`
- staged `firestore.enterprise.v2.rules`
- Firebase Functions region `asia-southeast2`
- frontend callable helpers in `src/core.jsx`

## Important
`firestore.enterprise.v2.rules` is a staged rule set. Do NOT replace production rules with it until every production user is migrated to Firebase Auth accounts and has valid custom claims.

The current compatibility rules remain active to avoid breaking existing tenant login flows. The compatibility catch-all is still a production gate and must be removed in the final migration.

## Provisioning prerequisites
1. Enable Firebase Authentication provider(s) used by WELP (email/password or the chosen SSO provider).
2. Create verified Firebase Auth users.
3. Configure `WELP_BOOTSTRAP_EMAILS` for the first trusted provisioning administrator.
4. Deploy functions: `firebase deploy --only functions`.
5. Use the callable only from a trusted management provisioning flow.
6. Verify claims with a fresh ID token before activating enterprise rules.

Never put Firebase Admin credentials or payment secrets in Vite environment variables.
