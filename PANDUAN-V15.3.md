# WELP v15.3 — Perbaikan Layout, QRIS, Slip Gaji & Bug Harian

Tanggal: 27 September 2026
Versi sebelumnya: v15.2 (keamanan). v15.3 berfokus ke UI/UX, bug harian, dan kualitas tampilan.
Tidak ada perubahan aturan Firestore atau langkah Firebase Console di versi ini. Cukup deploy.

---

## 1. Apa yang berubah di v15.3

### A. Simbol dan gaya bahasa
- Semua tanda pisah panjang (—/–) dan titik-tengah (·) di teks aplikasi dibersihkan
  atau ditulis ulang jadi kalimat natural. Label brand seperti "WELP v15.1 · Fresh Ink"
  diganti bentuk sederhana (WELP v15.3).
- Kalimat-kalimat kaku/toast panjang ditulis ulang supaya enak dibaca.

### B. ID profesional (format baru, ID lama tetap sah)
- Karyawan: PST-001/KMG-001 -> EMP-TAHUN-NOMOR, contoh: EMP-2025-0001
  (dibuat otomatis saat tambah karyawan; karyawan lama TIDAK diubah).
- Station kasir: POS-001 -> STN-TAHUN-NOMOR, contoh: STN-2025-01
  (station lama tetap bisa login dengan kode lamanya).
- Nomor slip gaji: SG-YYMM-XXXXXX (contoh SG-2509-A1B2C3) gaya dokumen resmi.

### C. Layout & responsive (PC / tablet / HP)
- Perbaikan induk: input tanggal/jam bawaan browser di HP punya lebar minimum yang
  tidak mau menyusut; sekarang dipaksa mengikuti kolomnya (index.css).
  Ini yang membuat card "Jam Masuk" dan pilihan tanggal cuti meluber.
- Tombol jenis pengajuan (Sakit/Izin Pribadi/Cuti/Kebutuhan Lain) jadi 2 kolom di HP,
  4 kolom mulai tablet — label panjang tidak lagi terpotong/meluber.
- Kelas ukuran w-5.5/h-5.5 kini benar-benar ter-generate di CSS (sebelumnya tidak
  menghasilkan style apa pun sehingga ikon bisa melebar sendiri).

### D. Bug absen "mengirim" terus
Penyebab: (1) Nominatim pencari alamat tanpa batas waktu, (2) retry bawaan Firebase
Storage bisa sampai 10 menit saat jaringan buruk.
Perbaikan:
- Pencari alamat dibatasi 6 detik, upload foto dibatasi 25 detik.
- Tombol kini menampilkan tahapan: "Mencari alamat lokasi...", "Mengunggah foto
  selfie...", "Menyimpan absen..." — dan SELALU kembali normal walau gagal.
- Gagal upload foto tidak memblokir absen: foto tetap tersimpan inline (mekanisme lama).

### E. QRIS: otomatis baca & otomatis dinamis
- Upload foto QRIS: pembacaan QR diperkuat (multi skala + penguatan kontras), dicoba
  dulu dari gambar asli sebelum crop. Jika tetap gagal, kolom tempel string otomatis
  terbuka dan fokus.
- Tempel string QRIS sekarang OTOMATIS tersimpan tanpa perlu klik Simpan; spasi/baris
  baru yang ikut tersalin dibersihkan sendiri (sering jadi penyebab CRC gagal).
- QR (QRIS checkout, QR meja, QR validasi pesanan, QR slip) dibuat LOKAL di perangkat.
  Tidak lagi bergantung ke layanan quickchart.io yang bisa lambat/mati, dan data
  QRIS/struk tidak lagi dikirim ke server pihak ketiga.
- QR meja bisa diunduh langsung sebagai PNG.

### F. Slip gaji premium + watermark logo gambar
- Desain baru: band warna brand, blok nominal gelap dengan angka besar, garis
  rincian halus, area tanda tangan, catatan keabsahan dokumen.
- Logo perusahaan (diatur di Manajemen Perusahaan / Custom Aplikasi) kini muncul
  sebagai WATERMARK GAMBAR besar di tengah slip (bukan teks), selain logo di header.
- Nomor slip gaya resmi + QR verifikasi lokal.

---

## 2. Cara deploy (5 menit)

1. Ekstrak tungitung-main-WELP-v15.3.zip (file .env sudah di dalamnya).
2. Deploy ke Netlify seperti biasa:
   - Drag & drop folder hasil build, ATAU
   - Push ke repo Git yang terhubung Netlify (build otomatis: npm run build).
3. Selesai. Tidak perlu mengubah apa pun di Firebase Console untuk versi ini.

Catatan: netlify.toml dari v15.2 (security headers) tetap dipakai — jangan dihapus.

## 3. Yang perlu dicek setelah deploy (checklist)

1. HP: buka Manajemen Cabang -> card Aturan Absensi -> input Jam Masuk harus di dalam
   batas kartu.
2. HP: Aplikasi Karyawan -> Ajukan -> pilih tanggal mulai/sampai: tidak meluber.
3. Absen dengan foto: tombol berpindah tahap, tidak mentok "Mengirim...".
4. Pengaturan -> Metode Pembayaran: upload foto QRIS (harus terbaca otomatis) ATAU
   tempel string (langsung aktif). Lalu checkout QRIS di Kasir: QR bertanda DINAMIS
   dengan nominal terisi.
5. Penggajian -> Cetak Slip Gaji: desain baru + watermark logo muncul jika logo
   perusahaan sudah diatur.
6. Tambah karyawan baru: ID otomatis EMP-2026-xxxx. Buat station baru: STN-2026-xx.

## 4. Rollback

Jika ada kendala, deploy ulang zip v15.2 (build lama) — struktur data tidak berubah,
jadi aman bolak-balik.
