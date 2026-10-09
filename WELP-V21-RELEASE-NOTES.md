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
