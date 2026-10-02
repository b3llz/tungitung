# WELP v20 — SATU CORE, DUA APLIKASI

> WELP Business (pusat kendali perusahaan) · WELP Cashier (POS + Employee Area) · WELP Core (data, identity, organization, RBAC)

## ARSITEKTUR v20

```
WELP CORE (src/welp-core/)
  rbac.js   → permission granular (domain.action), custom role engine,
              scope organisasi (org → region → branch → self),
              workspace resolver (employee → Area, kasir → POS, lainnya → Business)
  org.js    → model Region, tree Pusat→Region→Cabang, assignment user,
              filter data per scope

WELP BUSINESS (default ?app=management)
  Command Center · POS Monitoring · Pusat Persetujuan · Kasir/POS · Area Saya ·
  CRM · HPP · Riwayat · Kas Keluar · Diskon · Stok · Opname · In/Out ·
  Riwayat Stok · Supplier · Karyawan · Absensi · Payroll · Laporan ·
  Manajemen Cabang · Organisasi & Region · Role & Permission · Audit Log ·
  Profil · Payment · Hardware · Pengaturan · Perusahaan (+Pengumuman)

WELP CASHIER (?app=pos)
  POS fokus transaksi + "Area Saya" (Employee Area pribadi di dalam app).
  User role EMPLOYEE yang login otomatis masuk Employee Area — bukan POS.
```

## PERUBAHAN BESAR v20

1. **Login bersama cabang DIHAPUS.** Cabang = unit organisasi dengan branch ID,
   bukan akun login. Semua orang memakai identitas pribadi:
   - `Akun WELP` (Firebase Auth + claims server-side) — jalur utama
   - `Karyawan` (Employee ID + PIN pribadi, hash PBKDF2) — kompatibilitas
   - `Legacy Owner` & `Station` — kompatibilitas
2. **Struktur organisasi Pusat → Region/Area → Cabang → User.**
   Koleksi baru `regions`; cabang dapat `regionId`; karyawan dapat
   `regionIds[]` (Area Manager / supervisor wilayah). Mengganti assignment
   user TIDAK menyentuh cabang dan TIDAK merusak histori.
3. **Role & Permission Engine.** Role bawaan + custom role bebas
   (Area Manager, HRD, Accounting, Auditor, dst.) dengan permission granular
   `view/create/edit/delete/approve/export/manage/use` per domain
   (16 domain). Matrix legacy v15 tetap sah (auto-expand).
4. **Backend (functions/index.js).**
   - Role key bebas `[a-z0-9_-]{2,32}` (custom role disetujui server).
   - Claims baru: `welpRegions[]`, `welpBranches[]`, `welpDepartment`,
     `welpScope` (org|region|branch|self), `welpClaimsVersion: 3`.
   - Callable baru **updateWelpUserAssignment**: Owner/Direktur mengganti
     assignment user tanpa menyentuh password — penuh audit trail.
   - `getWelpSession` kini mengembalikan `scope` lengkap.
5. **Firestore Rules** — `firestore.enterprise.v4.rules`: tenant isolation +
   permission granular + scope + App Check + immutability (absensi & audit
   append-only, payroll tak terhapus klien). SEMUA koleksi yang dipakai app
   terdaftar eksplisit. **Deploy rules v4 hanya setelah migrasi Akun WELP
   tuntas; selama transisi pakai `firestore.rules` (compatibility).**
6. **Employee Area di dalam WELP** (`absensi-app.jsx`): Beranda, Absensi
   (kamera evidence + GPS + geofence + watermark + waktu server + hash +
   audit), Slip Gaji, Cuti/Izin + panel approval atasan, **Info**
   (Pengumuman · Dokumen kerja · Riwayat aktivitas), Profil, **Jadwal &
   Shift**. Akun pribadi tertaut otomatis via `karyawan.uid/email`; bila
   belum, verifikasi sekali dengan Employee ID + PIN.
7. **Halaman baru WELP Business**: Organisasi & Region, Role & Permission,
   Pusat Persetujuan (payroll + cuti, scope-aware), Audit Log, Customer CRM
   (statistik belanja dari transaksi kasir nyata), Pengumuman (Perusahaan).
8. **Bug fix kritis:**
   - `qrUrl is not defined` (buildSlipHtml & QR Aplikasi Karyawan) → QR
     lokal async (`qrDataUrl`/`useQr`); `buildSlipHtml` kini async.
   - **Absensi gagal submit**: `doSubmit` merujuk `geoAddress` yang tidak
     ada di scope root (ReferenceError setiap submit dgn GPS aktif) →
     alamat diteruskan AbsenFlow sebagai parameter + fallback reverse-geocode.
   - `getRbacConfig`/`permsOf` tahan argumen non-array (pola
     `Array.map(roleLabelOfV15)` yang menyisipkan index).
9. **Anti-fraud absensi (dipertahankan & dipertegas)**: kamera live-motion,
   foto mirror + watermark WELP/timestamp/ID/lokasi, GPS + radius geofence,
   server timestamp, SHA-256 evidence hash, `submitAttendanceEvidence`
   callable, audit trail, reverse geocoding. Tidak ada klaim 100% anti-hack.
10. **UI/UX**: light mode putih netral, dark mode charcoal tanpa orange tint,
    safe-area iPhone, tanpa horizontal overflow (diverifikasi headless
    browser iPhone 14), tanpa emoji generik pada login, tanpa underline
    pada logo.

## DEPLOY

1. Build: `npm run build` → `dist/` (Netlify config tidak berubah).
2. Functions: `firebase deploy --only functions` (region asia-southeast2,
   env `WELP_BOOTSTRAP_EMAILS` tetap).
3. Rules: pertahankan `firestore.rules` selama masa transisi; setelah semua
   user bermigrasi ke Akun WELP, publish `firestore.enterprise.v4.rules`.
4. ENV tidak berubah (`VITE_FIREBASE_*`, `VITE_RECAPTCHA_SITE_KEY`).

## PROVISIONING AKUN (contoh)

```js
// buat akun Area Manager Jakarta (setelah regions dibuat):
callWelpCreateIdentity({
  email: 'area.jkt@perusahaan.com', password: 'min8char',
  tenant: 'tenant-id', role: 'areamanager',
  scope: 'region', regions: ['jakarta'],
  permissions: [...ROLE_PRESETS_V20.areamanager]  // dari welp-core/rbac.js
});
// pindah tugas tanpa sentuh password:
updateWelpUserAssignment({ uid, tenant, regions: ['bandung'], scope: 'region' });
```
