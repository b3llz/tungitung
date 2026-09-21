// ============================================================
// APP ROOT & SHELL v6 WELP — logika sesi/lisensi dipertahankan
// 100% (restore session, onSnapshot lisensi, strip kredensial
// dari localStorage, heartbeat 60 detik, validasi berkala, dark
// mode di <html>). Presentasi: sidebar charcoal netral + kanvas
// putih/abu netral.
// NAVIGASI MOBILE: satu-satunya trigger menu ada di BottomNav.
// Header mobile tidak lagi membuat hamburger sendiri (perbaikan
// bug menu dobel), isinya hanya brand + toggle tema.
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from "firebase/firestore";
import { BrandLogo } from './ui';
import { Gelap, Terang } from './welp-icons.jsx';

import { db, safeParse, syncSession } from './core.jsx';
import { Toast } from './ui';
import { LockScreen, BannedScreen, RestoredScreen } from './lock';
import { HomeTab } from './home';
import { CalculatorTab } from './hpp';
import { PosTab } from './pos';
import { ReportTab } from './report';
import { StockTab, OpnameTab, InOutTab, StockHistoryTab, SupplierTab } from './inventory';
import { HistoryTab, CashOutTab, DiscountTab, EmployeeTab } from './ops';
import { OutletTab, HardwareTab, ProfileTab, PaymentTab, SettingsTab } from './settings';
import { Sidebar, BottomNav, MenuSheet } from './shell';
import { SelfOrderApp } from './selforder';
import { DeveloperPanel } from './devpanel';

const MainAdminApp = () => {
  const [isLocked, setIsLocked] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [active, setActive] = useState('home');
  const [dark, setDark] = useState(false);
  const [popup, setPopup] = useState({ show: false, message: '', type: 'success' });
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Role + badge stok menipis (dibaca langsung dari localStorage agar selalu segar).
  const role = licenseInfo?.currentUserRole || 'owner';
  const lowStockThreshold = parseInt(localStorage.getItem('low_stock_threshold')) || 5;
  const lowStockCount = safeParse('product_stock_db', []).filter(p => (p.stock || 0) <= lowStockThreshold).length;

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

  // Restore session
  useEffect(() => {
    const saved = localStorage.getItem('app_license');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (new Date() < new Date(data.validUntil)) {
          setLicenseInfo(data);
          setIsLocked(false);
        } else {
          setIsLocked(true);
        }
      } catch (e) { setIsLocked(true); }
    }
  }, []);

  const checkValidity = () => {
    if (localStorage.getItem('app_banned') === 'true') { setIsBanned(true); return; }
    const saved = localStorage.getItem('app_license');
    if (saved) {
      try {
        const data = JSON.parse(saved);
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
    // SECURITY: jangan simpan password & ownerPin plaintext di localStorage.
    const { password, ownerPin, ...safeSession } = data || {};
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

  const handleLogout = () => {
    if (confirm("Yakin ingin keluar dari sesi ini?")) {
      localStorage.removeItem('app_license');
      setLicenseInfo(null);
      setIsLocked(true);
      setIsMenuOpen(false);
    }
  };

  // Heartbeat presence (60 detik, hemat kuota).
  useEffect(() => {
    if (!licenseInfo) return;
    const interval = setInterval(async () => { syncSession('heartbeat', licenseInfo); }, 60000);
    return () => clearInterval(interval);
  }, [licenseInfo]);

  if (isBanned) return <BannedScreen id={licenseInfo?.id || "UNKNOWN"} />;
  if (isRestored) return <RestoredScreen onContinue={() => { setIsRestored(false); setIsLocked(true); }} />;
  if (isLocked) return <LockScreen onUnlock={handleUnlock} id={licenseInfo?.id} />;

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen w-full bg-paper dark:bg-night text-ink dark:text-ink-inv transition-colors">

        {/* SIDEBAR DOCK (desktop) */}
        <Sidebar role={role} active={active} setActive={setActive} licenseInfo={licenseInfo} dark={dark} toggleDark={toggleDarkMode} onLogout={handleLogout} lowStockCount={lowStockCount} editing={isEditingMode} />

        <div className="lg:pl-[260px]">

          {/* HEADER (mobile/tablet) — tanpa hamburger: menu hanya dari BottomNav */}
          <div className={`sticky top-0 px-4 py-2.5 flex justify-between items-center max-w-screen-xl mx-auto transition-all duration-300 lg:hidden ${isEditingMode ? 'z-0 opacity-40 blur-sm pointer-events-none' : 'z-40 bg-paper/85 dark:bg-night/85 backdrop-blur-md border-b border-line dark:border-line-dark'}`}>
            <div className="flex items-center gap-2.5">
              <BrandLogo size="sm" />
              {licenseInfo?.type && <span className="text-[8px] font-extrabold px-2 py-1 rounded-full bg-gold text-chrome-deep uppercase tracking-wider">{String(licenseInfo.type)}</span>}
            </div>
            <button onClick={toggleDarkMode} aria-label="Ganti tema" className="w-9 h-9 rounded-full bg-surface dark:bg-white/5 border border-line dark:border-line-dark text-ink-faint hover:text-flame-600 dark:hover:text-apricot transition flex items-center justify-center">
              {dark ? <Terang className="w-4 h-4" /> : <Gelap className="w-4 h-4" />}
            </button>
          </div>

          {/* KONTEN — pola mount keep-alive dipertahankan */}
          <main className="px-4 sm:px-6 pt-5 pb-40 lg:pb-12 lg:px-8 max-w-[1400px] mx-auto">
            <div className={active === 'home' ? 'block' : 'hidden'}><HomeTab licenseInfo={licenseInfo} setActive={setActive} activeTab={active} /></div>
            <div className={active === 'pos' ? 'block' : 'hidden'}><PosTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} setEditingMode={setIsEditingMode} activeTab={active} /></div>
            <div className={active === 'calc' ? 'block' : 'hidden'}><CalculatorTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} setEditingMode={setIsEditingMode} /></div>
            <div className={active === 'history' ? 'block' : 'hidden'}><HistoryTab activeTab={active} /></div>
            <div className={active === 'cashout' ? 'block' : 'hidden'}><CashOutTab triggerAlert={triggerAlert} /></div>
            <div className={active === 'discount' ? 'block' : 'hidden'}><DiscountTab triggerAlert={triggerAlert} /></div>
            <div className={active === 'employee' ? 'block' : 'hidden'}><EmployeeTab triggerAlert={triggerAlert} /></div>

            <div className={active === 'stock' ? 'block' : 'hidden'}>
              <StockTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} setEditingMode={setIsEditingMode} activeTab={active} />
            </div>
            <div className={active === 'opname' ? 'block' : 'hidden'}><OpnameTab triggerAlert={triggerAlert} /></div>
            <div className={active === 'inout' ? 'block' : 'hidden'}><InOutTab triggerAlert={triggerAlert} /></div>
            <div className={active === 'stockhistory' ? 'block' : 'hidden'}><StockHistoryTab activeTab={active} /></div>
            <div className={active === 'supplier' ? 'block' : 'hidden'}><SupplierTab triggerAlert={triggerAlert} /></div>

            <div className={active === 'profile' ? 'block' : 'hidden'}><ProfileTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} setEditingMode={setIsEditingMode} activeTab={active} /></div>
            <div className={active === 'report' ? 'block' : 'hidden'}><ReportTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} activeTab={active} /></div>
            <div className={active === 'payment' ? 'block' : 'hidden'}><PaymentTab triggerAlert={triggerAlert} setEditingMode={setIsEditingMode} activeTab={active} /></div>
            <div className={active === 'settings' ? 'block' : 'hidden'}><SettingsTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} /></div>
            <div className={active === 'hardware' ? 'block' : 'hidden'}><HardwareTab triggerAlert={triggerAlert} /></div>
            <div className={active === 'outlet' ? 'block' : 'hidden'}><OutletTab triggerAlert={triggerAlert} /></div>
          </main>
        </div>

        {/* MENU SHEET (mobile drawer, RBAC sama) */}
        <MenuSheet open={isMenuOpen} onClose={() => setIsMenuOpen(false)} role={role} active={active} setActive={setActive} licenseInfo={licenseInfo} onLogout={handleLogout} dark={dark} toggleDark={toggleDarkMode} />

        {/* TOAST GLOBAL */}
        {popup.show && <Toast message={popup.message} type={popup.type} onClose={() => setPopup({ ...popup, show: false })} />}

        {/* BOTTOM NAV (mobile) */}
        <BottomNav active={active} setActive={setActive} onMenu={() => setIsMenuOpen(true)} lowStockCount={lowStockCount} />

      </div>
    </div>
  );
};

const App = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const customerTable = urlParams.get('meja');

  if (urlParams.get('dev') === 'panel') return <DeveloperPanel />;

  if (customerTable) {
    const profile = safeParse('store_profile', {});
    return <SelfOrderApp tableNo={customerTable} profile={profile} />;
  }
  return <MainAdminApp />;
};

export default App;
