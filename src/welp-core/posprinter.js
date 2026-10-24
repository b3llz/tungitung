// ============================================================
// WELP CORE, PRINTER & CASH DRAWER (v21.3)
// ------------------------------------------------------------
// Sesi printer ESC/POS yang DIBAGIKAN antar halaman: Hardware
// (Alat Tambahan) menghubungkan printer sekali, lalu POS memakai
// koneksi yang sama untuk struk & BUKA LACI (cash drawer) otomatis
// saat transaksi tunai. Semua metode aman dipanggil tanpa printer:
// gagal = diam (tidak pernah mengganggu alur kasir).
//
// Perintah kick drawer standar ESC/POS: ESC p 0 25 250
//   0x1B 0x70 0x00 0x19 0xFA  (pulse pin 2, 25ms on / 250ms off)
// Beberapa printer pakai pin 5 (0x01). Keduanya dikirim berurutan
// agar semua merek umum (Xprinter, Rongta, EPSON TM, Gprinter)
// ikut membuka.
// ============================================================

let _char = null;          // BluetoothRemoteGATTCharacteristic (write)
let _deviceName = '';
let _status = 'disconnected';   // disconnected | connecting | connected | error
const _listeners = new Set();

export const printerStatus = () => _status;
export const printerName = () => _deviceName;
export const printerConnected = () => _status === 'connected' && !!_char;

export const onPrinterChange = (fn) => {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
};
const emit = () => { try { _listeners.forEach(fn => fn(_status, _deviceName)); } catch (e) { } };

const setStatus = (s, name) => { _status = s; if (name !== undefined) _deviceName = name; emit(); };

// Tulis byte ke printer (chunked, khas Web Bluetooth MTU kecil).
export const writeBytes = async (bytes) => {
  if (!_char) throw new Error('Printer belum terhubung');
  const CHUNK = 180;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.slice(i, i + CHUNK);
    if (_char.properties.writeWithoutResponse) await _char.writeValueWithoutResponse(slice);
    else await _char.writeValue(slice);
    await new Promise(r => setTimeout(r, 18));
  }
};

// Hubungkan printer Bluetooth (dipanggil dari Alat Tambahan / kasir).
export const connectPrinter = async () => {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    throw new Error('Browser tidak mendukung Web Bluetooth. Gunakan Chrome di Android/Desktop.');
  }
  setStatus('connecting');
  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
      ],
    });
    device.addEventListener('gattserverdisconnected', () => { _char = null; setStatus('disconnected', ''); });
    const server = await device.gatt.connect();
    const services = await server.getPrimaryServices();
    let writeChar = null;
    for (const svc of services) {
      const chars = await svc.getCharacteristics();
      for (const c of chars) { if (c.properties.write || c.properties.writeWithoutResponse) { writeChar = c; break; } }
      if (writeChar) break;
    }
    if (!writeChar) throw new Error('Karakteristik tulis tidak ditemukan di printer');
    _char = writeChar;
    setStatus('connected', device.name || 'Bluetooth Printer');
    return device.name || 'Bluetooth Printer';
  } catch (e) {
    setStatus('error');
    throw e;
  }
};

export const disconnectPrinter = () => {
  try { _char = null; } catch (e) { }
  setStatus('disconnected', '');
};

// BUKA LACI KAS (cash drawer) via printer thermal yang terhubung.
// return: 'opened' | 'no-printer' (tidak menggagalkan alur kasir).
export const kickCashDrawer = async () => {
  if (!printerConnected()) return 'no-printer';
  try {
    const pin0 = [0x1B, 0x70, 0x00, 0x19, 0xFA];   // ESC p 0 (pin 2)
    const pin1 = [0x1B, 0x70, 0x01, 0x19, 0xFA];   // ESC p 1 (pin 5)
    await writeBytes(new Uint8Array(pin0));
    await writeBytes(new Uint8Array(pin1));
    return 'opened';
  } catch (e) {
    return 'no-printer';
  }
};

// Buka laci otomatis saat penjualan TUNAI bila pengaturan aktif.
export const autoKickDrawer = async () => {
  try { if (localStorage.getItem('cash_drawer_auto') !== '1') return 'off'; } catch (e) { return 'off'; }
  return await kickCashDrawer();
};

// Getar singkat sebagai umpan balik sentuh kasir (aman di semua device).
export const haptic = (ms = 12) => {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { }
};

// Struk ESC/POS generik (dipakai Hardware test print & kasir bila BT aktif).
export const escposReceipt = ({ title, lines, paper }) => {
  const enc = new TextEncoder();
  const width = paper === '80mm' ? 48 : 32;
  const out = [];
  const push = (arr) => arr.forEach(b => out.push(b));
  const text = (str) => push(Array.from(enc.encode(str)));
  push([0x1B, 0x40]);                     // init
  push([0x1B, 0x61, 0x01]);               // center
  push([0x1B, 0x21, 0x30]); text((title || 'WELP') + '\n');  // double strike
  push([0x1B, 0x21, 0x00]);
  text('-'.repeat(width) + '\n');
  push([0x1B, 0x61, 0x00]);               // left
  (lines || []).forEach(l => text(l + '\n'));
  text('-'.repeat(width) + '\n');
  push([0x1B, 0x61, 0x01]); text('Terima kasih\n');
  push([0x0A, 0x0A, 0x0A]);
  push([0x1D, 0x56, 0x00]);               // cut
  return new Uint8Array(out);
};

export const printReceiptBytes = async (bytes) => {
  if (!printerConnected()) return false;
  try { await writeBytes(bytes); return true; } catch (e) { return false; }
};
