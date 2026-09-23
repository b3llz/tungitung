// ============================================================
// SHELL v8 — Navigasi WELP.
// BARU v8:
//  • Light mode: sidebar, drawer (MenuSheet) & BottomNav putih
//    dengan gradasi oren (flame) — tidak ada lagi yang item
//    saat mode terang.
//  • Role (Owner/Admin/Kasir) kini BADGE ber-highlight dengan
//    ikon perisai + gradasi flame, bukan teks polos.
//  • Nav baru: Manajemen Cabang, Manajemen Karyawan, Kelola
//    Absensi, Manajemen Penggajian, Multi Outlet (monitoring).
// Model RBAC (NAV_GROUPS) dipertahankan; mobile tetap satu
// trigger menu di BottomNav (tanpa hamburger dobel).
// ============================================================
import React from 'react';
import {
  Kasir, HppCalc, Riwayat, KasKeluar, Diskon, Stok, Opname, InOut,
  StokRiwayat, Supplier, Laporan, Outlet, Toko, Bayar,
  Alat, Setelan, Terang, Gelap, Keluar, Beranda, X, Menu,
  Cabang, Tim, Absensi, Penggajian, MonitorPusat, PerisaiBuddy
} from './welp-icons.jsx';
import { BrandLockup, BrandLogo, Mascot } from './brand.jsx';
import { t, getLang } from './core.jsx';

// item.roles === null artinya semua role boleh mengakses.
// v10: absensi karyawan TIDAK lagi di dalam app kasir — memakai
// halaman terpisah ?absen=1 (lihat src/absensi-app.jsx & Kelola Absensi).
export const NAV_GROUPS = [
  { key: 'main', labelKey: 'mainCat', items: [
    { id: 'home', labelKey: 'home', icon: Beranda, roles: null },
    { id: 'pos', labelKey: 'cashier', icon: Kasir, roles: null },
    { id: 'calc', labelKey: 'hpp', icon: HppCalc, roles: null },
    { id: 'history', labelKey: 'history', icon: Riwayat, roles: null },
    { id: 'cashout', labelKey: 'cashout', icon: KasKeluar, roles: ['kasir', 'owner'] },
    { id: 'discount', labelKey: 'discount', icon: Diskon, roles: ['admin', 'owner'] },
  ]},
  { key: 'ops', labelKey: 'operational', items: [
    { id: 'stock', labelKey: 'stock', icon: Stok, roles: null },
    { id: 'opname', labelKey: 'opname', icon: Opname, roles: null },
    { id: 'inout', labelKey: 'inout', icon: InOut, roles: null },
    { id: 'stockhistory', labelKey: 'stockHistory', icon: StokRiwayat, roles: null },
    { id: 'supplier', labelKey: 'supplier', icon: Supplier, roles: null },
  ]},
  { key: 'biz', labelKey: 'business', items: [
    { id: 'report', labelKey: 'report', icon: Laporan, roles: ['admin', 'owner'] },
    { id: 'employee', labelKey: 'employee', icon: Cabang, roles: ['owner'] },
    { id: 'karyawan', labelKey: 'karyawan', icon: Tim, roles: ['owner'] },
    { id: 'absensi', labelKey: 'absensi', icon: Absensi, roles: ['admin', 'owner'] },
    { id: 'payroll', labelKey: 'payroll', icon: Penggajian, roles: ['admin', 'owner'] },
    { id: 'perusahaan', labelKey: 'perusahaan', icon: Toko, roles: ['owner'] },
    { id: 'outlet', labelKey: 'outlet', icon: MonitorPusat, roles: ['owner'] },
    { id: 'profile', labelKey: 'profile', icon: Toko, roles: ['owner'] },
    { id: 'payment', labelKey: 'payment', icon: Bayar, roles: ['owner'] },
    { id: 'hardware', labelKey: 'hardware', icon: Alat, roles: ['owner'] },
    { id: 'settings', labelKey: 'settings', icon: Setelan, roles: ['owner'] },
  ]},
];
export const navAllowed = (item, role) => !item.roles || item.roles.includes(role);

/* ---------- BADGE ROLE (highlight, bukan teks polos) ---------- */
const RoleChip = ({ role, compact }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-flame-500 to-flame-600 text-white shadow-card ${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'}`}>
    <PerisaiBuddy className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
    <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] leading-none">
      {role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin' : 'Kasir'}
    </span>
  </span>
);

/* ---------- SIDEBAR DOCK (desktop lg+) ---------- */
export const Sidebar = ({ role, active, setActive, licenseInfo, dark, toggleDark, onLogout, lowStockCount, editing }) => (
  <aside className={`hidden lg:block fixed inset-y-0 left-0 w-[260px] p-3 z-40 transition-all duration-300 ${editing ? 'opacity-40 blur-sm pointer-events-none' : ''}`}>
    <div className="h-full rounded-[1.5rem] flex flex-col overflow-hidden shadow-dock border relative
      bg-surface dark:bg-chrome-deep border-line dark:border-chrome-edge">
      {/* brand: WELP primer + by JUSTru GROUP sekunder */}
      <div className="p-4 pb-3.5 border-b border-line dark:border-chrome-edge/70 bg-gradient-to-br from-flame-50 via-surface to-surface dark:from-flame-500/10 dark:via-chrome-deep dark:to-chrome-deep">
        <div className="flex items-start justify-between gap-2">
          <BrandLockup theme={dark ? 'dark' : 'light'} size="md" withTagline={false} />
          {licenseInfo?.type && <span className="text-[8px] font-extrabold px-2 py-1 rounded-full bg-gold text-chrome-deep uppercase tracking-wider">{String(licenseInfo.type)}</span>}
        </div>
        <div className="flex items-center justify-between gap-2 mt-2.5">
          <p className="text-ink-faint dark:text-ink-inv/45 text-[10px] font-bold truncate">
            {licenseInfo?.isStation ? `${licenseInfo.stationCode || 'POS'} · Perangkat Kasir` : (licenseInfo?.tenant ? licenseInfo.tenant : 'Kasir & HPP dalam satu genggaman')}
          </p>
          <RoleChip role={role} compact />
        </div>
      </div>

      {/* nav */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar px-2.5 py-3 space-y-4">
        {NAV_GROUPS.map(group => {
          const items = group.items.filter(i => navAllowed(i, role));
          if (!items.length) return null;
          return (
            <div key={group.key}>
              <p className="text-[8.5px] font-extrabold text-ink-faint dark:text-ink-inv/35 uppercase tracking-[0.2em] mb-1.5 px-3">{t(group.labelKey)}</p>
              <div className="space-y-0.5">
                {items.map(item => {
                  const isActive = active === item.id;
                  const Icon = item.icon;
                  return (
                    <button key={item.id} onClick={() => setActive(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] transition press ${isActive
                        ? 'bg-flame-500 text-white font-extrabold shadow-card'
                        : 'text-ink-soft dark:text-ink-inv/60 font-bold hover:bg-paper dark:hover:bg-chrome-panel hover:text-ink dark:hover:text-ink-inv'}`}>
                      <Icon className="w-[19px] h-[19px] shrink-0" />
                      <span className="truncate text-left flex-1">{t(item.labelKey)}</span>
                      {item.id === 'stock' && lowStockCount > 0 && (
                        <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-extrabold flex items-center justify-center ${isActive ? 'bg-white/25 text-white' : 'bg-brick text-white'}`}>{lowStockCount}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* footer: maskot asli menyapa + aksi */}
      <div className="px-3 pt-2 border-t border-line dark:border-chrome-edge/70">
        <div className="flex items-center gap-2.5 py-2 px-1">
          <div className="w-9 h-9 rounded-xl bg-paper dark:bg-chrome-panel border border-line dark:border-chrome-edge flex items-center justify-center overflow-hidden shrink-0">
            <Mascot pose="menyapa" className="w-8 h-8 object-contain translate-y-0.5" alt="" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-ink dark:text-ink-inv/85 text-[11px] font-extrabold truncate leading-none">{licenseInfo?.tenant || 'Welp'}</p>
            <p className="text-ink-faint dark:text-ink-inv/40 text-[9px] font-bold mt-1 truncate">{licenseInfo?.tenant ? role : 'Teman usahamu'}</p>
          </div>
        </div>
        <div className="pb-2.5 space-y-0.5">
          <button onClick={toggleDark} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] font-bold text-ink-soft dark:text-ink-inv/60 hover:bg-paper dark:hover:bg-chrome-panel hover:text-ink dark:hover:text-ink-inv transition">
            {dark ? <Terang className="w-[18px] h-[18px]" /> : <Gelap className="w-[18px] h-[18px]" />}
            {dark ? (getLang() === 'en' ? 'Light Mode' : 'Mode Terang') : (getLang() === 'en' ? 'Dark Mode' : 'Mode Gelap')}
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] font-bold text-brick hover:bg-brick/15 transition">
            <Keluar className="w-[18px] h-[18px]" /> {t('logout')}
          </button>
        </div>
      </div>
    </div>
  </aside>
);

/* ---------- BOTTOM NAV (mobile) — satu trigger menu ---------- */
export const BottomNav = ({ active, setActive, onMenu, lowStockCount }) => {
  const en = getLang() === 'en';
  const items = [
    { id: 'home', icon: Beranda, label: en ? 'Home' : 'Beranda' },
    { id: 'pos', icon: Kasir, label: en ? 'Cashier' : 'Kasir' },
    { id: 'calc', icon: HppCalc, label: 'HPP' },
    { id: 'stock', icon: Stok, label: en ? 'Stock' : 'Stok', badge: lowStockCount },
    { id: null, icon: Menu, label: t('menu') },
  ];
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 dark:bg-chrome-deep/95 backdrop-blur-md border-t border-line dark:border-chrome-edge pb-safe">
      <div className="grid grid-cols-5 max-w-screen-xl mx-auto h-16">
        {items.map((it, idx) => {
          const isActive = it.id && active === it.id;
          const Icon = it.icon;
          return (
            <button key={idx} onClick={() => it.id ? setActive(it.id) : onMenu()} aria-label={it.label}
              className={`relative flex flex-col items-center justify-center gap-1 transition press ${isActive ? 'text-flame-600 dark:text-apricot' : 'text-ink-faint dark:text-ink-inv/45 hover:text-ink-soft dark:hover:text-ink-inv/80'}`}>
              {isActive && <span className="absolute top-0 w-9 h-1 bg-flame-500 rounded-b-full" />}
              <div className="relative">
                <Icon className="w-[22px] h-[22px]" />
                {it.badge > 0 && <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-brick text-white text-[9px] font-extrabold flex items-center justify-center">{it.badge}</span>}
              </div>
              <span className={`text-[9px] ${isActive ? 'font-extrabold' : 'font-bold'}`}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

/* ---------- MENU SHEET (drawer mobile, RBAC sama) ----------
   Light: putih + gradasi oren di kepala drawer.
   Dark : tetap charcoal elegan. */
export const MenuSheet = ({ open, onClose, role, active, setActive, licenseInfo, onLogout, dark, toggleDark }) => {
  if (!open) return null;
  const en = getLang() === 'en';
  return (
    <div className="lg:hidden fixed inset-0 z-[200] flex justify-end bg-chrome-deep/60 dark:bg-chrome-deep/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-[85%] max-w-sm h-full shadow-pop flex flex-col animate-slide-up border-l
        bg-surface dark:bg-chrome-deep border-line dark:border-chrome-edge" onClick={e => e.stopPropagation()}>

        {/* kepala drawer dengan gradasi oren */}
        <div className="p-5 border-b border-line dark:border-chrome-edge flex justify-between items-start
          bg-gradient-to-br from-flame-50 via-surface to-surface dark:from-flame-500/10 dark:via-chrome-deep dark:to-chrome-deep">
          <div>
            <BrandLockup theme={dark ? 'dark' : 'light'} size="sm" withTagline={false} endorsement align="center" />
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[9px] font-extrabold text-ink-faint dark:text-ink-inv/40 uppercase tracking-[0.18em]">{t('access')}</span>
              <RoleChip role={licenseInfo?.currentUserRole || role} compact />
            </div>
          </div>
          <button onClick={onClose} aria-label="Tutup menu" className="w-9 h-9 rounded-full bg-paper dark:bg-white/5 text-ink-faint dark:text-ink-inv/60 hover:text-ink dark:hover:text-ink-inv flex items-center justify-center transition"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-5">
          {NAV_GROUPS.map(group => {
            const items = group.items.filter(i => navAllowed(i, role));
            if (!items.length) return null;
            return (
              <div key={group.key}>
                <p className="text-[8.5px] font-extrabold text-ink-faint dark:text-ink-inv/35 uppercase tracking-[0.2em] mb-2 px-2">{t(group.labelKey)}</p>
                <div className="space-y-0.5">
                  {items.map(item => {
                    const isActive = active === item.id;
                    const Icon = item.icon;
                    return (
                      <button key={item.id} onClick={() => { setActive(item.id); onClose(); }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition press ${isActive
                          ? 'bg-flame-500 text-white font-extrabold shadow-card'
                          : 'text-ink-soft dark:text-ink-inv/60 font-bold hover:bg-paper dark:hover:bg-chrome-panel hover:text-ink dark:hover:text-ink-inv'}`}>
                        <Icon className="w-5 h-5 shrink-0" />
                        <span className="text-[13px]">{t(item.labelKey)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3.5 border-t border-line dark:border-chrome-edge space-y-0.5">
          <button onClick={toggleDark} className="w-full flex items-center gap-3 p-3 rounded-xl text-[13px] font-bold text-ink-soft dark:text-ink-inv/60 hover:bg-paper dark:hover:bg-chrome-panel hover:text-ink dark:hover:text-ink-inv transition">
            {dark ? <Terang className="w-5 h-5" /> : <Gelap className="w-5 h-5" />}
            {dark ? (en ? 'Light Mode' : 'Mode Terang') : (en ? 'Dark Mode' : 'Mode Gelap')}
          </button>
          <button onClick={onLogout} className="w-full flex items-center justify-center gap-3 p-3 rounded-xl bg-brick/15 text-brick font-extrabold hover:bg-brick/25 transition press">
            <Keluar className="w-5 h-5" /> {t('logout')}
          </button>
          <p className="text-center text-[9px] font-extrabold text-ink-faint dark:text-ink-inv/25 uppercase tracking-[0.2em] pt-2">WELP v14 · Fresh Ink</p>
        </div>
      </div>
    </div>
  );
};
