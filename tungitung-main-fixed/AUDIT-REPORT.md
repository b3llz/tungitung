# AUDIT REPORT — Aplikasi HPP + Kasir "CostLab" (tungitung)

Status: **Deep audit selesai untuk seluruh source code yang ada di ZIP** (proyek ini memang berukuran kecil: 1 halaman React + 1 halaman admin HTML + rules Firestore). Semua finding di bawah ini punya rujukan file & baris yang bisa dicek langsung. Klaim ditandai sesuai level kepastian:

- **FAKTA** — ditemukan langsung di source code.
- **INFERENSI** — kesimpulan logis dari beberapa bagian kode, belum 100% dikonfirmasi lewat testing runtime.
- **UNKNOWN** — tidak bisa dipastikan dari source code yang tersedia (butuh akses ke Firebase Console / rules yang benar-benar dideploy / data produksi).
- **REKOMENDASI** — usulan ke depan, bukan sesuatu yang sudah ada.

---

## 1. PHASE DISCOVERY — Gambaran Besar

**Teknologi (FAKTA, dari `package.json`, `vite.config.js`, import di `src/App.jsx`):**
React 18 + Vite 4/5 + Tailwind, `firebase` v10 (Firestore + Auth SDK), `currency.js`, `react-easy-crop`, `qrcode.react` (tidak dipakai untuk QR — QR sebenarnya digenerate lewat API eksternal `quickchart.io`, lihat baris `qrUrl`), `lucide-react` untuk ikon. Deploy target: Netlify (`netlify.toml`) dan/atau Firebase Hosting (`firebase.json` hanya berisi konfigurasi Firestore rules, bukan hosting).

**Struktur project (FAKTA):**
```
src/App.jsx      -> 4190 baris, SATU file berisi HAMPIR SELURUH aplikasi
                     (Kalkulator HPP, Kasir/POS, Laporan, Stok, Karyawan,
                     Outlet, Pengaturan, LockScreen/Login, dll — semua
                     sebagai komponen di file yang sama)
src/main.jsx     -> entry point + Error Boundary sederhana
public/god-panel.html -> halaman admin TERPISAH (statis, di-serve publik)
                     untuk developer mendaftarkan/mengelola tenant
firestore.rules  -> aturan akses Firestore
.env             -> berisi VITE_FIREBASE_API_KEY (benar di-gitignore,
                     tapi ikut ter-bundle di ZIP yang diberikan)
```

**Arsitektur AKTUAL (FAKTA, paling penting untuk dipahami sebelum baca temuan lain):**

Ini **BUKAN** aplikasi dengan database bersama di server. Firestore **hanya** dipakai untuk 2 hal:
1. Koleksi `licenses` — data tenant/lisensi (dicek saat login).
2. Koleksi `logs` — log aktivitas login.

**Seluruh data bisnis** — produk, stok, bahan baku, resep/HPP, transaksi kasir, karyawan, outlet, pengaturan diskon/pajak, expense, dsb — disimpan **hanya di `localStorage` browser** (dikonfirmasi lewat 50+ pemanggilan `localStorage.getItem/setItem` di seluruh fitur: `product_stock_db`, `raw_material_db`, `hpp_pro_db`, `pos_history_db`, `active_orders_db`, `employee_db`, `outlets_db`, `expense_db`, `discount_tax_db`, `store_profile`, dst).

**Konsekuensi arsitektur ini (INFERENSI langsung dari fakta di atas, konsekuensi logis):**
- Tidak ada "database bersama" yang bisa diakses 2 kasir/2 device sekaligus. Setiap browser/device punya salinan data sendiri-sendiri yang independen.
- Fitur **Multi Outlet** (`outlets_db`) hanya menyimpan nama/lokasi outlet secara lokal — **tidak ada mekanisme sinkronisasi lintas device/outlet yang ditemukan**. Jadi klaim "multi outlet" saat ini kemungkinan besar tidak benar-benar menggabungkan data dari cabang berbeda (perlu dikonfirmasi ke pemilik produk — UNKNOWN apakah ini sudah disadari sebagai batasan yang disengaja atau bug persepsi).
- Backup/restore data (`handleBackup` / `handleRestore` di Pengaturan) hanya mengekspor **seluruh isi `localStorage`** sebagai JSON — ini satu-satunya mekanisme "backup" yang ada (dibahas lebih lanjut di bagian Database & Backup).
- Semua audit soal *concurrency* (2 kasir transaksi bersamaan, race condition database) di bagian instruksi awal **tidak relevan dalam bentuk klasik server-database**, karena memang tidak ada database bersama untuk terjadi race condition di dalamnya. Risiko konkurensi di aplikasi ini justru muncul dalam bentuk lain: *data antar-device tidak pernah konsisten/tersinkron*, dan *device yang sama dipakai bergantian tanpa isolasi transaksi nyata* (dibahas di bagian POS).

**Fitur yang benar-benar ditemukan (FAKTA, dari struktur tab/komponen):** Kalkulator HPP (mode simple & detail), Kasir/POS (retail & F&B/meja, self-order via QR, cart, payment method, cash change), Riwayat Transaksi + grafik, Manajemen Stok (opname, barang masuk/keluar, riwayat stok), Database Supplier, Manajemen Karyawan (role kasir/admin, PIN), Multi Outlet (lokal), Manajemen Kas Keluar (expense), Pengaturan Diskon/Pajak/Biaya Layanan, Profil Toko, Metode Pembayaran, Hardware (printer thermal via Bluetooth/IP), Multi bahasa (ID/EN), Dark mode, Backup/Restore JSON manual, Sistem lisensi tenant berbasis Firestore.

---

## 2. AUDIT HPP (Kalkulator COGS)

**Formula inti (FAKTA, `CalculatorTab`, sekitar baris 500–545):**
```
cost per baris bahan   = (harga_beli / isi_kemasan) * jumlah_pakai       // calcRow()
matPerUnit  = total_biaya_bahan   / yield
varPerUnit  = total_biaya_variabel / yield
fixPerUnit  = showFixed ? total_biaya_tetap / target_produksi_bulanan : 0
hppBersih   = matPerUnit + varPerUnit + fixPerUnit
hargaJual   = hppBersih / (1 - margin/100)     // rumus MARGIN, bukan markup
```

✅ **Temuan positif (FAKTA):** Aplikasi ini **sudah benar** membedakan margin dari markup — memakai `hpp / (1 - margin%)`, bukan `hpp * (1 + markup%)`. Ini poin yang sering salah di aplikasi HPP lain, dan di sini sudah tepat secara matematis. Verifikasi manual: HPP 10.000, margin 50% → 10.000/(1-0.5) = 20.000, profit 10.000 = tepat 50% dari harga jual. Benar.

🔴 **[HIGH] Tidak ada konversi satuan — field "Satuan" murni kosmetik.**
- Lokasi: `MATERIAL_UNITS` (baris 150) menyediakan pilihan `gr, kg, ml, liter, pcs, pack, sdm, sdt`, tapi `calcRow()` (baris ~504) **tidak pernah melihat nilai `unit` sama sekali** — hanya memakai angka `content` dan `usage` apa adanya. Dicari di seluruh file: **tidak ditemukan** satu pun logika konversi (kg→gr, liter→ml, dst).
- Dampak nyata: kalau user memilih satuan "kg" untuk harga beli (misal beli 1 kg tepung = `content: 1`), lalu mengisi "jumlah pakai" dalam gram (misal `usage: 250`), sistem akan menghitung `harga/1*250` — HPP bahan tersebut membengkak **1000x lipat** dari yang seharusnya. Sebaliknya kalau user salah asumsi arah lain, HPP bisa under-estimate drastis. Ini murni tergantung disiplin manual user menyamakan satuan `content` dan `usage`, dan UI tidak memvalidasi/mem-warning apa pun.
- Rekomendasi: tambahkan validasi/normalisasi otomatis (misal selalu normalisasi ke gram/ml sebagai satuan dasar saat `unit` dipilih "kg"/"liter"), atau minimal tampilkan warning kalkulasi kalau rasio `usage/content` di luar rentang wajar.

🟠 **[MEDIUM] Waste/susut tidak diperhitungkan dalam formula HPP.** Dicari di seluruh file (`waste`, `susut`, `shrink`) — **NOT FOUND**. Instruksi awal secara eksplisit meminta audit soal waste; secara faktual fitur ini belum ada sama sekali di kalkulator (hanya field `yield` untuk hasil produksi, tidak ada field terpisah untuk bahan yang terbuang/rusak). REKOMENDASI: tambahkan field opsional "estimasi waste %" per bahan atau per resep yang menambah `matPerUnit` secara proporsional.

🔴 **[CRITICAL — Data Integrity] Tidak ada historical cost snapshot per transaksi.** Ini exact scenario yang diminta di instruksi. Order (`newOrder` di `handleCheckout`, baris ~1421-1430) hanya menyimpan `price` (harga jual) dan `qty` per item — **tidak menyimpan HPP/biaya bahan pada saat transaksi terjadi**. Konsekuensi (INFERENSI, didukung fakta bahwa `ReportTab` sama sekali tidak menghitung profit — lihat Temuan #Bisnis di bawah): begitu fitur laporan profit/margin dibangun nanti (yang memang direkomendasikan di bagian Feature Discovery), ia **tidak bisa menghitung profit transaksi lama secara akurat** kalau harga bahan sudah berubah — kecuali developer menambahkan snapshot HPP per item saat checkout mulai sekarang. Ini harus diperbaiki **sebelum** membangun fitur profitability report, karena kalau tidak, laporan margin historis akan salah tanpa disadari.

🟠 **[MEDIUM] Pencocokan resep↔produk↔bahan baku berbasis NAMA STRING, bukan ID** — dijelaskan detail di bagian Database (§4) karena berdampak ke HPP *dan* stok. **Sudah saya perbaiki sebagian** (lihat §7 Implementasi).

**Kondisi ekstrem yang dicek (FAKTA — dibaca di kode, tidak ditemukan penanganan khusus):**
- Harga/qty bahan = 0 atau negatif: tidak ada validasi input (`type="number"` HTML saja); qty negatif akan membuat `cost` negatif dan `hppBersih` bisa negatif tanpa pesan error apa pun ke user.
- Resep kosong (tanpa bahan): `hppBersih` akan menjadi 0, harga jual jadi 0, tidak ada guard/minimum check sebelum `save()` selain validasi nama produk wajib diisi.
- `content = 0` sudah di-guard (`calcRow` return 0 kalau `content` 0/falsy) — ini benar, mencegah pembagian dengan nol.

---

## 3. AUDIT POS / KASIR

**Alur checkout (FAKTA, `handleCheckout`, baris ~1422 dst.):**
1. `addToCart` **sudah** mengecek stok (`p.stock <= 0` ditolak, qty di-cap ke `p.stock`) — ini bagus, mencegah jual melebihi stok yang terlihat di layar.
2. `handleCheckout` memotong stok produk jadi **dan** stok bahan baku (dari resep) sekaligus, lalu menyimpan order ke `active_orders_db` (status `pending`).
3. `confirmPayment` memindahkan order ke `pos_history_db` dengan status `paid`.

🔴 **[HIGH — sudah diperbaiki, lihat §7] Stok bahan baku tidak pernah dikembalikan saat order dibatalkan/diedit.** `cancelOrder` dan `editOrder` (baris ~1490 & ~1520 versi asli) mengembalikan `product.stock` (stok produk jadi) tapi **tidak menyentuh `raw_material_db` sama sekali**, padahal `handleCheckout` sudah memotongnya. Setiap siklus checkout→cancel akan membuat stok bahan baku menyusut permanen padahal barangnya tidak pernah benar-benar terpakai. Ini bug data-integrity nyata, bukan asumsi — terbukti dari perbandingan langsung kedua fungsi.

🟠 **[MEDIUM] Tidak ada guard eksplisit terhadap double-submit di level tombol** — hanya ada `if (isLoading) return;` di awal `handleCheckout` (state React, async). Saya **tidak menemukan** kode disable pada tombol checkout itu sendiri di JSX yang terhubung ke `isLoading` (perlu dicek visual di komponen tombolnya — kalau tombol tidak ber-`disabled={isLoading}`, double-click cepat *berpotensi* memicu 2x eksekusi sebelum re-render pertama menyalakan guard). Status: **INFERENSI, belum 100% diverifikasi** karena saya tidak trace lokasi JSX tombol checkout secara spesifik dalam sesi audit ini — REKOMENDASI: pastikan tombol checkout eksplisit `disabled={isLoading}` dan idealnya beri idempotency guard tambahan (misal simpan `lastOrderHash` beberapa detik).
- Delay `await new Promise(resolve => setTimeout(resolve, 500))` di awal checkout (baris ~1421) adalah **delay palsu (fake loading), bukan network call sungguhan** — hanya kosmetik UX, tidak menambah keamanan transaksi apa pun.

🟠 **[MEDIUM] Harga & diskon sepenuhnya dikontrol client-side, tanpa validasi server.** Karena tidak ada backend nyata untuk data bisnis (lihat §1), **semua** nilai — harga produk, diskon global, pajak, service charge (`computeOrderTotals`, `getBizConfig` dari `localStorage`) — bisa diubah siapa pun yang mengakses DevTools/localStorage di device kasir. Ini **bukan bug kode** dalam arti tradisional (tidak ada "server" untuk dibobol), tapi merupakan **batasan arsitektur fundamental**: kepercayaan sepenuhnya bertumpu pada kepercayaan terhadap operator device, bukan pada sistem. Kalau target pengguna adalah toko dengan banyak kasir yang tidak semuanya dipercaya penuh oleh owner, ini risiko bisnis nyata yang perlu dikomunikasikan secara eksplisit ke pemilik produk — bukan sesuatu yang bisa "dipatch" tanpa membangun backend sungguhan.

🟠 **[MEDIUM — dijelaskan detail di §2 & §4, sudah diperbaiki] Pencocokan resep saat checkout berbasis nama produk** (`resep.product.name === cartItem.name`), bukan ID. Rename produk / nama ganda / beda kapitalisasi akan membuat pengurangan stok bahan baku **gagal diam-diam** (silent failure — tidak ada error, hanya bahan baku tidak berkurang) atau salah sasaran.

**Skenario ekstrem yang dicek (FAKTA dari kode, bukan hasil testing runtime sungguhan):**
- Refresh browser saat proses checkout: karena semua operasi `localStorage.setItem` bersifat sinkron dan terjadi dalam satu tick JS setelah `await` 500ms, refresh tepat di tengah `handleCheckout` **secara teoritis** bisa meninggalkan state parsial (misal stok produk sudah terpotong di variabel lokal tapi `setItem` belum sempat jalan) — **UNKNOWN/tidak bisa dipastikan tanpa reproduksi runtime**, tapi risikonya nyata karena tidak ada mekanisme "all-or-nothing" (localStorage bukan database transaksional).
- Refund/void: **NOT FOUND** — tidak ada konsep refund/void terpisah dari "cancel" pesanan yang masih `pending`. Transaksi yang statusnya sudah `paid` di `pos_history_db` **tidak punya fungsi pembatalan/refund sama sekali** yang ditemukan di kode. Kalau kasir salah input dan sudah menekan bayar, tidak ada jalur resmi untuk membatalkannya — REKOMENDASI: tambahkan fitur void/refund dengan alasan wajib & role owner/admin.

---

## 4. AUDIT DATABASE & INTEGRITAS DATA

🔴 **[HIGH — sudah diperbaiki sebagian, lihat §7] Semua relasi antar-entitas (produk ↔ resep ↔ bahan baku) memakai pencocokan nama string (`.toLowerCase()`), bukan foreign key/ID yang stabil.**
- Bukti (FAKTA): `save()` di `CalculatorTab` (baris ~575) mencari produk existing lewat `p.name.toLowerCase() === product.name.toLowerCase()`; bahan baku dicocokkan lewat `m.name.toLowerCase() === mat.name.toLowerCase()`; `handleCheckout` mencocokkan resep lewat `r.product.name === cartItem.name`.
- Dampak: mengganti nama produk setelah resepnya dibuat akan **memutus link resep↔produk** (resep lama tidak lagi ketemu saat checkout → pengurangan bahan baku berhenti bekerja tanpa pesan error apa pun). Dua produk dengan nama sama akan bentrok/tertimpa. Typo spasi/kapital pada nama bahan baku akan membuat 2 baris bahan baku berbeda untuk bahan yang sebenarnya sama.
- **Sudah saya perbaiki untuk jalur resep↔produk** (lihat §7): resep sekarang menyimpan `productId` yang stabil saat disimpan, dan `handleCheckout` mengutamakan pencocokan `productId`, dengan fallback ke nama untuk resep lama (backward compatible, data lama tidak rusak). **Belum diperbaiki**: pencocokan bahan baku↔resep (`mat.name` ke `raw_material_db`) masih berbasis nama — memperbaikinya butuh perubahan skema resep (menyimpan `materialId` per baris bahan) yang lebih invasif dan berisiko merusak resep-resep lama yang sudah tersimpan tanpa `materialId`. **Direkomendasikan sebagai pekerjaan lanjutan**, bukan dieksekusi sekarang karena butuh strategi migrasi data yang hati-hati (lihat §8).

🟡 **[LOW/INFO] Tidak ada skema/validasi tipe data formal** — karena database-nya adalah JSON bebas di `localStorage`, tidak ada constraint (`NOT NULL`, `unique`, foreign key) sama sekali; semua validasi (kalau ada) murni di level UI JavaScript. Ini konsekuensi wajar dari pilihan arsitektur client-only, bukan "bug" — tapi berarti *tidak ada jaring pengaman* kalau ada baris kode lain di masa depan yang lupa validasi sebelum `JSON.stringify`.

**Backup & Recovery (dari instruksi `<backup_recovery>`):**
- FAKTA: `handleBackup` mengekspor **seluruh isi `localStorage`** menjadi satu file JSON (lihat `JSON.stringify(localStorage)` di sekitar Pengaturan, baris ~2521); `handleRestore` membaca file itu balik dan menulis ulang tiap key ke `localStorage`.
- Ini backup manual, **satu file, sekali jalan** — tidak ada backup otomatis/terjadwal, tidak ada versioning, tidak ada verifikasi checksum bahwa file yang di-restore valid/tidak korup sebelum menimpa seluruh data yang ada saat ini, dan tombol **"Zona Bahaya: Reset Aplikasi"** (`localStorage.clear()`) ada tepat di kartu yang sama tanpa lapisan konfirmasi kedua (hanya satu `confirm()` browser standar).
- REKOMENDASI: (a) ingatkan user secara berkala untuk backup (misal badge "terakhir backup: X hari lalu"), (b) validasi struktur JSON sebelum overwrite saat restore, (c) auto-backup ke Firestore/cloud storage sebagai opsi PRO — ini juga sekaligus jadi jalan untuk migrasi bertahap ke database bersama sungguhan di masa depan.

---

## 5. AUDIT SECURITY

Ini bagian dengan temuan paling serius. Diurutkan dari yang paling kritis.

### 🔴🔴 [CRITICAL] Password & PIN Owner tenant bisa dibaca publik tanpa login, langsung dari Firestore.

**Bukti (FAKTA):**
- `firestore.rules`: `match /licenses/{id} { allow get: if true; ... }` — siapa pun yang tahu (atau menebak) ID tenant bisa membaca **seluruh isi dokumen** tenant tersebut tanpa autentikasi apa pun.
- Isi dokumen itu (dibuat lewat `god-panel.html`, `setDoc(doc(db,"licenses", id), {...})`) berisi field **`password` dalam bentuk plaintext** dan **`ownerPin`** — bukan hash, bukan salt.
- `LockScreen.handleTenantLogin` (`src/App.jsx` ~baris 2652) melakukan `getDoc(docRef)` lalu membandingkan `data.password === inputPass` **di sisi client**.

**Kenapa ini critical:** "Login" di aplikasi ini sebenarnya *tidak pernah benar-benar memverifikasi apa pun di server* — client mengunduh dulu seluruh dokumen (termasuk password & PIN owner asli), baru mencocokkannya di JavaScript browser sendiri. Artinya siapa pun yang bisa menyusun request `GET` ke Firestore REST API dengan path `licenses/<id>` — tanpa perlu tahu password sama sekali — akan langsung mendapatkan password dan PIN owner tenant tersebut apa adanya. ID tenant sendiri **mudah ditebak** karena dibuat otomatis dari nama toko (`nama.toLowerCase().replace(/[^a-z0-9]/g,'_')` — lihat `god-panel.html` `autoGenerate()`), contoh: "Kopi Senja" → `kopi_senja`.

**Dampak bisnis:** siapa pun bisa mengambil alih akun tenant mana pun yang ID-nya berhasil ditebak/diketahui, termasuk akses **role owner** (lewat `ownerPin`), yang di aplikasi ini berarti akses penuh ke semua data, harga, diskon, laporan, dan pengaturan toko tersebut.

**Remediation (REKOMENDASI — ini perubahan arsitektur, TIDAK saya eksekusi otomatis karena berisiko merusak alur login yang sedang berjalan tanpa adanya backend pengganti):**
1. Jangan pernah menyimpan password/PIN plaintext yang bisa dibaca client secara langsung. Pindahkan proses verifikasi ke **Firebase Cloud Function** (butuh upgrade project ke plan Blaze): client kirim `{id, password}` ke Cloud Function, Function yang membaca dokumen (dengan Admin SDK, bukan client SDK) dan membandingkan **hash** password (mis. bcrypt), lalu mengembalikan **custom token** Firebase Auth atau session token, bukan seluruh dokumen tenant.
2. Sampai Cloud Function tersedia, langkah minimum: ubah rule `licenses/{id}` dari `allow get: if true` menjadi tetap publicly-gettable **tapi hanya dokumen yang field sensitifnya sudah dihapus** — ini tidak bisa dilakukan lewat security rules saja (rules tidak bisa "menyaring field"), jadi solusi sungguhan tetap butuh backend/Cloud Function.
3. Hash `password` dan `ownerPin` sebelum disimpan dari `god-panel.html` (walau ini tetap tidak menutup celah baca-publik selama field itu masih ada di dokumen yang `allow get: if true`, hashing hanya mengurangi dampak kalau bocor, bukan mencegah pembacaan itu sendiri).

Saya menandai ini sebagai **prioritas #1 yang perlu diputuskan pemilik produk** sebelum aplikasi ini dipakai tenant sungguhan dengan data sensitif, karena solusinya butuh infrastruktur baru (Cloud Function), bukan sekadar edit kode React.

### 🔴 [HIGH — sudah diperbaiki sebagian, lihat §7] `public/god-panel.html` (panel admin developer) tidak punya gate login sama sekali & berisi API key tidak valid.

**Bukti (FAKTA, versi asli sebelum diperbaiki):**
- File ini ada di folder `public/`, artinya ia **ter-deploy sebagai halaman statis yang bisa diakses siapa pun** yang tahu URL-nya (mis. `https://domain-anda/god-panel.html`) — tidak ada middleware/auth server yang membatasinya, karena ini situs statis (Netlify/Vite build).
- Script di dalamnya memanggil `onSnapshot(query(collection(db,"licenses"),...))` **langsung saat halaman dimuat**, tanpa proses login apa pun — padahal `firestore.rules` mensyaratkan `isAdmin()` (email developer terdaftar) untuk `list`/`create`/`update`/`delete` pada `licenses`. Karena tidak pernah ada pemanggilan `signInWithEmailAndPassword`/`getAuth` sama sekali di file aslinya, panel ini **akan selalu gagal dengan `permission-denied`** untuk siapa pun yang membukanya — termasuk developer aslinya sendiri. Ini bug fungsional (panel rusak), sekaligus indikasi bahwa halaman ini tidak dilindungi apa pun di levelnya sendiri.
- `firebaseConfig.apiKey` di file ini (`"AIzaSyDqMpyCBFg1m5pA0Bn8U"`, 25 karakter) **berbeda format/panjang** dari API key asli project yang sama di `.env` (39 karakter, format Firebase Web API key yang valid). Ini bukan secret asli yang bocor (formatnya sudah terlihat tidak valid/placeholder), tapi tetap menyebabkan `initializeApp` gagal (`auth/invalid-api-key`) — bug fungsional lain.

**Yang sudah saya perbaiki** (lihat §7): menambahkan layar login Firebase Auth (email+password) yang **wajib** berhasil sebelum konten panel & listener Firestore aktif — ini menyelaraskan perilaku halaman dengan syarat `isAdmin()` yang sudah ada di rules, sekaligus menambah lapisan proteksi kedua di level UI (bukan cuma mengandalkan rules). **Yang belum bisa saya perbaiki tanpa Anda**: mengisi `apiKey` yang benar (saya sengaja tidak mengisinya dengan API key dari `.env` karena itu keputusan konfigurasi yang harus eksplisit dari Anda, bukan ditebak/disalin otomatis) — lihat komentar `GANTI_DENGAN_API_KEY_ASLI...` di file. REKOMENDASI tambahan: pindahkan file ini keluar dari `public/` (misal jadi bagian dari Cloud Function/halaman yang butuh login server-side), sehingga tidak lagi bisa diakses lewat URL statis tanpa syarat apa pun.

### 🟠 [MEDIUM] Role-based access control (kasir/admin/owner) hanya berlaku di level tampilan (UI), bukan proteksi data sungguhan.

**Bukti (FAKTA):** Menu disembunyikan/ditampilkan berdasarkan `licenseInfo.currentUserRole` (baris ~3883–3933), tapi karena semua data & fungsi tersimpan di `localStorage`/state React yang sama, **tidak ada pemisahan hak akses di level penyimpanan data**. Seorang "kasir" yang membuka DevTools browser bisa memanggil fungsi/mengubah `localStorage` yang sama seperti "owner" — termasuk `employee_db` (menambah dirinya sendiri sebagai admin), `discount_tax_db` (mengubah diskon/pajak), dsb.

Ini **batasan arsitektur**, konsekuensi wajar dari aplikasi client-only tanpa backend otorisasi — bukan bug yang bisa "ditambal" dengan satu baris kode. REKOMENDASI: kalau target penggunanya adalah toko dengan kasir yang tidak sepenuhnya dipercaya (bukan hanya pemilik tunggal), ini harus dikomunikasikan jelas sebagai batasan produk saat ini, dan jadi salah satu alasan kuat untuk migrasi ke backend sungguhan di masa depan (lihat §6 & §8).

### 🟢 [Info, sudah baik] Tidak ditemukan secret/API key produksi yang benar-benar valid & tereksposur secara berbahaya di `src/App.jsx`.
- `firebaseConfig.apiKey` di `App.jsx` sudah benar diambil dari `import.meta.env.VITE_FIREBASE_API_KEY` (bukan hardcode) — praktik yang tepat.
- Ada komentar eksplisit di kode (baris ~54) yang menyatakan variabel-variabel secret lama (`LOG_API_URL`, `BLACKLIST_URL`, `SECRET_KEY`, `SESSION_TOKEN`) sudah dihapus karena dulu ikut ter-bundle ke browser — ini indikasi **sudah pernah ada audit/pembersihan security sebelumnya** oleh developer aslinya. Perlu dicatat sebagai temuan positif yang berbasis bukti, bukan basa-basi.
- Firebase Web API key sendiri **secara umum bukan secret rahasia** by design (Google mendokumentasikan ini) — ia hanya identifier project, keamanannya bertumpu pada security rules (Firestore rules) dan App Check, bukan pada kerahasiaan key itu sendiri. Jadi walau key ada di frontend bundle, itu bukan vulnerability tersendiri **selama** rules-nya benar — masalah aslinya tetap di rules `licenses` seperti dijelaskan di atas.

---

## 6. BUSINESS LOGIC & PELUANG PRODUK (Feature Discovery)

**Temuan kunci berbasis bukti kode:** Modul HPP dan modul Kasir/Laporan **secara teknis sudah terhubung untuk transaksi** (checkout memotong stok bahan baku berdasar resep), tapi **secara pelaporan sama sekali TERPUTUS**. Bukti: `ReportTab` (baris 1729 dst.) hanya menghitung:
```js
rev: filteredTxs.reduce((a,b)=>a+b.total,0)   // total omzet
topProducts: ... sort by qty terjual           // produk terlaris by kuantitas
```
Tidak ada satu pun perhitungan `profit`, `margin`, atau `hpp` di seluruh `ReportTab` (dicari langsung di file, **NOT FOUND**). Artinya sampai hari ini, pemilik toko **hanya bisa tahu omzet dan produk terlaris**, tapi **tidak bisa tahu produk mana yang sebenarnya paling untung** — persis pertanyaan yang disebut di instruksi awal ("produk mana yang sebenarnya paling menguntungkan?").

Ini justru peluang produk paling jelas dan paling didukung data (bukan usulan fitur random):

**REKOMENDASI prioritas tinggi — "Laporan Profitabilitas" (deterministik, tidak butuh AI):**
- Data yang **sudah ada** untuk membangunnya: `pos_history_db` (harga jual & qty per item per transaksi) + `product.hpp` (HPP saat resep terakhir disimpan, tersimpan di `product_stock_db`).
- Data yang **BELUM ada dan wajib ditambahkan dulu** (lihat §2 finding "historical cost snapshot"): HPP **pada saat transaksi terjadi**, bukan HPP produk saat ini — kalau tidak, laporan margin untuk transaksi lama akan salah begitu harga bahan berubah. REKOMENDASI konkret: mulai sekarang, saat `handleCheckout` membuat `newOrder`, tambahkan field `hppAtSale` per item (ambil dari `product.hpp` saat itu) — perubahan ini kecil, aman, dan jadi fondasi wajib sebelum laporan profit dibangun. (Belum saya eksekusi di kode karena mengubah struktur laporan berikutnya butuh keputusan desain lebih lanjut dari Anda — tapi ini rekomendasi paling konkret dan berisiko rendah untuk langkah selanjutnya.)
- Setelah data itu ada, laporan profit per produk/per periode = `SUM((item.price - item.hppAtSale) * item.qty)` — perhitungan sederhana, deterministik, mudah diverifikasi, **tidak perlu AI/ML**.

**REKOMENDASI lain yang genuinely didukung data yang sudah ada:**
- *Waste alert / stock opname selisih*: fitur "Stok Opname" & "Riwayat Stok" sudah ada (`stock_history_db`) — bisa dikembangkan jadi laporan selisih stok tercatat vs stok fisik untuk mendeteksi kebocoran, tanpa perlu data tambahan.
- *Price impact simulation* ("kalau harga bahan naik 15%, harus jual berapa?"): **bisa dibangun sepenuhnya dari data & formula HPP yang sudah ada** (§2) tanpa mengubah data produksi — cukup jalankan ulang formula `hppBersih`/`getTier` dengan angka hipotetis, tanpa menyentuh `localStorage`. Ini **bisa dibangun sebagai fitur simulasi terisolasi** persis seperti diminta di instruksi (`<simulation_engine>`) — arsitektur saat ini (kalkulasi murni di state React, belum ditulis ke storage sampai user klik "Simpan") **sudah cocok** untuk pola simulasi ini secara alami; perubahan minimum yang dibutuhkan hanya UI terpisah "mode simulasi" yang memuat resep tersimpan sebagai starting point tanpa memanggil `save()`.
- *Rekomendasi bahan perlu dibeli lebih cepat*: butuh data historis pemakaian bahan dari waktu ke waktu untuk estimasi kecepatan pemakaian — data mentahnya (`stock_history_db`, hasil checkout) sudah cukup untuk menghitung rata-rata pemakaian per hari secara deterministik (bukan ML), lalu dibandingkan ke stok saat ini untuk estimasi "berapa hari lagi habis".
- Fitur yang **saya TIDAK rekomendasikan** untuk versi awal karena data pendukungnya belum ada: *supplier price history* (tidak ada penyimpanan histori harga per supplier per waktu, hanya `lastPrice` tunggal — NOT FOUND field historis), *break-even analysis multi-produk* (butuh alokasi biaya tetap ke banyak produk yang belum ada modelnya).

---

## 7. IMPLEMENTASI YANG SUDAH DIEKSEKUSI DI ZIP INI

Prinsip yang saya pakai: **hanya mengeksekusi perubahan yang aditif, backward-compatible dengan data lama, dan tidak mengubah alur/UX yang sudah berjalan** — sesuai instruksi "jangan rewrite besar-besaran". Semua perubahan besar/berisiko (auth architecture, snapshot HPP di transaksi, konversi satuan) saya **rekomendasikan** tapi **tidak eksekusi otomatis**, karena butuh keputusan desain/infrastruktur dari Anda.

| # | File | Perubahan | Risiko |
|---|------|-----------|--------|
| 1 | `src/App.jsx` — `CalculatorTab.save()` | Resep sekarang menyimpan `productId` yang stabil (bukan cuma nama) saat disimpan. | Rendah — field baru, tidak mengubah field lama. |
| 2 | `src/App.jsx` — `handleCheckout()` | Pencocokan resep↔produk mengutamakan `productId`, fallback ke nama untuk resep lama. Stok produk di-clamp ke minimum 0. Pemakaian bahan baku per item pesanan sekarang dicatat (`newOrder.materialUsage`) supaya bisa direstore. | Rendah — perilaku normal tidak berubah, hanya menambah pencatatan & fallback. |
| 3 | `src/App.jsx` — `cancelOrder()` & `editOrder()` | Stok bahan baku sekarang ikut dikembalikan (lewat `restoreMaterialUsage`) saat pesanan dibatalkan/diedit, sesuai data yang dicatat di poin 2. Pesanan lama (dibuat sebelum fix ini) tidak punya data untuk direstore — fungsi akan diam-diam skip, tidak error. | Rendah — hanya menambah, tidak menghapus logika lama. |
| 4 | `public/god-panel.html` | Ditambahkan layar login Firebase Auth wajib sebelum konten & listener Firestore aktif (sebelumnya panel ini rusak total tanpa login sama sekali). API key placeholder ditandai jelas perlu diganti manual oleh Anda. | Rendah untuk aplikasi utama (file terpisah, tidak disentuh App.jsx) — **tapi panel ini TIDAK akan berfungsi sampai Anda mengisi `apiKey` yang valid dan memastikan email developer Anda ada di `isAdmin()` pada `firestore.rules`.** |

**Yang SENGAJA TIDAK saya ubah (dan kenapa):**
- `firestore.rules` — tidak saya ubah karena menghapus `allow get: if true` akan **langsung mematikan alur login tenant yang ada sekarang** tanpa pengganti (butuh Cloud Function dulu). Mengubah ini sepihak berisiko membuat aplikasi tidak bisa dipakai sama sekali.
- Formula HPP (`calcRow`, `getTier`) — sudah matematis benar (margin vs markup), tidak saya sentuh.
- Skema `raw_material_db`/matching by name untuk BAHAN BAKU (beda dengan produk) — saya hanya perbaiki sisi produk↔resep; memperbaiki sisi bahan baku butuh menambah `materialId` ke setiap baris resep tersimpan, yang berisiko terhadap resep-resep lama tanpa strategi migrasi yang jelas (lihat §8).
- Snapshot HPP per transaksi (`hppAtSale`) — saya rekomendasikan konkret di §6 tapi tidak saya tulis otomatis karena ini keputusan desain data laporan yang sebaiknya Anda konfirmasi dulu (nama field, apakah perlu breakdown per komponen biaya, dll).
- Konversi satuan otomatis di Kalkulator HPP — berisiko mengubah hasil hitung resep-resep yang SUDAH ADA dan sudah "benar" secara manual (user sudah terbiasa menyamakan satuan sendiri); mengubah ini sepihak bisa membuat HPP lama yang tadinya benar jadi salah. Perlu keputusan UX bersama Anda dulu.

---

## 8. REGRESSION CHECK & YANG BELUM BISA DIVERIFIKASI

**Sudah saya verifikasi (statis, baca kode):**
- Diff perubahan `src/App.jsx` sudah saya tinjau baris-per-baris (lihat diff di atas) — tidak ada logika lama yang dihapus, hanya disisipkan.
- Balance kurung kurawal `{}` dan kurung `()` di `src/App.jsx` sebelum/sesudah perubahan tetap seimbang (1962→1967 `{`/`}`, 2579→2604 `(`/`)`, delta konsisten dengan kode yang ditambahkan) — indikasi kuat tidak ada syntax error struktural, meski ini bukan pengganti build sungguhan.
- `public/god-panel.html`: tag `<div>` seimbang (51 buka / 51 tutup) setelah perubahan; blok `<script type="module">` diverifikasi sebagai JavaScript valid secara sintaksis (di-tes dengan parser JS setelah baris `import` dilepas, karena `import` butuh module context).

**BELUM bisa saya verifikasi (dan kenapa — jujur, bukan basa-basi):**
- **Saya tidak menjalankan `npm install` / `vite build` / aplikasi sungguhan di browser**, karena environment eksekusi saya **tidak punya akses jaringan** (tidak bisa `npm install` paket dari registry). Jadi saya tidak bisa memastikan 100% aplikasi hasil edit ini akan ter-build tanpa error atau berjalan mulus di browser — analisis di atas murni pembacaan & penelusuran source code secara manual + pengecekan sintaksis.
- Saya **tidak bisa menguji login tenant sungguhan** ke Firestore project `costlab-f221c` (tidak ada kredensial/akses ke project Firebase tersebut dari sisi saya) — jadi temuan soal `firestore.rules` didasarkan pada isi file rules yang diberikan, **bukan konfirmasi terhadap rules yang benar-benar ter-deploy di production** (bisa saja rules produksi sudah berbeda dari file ini — UNKNOWN, perlu Anda cek langsung di Firebase Console).
- Saya **tidak menemukan file test otomatis** (unit test/e2e) di project ini (`NOT FOUND` — tidak ada folder `__tests__`, tidak ada dependency testing di `package.json`), jadi tidak ada regression suite yang bisa saya jalankan. **REKOMENDASI**: sebelum menambahkan fitur besar (laporan profit, simulasi HPP), pertimbangkan menambahkan minimal beberapa test murni untuk fungsi kalkulasi (`calcRow`, `computeOrderTotals`, `getTier`) karena fungsi-fungsi ini pure function (tidak bergantung DOM/state), murah untuk ditest, dan risikonya tinggi kalau salah (langsung memengaruhi uang).
- Perilaku tombol checkout terhadap double-click (§3) — **belum saya verifikasi** posisi pasti `disabled={isLoading}` di JSX tombolnya; saya tandai sebagai INFERENSI, bukan fakta pasti.

**Kesimpulan jujur:** Perubahan yang saya eksekusi di zip ini bersifat **konservatif dan aditif** — saya percaya diri (berdasarkan tinjauan manual, bukan test runtime) bahwa perubahan ini tidak merusak alur yang sudah ada, tapi saya **tidak bisa memberi jaminan 100%** tanpa Anda menjalankan `npm install && npm run dev` sendiri dan mencoba alur: buat resep baru → checkout produk itu di kasir → cek stok bahan baku berkurang → batalkan pesanan → cek stok bahan baku kembali. Itu adalah skenario uji manual paling penting untuk memvalidasi fix #1–#3 di atas.

---

## 9. RINGKASAN PRIORITAS (untuk dibaca cepat)

| Prioritas | Temuan | Status |
|---|---|---|
| 🔴 P0 — perlu keputusan Anda | Password/PIN tenant bisa dibaca publik lewat Firestore (§5) | **Belum diperbaiki** — butuh Cloud Function/backend, di luar cakupan patch aman |
| 🔴 P0 | Tidak ada historical cost snapshot per transaksi (§2, §6) | **Belum diperbaiki** — rekomendasi konkret sudah diberikan |
| 🟠 P1 | Stok bahan baku tidak balik saat cancel/edit order (§3, §4) | ✅ **Sudah diperbaiki** |
| 🟠 P1 | Resep↔produk cocok berdasar nama, bukan ID (§4) | ✅ **Sudah diperbaiki (sisi produk)**, bahan baku masih pending |
| 🟠 P1 | `god-panel.html` tanpa login & API key invalid (§5) | ✅ **Login gate ditambahkan**; API key masih perlu diisi manual oleh Anda |
| 🟡 P2 | Tidak ada konversi satuan di HPP (§2) | Rekomendasi saja — perlu keputusan UX |
| 🟡 P2 | Tidak ada fitur refund/void transaksi paid (§3) | Rekomendasi saja |
| 🟡 P2 | Laporan hanya omzet, tidak ada profit/margin (§6) | Peluang produk terbesar — rekomendasi konkret diberikan |
| 🟢 P3 | Arsitektur client-only (localStorage) membatasi multi-outlet/multi-device sungguhan (§1) | Perlu keputusan strategis: tetap local-first, atau migrasi ke backend bersama |
