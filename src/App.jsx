// ============================================================
// WELP APP ROOT v20 — SATU PLATFORM, DUA APLIKASI, SATU CORE
// ------------------------------------------------------------
// WELP Business  = pusat kendali perusahaan (management)
// WELP Cashier   = POS + Employee Area
// WELP Core      = data, identity, organization, RBAC (welp-core/)
//
// ROUTING BERBASIS IDENTITY (bukan URL manual):
//   Setelah login, resolveWorkspace() menentukan aplikasi:
//     • role employee        → Employee Area (di dalam WELP Cashier)
//     • role kasir / station → POS
//     • role manajemen       → WELP Business
//   Override URL (?app=pos / ?app=management) tetap berlaku khusus
//   untuk perangkat station & integrasi lama.
//
// v20:
//   • Login "Cabang" (password/PIN bersama) DIHAPUS dari lock screen —
//     cabang adalah unit organisasi, bukan akun. Semua orang memakai
//     akun pribadi (Akun WELP) atau jalur kompatibilitas yang tetap
//     berbasis identitas pribadi (Owner legacy / Employee ID+PIN).
//   • Permission granular + custom role (welp-core/rbac.js).
//   • Scope organisasi: org → region → branch (welp-core/org.js).
//   • Tab baru: Area Saya, CRM, Organization, Persetujuan, Audit,
//     Role & Permission.
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from "firebase/firestore";
import { BrandLogo } from './ui';
import { Gelap, Terang } from './welp-icons.jsx';

import {
  db, auth, safeParse, syncSession, useBranding, ensureAuth, sanitizeSession,
  hydrateDb, useTenantCol, callWelpSession, signOutWelpAccount,
} from './core.jsx';
import {
  permsOf as rbacPermsOf, canDo, NAV_PERMS_V20, resolveWorkspace,
  scopeOf, normScope,
} from './welp-core/rbac.js';
import { Toast } from './ui';
import { LockScreen, BannedScreen, RestoredScreen } from './lock';
import { HomeTab } from './home';
import { CalculatorTab } from './hpp';
import { PosTab } from './pos';
import { ReportTab } from './report';
import { StockTab, OpnameTab, InOutTab, StockHistoryTab, SupplierTab } from './inventory';
import { HistoryTab, CashOutTab, DiscountTab } from './ops';
import { HardwareTab, ProfileTab, PaymentTab, SettingsTab } from './settings';
import { BranchTab, KaryawanTab, OutletTab, AbsensiTab, PayrollTab, PerusahaanTab } from './team';
import { AbsensiApp, EmployeeArea } from './absensi-app';
import { CustomersTab } from './business/crm.jsx';
import { OrganizationTab, RolesTab, ApprovalTab, AuditTab } from './business/governance.jsx';
import { Sidebar, BottomNav, MenuSheet, NAV_GROUPS, navAllowed } from './shell';
import { SelfOrderApp } from './selforder';
import { DeveloperPanel } from './devpanel';

const MainAdminApp = ({ mode = 'management' }) => {
  const scope = mode === 'pos' ? 'pos' : 'management';
  const [isLocked, setIsLocked] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [active, setActive] = useState(mode === 'pos' ? 'pos' : 'home');
  const [dark, setDark] = useState(false);
  const [popup, setPopup] = useState({ show: false, message: '', type: 'success' });
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Custom Aplikasi (v14): baca konfigurasi branding tenant realtime
  // → logo & warna UI perusahaan langsung dipakai di seluruh app.
  useBranding(licenseInfo);

  // Role + badge stok menipis (dibaca langsung dari localStorage agar selalu segar).
  const role = licenseInfo?.currentUserRole || 'owner';
  const lowStockThreshold = parseInt(localStorage.getItem('low_stock_threshold')) || 5;
  const lowStockCount = safeParse('product_stock_db', []).filter(p => (p.stock || 0) <= lowStockThreshold).length;

  // v20: matrix role per tenant (termasuk custom role) → Set permission
  // granular utk nav & guard. settingsRows dibaca realtime.
  const { items: settingsRows } = useTenantCol(licenseInfo, 'pengaturan', 'pengaturan_db');
  const perms = licenseInfo ? rbacPermsOf(role, settingsRows) : new Set();

  const triggerAlert = useCallback((message, type = 'success') => {
    setPopup({ show: true, message, type });
  }, []);

  // Monitor lisensi real-time (toleran offline: snapshot cache tidak mengunci sesi sah).
  useEffect(() => {
    if (licenseInfo?.id && db) {
      const unsub = onSnapshot(doc(db, "licenses", licenseInfo.id), (docSnapshot) => {
        if (docSnapshot.metadata && docSnapshot.metadata.fromCache) return;
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          if (!data.active) {
            setIsBanned(true);
            triggerAlert("Sesi Anda dihentikan Admin.", "error");
            setLicenseInfo(null);
            localStorage.removeItem('app_license');
          }
        } else {
          setIsLocked(true);
        }
      });
      return () => unsub();
    }
  }, [licenseInfo]);

  // Restore session: enterprise sessions are revalidated by Firebase Auth + backend.
  // Legacy sessions remain compatible until the migration cutover.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem('app_license') || 'null'); } catch (_) {}
      if (saved?.authVersion === 2) {
        try {
          if (auth?.authStateReady) await auth.authStateReady();
          const user = auth?.currentUser;
          if (!user || user.isAnonymous) throw new Error('enterprise-auth-required');
          const fresh = await callWelpSession();
          if (cancelled) return;
          const safe = sanitizeSession(fresh);
          localStorage.setItem('app_license', JSON.stringify(safe));
          setLicenseInfo(safe); setIsLocked(false);
          return;
        } catch (e) {
          if (!cancelled) {
            localStorage.removeItem('app_license');
            setLicenseInfo(null); setIsLocked(true);
          }
          return;
        }
      }
      if (saved) {
        try {
          const data = sanitizeSession(saved);
          localStorage.setItem('app_license', JSON.stringify(data));
          if (new Date() < new Date(data.validUntil)) {
            setLicenseInfo(data); setIsLocked(false);
          } else setIsLocked(true);
        } catch (e) { setIsLocked(true); }
      }
      // Anonymous auth remains only for legacy compatibility.
      await ensureAuth();
    })();
    return () => { cancelled = true; };
  }, []);
  const checkValidity = () => {
    if (localStorage.getItem('app_banned') === 'true') { setIsBanned(true); return; }
    const saved = localStorage.getItem('app_license');
    if (saved) {
      try {
        const data = sanitizeSession(JSON.parse(saved));
        if (new Date() < new Date(data.validUntil)) { setLicenseInfo(data); setIsLocked(false); }
        else { localStorage.removeItem('app_license'); setIsLocked(true); setLicenseInfo(null); }
      } catch (e) { setIsLocked(true); }
    } else { setIsLocked(true); }
  };

  useEffect(() => {
    // Jangan jalankan pengecekan background saat masih di halaman Login
    if (!isBanned && !isRestored && !isLocked) {
      const interval = setInterval(checkValidity, 10000);
      return () => clearInterval(interval);
    }
  }, [isBanned, isRestored, isLocked]);

  const handleUnlock = (data) => {
    if (isBanned) return triggerAlert("Akses Ditolak.", "error");
    // SECURITY v15 F0: satu pintu sanitasi — password, ownerPin, cred,
    // dan seluruh kredensial cabang (_branchList) TIDAK PERNAH masuk
    // localStorage. Metadata cabang (cid/name/role) tetap dipertahankan.
    const safeSession = sanitizeSession(data);
    localStorage.setItem('app_license', JSON.stringify(safeSession));
    setLicenseInfo(safeSession); setIsLocked(false);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDark(true);
      // Terapkan ke <html> agar LockScreen & Developer Panel ikut gelap.
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !dark; setDark(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
    if (newMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const handleLogout = async () => {
    if (confirm("Yakin ingin keluar dari sesi ini?")) {
      const enterprise = licenseInfo?.authVersion === 2;
      localStorage.removeItem('app_license');
      setLicenseInfo(null);
      setIsLocked(true);
      setIsMenuOpen(false);
      if (enterprise) await signOutWelpAccount().catch(() => {});
    }
  };

  // Heartbeat presence (60 detik, hemat kuota).
  useEffect(() => {
    if (!licenseInfo) return;
    const interval = setInterval(async () => { syncSession('heartbeat', licenseInfo); }, 60000);
    return () => clearInterval(interval);
  }, [licenseInfo]);

  // v15 F1: data komersial tersinkron ke Firestore — import sekali dari
  // localStorage (device pertama pindah ke v15) atau hidrasi mirror dari
  // Firestore (device kedua dst). Dipanggil setiap sesi login berubah.
  useEffect(() => {
    if (licenseInfo?.id) { hydrateDb(licenseInfo.id); }
  }, [licenseInfo?.id]);

  // POS Station: ganti kasir aktif → segarkan sesi dari localStorage
  useEffect(() => {
    const onSess = async () => {
      try {
        const saved = JSON.parse(localStorage.getItem('app_license') || 'null');
        if (saved?.authVersion === 2) {
          const fresh = await callWelpSession();
          setLicenseInfo(sanitizeSession(fresh));
        } else if (saved) setLicenseInfo(saved);
      } catch (e) { setLicenseInfo(null); setIsLocked(true); }
    };
    window.addEventListener('welp_session_update', onSess);
    return () => window.removeEventListener('welp_session_update', onSess);
  }, []);

  // v20: GUARD TAB — bila permission tab aktif dicabut saat sesi berjalan,
  // kembalikan ke beranda aplikasi (home utk business, pos utk cashier).
  useEffect(() => {
    if (!licenseInfo) return;
    const need = NAV_PERMS_V20[active];
    if (need && !canDo(perms, need)) setActive(scope === 'pos' ? 'pos' : 'home');
  }, [active, perms, licenseInfo, scope]);

  if (isBanned) return <BannedScreen id={licenseInfo?.id || "UNKNOWN"} />;
  if (isRestored) return <RestoredScreen onContinue={() => { setIsRestored(false); setIsLocked(true); }} />;
  if (isLocked) return <LockScreen onUnlock={handleUnlock} id={licenseInfo?.id} />;

  // ============================================================
  // v20 — WORKSPACE ROUTER: ke mana user ini mendarat?
  // Dipanggil setiap render setelah sesi sah; perangkat station
  // tetap ke POS, employee → Employee Area, lainnya sesuai izin.
  // ============================================================
  const workspace = resolveWorkspace(licenseInfo, perms, settingsRows);
  if (workspace === 'employee' && scope === 'management') {
    return (
      <div className={dark ? 'dark' : ''}>
        <div className="min-h-screen w-full bg-paper dark:bg-night text-ink dark:text-ink-inv">
          <EmployeeArea
            licenseInfo={licenseInfo}
            triggerAlert={triggerAlert}
            dark={dark}
            toggleDark={toggleDarkMode}
            onLogout={handleLogout}
          />
          {popup.show && <Toast message={popup.message} type={popup.type} onClose={() => setPopup({ ...popup, show: false })} />}
        </div>
      </div>
    );
  }

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen w-full bg-paper dark:bg-night text-ink dark:text-ink-inv transition-colors">

        {/* SIDEBAR DOCK (desktop) */}
        <Sidebar role={role} perms={perms} active={active} setActive={setActive} licenseInfo={licenseInfo} dark={dark} toggleDark={toggleDarkMode} onLogout={handleLogout} lowStockCount={lowStockCount} editing={isEditingMode} scope={scope} settingsRows={settingsRows} isStation={!!licenseInfo?.isStation} />

        <div className="lg:pl-[260px]">

          {/* HEADER (mobile/tablet) — tanpa hamburger: menu hanya dari BottomNav */}
          <div className={`sticky top-0 px-4 py-2.5 flex justify-between items-center max-w-screen-xl mx-auto transition-all duration-300 lg:hidden ${isEditingMode ? 'z-0 opacity-40 blur-sm pointer-events-none' : 'z-40 bg-paper/85 dark:bg-night/85 backdrop-blur-md border-b border-line dark:border-line-dark'}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <BrandLogo size="sm" />
              <span className="text-[8px] font-extrabold px-2 py-1 rounded-full bg-chrome-deep text-white uppercase tracking-wider truncate max-w-[110px]">{scope === 'pos' ? 'WELP Cashier' : 'WELP Business'}</span>
            </div>
            <button onClick={toggleDarkMode} aria-label="Ganti tema" className="w-9 h-9 rounded-full bg-surface dark:bg-white/5 border border-line dark:border-line-dark text-ink-faint hover:text-flame-600 dark:hover:text-apricot transition flex items-center justify-center shrink-0">
              {dark ? <Terang className="w-4 h-4" /> : <Gelap className="w-4 h-4" />}
            </button>
          </div>

          {/* KONTEN — pola mount keep-alive dipertahankan */}
          <main className="px-4 sm:px-6 pt-5 pb-40 lg:pb-12 lg:px-8 max-w-[1400px] mx-auto">
            <div className={active === 'home' ? 'block' : 'hidden'}><HomeTab licenseInfo={licenseInfo} setActive={setActive} activeTab={active} perms={perms} /></div>
            <div className={active === 'pos' ? 'block' : 'hidden'}><PosTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} setEditingMode={setIsEditingMode} activeTab={active} /></div>
            <div className={active === 'area' ? 'block' : 'hidden'}>
              <EmployeeArea licenseInfo={licenseInfo} triggerAlert={triggerAlert} dark={dark} toggleDark={toggleDarkMode} onLogout={handleLogout} />
            </div>
            <div className={active === 'calc' ? 'block' : 'hidden'}><CalculatorTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} setEditingMode={setIsEditingMode} /></div>
            <div className={active === 'history' ? 'block' : 'hidden'}><HistoryTab activeTab={active} /></div>
            <div className={active === 'cashout' ? 'block' : 'hidden'}><CashOutTab triggerAlert={triggerAlert} licenseInfo={licenseInfo} /></div>
            <div className={active === 'discount' ? 'block' : 'hidden'}><DiscountTab triggerAlert={triggerAlert} licenseInfo={licenseInfo} /></div>
            <div className={active === 'customers' ? 'block' : 'hidden'}><CustomersTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} perms={perms} /></div>
            <div className={active === 'employee' ? 'block' : 'hidden'}><BranchTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} /></div>
            <div className={active === 'karyawan' ? 'block' : 'hidden'}><KaryawanTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} /></div>
            <div className={active === 'absensi' ? 'block' : 'hidden'}><AbsensiTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} sessionRole={role} sessionBranchId={licenseInfo?.branchId || 'PUSAT'} /></div>
            <div className={active === 'payroll' ? 'block' : 'hidden'}><PayrollTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} sessionRole={role} sessionBranchId={licenseInfo?.branchId || 'PUSAT'} /></div>
            <div className={active === 'perusahaan' ? 'block' : 'hidden'}><PerusahaanTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} /></div>
            <div className={active === 'organization' ? 'block' : 'hidden'}><OrganizationTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} perms={perms} /></div>
            <div className={active === 'roles' ? 'block' : 'hidden'}><RolesTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} perms={perms} /></div>
            <div className={active === 'approval' ? 'block' : 'hidden'}><ApprovalTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} perms={perms} sessionRole={role} /></div>
            <div className={active === 'audit' ? 'block' : 'hidden'}><AuditTab licenseInfo={licenseInfo} perms={perms} /></div>

            <div className={active === 'stock' ? 'block' : 'hidden'}>
              <StockTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} setEditingMode={setIsEditingMode} activeTab={active} />
            </div>
            <div className={active === 'opname' ? 'block' : 'hidden'}><OpnameTab triggerAlert={triggerAlert} licenseInfo={licenseInfo} /></div>
            <div className={active === 'inout' ? 'block' : 'hidden'}><InOutTab triggerAlert={triggerAlert} licenseInfo={licenseInfo} /></div>
            <div className={active === 'stockhistory' ? 'block' : 'hidden'}><StockHistoryTab activeTab={active} /></div>
            <div className={active === 'supplier' ? 'block' : 'hidden'}><SupplierTab triggerAlert={triggerAlert} licenseInfo={licenseInfo} /></div>

            <div className={active === 'profile' ? 'block' : 'hidden'}><ProfileTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} setEditingMode={setIsEditingMode} activeTab={active} /></div>
            <div className={active === 'report' ? 'block' : 'hidden'}><ReportTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} activeTab={active} /></div>
            <div className={active === 'payment' ? 'block' : 'hidden'}><PaymentTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} setEditingMode={setIsEditingMode} activeTab={active} /></div>
            <div className={active === 'settings' ? 'block' : 'hidden'}><SettingsTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} /></div>
            <div className={active === 'hardware' ? 'block' : 'hidden'}><HardwareTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} activeTab={active} /></div>
            <div className={active === 'outlet' ? 'block' : 'hidden'}><OutletTab licenseInfo={licenseInfo} /></div>
          </main>
        </div>

        {/* MENU SHEET (mobile drawer, RBAC sama) */}
        <MenuSheet open={isMenuOpen} onClose={() => setIsMenuOpen(false)} role={role} perms={perms} active={active} setActive={setActive} licenseInfo={licenseInfo} onLogout={handleLogout} dark={dark} toggleDark={toggleDarkMode} scope={scope} settingsRows={settingsRows} isStation={!!licenseInfo?.isStation} />

        {/* TOAST GLOBAL */}
        {popup.show && <Toast message={popup.message} type={popup.type} onClose={() => setPopup({ ...popup, show: false })} />}

        {/* BOTTOM NAV (mobile) */}
        <BottomNav active={active} setActive={setActive} onMenu={() => setIsMenuOpen(true)} lowStockCount={lowStockCount} scope={scope} perms={perms} isStation={!!licenseInfo?.isStation} />

      </div>
    </div>
  );
};

const App = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const customerTable = urlParams.get('meja');

  if (urlParams.get('dev') === 'panel') return <DeveloperPanel />;

  // WELP punya dua aplikasi resmi + satu area internal:
  //   WELP Business   (default)      — pusat kendali perusahaan
  //   WELP Cashier    /?app=pos      — POS + Employee Area
  //   Employee Area   /?app=employee — kompatibilitas QR lama (?absen=1)
  // Keputusan workspace final tetap dari ROLE user (resolveWorkspace);
  // parameter URL hanya override untuk perangkat khusus.
  const pathMode = window.location.pathname.replace(/^\/+|\/+$/g, '');
  const appMode = urlParams.get('app') || (['pos', 'employee', 'management'].includes(pathMode) ? pathMode : null);
  if (appMode === 'employee' || urlParams.get('absen') != null) {
    return <AbsensiApp preLic={urlParams.get('lic') || ''} />;
  }
  if (appMode === 'pos') return <MainAdminApp mode="pos" />;
  if (appMode === 'management') return <MainAdminApp mode="management" />;

  if (customerTable) {
    const profile = safeParse('store_profile', {});
    return <SelfOrderApp tableNo={customerTable} profile={profile} lic={urlParams.get('lic')} token={urlParams.get('k')} />;
  }
  return <MainAdminApp mode="management" />;
};

export default App;
