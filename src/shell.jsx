// ============================================================
// SHELL v20 — Navigasi WELP (Business & Cashier)
// ------------------------------------------------------------
// v20 PERUBAHAN STRUKTURAL:
//  • NAV didasarkan permission granular (welp-core/rbac.js):
//    key legacy tetap sah (matrix lama di-expand otomatis),
//    halaman baru memakai key granular (crm.view, audit.view, ...).
//  • Struktur WELP Business: Command Center & Persetujuan di
//    paling atas, lalu Kasir/CRM, Inventaris, SDM, Organisasi
//    & Tata Kelola, Pengaturan — sesuai arsitektur perusahaan.
//  • WELP Cashier: tetap fokus transaksi + Area Saya (Employee
//    Area pribadi) — tidak ada menu manajemen yang tak relevan.
//  • Role custom dari Owner (mis. Area Manager, HRD, Auditor)
//    ikut tampil dengan labelnya, bukan hard-coded.
//  • Label grup i18n baru ditambahkan di core.TRANSLATIONS.
// ============================================================
import React from 'react';
import {
  Kasir, HppCalc, Riwayat, KasKeluar, Diskon, Stok, Opname, InOut,
  StokRiwayat, Supplier, Laporan, Toko, Bayar,
  Alat, Setelan, Terang, Gelap, Keluar, Beranda, X, Menu,
  Cabang, Tim, Absensi, Penggajian, MonitorPusat, PerisaiBuddy,
  Users, JaringanBuddy, History, BadgeCheck, StrukCetak,
} from './welp-icons.jsx';
import { BrandLockup, BrandLogo, Mascot } from './brand.jsx';
import { t, getLang } from './core.jsx';
import { NAV_PERMS_V20, roleLabelOf as rbacRoleLabel, canDo } from './welp-core/rbac.js';

// v20: NAV berbasis PERMISSION granular. Item tanpa pemetaan
// permission = terbuka utk semua yang punya sesi. navAllowed
// menerima Set permission dari rbac.permsOf(role, settingsRows).
export const NAV_GROUPS = [
  { key: 'main', labelKey: 'mainCat', items: [
    { id: 'home', labelKey: 'home', icon: Beranda, scope: 'all' },
    { id: 'outlet', labelKey: 'outlet', icon: MonitorPusat, scope: 'management' },
    { id: 'approval', labelKey: 'approval', icon: BadgeCheck, scope: 'management' },
  ]},
  { key: 'kasir', labelKey: 'kasirGrp', items: [
    { id: 'pos', labelKey: 'cashier', icon: Kasir, scope: 'pos' },
    { id: 'area', labelKey: 'area', icon: Tim, scope: 'all' },
    { id: 'calc', labelKey: 'hpp', icon: HppCalc, scope: 'pos' },
    { id: 'customers', labelKey: 'customers', icon: Users, scope: 'management' },
    { id: 'history', labelKey: 'history', icon: Riwayat, scope: 'pos' },
    { id: 'cashout', labelKey: 'cashout', icon: KasKeluar, scope: 'pos' },
    { id: 'discount', labelKey: 'discount', icon: Diskon, scope: 'pos' },
  ]},
  { key: 'ops', labelKey: 'operational', items: [
    { id: 'stock', labelKey: 'stock', icon: Stok, scope: 'pos' },
    { id: 'opname', labelKey: 'opname', icon: Opname, scope: 'management' },
    { id: 'inout', labelKey: 'inout', icon: InOut, scope: 'management' },
    { id: 'stockhistory', labelKey: 'stockHistory', icon: StokRiwayat, scope: 'management' },
    { id: 'supplier', labelKey: 'supplier', icon: Supplier, scope: 'management' },
  ]},
  { key: 'people', labelKey: 'peopleGrp', items: [
    { id: 'karyawan', labelKey: 'karyawan', icon: Tim, scope: 'management' },
    { id: 'absensi', labelKey: 'absensi', icon: Absensi, scope: 'management' },
    { id: 'payroll', labelKey: 'payroll', icon: Penggajian, scope: 'management' },
  ]},
  { key: 'org', labelKey: 'orgGrp', items: [
    { id: 'report', labelKey: 'report', icon: Laporan, scope: 'management' },
    { id: 'finance2', labelKey: 'finance2', icon: Bayar, scope: 'management' },   // v21: Settlement/Rekonsiliasi/Kas
    { id: 'employee', labelKey: 'employee', icon: Cabang, scope: 'management' },
    { id: 'organization', labelKey: 'organization', icon: JaringanBuddy, scope: 'management' },
    { id: 'roles', labelKey: 'roles', icon: PerisaiBuddy, scope: 'management' },
    { id: 'audit', labelKey: 'audit', icon: History, scope: 'management' },
  ]},
  // Keluarga PENGATURAN terpisah dari menu operasional.
  { key: 'setelan', labelKey: 'settings', items: [
    { id: 'profile', labelKey: 'profile', icon: Toko, scope: 'management' },
    { id: 'payment', labelKey: 'payment', icon: Bayar, scope: 'pos' },
    { id: 'hardware', labelKey: 'hardware', icon: Alat, scope: 'pos' },
    { id: 'settings', labelKey: 'settings', icon: Setelan, scope: 'management' },
    { id: 'perusahaan', labelKey: 'perusahaan', icon: Toko, scope: 'management' },
  ]},
];

export const navAllowed = (item, role, perms, scope = 'all', isStation = false) => {
  if (item.scope && item.scope !== 'all' && item.scope !== scope) return false;
  // Station/perangkat tanpa identitas pribadi tidak melihat Area Saya.
  if (item.id === 'area' && isStation) return false;
  const need = item.perm || NAV_PERMS_V20[item.id] || null;
  if (!need) return true;
  if (!perms || !(perms.has)) return true;      // fallback aman bila matrix belum terbaca
  return perms.has(need);
};

/* ---------- BADGE ROLE (highlight, label custom-aware) ---------- */
const RoleChip = ({ role, compact, settingsRows }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-flame-500 to-flame-600 text-white shadow-card ${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'}`}>
    <PerisaiBuddy className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
    <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] leading-none max-w-[140px] truncate">{rbacRoleLabel(role, settingsRows)}</span>
  </span>
);

/* ---------- SIDEBAR DOCK (desktop lg+) ---------- */
export const Sidebar = ({ role, perms, active, setActive, licenseInfo, dark, toggleDark, onLogout, lowStockCount, editing, scope = 'all', settingsRows, isStation = false }) => (
  <aside className={`hidden lg:block fixed inset-y-0 left-0 w-[260px] p-3 z-40 transition-all duration-300 ${editing ? 'opacity-40 blur-sm pointer-events-none' : ''}`}>
    <div className="h-full rounded-[1.5rem] flex flex-col overflow-hidden shadow-dock border relative
      bg-surface dark:bg-chrome-deep border-line dark:border-chrome-edge">
      {/* brand: WELP primer + by JUSTru GROUP sekunder */}
      <div className="p-4 pb-3.5 border-b border-line dark:border-chrome-edge/70 bg-gradient-to-br from-flame-50 via-surface to-surface dark:from-flame-500/10 dark:via-chrome-deep dark:to-chrome-deep">
        <div className="flex items-start justify-between gap-2">
          <BrandLockup theme={dark ? 'dark' : 'light'} size="md" withTagline={false} />
          <span className="text-[8px] font-extrabold px-2 py-1 rounded-full bg-chrome-deep text-white uppercase tracking-wider shrink-0">{scope === 'pos' ? 'Cashier' : 'Business'}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-2.5">
          <p className="text-ink-faint dark:text-ink-inv/45 text-[10px] font-bold truncate">
            {licenseInfo?.isStation ? `Perangkat Kasir ${licenseInfo.stationCode || ''}` : (licenseInfo?.tenant || 'Kasir & HPP dalam satu genggaman')}
          </p>
          <RoleChip role={role} compact settingsRows={settingsRows} />
        </div>
      </div>

      {/* nav */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar px-2.5 py-3 space-y-4">
        {NAV_GROUPS.map(group => {
          const items = group.items.filter(i => navAllowed(i, role, perms, scope, isStation));
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
            <p className="text-ink-faint dark:text-ink-inv/40 text-[9px] font-bold mt-1 truncate">{licenseInfo?.tenant ? rbacRoleLabel(role, settingsRows) : 'Teman usahamu'}</p>
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
export const BottomNav = ({ active, setActive, onMenu, lowStockCount, scope = 'all', perms, isStation = false }) => {
  const en = getLang() === 'en';
  const allItems = [
    { id: 'home', icon: Beranda, label: en ? 'Home' : 'Beranda', scope: 'all' },
    { id: 'pos', icon: Kasir, label: en ? 'Cashier' : 'Kasir', scope: 'pos' },
    { id: 'area', icon: Tim, label: en ? 'My Area' : 'Area Saya', scope: 'all' },
    { id: 'calc', icon: HppCalc, label: 'HPP', scope: 'pos' },
    { id: 'stock', icon: Stok, label: en ? 'Stock' : 'Stok', badge: lowStockCount, scope: 'pos' },
    { id: null, icon: Menu, label: t('menu'), scope: 'all' },
  ];
  const items = allItems
    .filter(it => !it.scope || it.scope === 'all' || it.scope === scope)
    // Station perangkat tanpa identitas pribadi: tanpa "Area Saya".
    .filter(it => it.id !== 'area' || !isStation)
    .filter(it => it.id === null || navAllowed({ id: it.id, scope: 'all' }, {}, perms, scope))
    .slice(0, 5);
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

/* ---------- MENU SHEET (drawer mobile, RBAC sama) ---------- */
export const MenuSheet = ({ open, onClose, role, perms, active, setActive, licenseInfo, onLogout, dark, toggleDark, scope = 'all', settingsRows, isStation = false }) => {
  if (!open) return null;
  const en = getLang() === 'en';
  return (
    <div className="lg:hidden fixed inset-0 z-[200] flex justify-end bg-chrome-deep/60 dark:bg-chrome-deep/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-[85%] max-w-sm h-full shadow-pop flex flex-col animate-slide-up border-l
        bg-surface dark:bg-chrome-deep border-line dark:border-chrome-edge" onClick={e => e.stopPropagation()}>

        {/* kepala drawer */}
        <div className="p-5 border-b border-line dark:border-chrome-edge flex justify-between items-start
          bg-gradient-to-br from-flame-50 via-surface to-surface dark:from-flame-500/10 dark:via-chrome-deep dark:to-chrome-deep">
          <div className="min-w-0">
            <BrandLockup theme={dark ? 'dark' : 'light'} size="sm" withTagline={false} endorsement align="center" />
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-[9px] font-extrabold text-ink-faint dark:text-ink-inv/40 uppercase tracking-[0.18em]">{t('access')}</span>
              <RoleChip role={licenseInfo?.currentUserRole || role} compact settingsRows={settingsRows} />
            </div>
          </div>
          <button onClick={onClose} aria-label="Tutup menu" className="w-9 h-9 rounded-full bg-paper dark:bg-white/5 text-ink-faint dark:text-ink-inv/60 hover:text-ink dark:hover:text-ink-inv flex items-center justify-center transition shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-5">
          {NAV_GROUPS.map(group => {
            const items = group.items.filter(i => navAllowed(i, role, perms, scope, isStation));
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
          <p className="text-center text-[9px] font-extrabold text-ink-faint dark:text-ink-inv/25 uppercase tracking-[0.2em] pt-2">WELP v20</p>
        </div>
      </div>
    </div>
  );
};
