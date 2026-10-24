# WELP v21 — PRODUCTION-GRADE BUSINESS OS + PROFESSIONAL POS

> Prinsip: MAKE THE EXPERIENCE SIMPLE, NOT THE PRODUCT. MAKE THE INTERACTION FAST, NOT THE INTERFACE CHEAP.

## YANG BARU (v20 → v21)

### 1. Domain Transaksi Terpusat (src/welp-core/tx.js)
- **State machine kanonik**: SALE_CREATED → PAYMENT_PENDING → PAYMENT_CONFIRMED → SETTLEMENT_PENDING → SETTLED + VOIDED, REFUND_PENDING/PROCESSING/REFUNDED/PARTIALLY_REFUNDED, PAYMENT_FAILED/EXPIRED, SETTLEMENT_FAILED/MISMATCH. Tidak ada lagi status string liar tersebar.
- **Kompatibel mundur**: order lama (status 'pending'/'paid'/'cancelled' tanpa payments[]) tetap terbaca via derivasi `txStateOf()` — TIDAK perlu migrasi data.
- Payment records kanonik (`payments[]`), refund penuh/sebagian, void dengan alasan/approver/stok.
- Settlement math: gross − fee/MDR − refund ± adjustment = net (fee dari konfigurasi metode, bukan hardcode).
- Rekonsiliasi dengan ALASAN selisih (fee beda, refund belum dikurangi, tx hilang/ekstra, partial settlement, provider delay, adjustment).
- Shift & kas: expected cash = modal awal + penjualan tunai + masuk − keluar; hasil MATCHED/SHORT/OVER.

### 2. Idempotensi (WAJIB — sudah diuji)
- `clientTransactionId` = order id = doc id Firestore. Double-tap BAYAR / retry koneksi menulis dokumen yang SAMA.
- Dua lapis guard: latch sinkron `lastSaleSigRef` (double-fire dalam satu tick) + `isLoading` (lintas render).
- **Diverifikasi**: 4× klik BAYAR beruntun = 1 transaksi (test browser nyata).

### 3. Offline-First POS (src/welp-core/sync.js)
- Firestore memakai **persistent local cache + multi-tab manager** (fallback memori bila IndexedDB tak tersedia).
- Outbox persist di localStorage: PENDING → SYNCING → SYNCED/FAILED dengan **retry exponential backoff** (5s→15s→45s→2m→5m→15m).
- **Satu engine** untuk semua mutasi finansial (transaksi, void, refund, settlement, shift, kas). Tidak ada sync logic tersebar.
- UI status: SyncPill (ONLINE / OFFLINE — antrean aktif / Menyinkronkan / Sinkron gagal — diulang otomatis), klik = flush manual.
- **Tanpa page refresh** — semua via engine.
- `dbSet` diperkuat: koleksi finansial (pos_history, settlements, shift_log, cash_events) **append-only** — perangkat stale tidak bisa menghapus data cloud.

### 4. POS Super-Fast (src/pos.jsx)
- **Fast-path tunai**: SCAN/KLIK → BAYAR → STRUK (tanpa layar antara). Delay artifisial 500ms dihapus.
- Checkout **payment-first**: TOTAL besar di atas → Tunai | QRIS | Lainnya ▾ → keypad tunai kontekstual → satu tombol BAYAR selalu terlihat.
- **Progressive disclosure**: Item Pesanan & Opsi Pesanan (pembeli/tipe/meja/catatan) jadi collapsible — capability lengkap, cognitive load rendah.
- **Scanner hot-path**: scanner fisik mengetik SKU + Enter → item langsung masuk keranjang (tanpa modal/konfirmasi).
- QRIS: QR dinamis inline di checkout; setelah BAYAR, layar detail langsung terbuka (hemat 1 langkah).
- **Motion 120–220ms GPU-friendly** (transform/opacity): bump badge keranjang, flash total, pop sukses; `prefers-reduced-motion` dihormati.

### 5. VOID & REFUND (berizin, beraudit)
- Void: transaksi lunas/pending dibatalkan dgn **alasan wajib + pelaku + approver + opsi kembalikan stok**. Original transaction TIDAK dihapus (status VOIDED + voidInfo menempel).
- Refund: penuh/sebagian. Cash → REFUNED saat disetujui; QRIS/e-wallet/bank → REFUND_PROCESSING sampai provider dikonfirmasi (tombol "Tandai Selesai" + nomor referensi wajib → REFUNDED).
- Entri di Riwayat (Business) & detail pesanan (POS), permission-gated (`transaction.void` / `transaction.refund`).

### 6. Settlement & Rekonsiliasi (tab Keuangan baru)
- Workspace Keuangan = 1 nav item: **Settlement · Rekonsiliasi · Kas & Shift** (tanpa menu baru berlebihan).
- Settlement per metode per tanggal: gross, fee/MDR (dari config), refund, adjustment, net. Siklus PENDING → PROCESSING → SETTLED (dgn referensi provider wajib) / MISMATCH / FAILED.
- Rekonsiliasi: COCOK / SELISIH / MENUNGGU + daftar alasan yang bisa dibaca manusia.
- **Jujur terhadap integrasi**: konfirmasi settlement/refund bersifat MANUAL (nomor referensi dari dasbor provider). Struktur `providerRef` tersedia — bila API provider terhubung nanti, otomatisasi menggantikan manual tanpa mengubah model. Tidak ada klaim integrasi otomatis yang belum ada.

### 7. Shift & Kas (di POS, dipantau di Keuangan)
- Buka Shift (modal kas awal) → panel realtime (kas di laci est., penjualan tunai, masuk/keluar) → Uang Masuk/Keluar → Tutup Shift (hitung fisik → selisih MATCHED/SHORT/OVER).
- Semua event (SHIFT_OPEN/CLOSE, KAS_MASUK/KELUAR) masuk audit log.

### 8. RBAC diperluas (tetap satu engine)
- Permission baru: `transaction.view/create/void/refund`, `payment.view`, `settlement.view/manage`, `reconciliation.view`, `shift.open/close/view`.
- Ekspansi legacy otomatis: `pos.use` → transaction.create + payment.view + shift.*; `refund.perform` → transaction.void/refund. Matrix lama tetap sah tanpa migrasi.
- Preset diperbarui (kasir dapat transaksi+shift; manager/supervisor/area manager/kepala toko dapat void/refund/settlement.view; finance/accounting/auditor dapat settlement/reconciliation).
- Whitelist server (functions/index.js) + Firestore Rules v4 (koleksi pos_history, settlements, shift_log, cash_events — append-only, tenant isolation) selaras.
- Rules kompatibilitas (firestore.rules) tidak berubah — wildcard sudah menutupi koleksi baru.

### 9. Integritas Angka (void/refund-aware)
- Command Center, Laporan & Analisa, Riwayat, CRM: order void TIDAK dihitung; refund dikurangkan (refund sebagian diskalakan proporsional pada laba kotor).
- Label diubah jadi "Penjualan Bersih" supaya jujur.

### 10. Konfigurasi Biaya per Metode (Metode Pembayaran)
- Owner mengisi MDR/fee % + fee tetap + rekening tujuan per metode → dipakai settlement & rekonsiliasi.

## DEPLOY (tidak ada perubahan konfigurasi)
1. `npm run build` → dist/ (Netlify tetap).
2. `firebase deploy --only functions` (whitelist permission baru).
3. Rules: tetap `firestore.rules` selama transisi. Setelah migrasi Akun WELP tuntas → publish `firestore.enterprise.v4.rules` (koleksi baru sudah terdaftar).
4. ENV tidak berubah.

## PERINTAH VERIFIKASI
- `npm test`            → 36 test domain (state machine, refund, settlement, rekonsiliasi, shift) — 36/36 PASS
- `npm run build`       → production build PASS
- `npm run security:smoke` → PASS

## ACCEPTANCE TEST (diverifikasi via headless browser + unit test)
| # | Test | Hasil |
|---|------|-------|
| 1 | Cash sale: scan/klik → cart → tunai → BAYAR → struk → tersimpan → audit | PASS (fast-path 2 klik) |
| 2 | QRIS: sale → pending → konfirmasi → lunas + payments CONFIRMED | PASS |
| 3 | Void: lunas → permission → alasan → voided + stok kembali + audit, record asli utuh | PASS |
| 4 | Refund: partial 3rb → REFUND_PROCESSING → Tandai Selesai (ref provider) → REFUNDED + audit | PASS |
| 5 | Offline: internet putus → transaksi jalan → antre PENDING → online → auto-flush + backoff terlihat | PASS (mechanics; SYNCED butuh kredensial production) |
| 6 | Duplikat: 4× klik BAYAR = 1 transaksi | PASS (setelah perbaikan latch sinkron) |
| 7 | Settlement: PENDING → konfirmasi dgn referensi → SETTLED | PASS |
| 8 | Rekonsiliasi: COCOK / alasan selisih | PASS |
| 9 | Shift: buka (200rb) → kas masuk 50rb / keluar 20rb → tutup (fisik 230rb) → MATCHED +0 | PASS |
| 10 | UX mobile iPhone 14: 0px horizontal overflow di POS/checkout/riwayat/finance; dark mode aman | PASS |

## BUG YANG DITEMUKAN & DIPERBAIKI SAJA PENGEMBANGAN
1. **Double-click BAYAR = 3 transaksi** (id berbeda) → latch sinkron + id clientTransactionId. Diuji ulang: 4 klik = 1 tx.
2. **TDZ crash FinanceTab** (`reconMethod` dipakai sebelum deklarasi) → Error Boundary menangkap saat reload → deklarasi dipindah.
3. **Double-count settlement** (order lunas ada di pos_history DAN active_orders) → dedup sumber.
4. **dbSet bisa menghapus data finansial cloud** saat perangkat stale menulis → DB_PROTECTED merge-keep.
5. Report/Home/CRM menghitung order void & tidak mengurangi refund → dibersihkan.

## KETERBATASAN (jujur)
- Konfirmasi settlement/refund non-tunai masih MANUAL (nomor referensi dari dasbor provider) — struktur & lifecycle sudah siap untuk integrasi API (Midtrans/QRIS aggregator) tanpa mengubah data.
- Sinkronisasi SYNCED end-to-end butuh deployment dengan kredensial/rules production; di sandbox verifikasi, write ditolak permission sehingga engine menunjukkan status FAILED + retry sesuai desain.
- Tidak ada klaim 100% anti-fraud; semua aksi tetap tercatat immutable di audit log.

---

# v21.1.3 — Dev Panel: "Gagal simpan: internal" TUNTAS + Error Transparan

## ROOT CAUSE yang ditemukan
1. **Error mentah Admin SDK lolos dari callable functions.** Semua error seperti
   `auth/email-already-exists`, `auth/unauthorized-continue-uri` (domain panel
   belum ada di Authorized domains), `auth/insufficient-permissions` (IAM service
   account), `auth/password-policy-*` (project pakai kebijakan password ketat)
   dilempar tanpa dipetakan → Firebase client menerjemahkannya menjadi satu kata:
   **"internal"** — misterius dan tidak bisa ditindaklanjuti.
2. **Alur simpan tenant rapuh:** lisensi ditulis dulu → identity → link
   verifikasi. Gagal di link verifikasi = seluruh simpanan terasa gagal, padahal
   akun owner & lisensi sudah terbentuk (state tidak konsisten + user mengulang
   dan menabrak `email-already-exists` → "internal" lagi).

## PERBAIKAN
### Backend (functions/index.js)
- `mapAdminError()` + wrapper `guarded()` untuk **7/7 callable**: HttpsError
  validasi diteruskan apa adanya; error Admin SDK/Firestore dipetakan ke pesan
  Indonesia yang bisa dieksekusi (cara fix-nya disebut langsung di pesan).
- `createWelpIdentity` kini **idempoten terhadap balapan**: email yang terlanjur
  ada (save dobel / tab ganda / percobaan setengah jalan) dipakai lanjut, bukan
  crash. Akun disabled di-un-disable otomatis.
- Health endpoint menandai versi `v21.1.3-payment-core`.
- **Tidak ada pelonggaran keamanan:** whitelist permission, requireProvisioner,
  HMAC webhook, dan fail-closed semuanya utuh.

### Dev Panel (src/devpanel.jsx)
- `explainFnError()` + `explainStoreError()`: kata "internal"/kode mentah
  diganti instruksi konkret (deploy functions, IAM, Authorized domains, kuota,
  sesi kedaluwarsa). Toast error tampil 8-9 detik (dulu 2,6 detik — sering
  keburu hilang sebelum sempat dibaca) + timer anti tumpang-tindih.
- **Simpan tenant idempoten:** identity dulu → lisensi → link verifikasi
  BEST-EFFORT. Gagal membuat link verifikasi TIDAK membatalkan tenant; modal
  kredensial tetap muncul dengan peringatan + tombol **"Coba buat link
  verifikasi lagi"**.
- **Generator password kelas lengkap** (besar/kecil/angka/simbol, 12 char,
  Fisher-Yates dgn crypto.getRandomValues): lolos password policy ketat
  sekalipun; entropi naik dari 62^10 menjadi ±93^12.
- Badge DEV berbeda utk email belum terverifikasi (`DEV?`), footer versi panel
  diperbarui.

## v21.1.1 / v21.1.2 (rekam jejak)
- v21.1.1: `explainAuthError` — kode auth mentah (termasuk `invalid-credential`
  hasil penyamaran anti user-enumeration Firebase) dijelaskan dgn langkah fix.
- v21.1.2: deteksi dini `.env` tidak terbaca (banner merah sebelum login),
  badge project aktif, pesan `invalid-api-key` diperlengkapi.

## YANG HARUS DILAKUKAN USER SETELAH UPDATE
1. Ekstrak zip → `npm install`.
2. Root `.env` berisi `VITE_FIREBASE_*` (client); `functions/.env` berisi
   `WELP_BOOTSTRAP_EMAILS` (server). Keduanya TIDAK saling menggantikan.
3. **Wajib deploy ulang backend:** `firebase deploy --only functions`
   (perbaikan "internal" ada di sisi server — client saja TIDAK cukup).
4. Pastikan domain tempat panel di-host terdaftar di Firebase Console →
   Authentication → Settings → **Authorized domains** (localhost sudah default).

## VERIFIKASI
- `npm test` → 69/69 PASS (36 tx + 33 payment)
- `npm run build` → PASS
- `npm run security:smoke` → PASS
- `node --check functions/index.js` → PASS

---

# v21.2.0 — SPARK MODE: TANPA CLOUD FUNCTIONS (plan gratis pun jalan penuh)

## ROOT CAUSE yang akhirnya tuntas
"Fagal simpan: internal" di Dev Panel ternyata BUKAN sekadar error server —
**plan Firebase Spark (gratis) memang TIDAK bisa deploy Cloud Functions**
(deploy functions butuh plan Blaze/pay-as-you-go). Artinya selama ini
`createWelpIdentity` tidak pernah ada di server: setiap simpan tenant memanggil
endpoint yang tidak ada → Firebase client menerjemahkan 404 menjadi
`functions/internal` → "Gagal simpan: internal". Solusi v21.1.3 (deploy ulang
functions) mustahil dijalankan di plan gratis → **arsitektur dirombok: fitur
inti tidak lagi membutuhkan Cloud Functions sama sekali, tanpa menurunkan
keamanan.**

## PERUBAHAN ARSITEKTUR (client-first, security-first)
### 1. Provisioning 100% klien (src/core.jsx + src/devpanel.jsx)
- `provisionWelpIdentityClient()`: akun Auth owner dibuat dari klien via
  **app Firebase sekunder** (sesi developer tidak pernah tertimpa), idempoten
  (email sudah ada → dipakai lanjut; password beda → pesan jelas, bukan crash).
- Email verifikasi owner **dikirim otomatis** dari klien
  (`sendEmailVerification`) — tanpa server. Gagal kirim tidak membatalkan
  pendaftaran; tombol "Kirim ulang email verifikasi" ada di modal kredensial
  (`welpResendVerification`).
- Alur simpan tenant: akun Auth → lisensi → **welp_identities/{uid}** → record
  karyawan owner (linking Employee Area). Semua idempoten & diberi pesan error
  actionable.

### 2. Sumber privilege baru yang aman: welp_identities/{uid}
- Sesi Akun WELP kini bisa dibangun dari Firestore (`buildDirectSession`):
  identitas + lisensi, keduanya **dokumen DEV-controlled**.
- Keamanan setara custom claims: rules membatasi penulisan
  `welp_identities` & `licenses` HANYA untuk allowlist email developer
  terverifikasi (`isDev()` di compatibility rules, `isProvisioner()` di
  enterprise v4). User biasa hanya bisa MEMBACA dokumen identitas miliknya
  sendiri (doc id == uid), list diblokir total.
- `firestore.rules` + `firestore.enterprise.v4.rules` diperbarui; enterprise
  v4 juga memperbaiki bug laten (panel tidak bisa menulis licenses di mode
  enterprise karena `create,update,delete: if false`).

### 3. Login & sesi (src/lock.jsx + src/App.jsx)
- `handleAccountLogin`: dua jalur — claims (enterprise/Blaze) ATAU sesi
  langsung dari `welp_identities` (Spark). Email harus terverifikasi.
- Restore & refresh sesi via `refreshWelpSession()`: functions dulu, fallback
  jalur langsung — transisi Blaze↔Spark tidak lagi memutus sesi.

### 4. Pesan error jujur & bisa dieksekusi
- `functions/not-found` → dijelaskan sebagai wajar di plan Spark + arahkan
  update ke v21.2 (bukan lagi "deploy functions" yang mustahil).
- Kasus baru: `wrong-existing-password`, `weak-password`,
  `operation-not-allowed`, App Check/permission-denied dengan langkah konkret.

## YANG HARUS DILAKUKAN USER (plan gratis — TANPA deploy functions)
1. `npm install` → `npm run dev` / `npm run build`.
2. Publish rules terbaru (INI BISA di plan gratis):
   `firebase deploy --only firestore:rules`
   atau lewat Console: Firestore → Rules → tempel isi `firestore.rules` → Publish.
3. Firebase Console → Authentication: aktifkan **Email/Password** (+ Anonymous
   untuk mode legacy); pastikan domain aplikasi ada di **Authorized domains**.
4. (Disarankan) Aktifkan App Check + reCAPTCHA v3 → `VITE_RECAPTCHA_SITE_KEY`
   di `.env` — compat rules menuntut `request.app`.
5. Panduan lengkap: **PANDUAN-PLAN-GRATIS-SPARK.md**.

## YANG TETAP & TIDAK BERUBAH
- Functions/index.js tidak diubah — tetap berguna untuk Blaze (claims server,
  webhook HMAC payment). v21.2 memakainya BILA ada, bukan syarat.
- Semua koleksi/fitur v21 (POS, Payment Core, settlement, shift) tidak disentuh.
- PBKDF2 310k, sanitasi sesi, pin-gate, audit trail, App Check gate: utuh.

## VERIFIKASI
- `npm test` → 69/69 PASS · `npm run build` PASS · `npm run security:smoke` PASS

---

## v21.4.0 ENTERPRISE GROWTH PACK (2026-10-24)
Fitur bisnis baru (ekosistem kompleks, UI tetap simpel):
1. PROMO & LOYALITAS (menu baru, izin crm.manage)
   - Poin member otomatis dari transaksi kasir (aturan earn/redeem bisa diatur)
   - Tier otomatis: Bronze / Silver / Gold / Platinum dari akumulasi belanja
   - Tukar poin jadi potongan harga langsung di Kasir (batas aman otomatis)
   - RADAR BISNIS: omzet vs kemarin, produk terlaris 7 hari, jam tersibuk, stok kritis
2. VOUCHER & PROMO
   - Kode voucher persen/nominal + min belanja, maks potongan, periode, kuota, per cabang
   - Dipakai langsung di Kasir; kuota & periode divalidasi ulang saat checkout
3. PEMBELIAN & TRANSFER (menu baru, izin purchasing.manage)
   - Purchase Order + terima barang parsial; stok & HPP rata-rata bergerak otomatis
   - Hutang Supplier (PO tempo) + bayar sebagian/lunas, kas keluar tercatat otomatis
   - Transfer Stok antar cabang: nota kirim-terima dengan riwayat
4. OPERASIONAL TIM (menu baru, izin employee.manage)
   - Jadwal Shift mingguan (tap ganti shift, salin minggu lalu)
   - Target Omzet per cabang/kasir + Leaderboard dari penjualan nyata
   - Pengumuman internal (semua / role / cabang) dengan tanda belum dibaca
   - Checklist Buka/Tutup Toko harian + rekap 7 hari
5. KASIR (POS)
   - Tombol Pilih Member + tukar poin + kode voucher di panel checkout
   - Poin masuk otomatis saat lunas, tercatat di struk & riwayat poin
   - Tombol Bagikan WA (struk digital via WhatsApp) di modal struk
6. EMPLOYEE AREA
   - Kartu baru: Pengumuman (badge belum baca), Jadwal Saya, Poin Saya, Target Saya
7. BERANDA: kartu Radar Bisnis ringkas dengan tautan ke Radar lengkap

Koleksi Firestore baru (mirror lokal otomatis): loyalty_cfg, loyalty_log, voucher,
purchase_order, hutang, transfer_stok, jadwal_shift, target_omzet, pengumuman,
checklist_template, checklist_log.
Izin baru memakai domain lama (tanpa migrasi role): crm.manage, purchasing.manage,
employee.manage.

---

## v21.5.0 (24 Oktober 2026), RETAIL SETTLEMENT, STRUK MEWAH & ANTI-FRAUD

### 1. Navigasi tidak lagi menutupi konten
- FIX nav ganda: di tab Absen & Gaji, nav bawah Employee Area kini satu-satunya nav (nav utama disembunyikan), tombol Kirim Absen tidak tertutup lagi. Tombol "Kembali ke Beranda WELP" ditambahkan di Beranda & Profil Employee Area.
- Judul halaman (contoh: Operasional Tim) tidak pernah tertimpa tombol navigasi: di HP judul di atas, kontrol sub-tab di baris tersendiri full-width.

### 2. Laporan Shift / Settlement gaya retail + tab Akhir Hari
- Tutup Shift di Kasir otomatis membuat laporan Z (Akhir Hari): tanggal, jam mulai-selesai, nama kasir, total customer, jumlah struk, void bill & void item, ringkasan penjualan (omzet, diskon, qty, item, omzet bersih), metode pembayaran, jenis pesanan, modal awal, kas masuk/keluar, kas seharusnya, uang dihitung, dan SELISIH.
- Menu Keuangan punya sub-tab baru "Akhir Hari": daftar laporan tersimpan, filter tanggal + nomor settlement, detail bisa pilih Ringkasan atau Rincian (daftar struk satu per satu: jam, kode, metode, nominal), dan tombol Cetak Thermal. Laporan X (sementara) bisa dicetak saat shift masih berjalan.
- Laporan dihitung dari data transaksi nyata (bukan input manual), disimpan append-only (tidak bisa diedit/dihapus).

### 3. Struk mewah (layar & thermal)
- Struk baru: logo di tengah atas (logo perusahaan, atau logo WELP bila belum upload), nama toko, alamat & telepon, kode + status Lunas, item rapi, total tebal, garis pemisah tipis modern (tanpa pola "- - - -" kuno), barcode kode transaksi, dan watermark kecil "by WELP" di dasar struk.
- Tombol Thermal di struk kasir: cetak langsung ke printer ESC/POS dengan logo otomatis.

### 4. Logo otomatis siap thermal
- PNG transparan: bentuk logo diambil dari channel alpha (latar hilang).
- JPEG / PNG berlatar: otomatis menjadi SKETSA OUTLINE (deteksi tepi Sobel) sehingga tidak ada blok hitam di struk thermal.
- Cache hasil olahan supaya cetakan berikutnya lebih cepat.

### 5. Anti-fraud layer v1
- Riwayat tidak bisa "hilang": absensi, opname, riwayat stok, audit log, settlement, shift, kas, dan laporan akhir hari masuk daftar append-only (perangkat basi tidak bisa menimpa/menghapus cloud).
- Firestore rules baru: riwayat_opname & eod_reports append-only (create boleh, update/delete ditolak), audit_log tetap append-only.
- Setiap sesi stok opname masuk audit log (siapa, kapan, total selisih). Koreksi selanjutnya harus lewat sesi baru, bukan edit.
- Laporan kas dihitung sistem; selisih kas tersimpan permanen per shift + kasir.

### 6. Riwayat Absensi untuk atasan
- Riwayat 14 menjadi 30 hari, bisa difilter per karyawan, lengkap foto selfie, status waktu server, jarak, dan keterlambatan.

### 7. Kepadatan UI sadar perangkat
- Drawer menu di HP kini padat (item lebih kecil, muat lebih banyak tanpa scroll), tablet & PC tetap lega. Semua kontrol segmented bisa digeser horizontal, tidak menutupi judul.

### 8. Beranda anti-macet
- Semua hitungan berat (omzet, radar, top-5 transaksi) dihitung sekali per masuk tab dengan proteksi error penuh; data ribuan transaksi pun tidak membuat Beranda nge-freeze.
