# PANDUAN PLAN GRATIS (SPARK) — WELP v21.2 "Spark Mode"

> Sejak v21.2, WELP **tidak membutuhkan Cloud Functions** untuk fitur inti:
> daftar tenant, login Akun WELP, verifikasi email, dan seluruh aplikasi
> berjalan penuh di plan **Spark (gratis)**. Semua perbaikan dilakukan di
> sisi klien + Firestore Rules — keamanan TIDAK diturunkan.

## Kenapa dulu "Gagal simpan: internal"?

Plan Spark **tidak bisa deploy Cloud Functions** (itu fitur plan Blaze).
Panel lama memanggil function `createWelpIdentity` yang tidak pernah ada di
server → setiap simpan tenant pasti gagal dengan kode `internal`. Itu bukan
salah kamu — memang mustahil di plan gratis. v21.2 mengganti mekanisme itu.

---

## Checklist setup (sekali saja, ~10 menit)

### 1. Authentication
Firebase Console → project kamu → **Authentication**:
- **Sign-in method** → aktifkan **Email/Password** (wajib).
- Aktifkan juga **Anonymous** (dipakai mode login legacy: ID Toko / Station /
  Karyawan PIN).
- Tab **Users** → buat akun developer kamu (email yang sama dengan allowlist
  di rules) → setelah dibuat, klik titik tiga → **Verify email** (atau
  verifikasi lewat panel).

### 2. Publish Firestore Rules (BISA di plan gratis)
Rules versi baru menambahkan koleksi `welp_identities` + izin provisioning
untuk developer. Pilih salah satu:
- **CLI**: `firebase deploy --only firestore:rules` (dari folder project).
- **Console**: Firestore Database → Rules → tempel seluruh isi
  `firestore.rules` → **Publish**.

> Enterprise rules (`firestore.enterprise.v4.rules`) hanya dipakai kalau kamu
> sengaja pindah ke mode enterprise; Compatibility rules (firestore.rules)
> adalah mode aktif bawaan.

### 3. Allowlist developer
- File `firestore.rules` → fungsi `isDev()` → pastikan email developer kamu
  ada di daftar (`shandikazaid@gmail.com` bawaan).
- Sama untuk `firestore.enterprise.v4.rules` → `isProvisioner()` bila
  memakai mode enterprise.
- Ganti email ini juga kalau suatu saat ganti akun developer.

### 4. Authorized domains
Authentication → Settings → **Authorized domains** → pastikan domain tempat
aplikasi berjalan terdaftar (localhost sudah default). Tanpa ini, email
verifikasi owner ditolak (`auth/unauthorized-continue-uri`).

### 5. App Check (disarankan, wajib bagi compat rules)
Compat rules menuntut `request.app != null` → tanpa App Check, semua tulisan
ditolak `permission-denied`:
- App Check → Apps → daftarkan Web app dengan **reCAPTCHA v3**.
- Salin site key → `.env` root: `VITE_RECAPTCHA_SITE_KEY=xxxx`.
- Restart dev server / build ulang.

### 6. .env root (client)
`VITE_FIREBASE_API_KEY` dst. harus ada di folder **ROOT** project (sejajar
package.json). `functions/.env` TIDAK lagi diperlukan untuk fitur inti —
biarkan saja kalau sudah ada.

---

## Alur kerja baru

### Daftar tenant (Dev Panel: `?dev=panel`)
1. Isi nama toko, ID tenant, email owner, password, PIN → **Simpan**.
2 Yang terjadi otomatis (tanpa server):
   - Akun Auth owner dibuat (atau dipakai bila email sudah terdaftar).
   - Email verifikasi terkirim ke owner.
   - Lisensi + identitas (`welp_identities`) + record karyawan owner dibuat.
3. Modal kredensial tampil sekali — salin & kirim ke client.

### Login owner (Aplikasi utama)
- Mode **Akun WELP** → email + password owner.
- Syarat: email sudah terverifikasi (klik link di email).
- Owner dapat role owner + akses penuh tenant-nya.

### Login karyawan
- Tetap seperti sebelumnya: **Employee ID + PIN** (mode Karyawan) atau
  Station (POS). Tidak terpengaruh perubahan ini.

### Kirim ulang email verifikasi owner
Modal kredensial tenant baru → tombol **"Kirim ulang email verifikasi"**.

---

## Keamanan — apa yang berubah & kenapa tetap aman

| Aspek | Dulu (functions) | Sekarang (Spark mode) |
|---|---|---|
| Pembuatan akun Auth | Admin SDK di server | Client SDK via app sekunder |
| Penyimpanan privilege | Custom claims (server-only) | `welp_identities/{uid}` (Firestore) |
| Siapa boleh tulis privilege | requireProvisioner (allowlist) | Rules `isDev()`/`isProvisioner()` (allowlist email terverifikasi) |
| Baca privilege | token claims | Hanya dokumen milik sendiri (doc id == uid), list = false |
| Kredensial tenant | PBKDF2-SHA256 310k iterasi | Tidak berubah |
| App Check + Auth gate | Wajib | Tidak berubah |

Titik kuncinya: dokumen `welp_identities` & `licenses` hanya bisa ditulis oleh
email developer yang **terverifikasi** dan tercantum di allowlist rules.
Pengguna biasa (bahkan yang sudah login) tidak punya jalur menaikkan haknya
sendiri — setara keamanan custom claims.

## Kapan perlu Blaze?
Hanya untuk fitur server-side opsional nanti: custom claims via functions,
webhook payment HMAC (`welpPaymentEvents`), dsb. Aplikasi tetap berfungsi
tanpa semuanya. Bila suatu saat upgrade ke Blaze, jalur functions langsung
aktif tanpa perubahan kode (fallback otomatis dua arah).
