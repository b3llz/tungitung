# Cara Mendaftarkan Tenant (Pengganti god-panel.html)

Ada 2 lapis yang sudah dipasang:

## 1) Developer Panel di dalam aplikasi (Opsi B) - DIREKOMENDASIKAN

Tidak ada lagi file HTML longgar yang bisa di-dorking. Panel sekarang jadi
halaman rahasia di dalam aplikasi yang WAJIB login developer (Firebase Auth).

### Cara akses
Buka aplikasimu lalu tambahkan `?dev=panel` di URL, contoh:

    https://domainmu.com/?dev=panel

Kamu akan diminta login email + password developer. Setelah masuk, kamu bisa:
- Registrasi tenant (nama toko, ID, password, owner PIN, durasi sewa, tipe BASIC/PRO)
- Lihat semua tenant, salin password/PIN
- Matikan / buka akses (suspend) tenant
- Hapus tenant

### Setup sekali saja (WAJIB)
1. Buka Firebase Console -> Authentication -> Sign-in method -> aktifkan "Email/Password".
2. Tab Users -> Add user -> buat akun developer kamu (mis. espokemon71@gmail.com + password kuat).
3. Pastikan email itu sama dengan yang ada di `firestore.rules` (fungsi isAdmin).

## 2) Firestore Security Rules (Opsi C) - WAJIB di-deploy

File `firestore.rules` mengunci database:
- Membuat/mengubah/menghapus tenant HANYA bisa oleh email developer (isAdmin).
- Melihat SELURUH daftar tenant (list) hanya developer -> mencegah orang men-dump semua data.
- Login tenant tetap jalan (boleh baca 1 dokumen by ID).
- Semua koleksi lain ditutup default.

### Cara deploy rules
Lewat Firebase Console (paling cepat):
  Firestore Database -> Rules -> tempel isi firestore.rules -> Publish

Atau lewat CLI:
  npm i -g firebase-tools
  firebase login
  firebase deploy --only firestore:rules

### GANTI email admin
Di `firestore.rules`, ubah daftar email pada fungsi isAdmin() sesuai akun developer kamu.

## Catatan keamanan penting (jujur)
- `firebaseConfig` di aplikasi frontend memang selalu terlihat publik. Itu normal.
  Keamanan asli ada di Security Rules di atas, BUKAN di menyembunyikan config.
- Kelemahan tersisa: password & owner PIN tenant masih bisa dibaca per-dokumen
  (allow get) oleh siapa pun yang tahu ID tenant, karena proses login dilakukan
  di sisi browser. Untuk produk komersial skala besar, langkah paling aman
  berikutnya adalah memindahkan proses login ke Cloud Functions (verifikasi
  password di server + kirim custom token), sehingga password tidak pernah
  bisa dibaca dari client sama sekali. Aku bisa bantu siapkan kalau kamu mau.
- Aktifkan juga Firebase App Check untuk mencegah pemakaian config dari luar app.

## File lama
`dev-tools/god-panel.html` masih ada sebagai cadangan, TAPI sudah TIDAK ikut
ter-deploy (di luar folder public). Jangan menaruhnya kembali ke `public/`.
