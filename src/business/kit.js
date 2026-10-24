// ============================================================
// WELP v21.4 ENTERPRISE GROWTH PACK, SHARED KIT
// ------------------------------------------------------------
// Helper lintas modul baru (Loyalitas, Voucher, Pembelian,
// Jadwal, Target, Pengumuman). Semua logika harga/poin dibaca
// dari sumber yang sama agar Kasir & panel manajemen tidak
// pernah berbeda hitungan.
// Tanpa em-dash: teks UI memakai spasi atau titik tengah (·).
// ============================================================

export const nid = (prefix = 'gx') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const fmtDT = (ms) => new Date(ms).toLocaleString('id-ID', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
export const fmtD = (ms) => new Date(ms).toLocaleDateString('id-ID', {
  day: '2-digit', month: 'short', year: 'numeric',
});

export const pad2 = (n) => String(n).padStart(2, '0');

export const dateKeyOfMs = (ms = Date.now()) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const monthKeyOf = (ms = Date.now()) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

// ISO week: kunci minggu "2026-W43", Senin sebagai hari pertama.
export const weekKeyOf = (ms = Date.now()) => {
  const d = new Date(ms);
  const day = (d.getDay() + 6) % 7;             // Senin = 0
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  const thursday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3);
  const year = thursday.getFullYear();
  const week1 = new Date(year, 0, 1);
  const week1Day = (week1.getDay() + 6) % 7;
  const week1Monday = new Date(year, 0, 1 - week1Day);
  const week = Math.floor((monday - week1Monday) / 604800000) + 1;
  return `${year}-W${pad2(week)}`;
};

export const weekMondayOf = (weekKey) => {
  const [y, w] = String(weekKey || '').split('-W').map(Number);
  if (!y || !w) return null;
  const jan1 = new Date(y, 0, 1);
  const jan1Day = (jan1.getDay() + 6) % 7;
  const week1Monday = new Date(y, 0, 1 - jan1Day);
  return new Date(week1Monday.getFullYear(), week1Monday.getMonth(), week1Monday.getDate() + (w - 1) * 7);
};

export const shiftWeekKey = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset * 7);
  return weekKeyOf(d.getTime());
};

// ---------- LOYALITAS ----------
export const DEFAULT_LOYALTY = {
  aktif: true,
  earnPerRp: 10000,          // 1 poin tiap Rp 10.000 belanja
  poinWorth: 100,            // 1 poin bernilai Rp 100 saat tukar
  minRedeem: 50,             // minimal poin untuk sekali tukar
  tiers: { silver: 1000000, gold: 5000000, platinum: 20000000 }, // akumulasi belanja (lifetime)
};

export const TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum'];

export const tierOf = (spend, cfg) => {
  const t = (cfg && cfg.tiers) || DEFAULT_LOYALTY.tiers;
  if (spend >= (t.platinum || Infinity)) return 'Platinum';
  if (spend >= (t.gold || Infinity)) return 'Gold';
  if (spend >= (t.silver || Infinity)) return 'Silver';
  return 'Bronze';
};

export const poinEarnedOf = (total, cfg) => {
  const per = Number(cfg?.earnPerRp) > 0 ? Number(cfg.earnPerRp) : DEFAULT_LOYALTY.earnPerRp;
  return Math.floor(Number(total || 0) / per);
};

export const poinValueOf = (poin, cfg) => {
  const w = Number(cfg?.poinWorth) > 0 ? Number(cfg.poinWorth) : DEFAULT_LOYALTY.poinWorth;
  return Math.max(0, Math.floor(Number(poin || 0))) * w;
};

export const loyaltyCfgOf = (rows) => {
  const rec = Array.isArray(rows) ? rows.find(r => r.cid === 'cfg') : null;
  return { ...DEFAULT_LOYALTY, ...(rec || {}) };
};

// ---------- VOUCHER ----------
export const discOfVoucher = (v, subtotal) => {
  const sub = Number(subtotal || 0);
  if (!v) return 0;
  if (v.type === 'percent') {
    let d = Math.round((sub * Number(v.value || 0)) / 100);
    if (Number(v.maxDisc) > 0) d = Math.min(d, Number(v.maxDisc));
    return Math.min(d, sub);
  }
  return Math.min(Number(v.value || 0), sub);
};

// Validasi satu kode voucher utk kondisi belanja saat ini.
// Returns { ok, disc, voucher, reason }
export const findVoucher = (vouchers, code, { subtotal = 0, nowMs = Date.now(), branchId = null } = {}) => {
  const needle = String(code || '').trim().toUpperCase();
  if (!needle) return { ok: false, disc: 0, voucher: null, reason: 'Masukkan kode voucher.' };
  const v = (vouchers || []).find(x => String(x.code || '').trim().toUpperCase() === needle);
  if (!v) return { ok: false, disc: 0, voucher: null, reason: 'Kode voucher tidak ditemukan.' };
  if (v.aktif === false) return { ok: false, disc: 0, voucher: v, reason: 'Voucher sudah dinonaktifkan.' };
  const now = Number(nowMs || Date.now());
  if (v.startAt && now < new Date(v.startAt).getTime()) return { ok: false, disc: 0, voucher: v, reason: 'Voucher belum mulai.' };
  if (v.endAt && now > new Date(v.endAt).getTime()) return { ok: false, disc: 0, voucher: v, reason: 'Voucher sudah kedaluwarsa.' };
  const kuota = Number(v.kuota || 0);
  if (kuota > 0 && Number(v.used || 0) >= kuota) return { ok: false, disc: 0, voucher: v, reason: 'Kuota voucher sudah habis.' };
  if (Number(v.minBelanja) > 0 && subtotal < Number(v.minBelanja)) {
    return { ok: false, disc: 0, voucher: v, reason: `Minimal belanja Rp ${Number(v.minBelanja).toLocaleString('id-ID')}.` };
  }
  if (v.cabangId && v.cabangId !== 'ALL' && branchId && v.cabangId !== branchId) {
    return { ok: false, disc: 0, voucher: v, reason: 'Voucher hanya berlaku di cabang tertentu.' };
  }
  return { ok: true, disc: discOfVoucher(v, subtotal), voucher: v, reason: '' };
};

export const voucherStatusOf = (v, nowMs = Date.now()) => {
  const now = Number(nowMs);
  if (v.aktif === false) return { key: 'off', label: 'Nonaktif', tone: 'neutral' };
  if (v.endAt && now > new Date(v.endAt).getTime()) return { key: 'expired', label: 'Kedaluwarsa', tone: 'brick' };
  if (Number(v.kuota) > 0 && Number(v.used || 0) >= Number(v.kuota)) return { key: 'out', label: 'Kuota Habis', tone: 'brick' };
  if (v.startAt && now < new Date(v.startAt).getTime()) return { key: 'soon', label: 'Belum Mulai', tone: 'gold' };
  return { key: 'on', label: 'Aktif', tone: 'leaf' };
};

// ---------- JADWAL SHIFT ----------
export const SHIFT_CODES = [
  { k: 'L', label: 'Libur', cls: 'bg-paper dark:bg-white/5 text-ink-faint border-line dark:border-line-dark' },
  { k: 'P', label: 'Pagi', cls: 'bg-leaf/15 text-leaf border-leaf/30' },
  { k: 'S', label: 'Siang', cls: 'bg-gold/15 text-gold border-gold/30' },
  { k: 'M', label: 'Malam', cls: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30' },
];
export const SHIFT_MAP = Object.fromEntries(SHIFT_CODES.map(s => [s.k, s]));
export const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export const nextShiftCode = (k) => {
  const idx = SHIFT_CODES.findIndex(s => s.k === (k || 'L'));
  return SHIFT_CODES[(idx + 1) % SHIFT_CODES.length].k;
};

// ---------- TARGET & LEADERBOARD ----------
export const MEDALS = ['🥇', '🥈', '🥉'];
