# WELP v16 Commercial Hardening

## Yang diperketat di release ini

- Absensi tidak lagi menerima foto dari galeri. Capture wajib berasal dari kamera WELP.
- Capture melakukan pemeriksaan perubahan frame sederhana untuk menolak media statis yang ditempel ke kamera. Ini **bukan** liveness/deepfake detector enterprise.
- GPS wajib tersedia untuk attendance terverifikasi.
- GPS dengan akurasi >100 m ditolak.
- Absensi di luar radius cabang ditolak.
- Evidence absensi memiliki `captureId`, SHA-256 `photoHash`, `evidenceVersion`, `captureMode`, dan status verifikasi.
- Attendance ditulis dengan `serverTimestamp()` dan record client tidak boleh di-update/delete melalui Firestore Rules.
- Storage untuk evidence absensi hanya menerima image <=2 MB dan tidak dapat dihapus oleh client.
- Permissions Policy diperbaiki agar geolocation browser benar-benar diizinkan di domain WELP.
- CSP mengizinkan reverse geocoding Nominatim yang memang digunakan source v15.3.

## Batasan penting

Release ini belum membuat WELP menjadi anti-fraud 100%. Browser GPS masih merupakan sinyal dari device dan belum merupakan device attestation.

Untuk tingkat komersial/enterprise berikutnya, attendance harus dipindahkan ke backend callable/HTTP endpoint dengan custom claims atau session token server-side, lalu ditambah device attestation dan liveness/face verification yang benar. Jangan menyebut fitur saat ini sebagai jaminan anti-fake-GPS atau anti-AI absolut.

## Deployment

1. Deploy `firestore.rules` dan `storage.rules`.
2. Deploy source dengan `npm run build`.
3. Pastikan Authorized Domains Firebase sesuai domain produksi.
4. Aktifkan App Check setelah site key reCAPTCHA tersedia dan diuji.
5. Sebelum mengaktifkan enforcement App Check, uji login, POS, QR, storage, dan attendance di device nyata.
