# PANDUAN KEAMANAN WELP v15.2
### Hardening anti-hacker — yang berubah, kenapa, dan langkah kamu di Firebase Console
> Disusun dengan standar keamanan kelas enterprise. Ikuti urutan langkah PERSIS seperti di bawah — urutannya dirancang agar aplikasi tidak pernah mati satu detik pun.

---

## 1. APA YANG BERUBAH DI v15.2 (dan kenapa)

| # | Perubahan | Menutup celah apa |
|---|-----------|-------------------|
| 1 | **Firestore Rules v15.2**: `licenses` tidak bisa di-**list** oleh sesi anonim (hanya dev) | Bot/hacker tidak bisa lagi **mendaftar semua ID tenant** untuk dipetakan (anti-enumerasi) |
| 2 | **`licenses` tidak bisa di-`create` oleh sesi anonim** (hanya dev) | Anti-squatting: orang luar tidak bisa membuat/memalsukan lisensi |
| 3 | **`licenses` tidak bisa di-`update` oleh sesi anonim** — KECUALI satu pengecualian sangat sempit: auto-upgrade kredensial plaintext lama → hash (hanya field `credPass+password` / `credPin+ownerPin`, hanya bila hash masih kosong, hash wajib 64-hex & salt 32-hex) | **Kill chain takeover MATI**: sebelumnya hacker bisa menimpa hash password tenant mana pun dengan hash miliknya → login sebagai tenant. Sekarang field yang sudah ter-hash **tidak akan pernah bisa disentuh** sesi anonim |
| 4 | **PBKDF2 naik 60.000 → 310.000 iterasi** | Offline brute-force jadi ±5× lebih mahal. Kompatibel 100%: hash lama tetap sah (iterasi tersimpan per-kredensial) |
| 5 | **App Check (reCAPTCHA v3)** terpasang di kode — aktif otomatis begitu site key diisi | Script/bot yang memanggil API Firebase **langsung tanpa app asli** akan ditolak di level platform (setelah kamu menekan tombol Enforce) |
| 6 | **Security headers di Netlify** (CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) | Injeksi script pihak ketiga diblokir browser; anti-clickjacking; kamera hanya untuk app (fitur scan QR tetap jalan) |
| 7 | **Generator kredensial dev panel** pakai `crypto.getRandomValues` (bukan Math.random yang bisa diprediksi), password acak 10 char | Kredensial yang di-generate tidak bisa diprediksi siapa pun |
| 8 | **Kebijakan kredensial registrasi**: PIN wajib 6 digit, password min. 8 char, ID tenant min. 3 char tanpa spasi | PIN 4 digit = 10.000 kombinasi = brute-force offline hitungan menit. PIN 6 digit + PBKDF2 310k = tidak praktis |

Yang **sengaja TIDAK diubah**: `tenants/{lic}/**` masih `signedIn()` — isolasi antar-tenant per-uid butuh Cloud Functions (custom claims) dan akan jadi milestone berikutnya. Pengerasan jalur ini untuk sementara ditutup oleh App Check (poin 5).

---

## 2. LANGKAH KAMU DI FIREBASE CONSOLE (urutan wajib!)

### LANGKAH 1 — Publish Firestore Rules v15.2
1. Buka https://console.firebase.google.com → pilih project **costlab-f221c**
2. Menu kiri: **Firestore Database** → tab **Rules**
3. Hapus seluruh isi, lalu copy-paste **seluruh isi file `FIRESTORE-RULES-welp-v15.2.rules`** (ada di dalam zip ini)
4. Klik **Publish**. Selesai — rules langsung aktif, aplikasi tidak terganggu.

**Kenapa aman?** Semua jalur yang dipakai aplikasi tetap terbuka: login (get lisensi), data tenant (read/write), logs. Yang ditutup hanya list/create/update lisensi oleh sesi anonim — dan app memang tidak pernah melakukannya (sudah diverifikasi ke seluruh kode).

### LANGKAH 2 — Deploy build baru ke Netlify
Deploy **WELP v15.2** ke Netlify seperti biasa (drag & drop folder, cara sama seperti sebelumnya). Build lama tetap kompatibel dengan rules baru — tapi deploy yang baru supaya PBKDF2 310k, generator baru, dan App Check aktif.

### LANGKAH 3 — Buat reCAPTCHA v3 site key (untuk App Check)
1. Buka https://console.cloud.google.com → pilih project **costlab-f221c**
2. Menu kiri (kotak pencarian): ketik **reCAPTCHA** → **reCAPTCHA Enterprise**... **STOP — pilih yang "reCAPTCHA" klasik (bukan Enterprise)**: cari menu **"reCAPTCHA"** di bawah kategori *Security*. (Kalau diminta enable API, enable.)
3. Klik **CREATE SITE KEY / Create**
   - Domain: isi **dua** baris:
     - `goodstuffs.netlify.app`
     - `localhost`
   - Type: **v3**
4. Setelah dibuat, catat **Site Key** (formatnya panjang, diawali `6L...`). Secret key TIDAK dipakai untuk web client — abaikan.

**Kirim Site Key ini ke saya di chat** → saya bake ke build final dan kirim ulang zip-nya. (Ini kunci PUBLIK — aman terekspos, sama seperti API key Firebase.)

### LANGKAH 4 — Daftarkan app di App Check (mode MONITORING dulu!)
1. Firebase Console → **App Check** (menu kiri) → **Apps** → pilih app Web kamu
2. Pilih **reCAPTCHA v3**, tempel Site Key dari Langkah 3 → **Save**
3. **JANGAN sentuh tombol "Enforce" apa pun dulu.** Biarkan App Check bekerja dalam mode **monitoring**: request yang tanpa attestation tetap lolos, tapi tercatat.

### LANGKAH 5 — Pantau 24–48 jam, BARU Enforce
1. Setelah build terbaru (dengan site key) ter-deploy dan dipakai normal 1–2 hari, buka **App Check → Metrics**
2. Kamu akan lihat persentase request **verified** mendekati 100% (sisa kecil = pengguna lama yang belum refresh halaman)
3. Kalau verified-nya tinggi dan tidak ada request legit yang tertolak:
   - **Firestore** → klik **Enforce** (di bagian App Check enforcement)
   - **Storage** → klik **Enforce**
4. Sejak detik ini: **script/bot tanpa browser asli = ditolak Firebase**. Ini pengerasan terbesar di v15.2.

⚠️ **PERINGATAN URUTAN**: jangan menekan **Enforce** sebelum build dengan Site Key ter-deploy. Build lama tidak mengirim token App Check → jika di-enforce duluan, SEMUA request user ditolak (app mati). Kalau sampai kejadian: balik ke App Check → matikan Enforce → selesai, langsung pulih.

### LANGKAH 6 — Upgrade tenant lama (yang masih plaintext)
1. Buka **?dev=panel** → daftar tenant: kolom kredensial menunjukkan **"ter-hash"** (aman) atau **"legacy plaintext"** (belum)
2. Untuk tenant legacy: minta owner **login satu kali dengan kredensial lamanya** → app otomatis meng-upgrade ke hash (310k) secara senyap
3. Alternatif tanpa menunggu owner: daftarkan ulang tenant dengan kredensial baru (tombol Acak), berikan kredensial baru ke owner
4. Target: semua baris **"ter-hash"** → window legacy tertutup total

### LANGKAH 7 — Kebersihan akun (5 menit, sering dilupakan)
1. **2FA akun Google** `shandikazaid@gmail.com`: https://myaccount.google.com/security → 2-Step Verification → aktifkan (pakai authenticator, bukan SMS)
2. **Billing alert**: https://console.cloud.google.com/billing → Budgets & alerts → buat budget (mis. Rp50.000/bulan, alert 50/90/100%) — pelindung dari serangan biaya
3. Cek **Authentication → Settings → Authorized domains**: hanya `goodstuffs.netlify.app` + `localhost` + domain Firebase bawaan. Hapus domain asing.

---

## 3. ROLLBACK (kalau ada yang aneh)

| Gejala | Obat |
|---|---|
| Setelah publish rules, tenant tidak bisa login / "ID tidak ditemukan" | Firestore → Rules → kembalikan isi **v15.1** → Publish (v15.1 ada di arsip/PANDUAN-DEPLOY). Lalu kabari saya |
| Setelah Enforce App Check, app mati | App Check → matikan Enforce → pulih instan |
| Font/tampilan berubah aneh setelah deploy v15.2 | Screenshot → kirim ke saya (kemungkinan CSP perlu whitelist tambahan — tidak mempengaruhi data) |

---

## 4. FAQ

**Q: Tenant lama masih bisa login?**
A: Bisa, 100%. Verifikasi membaca iterasi dari hash masing-masing tenant. Yang baru otomatis dibuat dengan 310k.

**Q: Kenapa login terasa sedikit lebih lama?**
A: PBKDF2 310.000 iterasi butuh ±0,3–1 detik di HP kentang. Itu TIDAK efisiensi buruk — itu justru tembok yang membuat brute-force offline tidak praktis. Hanya terasa saat menekan login/PIN.

**Q: App Check menghalangi user?**
A: Tidak. reCAPTCHA v3 itu invisible — tidak ada captcha yang diisi user. Skor risiko dihitung di belakang layar.

**Q: Kapan isolasi antar-tenant jadi absolut?**
A: Milestone berikutnya: Cloud Function login → custom claim per-tenant → rules `token.tenant == lic`. Butuh Firebase Blaze plan (bayar sesuai pakai — untuk skala WELP masih sangat murah). Kabari kalau mau dieksekusi.

---

## 5. CHECKLIST RINGKAS (centang satu-satu)

- [ ] 1. Rules v15.2 di-publish (Firestore → Rules)
- [ ] 2. Build v15.2 di-deploy ke Netlify
- [ ] 3. reCAPTCHA v3 site key dibuat → dikirim ke saya
- [ ] 4. App Check terdaftar (mode monitoring)
- [ ] 5. 24–48 jam → verified ±100% → **Enforce** Firestore + Storage
- [ ] 6. Tenant legacy di-upgrade (semua "ter-hash" di panel)
- [ ] 7. 2FA Google aktif + budget alert dibuat + authorized domains dicek
