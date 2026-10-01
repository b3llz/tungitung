# WELP Security Production Gate v18

## Yang sudah diperketat
- Firestore dan Storage client access membutuhkan Firebase Auth + App Check.
- Evidence absensi immutable dari client.
- Upload evidence dibatasi image dan 2 MB.
- Client tidak boleh menghapus media Storage.
- Error boundary tidak menampilkan stack/error detail internal ke pengguna.
- Firebase Web API key tidak lagi dibundel di source fallback dan `.env` produksi tidak ikut distribusi.
- Credential legacy upgrade tetap dibatasi ke perubahan field credential saja.

## Yang BELUM boleh diklaim sebagai enterprise-complete
Tenant isolation masih menggunakan compatibility rule pada `tenants/{lic}`. App Check bukan pengganti authorization.

### Production gate berikutnya (WAJIB)
1. Firebase Auth dengan custom claims:
   - `welpTenant`
   - `welpRole`
   - `welpBranch`
   - optional `welpEmployeeCid`
2. Semua `/tenants/{lic}/...` harus memvalidasi `request.auth.token.welpTenant == lic`.
3. Permission sensitif harus divalidasi server-side, bukan hanya React/localStorage.
4. Payroll approval, cashout, attendance correction, employee credential reset, tenant provisioning, dan billing harus melalui trusted backend/Cloud Functions.
5. Rate limit login dan sensitive mutation di backend.
6. Audit log trusted backend dengan actor UID, tenant, action, target, before/after hash, timestamp server.
7. App Check enforcement di Firebase Console setelah production domain dan site key tervalidasi.
8. Automated rules tests untuk cross-tenant read/write, role escalation, delete, and replay.

## Deployment requirement
Set:
- `VITE_FIREBASE_API_KEY`
- `VITE_RECAPTCHA_SITE_KEY`

Jangan commit `.env` produksi.
