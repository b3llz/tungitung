// ============================================================
// TAB BISNIS & PENGATURAN v5 WELP — Multi Outlet, Hardware
// (printer thermal + scanner), Profil Toko, Metode Pembayaran,
// Pengaturan. Logika 100% dipertahankan (Web Bluetooth ESC/POS,
// BarcodeDetector, backup/restore tervalidasi, QR meja, dsb).
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Toko, Plus, Trash2, Layers, Omzet, Tim, LayarBuddy, JaringanBuddy,
  Alat, Pindai, KameraBuddy, X, BluetoothBuddy, WifiBuddy, Selesai, Qris, QrDinamis, Dompet,
  Bayar, Edit3, UnduhBuddy, UnggahBuddy, Languages, Stok, Lisensi, BahayaBuddy,
  ModeRetail, ModeFnb, Setelan, BadgeCheck, Check, UnggahQris, WaktuReal, KoinBuddy
} from './welp-icons.jsx';
import { safeParse, formatIDR, getLang, qrDataUrl, useQr, WALLET_TYPES, decodeQrFromImage, parseEmv, qrisMeta, verifyQrisCrc, makeTableToken, db, dbSet, dbSetDoc, useDbSync, hydrateDb, getBizConfig, stockTrackingOn, auditLog } from './core.jsx';
import { ingestPaymentEvent } from './welp-core/paymentOps.js';
import { MATCH_STATUS, MATCH_STATUS_META, PAYMENT_EVENT_SOURCES, PAYMENT_EVENT_SOURCE_META, collectIntents } from './welp-core/payment.js';
import { doc as fsDoc, setDoc as fsSetDoc } from 'firebase/firestore';
import { Button, Card, PageTitle, NumericInput, Select, Toggle, Badge, EmptyState, ImageCropperModal, ConfirmDialog } from './ui';

/* Multi Outlet pindah ke src/team.jsx (monitoring terpusat realtime) */

/* ================= ALAT TAMBAHAN (HARDWARE) ================= */
export const HardwareTab = ({ licenseInfo, triggerAlert, activeTab }) => {
  const isActive = activeTab === 'hardware';   // v15 F4-H6
  const [connType, setConnType] = useState('bluetooth');
  const [paperSize, setPaperSize] = useState(localStorage.getItem('printer_paper') || '58mm');
  const [printerChar, setPrinterChar] = useState(null);
  const [printerStatus, setPrinterStatus] = useState('disconnected');
  const [printerName, setPrinterName] = useState('');
  const [netIp, setNetIp] = useState(localStorage.getItem('printer_ip') || '');
  const [scanActive, setScanActive] = useState(false);
  const [scannedOrder, setScannedOrder] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const usbBufferRef = useRef('');
  const hasBT = typeof navigator !== 'undefined' && !!navigator.bluetooth;

  const escposReceipt = ({ title, lines, paper }) => {
    const enc = new TextEncoder();
    const width = paper === '80mm' ? 48 : 32;
    const out = [];
    const push = (arr) => arr.forEach(b => out.push(b));
    const text = (str) => push(Array.from(enc.encode(str)));
    push([0x1B, 0x40]);
    push([0x1B, 0x61, 0x01]);
    push([0x1B, 0x21, 0x30]); text((title || 'WELP') + '\n');
    push([0x1B, 0x21, 0x00]);
    text('-'.repeat(width) + '\n');
    push([0x1B, 0x61, 0x00]);
    (lines || []).forEach(l => text(l + '\n'));
    text('-'.repeat(width) + '\n');
    push([0x1B, 0x61, 0x01]); text('Terima kasih\n');
    push([0x0A, 0x0A, 0x0A]);
    push([0x1D, 0x56, 0x00]);
    return new Uint8Array(out);
  };

  const connectPrinter = async () => {
    if (!hasBT) { triggerAlert('Browser tidak mendukung Web Bluetooth. Gunakan Chrome di Android/Desktop.', 'error'); return; }
    try {
      setPrinterStatus('connecting');
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455'] });
      device.addEventListener('gattserverdisconnected', () => { setPrinterStatus('disconnected'); setPrinterChar(null); });
      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      let writeChar = null;
      for (const svc of services) {
        const chars = await svc.getCharacteristics();
        for (const c of chars) { if (c.properties.write || c.properties.writeWithoutResponse) { writeChar = c; break; } }
        if (writeChar) break;
      }
      if (!writeChar) throw new Error('Karakteristik tulis tidak ditemukan di printer');
      setPrinterChar(writeChar); setPrinterName(device.name || 'Bluetooth Printer'); setPrinterStatus('connected');
      triggerAlert('Printer terhubung: ' + (device.name || 'Bluetooth'), 'success');
    } catch (e) { setPrinterStatus('error'); triggerAlert('Gagal konek printer: ' + e.message, 'error'); }
  };

  const writeToPrinter = async (bytes) => {
    if (!printerChar) throw new Error('Printer belum terhubung');
    const CHUNK = 180;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.slice(i, i + CHUNK);
      if (printerChar.properties.writeWithoutResponse) await printerChar.writeValueWithoutResponse(slice);
      else await printerChar.writeValue(slice);
      await new Promise(r => setTimeout(r, 18));
    }
  };

  const testPrint = async () => {
    const profile = safeParse('store_profile', {});
    const bytes = escposReceipt({ title: profile.name || 'WELP', lines: ['TEST PRINT BERHASIL', 'Tanggal: ' + new Date().toLocaleString('id-ID'), 'Kertas: ' + paperSize, 'Printer siap dipakai.'], paper: paperSize });
    if (printerStatus === 'connected') {
      try { await writeToPrinter(bytes); triggerAlert('Struk test terkirim ke printer.', 'success'); }
      catch (e) { triggerAlert('Gagal print: ' + e.message, 'error'); }
    } else if (connType === 'wifi') {
      triggerAlert('Mode WiFi/LAN: kirim ke ' + (netIp || 'IP belum diisi') + ' (butuh print server lokal).', netIp ? 'success' : 'error');
    } else {
      triggerAlert('Printer belum terhubung. Membuka dialog cetak browser...', 'success');
      window.print();
    }
  };

  const handleScanValue = (val) => {
    stopScan();
    if (typeof val === 'string' && val.startsWith('CL-ORDER:')) {
      try { setScannedOrder(JSON.parse(val.slice(9))); }
      catch (e) { triggerAlert('QR pesanan tidak valid.', 'error'); }
    } else {
      triggerAlert('Kode terbaca: ' + val, 'success');
    }
  };

  const startScan = async () => {
    if (!('BarcodeDetector' in window)) { triggerAlert('Scanner kamera tidak didukung browser ini. Gunakan scanner USB (ketik lalu Enter).', 'error'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setScanActive(true);
      await new Promise(r => setTimeout(r, 60));
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'code_39', 'ean_8'] });
      const loop = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try { const codes = await detector.detect(videoRef.current); if (codes && codes.length) { handleScanValue(codes[0].rawValue); return; } } catch (e) { }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) { setScanActive(false); triggerAlert('Gagal akses kamera: ' + e.message, 'error'); }
  };

  const stopScan = () => {
    setScanActive(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const acceptScannedToPos = () => {
    if (!scannedOrder) return;
    const items = (scannedOrder.it || []).map(i => ({ name: i.n, qty: i.q, price: i.h, id: 'scan_' + Math.random().toString(36).slice(2) }));
    const newOrder = { id: 'ord_' + Date.now(), date: new Date().toISOString(), buyer: scannedOrder.b || ('Meja ' + scannedOrder.t), paymentMethod: scannedOrder.p || 'Tunai', items, subtotal: scannedOrder.tot, total: scannedOrder.tot, tableNo: scannedOrder.t, orderType: 'Dine-in', status: 'pending', notes: 'Validasi dari Self-Order (QR)' };
    const active = safeParse('active_orders_db', []);
    dbSet(licenseInfo?.id, 'active_orders_db', [newOrder, ...active]);   // v15 F1
    const rest = safeParse('self_orders_db', []).filter(o => o.tableNo !== scannedOrder.t);
    localStorage.setItem('self_orders_db', JSON.stringify(rest));
    triggerAlert('Pesanan Meja ' + scannedOrder.t + ' divalidasi & masuk ke Kasir (Pesanan).', 'success');
    setScannedOrder(null);
  };

  useEffect(() => {
    const onKey = (e) => {
      // v15 F4-H6: listener scanner USB hanya aktif saat tab Hardware terbuka
      // — tidak lagi menangkap ketikan+Enter di halaman lain (toast palsu).
      if (!isActive || scanActive) return;
      if (e.key === 'Enter') { if (usbBufferRef.current.length > 2) handleScanValue(usbBufferRef.current); usbBufferRef.current = ''; }
      else if (e.key && e.key.length === 1) usbBufferRef.current += e.key;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scanActive, isActive]);
  useEffect(() => () => stopScan(), []);

  const statusMap = {
    disconnected: ['Belum terhubung', 'bg-paper dark:bg-white/5 text-ink-faint'],
    connecting: ['Menghubungkan...', 'bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold'],
    connected: ['Terhubung', 'bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot'],
    error: ['Gagal / Error', 'bg-brick-soft dark:bg-brick/10 text-brick-deep dark:text-brick']
  };

  return (
    <div className="max-w-3xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Alat Tambahan" sub="Integrasi Perangkat Keras Nyata" />

      <Card title="Printer Kasir (Thermal)" icon={Alat}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${printerStatus === 'connected' ? 'bg-leaf animate-pulse-dot' : printerStatus === 'connecting' ? 'bg-gold animate-pulse-dot' : printerStatus === 'error' ? 'bg-brick' : 'bg-ink-faint/40'}`}></span>
              <span className="text-[13px] font-extrabold text-ink dark:text-ink-inv">{printerName || 'Printer Bluetooth'}</span>
            </div>
            <span className={`badge ${statusMap[printerStatus][1]}`}>{statusMap[printerStatus][0]}</span>
          </div>
          <div className="flex gap-1.5 p-1 bg-paper dark:bg-white/5 rounded-xl">
            <button onClick={() => setConnType('bluetooth')} className={`flex-1 py-2 text-xs font-extrabold rounded-lg flex justify-center gap-2 items-center transition ${connType === 'bluetooth' ? 'bg-surface dark:bg-surface-dark shadow-card text-flame-700 dark:text-apricot' : 'text-ink-faint'}`}><BluetoothBuddy className="w-3.5 h-3.5" /> Bluetooth</button>
            <button onClick={() => setConnType('wifi')} className={`flex-1 py-2 text-xs font-extrabold rounded-lg flex justify-center gap-2 items-center transition ${connType === 'wifi' ? 'bg-surface dark:bg-surface-dark shadow-card text-flame-700 dark:text-apricot' : 'text-ink-faint'}`}><WifiBuddy className="w-3.5 h-3.5" /> WiFi / LAN</button>
          </div>
          <div className="flex gap-3">
            <div className="flex-1"><Select label="Ukuran Kertas" value={paperSize} options={['58mm', '80mm']} onChange={(v) => { setPaperSize(v); localStorage.setItem('printer_paper', v); }} /></div>
            <div className="flex-1">
              <label className="kicker block mb-1.5 ml-0.5">{connType === 'bluetooth' ? 'Status' : 'Alamat IP Printer'}</label>
              {connType === 'wifi' ? (
                <input value={netIp} onChange={e => { setNetIp(e.target.value); localStorage.setItem('printer_ip', e.target.value); }} className="field" placeholder="192.168.1.50" />
              ) : (
                <div className="field text-ink-faint">{hasBT ? 'Web Bluetooth siap' : 'Tidak didukung'}</div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {connType === 'bluetooth' ? (
              printerStatus === 'connected'
                ? <Button className="flex-1 py-3" variant="secondary" onClick={() => { setPrinterChar(null); setPrinterStatus('disconnected'); triggerAlert('Printer diputus.', 'success'); }}>Putuskan</Button>
                : <Button className="flex-1 py-3" onClick={connectPrinter}>Hubungkan Printer</Button>
            ) : (
              <Button className="flex-1 py-3" onClick={() => triggerAlert(netIp ? ('Tersimpan: ' + netIp) : 'Isi IP printer dulu', netIp ? 'success' : 'error')}>Simpan IP</Button>
            )}
            <Button className="flex-1 py-3" variant="secondary" onClick={testPrint}>Test Print</Button>
          </div>
          <p className="text-[10px] text-ink-faint leading-relaxed font-semibold">Mendukung printer thermal ESC/POS via Web Bluetooth (Chrome Android/Desktop). Jika tidak terhubung, Test Print memakai dialog cetak browser sebagai cadangan.</p>
        </div>
      </Card>

      <Card title="Barcode / QR Scanner" icon={Pindai}>
        <div className="space-y-4">
          {scanActive ? (
            <div className="relative rounded-2xl overflow-hidden bg-chrome-deep aspect-video">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline></video>
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-apricot/80 rounded-2xl relative">
                  <div className="absolute left-0 right-0 h-0.5 bg-flame-400 shadow-[0_0_10px_#F4622E] animate-scanline"></div>
                </div>
              </div>
              <button onClick={stopScan} className="absolute top-3 right-3 bg-white/90 text-ink p-2 rounded-full shadow-card"><X className="w-4 h-4" /></button>
              <span className="absolute bottom-3 left-3 bg-chrome-deep/70 text-apricot text-[10px] font-extrabold px-3 py-1.5 rounded-full flex items-center gap-1.5"><span className="w-2 h-2 bg-flame-400 rounded-full animate-pulse-dot"></span> Memindai...</span>
            </div>
          ) : (
            <button onClick={startScan} className="w-full py-10 rounded-2xl border-2 border-dashed border-flame-200 dark:border-flame-800 bg-paper/60 dark:bg-white/[.03] flex flex-col items-center gap-2 hover:bg-flame-50 dark:hover:bg-flame-900/40 transition group press">
              <div className="w-14 h-14 rounded-2xl bg-flame-600 text-white flex items-center justify-center group-hover:scale-105 transition"><KameraBuddy className="w-6 h-6" /></div>
              <span className="font-extrabold text-sm text-ink dark:text-ink-inv">Buka Kamera Scanner</span>
              <span className="text-[10px] text-ink-faint">Scan QR validasi pelanggan atau barcode produk</span>
            </button>
          )}
          <div className="p-3.5 bg-paper dark:bg-white/[.03] rounded-xl border border-line dark:border-line-dark">
            <p className="text-[11px] font-extrabold text-ink dark:text-ink-inv flex items-center gap-2"><Pindai className="w-4 h-4 text-flame-600 dark:text-apricot" /> Scanner USB / Bluetooth HID</p>
            <p className="text-[10px] text-ink-faint mt-1 font-semibold">Scanner fisik bekerja otomatis (mode keyboard). Arahkan ke barcode, hasil akan terbaca tanpa setting tambahan.</p>
          </div>
        </div>
      </Card>

      {scannedOrder && createPortal(
        <div className="fixed inset-0 z-[85] bg-chrome-deep/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setScannedOrder(null)}>
          <div className="bg-surface dark:bg-surface-dark rounded-3xl w-full max-w-sm shadow-pop overflow-hidden animate-pop" onClick={e => e.stopPropagation()}>
            <div className="bg-chrome-deep p-5 text-white text-center">
              <Selesai className="w-9 h-9 mx-auto mb-1 text-apricot" />
              <h3 className="font-extrabold text-lg">Pesanan Tervalidasi</h3>
              <p className="text-xs text-ink-inv/60">Meja {scannedOrder.t}, bayar {scannedOrder.p}</p>
            </div>
            <div className="p-5 space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
              {(scannedOrder.it || []).map((i, x) => (
                <div key={x} className="flex justify-between text-xs font-bold"><span className="text-ink-soft dark:text-ink-inv/70">{i.n} x{i.q}</span><span className="text-ink dark:text-ink-inv money">{formatIDR(i.h * i.q)}</span></div>
              ))}
            </div>
            <div className="px-5 pb-3 flex justify-between items-center border-t border-line/70 dark:border-line-dark/70 pt-3">
              <span className="font-extrabold text-ink-faint text-sm">Total</span>
              <span className="font-extrabold text-xl text-flame-700 dark:text-apricot money">{formatIDR(scannedOrder.tot)}</span>
            </div>
            <div className="p-4 flex gap-2">
              <button onClick={() => setScannedOrder(null)} className="flex-1 py-3 rounded-xl bg-paper dark:bg-white/5 text-ink-soft dark:text-ink-inv/70 font-extrabold text-sm press">Tutup</button>
              <button onClick={acceptScannedToPos} className="flex-1 py-3 rounded-xl bg-flame-600 hover:bg-flame-500 text-white font-extrabold text-sm press">Terima ke Kasir</button>
            </div>
          </div>
        </div>, document.body)}
    </div>
  );
};

/* ================= PROFIL TOKO ================= */
export const ProfileTab = ({ licenseInfo, triggerAlert, setEditingMode, activeTab }) => {
  const [profile, setProfile] = useState({ name: '', address: '', wa: '', logo: null, adminName: '', payment: { qris: null, ewallets: [], bank: [] } });
  const [cropSrc, setCropSrc] = useState(null);
  const [cropTarget, setCropTarget] = useState('');

  useEffect(() => {
    if (activeTab === 'profile' || !activeTab) {
      setProfile(safeParse('store_profile', {}));
    }
  }, [activeTab]);
  useDbSync(() => setProfile(safeParse('store_profile', {})));   // v15 F1 rebind

  useEffect(() => {
    if (cropSrc) setEditingMode(true);
    else setEditingMode(false);
  }, [cropSrc, setEditingMode]);

  const saveProfile = (newP) => {
    setProfile(newP);
    dbSetDoc(licenseInfo?.id, 'store_profile', newP);   // v15 F1: dokumen pengaturan/toko_profile
  };

  return (
    <div className="max-w-3xl mx-auto w-full pb-24">
      <PageTitle title="Profil Bisnis" sub="Identitas Resmi Toko & Kasir" />

      <Card title="Informasi Bisnis" icon={Toko}>
        <div className="space-y-6">
          <div className="flex justify-center pt-2">
            <div className="relative group cursor-pointer">
              <div className="w-32 h-32 bg-paper dark:bg-white/[.03] rounded-full border-4 border-line dark:border-line-dark shadow-card overflow-hidden flex items-center justify-center group-hover:border-flame-400 transition-colors">
                {profile.logo ? (
                  <img src={profile.logo} className="w-full h-full object-cover" alt="Logo Bisnis" />
                ) : (
                  <Toko className="w-12 h-12 text-ink-faint/40" />
                )}
              </div>
              <label className="absolute bottom-1 right-1 bg-flame-600 text-white p-2.5 rounded-full shadow-card hover:bg-flame-500 transition active:scale-90 border-4 border-surface dark:border-surface-dark cursor-pointer">
                <Edit3 className="w-4 h-4" />
                <input type="file" className="hidden" accept="image/*" onChange={e => {
                  if (e.target.files[0]) {
                    const r = new FileReader();
                    r.onload = v => { setCropSrc(v.target.result); setCropTarget('logo'); };
                    r.readAsDataURL(e.target.files[0]);
                  }
                }} />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="kicker block mb-1.5 ml-0.5">Nama Bisnis</label>
              <input className="field-lg" value={profile.name} onChange={e => saveProfile({ ...profile, name: e.target.value })} placeholder="Contoh : Kopi Senja" />
            </div>
            <div>
              <label className="kicker block mb-1.5 ml-0.5">Alamat Lengkap</label>
              <textarea className="field h-24 resize-none" value={profile.address} onChange={e => saveProfile({ ...profile, address: e.target.value })} placeholder="Alamat detail toko..." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="kicker block mb-1.5 ml-0.5">WhatsApp</label>
                <input className="field-lg" value={profile.wa} onChange={e => saveProfile({ ...profile, wa: e.target.value })} placeholder="08..." />
              </div>
              <div>
                <label className="kicker block mb-1.5 ml-0.5">Nama Owner / Kasir</label>
                <input className="field-lg" value={profile.adminName} onChange={e => saveProfile({ ...profile, adminName: e.target.value })} placeholder="Nama Anda" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {cropSrc && (
        <ImageCropperModal
          imageSrc={cropSrc}
          onCropComplete={(img) => {
            if (cropTarget === 'logo') saveProfile({ ...profile, logo: img });
            setCropSrc(null);
          }}
          onClose={() => setCropSrc(null)}
        />
      )}
    </div>
  );
};

/* ================= METODE PEMBAYARAN ================= */
// v15.3: QR meja di-generate lokal (data URL) dan bisa diunduh langsung
// sebagai PNG, tidak lagi membuka layanan QR pihak ketiga.
const TableQrCard = ({ n, link }) => {
  const qr = useQr(link, 512);
  return (
    <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-2xl p-3 flex flex-col items-center shadow-card">
      {qr ? <img alt={'QR Meja ' + n} src={qr} className="w-full aspect-square rounded-lg bg-white p-1" /> : <div className="w-full aspect-square rounded-lg bg-paper dark:bg-white/5 animate-pulse" />}
      <p className="font-extrabold text-sm text-ink dark:text-ink-inv mt-2">Meja {n}</p>
      {qr && <a href={qr} download={`QR-Meja-${n}.png`} className="mt-1 text-[10px] font-extrabold text-flame-700 dark:text-apricot flex items-center gap-1"><UnduhBuddy className="w-3 h-3" /> Unduh PNG</a>}
    </div>
  );
};

export const PaymentTab = ({ licenseInfo, triggerAlert, setEditingMode, activeTab }) => {
  const [profile, setProfile] = useState({ payment: { qris: null, ewallets: [], bank: [] } });
  const [newWallet, setNewWallet] = useState({ type: 'Gopay', number: '' });
  const [newBank, setNewBank] = useState({ bank: '', number: '' });
  const [cropSrc, setCropSrc] = useState(null);
  const [manualPayload, setManualPayload] = useState('');
  const [showPasteBox, setShowPasteBox] = useState(false);
  const pasteRef = useRef(null);

  // v15.3: simpan payload QRIS + bersihkan spasi/baris baru yang sering
  // ikut tersalin dari aplikasi bank (bisa merusak CRC).
  const applyPayload = (raw, { silent = false } = {}) => {
    const p = String(raw || '').replace(/\s+/g, '').trim();
    if (!p) return false;
    const m = parseEmv(p);
    if (!m['00'] || !m['01']) {
      if (!silent) triggerAlert('Payload tidak dikenali. Salin string QRIS yang utuh, biasanya berawalan 0002.', 'error');
      return false;
    }
    // CRC diverifikasi + metadata merchant tersimpan
    const meta = qrisMeta(p);
    saveProfile({ ...profile, payment: { ...profile.payment, qrisPayload: p, qrisMeta: meta } });
    setManualPayload('');
    if (!silent) {
      const nama = meta?.merchant || '-';
      triggerAlert(meta?.crcValid
        ? `QRIS Dinamis aktif. Merchant: ${nama}${meta.city ? ', ' + meta.city : ''}. Saat checkout, nominal tagihan terisi sendiri.`
        : 'QRIS Dinamis aktif, tapi CRC payload tidak cocok. Coba salin ulang string QRIS secara utuh.', meta?.crcValid ? 'success' : 'error');
    }
    return true;
  };

  const saveManualPayload = () => { applyPayload(manualPayload); };

  // v15.3: OTOMATIS SAAT TEMPEL. String yang valid langsung tersimpan
  // tanpa perlu menekan tombol Simpan, jadi QRIS dinamis aktif sendiri.
  const handlePayloadPaste = (e) => {
    const txt = (e.clipboardData || window.clipboardData)?.getData?.('text') || '';
    if (!txt) return;
    const p = txt.replace(/\s+/g, '');
    if (p.length >= 40 && /^\d+$/.test(p.slice(0, 10))) {
      e.preventDefault();
      const ok = applyPayload(p);
      if (!ok) setManualPayload(p.slice(0, 400));
    }
  };

  // v15.3: deteksi otomatis saat ketik manual: cukup lengkap + CRC valid = simpan sendiri
  const handlePayloadChange = (v) => {
    setManualPayload(v);
    const p = v.replace(/\s+/g, '');
    if (p.length >= 60 && p.endsWith('6304')) {
      try { if (verifyQrisCrc(p)) applyPayload(p, { silent: false }); } catch (_) { }
    }
  };

  // Setelah crop: simpan gambar QRIS + coba baca payload EMVCo otomatis.
  // v15.3: decode dicoba dulu dari gambar ASLI (sebelum crop) karena
  // hasil crop kadang mengecilkan modul QR; gagal baru dari hasil crop.
  const saveQrisImage = async (img) => {
    saveProfile({ ...profile, payment: { ...profile.payment, qris: img } });
    setCropSrc(null);
    let payload = null;
    try {
      const asal = cropSrc || img;
      payload = (await decodeQrFromImage(asal)) || (await decodeQrFromImage(img));
    } catch (e) { payload = null; }
    const m = payload ? parseEmv(payload) : null;
    if (m && m['00'] && m['01']) {
      const meta = qrisMeta(payload);
      saveProfile({ ...profile, payment: { ...profile.payment, qris: img, qrisPayload: payload, qrisMeta: meta } });
      const nama = meta?.merchant || '-';
      triggerAlert(meta?.crcValid
        ? `QRIS tersimpan dan CRC valid. Merchant: ${nama}${meta.city ? ', ' + meta.city : ''}. Nominal otomatis AKTIF.`
        : 'QRIS tersimpan dan terbaca, tapi CRC tidak cocok. Disarankan tempel ulang string payload yang utuh.', meta?.crcValid ? 'success' : 'error');
    } else {
      setShowPasteBox(true);
      triggerAlert('QRIS tersimpan. String payload tidak terbaca dari gambar. Tempel string QRIS di kolom yang terbuka agar nominal terisi otomatis.', 'error');
      setTimeout(() => { try { pasteRef.current?.focus(); } catch (_) { } }, 150);
    }
  };

  useEffect(() => {
    if (activeTab === 'payment' || !activeTab) {
      setProfile(safeParse('store_profile', {}));
    }
  }, [activeTab]);

  useEffect(() => {
    if (cropSrc) setEditingMode(true);
    else setEditingMode(false);
  }, [cropSrc, setEditingMode]);

  const saveProfile = (newP) => {
    setProfile(newP);
    dbSetDoc(licenseInfo?.id, 'store_profile', newP);   // v15 F1: dokumen pengaturan/toko_profile
  };

  const addWallet = () => {
    if (!newWallet.number) return triggerAlert("Nomor E-Wallet wajib diisi", "error");
    saveProfile({ ...profile, payment: { ...profile.payment, ewallets: [...(profile.payment?.ewallets || []), newWallet] } });
    setNewWallet({ type: 'Gopay', number: '' });
    triggerAlert("E-Wallet berhasil ditambahkan");
  };

  const addBank = () => {
    if (!newBank.number) return triggerAlert("Nomor Rekening wajib diisi", "error");
    saveProfile({ ...profile, payment: { ...profile.payment, bank: [...(profile.payment?.bank || []), newBank] } });
    setNewBank({ bank: '', number: '' });
    triggerAlert("Rekening Bank berhasil ditambahkan");
  };

  return (
    <div className="max-w-3xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Metode Pembayaran" sub="Kelola QRIS & Rekening Toko" />

      <Card title="QRIS Toko" icon={Qris}>
        <div className="w-full h-52 bg-paper dark:bg-white/[.03] rounded-2xl border-2 border-dashed border-line dark:border-line-dark flex items-center justify-center relative overflow-hidden group hover:border-flame-400 transition cursor-pointer">
          {profile.payment?.qris ? <img src={profile.payment.qris} className="w-full h-full object-contain p-4" /> : <div className="text-center text-ink-faint/60"><UnggahQris className="w-12 h-12 mx-auto mb-2" /><p className="text-xs font-extrabold">Upload QRIS</p></div>}
          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => { if (e.target.files[0]) { const r = new FileReader(); r.onload = v => setCropSrc(v.target.result); r.readAsDataURL(e.target.files[0]); } }} />
        </div>

        {/* QRIS DINAMIS — payload EMVCo dibaca dari gambar, nominal otomatis saat checkout */}
        <div className="mt-4 p-4 rounded-2xl border border-line dark:border-line-dark bg-paper dark:bg-white/[.03]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-2xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center shrink-0"><QrDinamis className="w-5.5 h-5.5" /></span>
              <div className="min-w-0">
                <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">QRIS Dinamis</p>
                <p className="text-[10px] text-ink-faint font-semibold leading-snug">{profile.payment?.qrisPayload ? 'Aktif. Saat checkout, QR otomatis berisi nominal tagihan dan pelanggan tinggal scan.' : 'Upload foto QRIS: payload dibaca otomatis, lalu nominal terisi sendiri saat pembayaran.'}</p>
              </div>
            </div>
            {profile.payment?.qrisPayload ? <Badge tone="green"><Check className="w-3 h-3" /> Aktif</Badge> : <Badge tone="grey">Belum</Badge>}
          </div>

          {(showPasteBox || !profile.payment?.qrisPayload) ? (
            <div className="mt-3 animate-fade-in">
              <label className="kicker block mb-1.5 ml-0.5">Tempel string QRIS (berawalan 0002, diambil dari app bank)</label>
              <div className="flex gap-2">
                <input ref={pasteRef} className="field flex-1 min-w-0 font-mono text-[11px]" placeholder="00020101021126610014COM..." onPaste={handlePayloadPaste}
                  value={manualPayload} onChange={e => handlePayloadChange(e.target.value)} />
                <button onClick={saveManualPayload} className="px-4 bg-flame-600 text-white rounded-xl hover:bg-flame-500 active:scale-95 transition press text-xs font-extrabold shrink-0">Simpan</button>
              </div>
              <p className="text-[9.5px] text-ink-faint font-semibold mt-2 leading-relaxed">Cukup tempel, string valid langsung aktif sendiri. Foto QRIS tetap dicoba dibaca otomatis dari gambarnya; kalau gagal, pakai cara tempel ini.</p>
            </div>
          ) : (
            <button onClick={() => setShowPasteBox(true)} className="mt-3 text-[10px] font-extrabold text-flame-700 dark:text-apricot hover:underline">Ganti string payload QRIS</button>
          )}
          {profile.payment?.qrisPayload && (
            <button onClick={() => { saveProfile({ ...profile, payment: { ...profile.payment, qrisPayload: null } }); triggerAlert('QRIS Dinamis dimatikan. Pembayaran kembali ke QR statis tanpa nominal.', 'success'); }}
              className="mt-3 ml-3 text-[10px] font-extrabold text-brick hover:underline">Matikan & hapus payload</button>
          )}
        </div>
      </Card>

      <Card title="Rekening & E-Wallet">
        <div className="space-y-6">
          <div className="bg-paper dark:bg-white/[.03] p-4 rounded-2xl border border-line dark:border-line-dark">
            <label className="kicker text-flame-700 dark:text-apricot mb-3 block">Tambah E-Wallet</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="w-full sm:w-32 shrink-0"><Select value={newWallet.type} options={WALLET_TYPES} onChange={v => setNewWallet({ ...newWallet, type: v })} /></div>
              <div className="flex gap-2 w-full">
                <input className="field flex-1 min-w-0" placeholder="0812..." value={newWallet.number} onChange={e => setNewWallet({ ...newWallet, number: e.target.value })} />
                <button onClick={addWallet} className="px-4 bg-flame-600 text-white rounded-xl hover:bg-flame-500 active:scale-95 transition press"><Plus className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {(profile.payment?.ewallets || []).map((w, i) => (
                <div key={i} className="flex items-center gap-2 bg-surface dark:bg-surface-dark pl-2.5 pr-1.5 py-1.5 rounded-lg border border-line dark:border-line-dark shadow-card animate-pop">
                  <Badge tone="green">{w.type}</Badge>
                  <span className="text-xs font-extrabold text-ink-soft dark:text-ink-inv/70 money">{w.number}</span>
                  <button onClick={() => saveProfile({ ...profile, payment: { ...profile.payment, ewallets: profile.payment.ewallets.filter((_, x) => x !== i) } })} className="p-1 hover:bg-brick-soft dark:hover:bg-brick/10 rounded text-ink-faint hover:text-brick transition"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-paper dark:bg-white/[.03] p-4 rounded-2xl border border-line dark:border-line-dark">
            <label className="kicker text-gold-deep dark:text-gold mb-3 block">Tambah Rekening Bank</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input className="w-full sm:w-28 field uppercase placeholder:normal-case" placeholder="Bank (BCA)" value={newBank.bank} onChange={e => setNewBank({ ...newBank, bank: e.target.value })} />
              <div className="flex gap-2 w-full">
                <input className="field flex-1 min-w-0" placeholder="No. Rekening" value={newBank.number} onChange={e => setNewBank({ ...newBank, number: e.target.value })} />
                <button onClick={addBank} className="px-4 bg-gold text-white rounded-xl hover:brightness-105 active:scale-95 transition press"><Plus className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {(profile.payment?.bank || []).map((b, i) => (
                <div key={i} className="flex items-center gap-2 bg-surface dark:bg-surface-dark pl-2.5 pr-1.5 py-1.5 rounded-lg border border-line dark:border-line-dark shadow-card animate-pop">
                  <Badge tone="gold">{b.bank}</Badge>
                  <span className="text-xs font-extrabold text-ink-soft dark:text-ink-inv/70 money">{b.number}</span>
                  <button onClick={() => saveProfile({ ...profile, payment: { ...profile.payment, bank: profile.payment.bank.filter((_, x) => x !== i) } })} className="p-1 hover:bg-brick-soft dark:hover:bg-brick/10 rounded text-ink-faint hover:text-brick transition"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* ===== v21: BIAYA & SETTLEMENT PER METODE (integration boundary) ===== */}
      <Card title="Biaya & Settlement per Metode" icon={KoinBuddy}>
        <div className="space-y-3">
          <p className="text-[10.5px] text-ink-faint font-semibold leading-relaxed">
            Isi MDR/fee tiap metode agar workspace <b>Keuangan</b> bisa menghitung dana bersih yang masuk rekening (gross − fee − refund = net).
            Setor tunai diakhiri menutup shift; dana QRIS/e-wallet/bank dikonfirmasi lewat tab Keuangan memakai nomor referensi provider.
          </p>
          {[
            { key: 'QRIS', label: 'QRIS' },
            ...(profile.payment?.ewallets || []).map(w => ({ key: w.type, label: w.type })),
            ...(profile.payment?.bank || []).map(b => ({ key: b.bank, label: `Bank ${b.bank}` })),
          ].map(m => {
            const cfg = profile.payment?.methods?.[m.key] || {};
            const setCfg = (patch) => saveProfile({
              ...profile,
              payment: { ...profile.payment, methods: { ...(profile.payment?.methods || {}), [m.key]: { ...cfg, ...patch } } },
            });
            return (
              <div key={m.key} className="p-3.5 rounded-2xl border border-line dark:border-line-dark bg-paper dark:bg-white/[.03]">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="font-extrabold text-[12px] text-ink dark:text-ink-inv">{m.label}</p>
                  {(cfg.feePercent || cfg.feeFixed) ? <Badge tone="green"><Check className="w-3 h-3" /> Fee diatur</Badge> : <Badge tone="grey">Tanpa fee</Badge>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <NumericInput label="MDR / Fee (%)" suffix="%" value={cfg.feePercent || 0} onChange={v => setCfg({ feePercent: v })} />
                  <NumericInput label="Fee Tetap (Rp)" prefix="Rp" value={cfg.feeFixed || 0} onChange={v => setCfg({ feeFixed: v })} />
                  <div>
                    <label className="kicker block mb-1.5 ml-0.5">Rekening Tujuan</label>
                    <input className="field" placeholder="BCA 1234567890" value={cfg.account || ''} onChange={e => setCfg({ account: e.target.value })} />
                  </div>
                </div>
              </div>
            );
          })}
          {(profile.payment?.ewallets || []).length === 0 && (profile.payment?.bank || []).length === 0 && (
            <p className="text-[10.5px] font-bold text-ink-faint">Tambahkan e-wallet / rekening bank di atas untuk mengatur fee metodenya. QRIS selalu tersedia.</p>
          )}
        </div>
      </Card>

      {/* v21.1 — WELP PAYMENT CORE LAB: simulator event + intent + ledger */}
      <PaymentLab licenseInfo={licenseInfo} triggerAlert={triggerAlert} />

      {cropSrc && (
        <ImageCropperModal
          imageSrc={cropSrc}
          onCropComplete={(img) => saveQrisImage(img)}
          onClose={() => setCropSrc(null)}
        />
      )}
    </div>
  );
};



/* ================= PAYMENT LAB (v21.1, spec #25 & #28–31) =================
   Simulator event pembayaran utk fase PWA — menguji arsitektur Payment
   Core TANPA native capability: Order → QR → Simulated Event →
   Internal Webhook → Matching → PAID / AMBIGUOUS. Semua hasil
   ter-audit di ledger payment_events. BUKAN integrasi pembayaran nyata. */
const PaymentLab = ({ licenseInfo, triggerAlert }) => {
  const [, force] = useState(0);
  const [targetRef, setTargetRef] = useState('');
  const [amount, setAmount] = useState(0);
  const [source, setSource] = useState(PAYMENT_EVENT_SOURCES.PWA_SIMULATOR);
  const [rawText, setRawText] = useState('');
  const [lastResult, setLastResult] = useState(null);

  const events = safeParse('payment_event_db', []);
  const orders = [...safeParse('active_orders_db', []), ...safeParse('pos_history_db', [])];
  const intents = collectIntents(orders).filter(i => i.status === 'PENDING' && i.method !== 'Cash');
  const pendingAmbiguous = events.filter(e => e.matchStatus === MATCH_STATUS.AMBIGUOUS);
  const actor = licenseInfo?.employeeName || licenseInfo?.tenant || 'owner';

  const fire = () => {
    const intent = intents.find(i => i.paymentReference === targetRef);
    const amt = Number(amount) || (intent ? intent.amount : 0);
    if (!amt) return triggerAlert('Pilih intent / isi nominal dulu.', 'error');
    const rawEvent = {
      eventId: 'evt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      source, amount: amt, method: intent?.method || 'QRIS',
      reference: intent ? intent.paymentReference : (targetRef || null),
      providerRef: null, timestamp: Date.now(),
      rawText: source === PAYMENT_EVENT_SOURCES.ANDROID_NOTIFICATION_BRIDGE ? (rawText || null) : null,
      device: 'payment-lab', note: 'Payment Lab (PWA)',
    };
    const res = ingestPaymentEvent({
      tenantId: licenseInfo?.id, rawEvent, orders,
      actor, actorRole: licenseInfo?.currentUserRole || 'owner', licenseInfo,
    });
    setLastResult(res);
    force(v => v + 1);
    const tone = (res.status === MATCH_STATUS.CONFIRMED || res.status === MATCH_STATUS.DUPLICATE) ? 'success' : 'error';
    triggerAlert(`Event ${res.status}: ${MATCH_STATUS_META[res.status]?.label || ''}${res.reason ? ' — ' + res.reason : ''}`, tone);
  };

  const toneCls = (st) => st === MATCH_STATUS.CONFIRMED ? 'bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf'
    : st === MATCH_STATUS.AMBIGUOUS ? 'bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold'
      : st === MATCH_STATUS.DUPLICATE ? 'bg-paper dark:bg-white/5 text-ink-faint'
        : 'bg-brick-soft dark:bg-brick/10 text-brick-deep dark:text-brick';

  return (
    <Card title="Payment Lab — Simulator Event (Testing)" icon={Qris}
      help="Fase PWA TIDAK bisa membaca notifikasi Android — itu tugas Native Notification Bridge nanti. Di sini arsitektur diuji: event → webhook internal → matching → keputusan. Nominal sama TIDAK pernah auto-confirm.">
      <div className="space-y-4">
        <div>
          <p className="kicker mb-1.5">PaymentIntent Aktif (menunggu bayar)</p>
          {intents.length === 0 ? (
            <p className="text-[11px] font-bold text-ink-faint p-3 rounded-xl border border-dashed border-line dark:border-line-dark">Belum ada intent. Buat transaksi QRIS di Kasir (pilih QRIS lalu BAYAR), kembali ke sini untuk mensimulasikan pembayarannya.</p>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
              {intents.map(i => (
                <button key={i.paymentReference} onClick={() => { setTargetRef(i.paymentReference); setAmount(i.amount); }}
                  className={`w-full flex justify-between items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition press ${targetRef === i.paymentReference ? 'border-flame-500 bg-flame-50 dark:bg-flame-900/20' : 'border-line dark:border-line-dark hover:border-flame-300'}`}>
                  <span className="min-w-0">
                    <span className="block text-[10.5px] font-mono font-extrabold text-ink dark:text-ink-inv truncate">{i.paymentReference}</span>
                    <span className="block text-[9px] font-bold text-ink-faint">order #{String(i.orderId).slice(-5)} · {i.branchId || 'PUSAT'}{i.expiresAt ? ` · exp ${Math.max(0, Math.round((i.expiresAt - Date.now()) / 60000))}m` : ''}</span>
                  </span>
                  <span className="font-extrabold text-[11.5px] money text-ink dark:text-ink-inv shrink-0">{formatIDR(i.amount)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Sumber Event (PaymentEventSource)" value={source === PAYMENT_EVENT_SOURCES.PWA_SIMULATOR ? 'Simulator PWA' : source === PAYMENT_EVENT_SOURCES.ANDROID_NOTIFICATION_BRIDGE ? 'Notification Bridge (Android)' : 'Provider Webhook'}
            options={['Simulator PWA', 'Notification Bridge (Android)', 'Provider Webhook']}
            onChange={v => setSource(v === 'Simulator PWA' ? PAYMENT_EVENT_SOURCES.PWA_SIMULATOR : v === 'Notification Bridge (Android)' ? PAYMENT_EVENT_SOURCES.ANDROID_NOTIFICATION_BRIDGE : PAYMENT_EVENT_SOURCES.PROVIDER_WEBHOOK)} />
          <NumericInput label="Nominal Dana Masuk" value={amount} onChange={setAmount} prefix="Rp" />
        </div>
        {source === PAYMENT_EVENT_SOURCES.ANDROID_NOTIFICATION_BRIDGE && (
          <div>
            <label className="kicker block mb-1.5">Teks Notifikasi Mentah (simulasi bridge)</label>
            <textarea className="field" rows={2} placeholder="Contoh: QRIS debit Rp25.000. Ref WELP-XXXX..." value={rawText} onChange={e => setRawText(e.target.value)} />
            <p className="text-[9.5px] font-bold text-ink-faint mt-1">Bridge native nanti membaca notifikasi perangkat lalu mengirim event ke webhook WELP — bukan webhook jaringan.</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={fire} disabled={!intents.length} icon={Qris}>Kirim Event ke Webhook WELP</Button>
          <Button variant="secondary" onClick={() => { setTargetRef(''); setAmount(0); setRawText(''); setLastResult(null); }}>Reset</Button>
        </div>

        {lastResult && (
          <div className={`p-3.5 rounded-2xl border ${toneCls(lastResult.status)} animate-pop`}>
            <p className="font-extrabold text-[12.5px]">Hasil: {MATCH_STATUS_META[lastResult.status]?.label || lastResult.status}</p>
            <p className="text-[10.5px] font-bold opacity-80 mt-0.5">{lastResult.reason || ''}</p>
            {lastResult.status === MATCH_STATUS.AMBIGUOUS && <p className="text-[10px] font-bold mt-1">→ Review manual tersedia di Keuangan → Pembayaran (permission payment.confirm).</p>}
          </div>
        )}

        <div>
          <p className="kicker mb-1.5">Ledger Event Pembayaran ({events.length}){pendingAmbiguous.length > 0 && <span className="ml-2 text-gold-deep dark:text-gold">· {pendingAmbiguous.length} ambigu</span>}</p>
          {!events.length ? (
            <p className="text-[11px] font-bold text-ink-faint p-3 rounded-xl border border-dashed border-line dark:border-line-dark">Belum ada event. Semua event (simulator, bridge, provider) tampil di sini sebagai ledger append-only.</p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
              {events.slice(0, 14).map(e => (
                <div key={e.eventId} className="flex justify-between items-center gap-2 px-3 py-2 rounded-xl bg-paper dark:bg-white/[.03] border border-line/70 dark:border-line-dark/70">
                  <span className="min-w-0">
                    <span className="block text-[10px] font-mono font-bold text-ink dark:text-ink-inv truncate">{e.eventId}</span>
                    <span className="block text-[9px] font-bold text-ink-faint truncate">{PAYMENT_EVENT_SOURCE_META[e.source]?.label || e.source} · {e.reference || e.providerRef || 'tanpa ref'} · {new Date(e.timestamp || e.processedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-[10.5px] font-extrabold money text-ink dark:text-ink-inv">{formatIDR(e.amount)}</span>
                    <span className={`text-[8.5px] font-extrabold px-2 py-1 rounded-full ${toneCls(e.matchStatus)}`}>{MATCH_STATUS_META[e.matchStatus]?.label || e.matchStatus}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

/* ================= PENGATURAN UTAMA ================= */
export const SettingsTab = ({ licenseInfo, triggerAlert }) => {
  const [bizMode, setBizMode] = useState(localStorage.getItem('biz_mode') || 'retail');
  const [tableMode, setTableMode] = useState(localStorage.getItem('table_mode') === 'true');
  const [tableCount, setTableCount] = useState(parseInt(localStorage.getItem('table_count')) || 10);
  const [lang, setLang] = useState(getLang());
  const [timeLeft, setTimeLeft] = useState('');
  const [showTableQR, setShowTableQR] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);   // v15 F4/K2
  const [lowStock, setLowStock] = useState(parseInt(localStorage.getItem('low_stock_threshold')) || 5);
  const [tableSessions, setTableSessions] = useState({});
  const [genBusy, setGenBusy] = useState(false);

  // Regenerasi token sesi meja → QR lama otomatis tidak berlaku.
  const generateTableQR = async () => {
    const cnt = parseInt(tableCount);
    if (!cnt || cnt < 1) { triggerAlert('Isi jumlah meja dulu (minimal 1).', 'error'); return; }
    setGenBusy(true);
    const lic = licenseInfo?.id;
    const links = {};
    try {
      for (let n = 1; n <= Math.min(cnt, 200); n++) {
        const token = makeTableToken();
        if (lic && db) await fsSetDoc(fsDoc(db, 'tenants', lic, 'meja_sessions', String(n)), { token, open: true, updatedAt: Date.now() });
        links[n] = token;
      }
      setTableSessions(links);
      setShowTableQR(true);
      triggerAlert(lic ? cnt + ' QR meja aman siap dipakai. Sesi lama otomatis nonaktif.' : 'QR dibuat lokal (login lisensi dibutuhkan untuk sesi aman).', 'success');
    } catch (e) { triggerAlert('Gagal membuat sesi meja: ' + e.message, 'error'); }
    setGenBusy(false);
  };

  useEffect(() => {
    if (!licenseInfo?.validUntil) return;
    const updateTimer = () => {
      const diff = new Date(licenseInfo.validUntil) - new Date();
      if (diff <= 0) { setTimeLeft("Kedaluwarsa"); }
      else {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        setTimeLeft(`${d} Hari ${h} Jam`);
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [licenseInfo]);

  const handleModeChange = (mode) => {
    setBizMode(mode);
    localStorage.setItem('biz_mode', mode);
    triggerAlert(mode === 'retail' ? "Mode Retail Aktif." : "Mode F&B Aktif.", "success");
  };

  const handleTableModeChange = () => {
    const newVal = !tableMode;
    setTableMode(newVal);
    localStorage.setItem('table_mode', newVal);
    triggerAlert(`Mode Meja ${newVal ? 'Aktif' : 'Nonaktif'}.`, "success");
  };

  const saveTableCount = (val) => {
    setTableCount(val);
    localStorage.setItem('table_count', val);
  };

  const handleBackup = () => {
    const data = JSON.stringify(localStorage);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_welp_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    triggerAlert("Backup data berhasil diunduh!", "success");
  };

  const handleRestore = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        // Validasi struktur: harus object & berisi minimal satu kunci WELP.
        const isObject = data && typeof data === 'object' && !Array.isArray(data);
        const knownKeys = ['product_stock_db', 'hpp_pro_db', 'pos_history_db', 'store_profile', 'raw_material_db', 'discount_tax_db', 'employee_db', 'expense_db', 'active_orders_db', 'settings_version', 'app_license'];
        const hasKnownKey = isObject && Object.keys(data).some(k => knownKeys.includes(k));
        if (!isObject || !hasKnownKey) {
          triggerAlert("File bukan backup WELP yang valid!", "error");
          return;
        }
        Object.keys(data).forEach(k => localStorage.setItem(k, data[k]));
        triggerAlert("Restore data berhasil! Memuat ulang sistem...", "success");
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        triggerAlert("Format file backup tidak valid!", "error");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-3xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Pengaturan Utama" sub={`Konfigurasi Sistem ${licenseInfo?.tenant || ''}`} />

      {/* MODE OPERASIONAL */}
      <Card title="Mode Operasional" icon={ModeRetail}>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button onClick={() => handleModeChange('retail')}
            className={`p-4 rounded-xl border-2 text-left transition-all press ${bizMode === 'retail' ? 'border-flame-600 bg-flame-50 dark:bg-flame-900/30' : 'border-line dark:border-line-dark hover:border-flame-300'}`}>
            <ModeRetail className={`w-6 h-6 mb-2 ${bizMode === 'retail' ? 'text-flame-600 dark:text-apricot' : 'text-ink-faint'}`} />
            <h4 className="font-extrabold text-sm text-ink dark:text-ink-inv">Retail Murni</h4>
            <p className="text-[10px] text-ink-faint font-semibold mt-0.5">Jualan tanpa meja</p>
          </button>
          <button onClick={() => handleModeChange('fnb')}
            className={`p-4 rounded-xl border-2 text-left transition-all press ${bizMode === 'fnb' ? 'border-gold bg-gold-soft dark:bg-gold/10' : 'border-line dark:border-line-dark hover:border-gold/50'}`}>
            <ModeFnb className={`w-6 h-6 mb-2 ${bizMode === 'fnb' ? 'text-gold-deep dark:text-gold' : 'text-ink-faint'}`} />
            <h4 className="font-extrabold text-sm text-ink dark:text-ink-inv">Food &amp; Beverage</h4>
            <p className="text-[10px] text-ink-faint font-semibold mt-0.5">Dine-in, meja & self-order</p>
          </button>
        </div>
        {bizMode === 'fnb' && (
          <div className="space-y-3 p-4 bg-paper dark:bg-white/[.03] rounded-xl border border-line dark:border-line-dark">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">Mode Meja (Dine-in)</p>
                <p className="text-[10px] text-ink-faint font-semibold">Aktifkan self-order URL Pelanggan</p>
              </div>
              <Toggle on={tableMode} onClick={handleTableModeChange} />
            </div>
            {tableMode && (
              <div className="pt-3 border-t border-line dark:border-line-dark animate-fade-in">
                <div className="mb-3"><NumericInput label="Jumlah Meja Tersedia" value={tableCount} onChange={saveTableCount} /></div>
                <div className="space-y-3">
                  <button onClick={generateTableQR} disabled={genBusy}
                    className="w-full py-3 rounded-xl bg-flame-600 hover:bg-flame-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 press disabled:opacity-60">
                    {genBusy ? <><WaktuReal className="w-4 h-4 animate-spin" /> Menyiapkan sesi aman...</> : <><QrDinamis className="w-4 h-4" /> Generate {tableCount || 0} QR Meja Aman</>}
                  </button>
                  {showTableQR && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1 max-h-72 overflow-y-auto custom-scrollbar">
                      {Object.entries(tableSessions).map(([n, token]) => {
                        const link = licenseInfo?.id
                          ? window.location.origin + '/?meja=' + n + '&k=' + token + '&lic=' + licenseInfo.id
                          : window.location.origin + '/?meja=' + n;
                        return <TableQrCard key={n} n={n} link={link} />;
                      })}
                    </div>
                  )}
                  <p className="text-[10px] text-ink-faint text-center leading-relaxed font-semibold">
                    Setiap QR membawa token sesi unik: hanya <b>satu perangkat pertama yang scan</b> yang bisa memesan, ubah angka meja di URL tidak berlaku, dan sesi bisa di-reset kapan pun. Tempel di tiap meja.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* DATA & KEAMANAN */}
      <Card title="Data & Keamanan" icon={JaringanBuddy}>
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={handleBackup} icon={UnduhBuddy} className="py-4">Backup Data</Button>
          <div className="relative">
            <Button variant="secondary" icon={UnggahBuddy} className="w-full py-4">Restore Data</Button>
            <input type="file" accept=".json" onChange={handleRestore} className="absolute inset-0 opacity-0 cursor-pointer" />
          </div>
        </div>
        <p className="text-[10px] text-ink-faint mt-3 font-semibold leading-relaxed">Backup mencakup seluruh data toko (produk, resep, transaksi, stok). File restore divalidasi, hanya backup WELP asli yang diterima.</p>
      </Card>

      {/* SISTEM */}
      <Card title="Sistem" icon={Setelan} flush>
        <div className="divide-y divide-line/70 dark:divide-line-dark/70">
          <div className="flex justify-between items-center gap-3 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-paper dark:bg-white/5 text-ink-faint flex items-center justify-center"><Languages className="w-4 h-4" /></div>
              <div>
                <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">Bahasa Aplikasi</p>
                <p className="text-[10px] text-ink-faint font-semibold">Bahasa antarmuka kasir & menu</p>
              </div>
            </div>
            <Select value={lang === 'id' ? 'Indonesia' : 'English'} options={['Indonesia', 'English']} onChange={v => { const code = v === 'Indonesia' ? 'id' : 'en'; setLang(code); localStorage.setItem('app_lang', code); triggerAlert(code === 'id' ? 'Bahasa: Indonesia' : 'Language: English', 'success'); }} className="w-32" />
          </div>

          <div className="flex justify-between items-center gap-3 px-5 py-4">
            <div className="flex items-center gap-3 pr-3">
              <div className="w-9 h-9 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick flex items-center justify-center"><Stok className="w-4 h-4" /></div>
              <div>
                <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">Batas Stok Menipis</p>
                <p className="text-[10px] text-ink-faint font-semibold">Badge merah muncul di navigasi saat stok produk ≤ angka ini.</p>
              </div>
            </div>
            <div className="w-24 shrink-0"><NumericInput value={lowStock} onChange={v => { setLowStock(v); localStorage.setItem('low_stock_threshold', String(v || 0)); }} /></div>
          </div>

          {/* v21.1 — INVENTORY OPTIONAL (spec #9–11): Stock Tracking ON/OFF */}
          <div className="flex justify-between items-center gap-3 px-5 py-4">
            <div className="flex items-center gap-3 pr-3">
              <div className="w-9 h-9 rounded-xl bg-paper dark:bg-white/5 text-ink-faint flex items-center justify-center"><Stok className="w-4 h-4" /></div>
              <div>
                <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">Stock Tracking (Kontrol Stok)</p>
                <p className="text-[10px] text-ink-faint font-semibold max-w-[340px]">ON: stok turun otomatis saat jual, produk habis terblokir. OFF: semua produk tetap laku tanpa blokir stok & crew tidak dipaksa mengelola inventaris (stok tetap bisa diatur manual lewat opname).</p>
              </div>
            </div>
            <div className="shrink-0">
              <Toggle on={stockTrackingOn()} onClick={() => {
                const cfg = getBizConfig();
                const next = { ...cfg, stockTracking: cfg.stockTracking === false ? true : false };
                dbSetDoc(licenseInfo?.id, 'discount_tax_db', next);
                auditLog(licenseInfo, 'STOCK_TRACKING_TOGGLE', { status: next.stockTracking === false ? 'OFF' : 'ON' });
                triggerAlert(next.stockTracking === false ? 'Stock Tracking OFF — POS tidak lagi memblokir/menurunkan stok.' : 'Stock Tracking ON — stok turun otomatis saat penjualan.', 'success');
              }} />
            </div>
          </div>

          <div className="flex justify-between items-center gap-3 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold flex items-center justify-center"><Lisensi className="w-4 h-4" /></div>
              <div>
                <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">Lisensi</p>
                <p className="text-[10px] text-ink-faint font-mono mt-0.5">ID: {licenseInfo?.id}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <Badge tone="gold">Sisa Waktu</Badge>
              <p className="font-extrabold text-sm text-ink dark:text-ink-inv mt-1">{timeLeft}</p>
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 pt-4">
          {/* v15 F4/K2: aksi paling destruktif kini pakai ConfirmDialog +
              ketik HAPUS — satu-satunya salinan data tidak lagi bisa
              hilang karena satu klik ceroboh. */}
          <Button onClick={() => setConfirmReset(true)} variant="danger" icon={BahayaBuddy} className="w-full py-3">Zona Bahaya : Reset Aplikasi</Button>
          <p className="text-[9.5px] text-ink-faint font-semibold mt-2 leading-relaxed text-center">Menghapus seluruh data di perangkat ini (termasuk data komersial yang belum tersinkron ke server). Data yang sudah masuk Firestore tetap aman &amp; kembali setelah login.</p>
        </div>
      </Card>

      <ConfirmDialog open={confirmReset} danger typeWord="HAPUS"
        title="Reset seluruh aplikasi di perangkat ini?"
        message="Semua database lokal (produk, transaksi, laporan, sesi) akan DIHAPUS PERMANEN dari perangkat. Data yang sudah tersinkron ke server WELP tidak ikut terhapus dan bisa diunduh lagi setelah login."
        confirmLabel="Hapus Semua & Muat Ulang"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => { localStorage.clear(); window.location.reload(); }} />

      <div className="flex items-center justify-center gap-1.5 pt-2">
        <BadgeCheck className="w-3.5 h-3.5 text-flame-600 dark:text-apricot" />
        <p className="text-[10px] font-bold text-ink-faint uppercase tracking-widest">WELP v21.1</p>
      </div>
    </div>
  );
};
