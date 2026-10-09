# WELP v16.2 - Attendance & Commercial Fixes

## Perbaikan
- Reverse geocoding lokasi sekarang menyimpan komponen terstruktur: jalan, nomor, kelurahan, kecamatan, kota/kabupaten, provinsi, kode pos.
- Nama lokasi ditampilkan di layar absensi dan ikut dicetak pada bukti foto bila tersedia.
- Employee ID ditampilkan di sesi karyawan dan watermark foto. Karyawan lama tanpa ID mendapat ID `EMP-TAHUN-NOMOR` saat login.
- Alur submit absensi tidak lagi melakukan reverse-geocoding ulang yang berpotensi membuat tombol terasa menggantung. Alamat dipersiapkan sejak GPS didapat dan submit memiliki fallback timeout.
- Upload media tetap memiliki batas waktu. Jika Storage tidak tersedia, aplikasi hanya boleh menyimpan fallback bila ukuran bukti aman; kegagalan akan ditampilkan sebagai error, bukan spinner tanpa akhir.
- Server timestamp tetap menjadi waktu authoritative.

## Password/PIN
Password dan PIN **tetap harus disimpan sebagai hash**. Hash satu arah adalah mekanisme yang benar untuk password/PIN karena aplikasi tidak perlu membaca kembali rahasia asli. Jangan mengubahnya menjadi plaintext untuk produksi. Jika sebuah fitur membutuhkan "lihat PIN", gunakan reset PIN atau verifikasi ulang, bukan menampilkan PIN lama.

## Catatan komersial
Build ini memperbaiki UX dan hardening client-side. Untuk produksi skala besar, attendance write authorization tetap idealnya dipindahkan ke backend/Cloud Functions dengan custom claims, device attestation, dan liveness verification. Public Nominatim juga sebaiknya diganti provider geocoding ber-SLA/API key untuk volume komersial.
