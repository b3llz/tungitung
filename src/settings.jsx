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
  ModeRetail, ModeFnb, Setelan, BadgeCheck, Check, UnggahQris, WaktuReal
} from './welp-icons.jsx';
import { safeParse, formatIDR, getLang, qrUrl, WALLET_TYPES, decodeQrFromImage, parseEmv, qrisMeta, makeTableToken, db, dbSet, dbSetDoc, useDbSync, hydrateDb } from './core.jsx';
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
              <p className="text-xs text-ink-inv/60">Meja {scannedOrder.t} · {scannedOrder.p}</p>
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
export const PaymentTab = ({ licenseInfo, triggerAlert, setEditingMode, activeTab }) => {
  const [profile, setProfile] = useState({ payment: { qris: null, ewallets: [], bank: [] } });
  const [newWallet, setNewWallet] = useState({ type: 'Gopay', number: '' });
  const [newBank, setNewBank] = useState({ bank: '', number: '' });
  const [cropSrc, setCropSrc] = useState(null);
  const [manualPayload, setManualPayload] = useState('');

  const saveManualPayload = () => {
    const p = (manualPayload || '').trim();
    const m = parseEmv(p);
    if (!m['00'] || !m['01']) return triggerAlert('Payload tidak valid — pastikan menyalin string QRIS lengkap.', 'error');
    // v15 F5/G2: CRC diverifikasi + metadata merchant tersimpan
    const meta = qrisMeta(p);
    saveProfile({ ...profile, payment: { ...profile.payment, qrisPayload: p, qrisMeta: meta } });
    setManualPayload('');
    triggerAlert(meta?.crcValid
      ? `QRIS Dinamis aktif! CRC valid · merchant: ${meta.merchant || '-'}${meta.city ? ' · ' + meta.city : ''}.`
      : 'QRIS Dinamis aktif, PERINGATAN: CRC payload tidak valid — pastikan menyalin payload utuh.', meta?.crcValid ? 'success' : 'error');
  };

  // Setelah crop: simpan gambar QRIS + coba baca payload EMVCo otomatis.
  const saveQrisImage = async (img) => {
    saveProfile({ ...profile, payment: { ...profile.payment, qris: img } });
    setCropSrc(null);
    try {
      // v15 F5/G1+G3: decode di resolusi penuh dgn fallback jsQR — Safari/Firefox kini terbaca
      const payload = await decodeQrFromImage(img);
      const m = payload ? parseEmv(payload) : null;
      if (m && m['00'] && m['01']) {
        const meta = qrisMeta(payload);   // v15 F5/G2
        saveProfile({ ...profile, payment: { ...profile.payment, qris: img, qrisPayload: payload, qrisMeta: meta } });
        triggerAlert(meta?.crcValid
          ? `QRIS tersimpan & CRC valid — merchant: ${meta.merchant || '-'}${meta.city ? ' · ' + meta.city : ''}. Nominal otomatis AKTIF!`
          : 'QRIS tersimpan & terbaca, tapi CRC tidak valid — cek ulang gambar/payload.', meta?.crcValid ? 'success' : 'error');
      } else {
        triggerAlert('QRIS tersimpan. Payload tidak terbaca otomatis — tempel manual agar nominal terisi otomatis.', 'error');
      }
    } catch (e) { triggerAlert('QRIS tersimpan (payload tidak diperiksa).', 'success'); }
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
                <p className="text-[10px] text-ink-faint font-semibold leading-snug">{profile.payment?.qrisPayload ? 'Aktif — saat checkout, QR otomatis berisi nominal tagihan. Pelanggan tinggal scan.' : 'Upload foto QRIS: payload dibaca otomatis, lalu nominal terisi sendiri saat pembayaran.'}</p>
              </div>
            </div>
            {profile.payment?.qrisPayload ? <Badge tone="green"><Check className="w-3 h-3" /> Aktif</Badge> : <Badge tone="grey">Belum</Badge>}
          </div>

          {!profile.payment?.qrisPayload && (
            <div className="mt-3 animate-fade-in">
              <label className="kicker block mb-1.5 ml-0.5">Atau tempel payload QRIS (string panjang berawalan 0002...) </label>
              <div className="flex gap-2">
                <input className="field flex-1 min-w-0 font-mono text-[11px]" placeholder="00020101021126610014COM..."
                  value={manualPayload} onChange={e => setManualPayload(e.target.value)} />
                <button onClick={saveManualPayload} className="px-4 bg-flame-600 text-white rounded-xl hover:bg-flame-500 active:scale-95 transition press text-xs font-extrabold">Simpan</button>
              </div>
              <p className="text-[9.5px] text-ink-faint font-semibold mt-2 leading-relaxed">Pembacaan otomatis butuh browser dengan BarcodeDetector (Chrome/Edge). Bila tidak terbaca, buka teks payload dari bank/QRIS di console, salin & tempel di atas.</p>
            </div>
          )}
          {profile.payment?.qrisPayload && (
            <button onClick={() => { saveProfile({ ...profile, payment: { ...profile.payment, qrisPayload: null } }); triggerAlert('QRIS Dinamis dimatikan — kembali ke QR statis.', 'success'); }}
              className="mt-3 text-[10px] font-extrabold text-brick hover:underline">Matikan & hapus payload</button>
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
      triggerAlert(lic ? cnt + ' QR meja aman siap — sesi lama otomatis mati.' : 'QR dibuat lokal (login lisensi dibutuhkan untuk sesi aman).', 'success');
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
                        return (
                          <div key={n} className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-2xl p-3 flex flex-col items-center shadow-card">
                            <img alt={'QR Meja ' + n} src={qrUrl(link, 220)} className="w-full aspect-square rounded-lg bg-white p-1" />
                            <p className="font-extrabold text-sm text-ink dark:text-ink-inv mt-2">Meja {n}</p>
                            <a href={qrUrl(link, 700)} target="_blank" rel="noopener noreferrer" className="mt-1 text-[10px] font-extrabold text-flame-700 dark:text-apricot flex items-center gap-1"><UnduhBuddy className="w-3 h-3" /> Buka / Unduh</a>
                          </div>
                        );
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
        <p className="text-[10px] font-bold text-ink-faint uppercase tracking-widest">WELP v15.1 · Fresh Ink</p>
      </div>
    </div>
  );
};
