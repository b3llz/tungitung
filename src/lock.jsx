// ============================================================
// LOCK SCREEN v8 — pintu masuk WELP.
// Latar form panel = sistem grafis "warm ink print shop"
// (src/login-art.jsx): halftone bervariasi, arch, arc
// konsentris, stiker Welpie, struk POS, perforasi, barcode —
// TANPA dot-grid seragam & tanpa plus melayang (dihapus).
// BrandLockup dengan JUSTru GROUP tampil di SEMUA device
// (desktop, tablet, mobile) dengan ukuran jelas terbaca.
// Logika verifikasi lisensi & PIN dipertahankan 100%.
// ============================================================
import React, { useState, useRef } from 'react';
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db, syncSession, auditLog, ensureAuth, verifyCred, upgradeCred, credIsLegacy, pinGate, pinGateMsg } from './core.jsx';
import { BrandLockup, BrandLogo, Mascot } from './brand.jsx';
import {
  HppCalc, Kasir, Laporan, Pindai,
  PerisaiBuddy, GembokBuddy, Kredensial, HapusBuddy, Lisensi, Cabang, LayarBuddy
} from './welp-icons.jsx';
import {
  Arch, QuarterArcs, Halftone, WavyLines, Sticker, Burst,
  Receipt, TearLine, Barcode, sphereMask, ringMask
} from './login-art.jsx';

/* Dekor panel form — komposisi cetak kiri/kanan mengelilingi kartu.
   Light: flame + abu di atas putih · Dark: apricot + putih redup. */
const LoginDecor = () => (
  <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* cahaya ambient (bukan dekorasi utama, sangat halus) */}
    <div className="absolute -top-40 -right-32 w-[480px] h-[480px] rounded-full bg-flame-200/25 blur-3xl dark:bg-flame-500/[.06]" />
    <div className="absolute -bottom-48 -left-36 w-[460px] h-[460px] rounded-full bg-[#E9ECF1]/70 blur-3xl dark:bg-white/[.035]" />

    {/* KIRI: donut halftone abu → stiker Welpie → burst → arc konsentris */}
    <Halftone w={8} h={8} gap={17} mask={ringMask}
      className="absolute top-[4%] left-[5%] w-28 sm:w-36 text-[#AEB6C2]/55 dark:text-white/[.09]" />
    <Sticker className="absolute top-[15%] left-[8%] w-14 sm:w-16 text-flame-500 dark:text-apricot-deep/85 animate-wobble" />
    <Burst className="absolute top-[37%] left-[3.5%] w-8 sm:w-10 text-flame-400/70 dark:text-apricot/30 animate-floaty" style={{ animationDuration: '7s' }} />
    <QuarterArcs className="absolute -bottom-12 -left-12 w-44 sm:w-56 text-flame-300/60 dark:text-apricot/[.10]" />

    {/* KANAN: arch → halftone bola oren → perforasi → struk */}
    <Arch className="absolute -top-8 -right-7 w-32 sm:w-44 rotate-[7deg] text-flame-400/90 dark:text-apricot-dim/50" />
    <Halftone w={8} h={8} gap={18} mask={sphereMask}
      className="absolute top-[7%] right-[15%] w-28 sm:w-40 text-flame-500/50 dark:text-apricot/20" />
    <TearLine className="hidden sm:block absolute right-2.5 top-1/2 -translate-y-1/2 h-52 w-3 text-flame-400/35 dark:text-white/[.08]" />
    <Receipt className="hidden sm:block absolute -bottom-9 right-[3%] w-24 sm:w-28 rotate-[9deg] text-flame-600/[.17] dark:text-apricot/[.08]" />

    {/* TENGAH-BAWAH: gelombang topografi + barcode POS */}
    <WavyLines className="hidden sm:block absolute bottom-[6%] left-[30%] w-32 text-[#B9BFC9]/60 dark:text-white/[.07]" />
    <Barcode className="hidden sm:block absolute bottom-[7%] right-[26%] w-20 rotate-[-5deg] text-ink-faint/55 dark:text-white/[.12]" />
    <div className="absolute top-[48%] right-[6%] w-3 h-3 rounded-full bg-flame-400/70 dark:bg-apricot/25 animate-floaty" style={{ animationDuration: '8s', animationDelay: '1.2s' }} />
  </div>
);

export const LockScreen = ({ onUnlock }) => {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState('pusat');           // pusat | cabang | station
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [inputId, setInputId] = useState("");
  const [inputPass, setInputPass] = useState("");
  const [stationCode, setStationCode] = useState('');   // mode Station: POS-001
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [tenantData, setTenantData] = useState(null);
  const [err, setErr] = useState('');

  // v15 F0: rekaman cabang yang lolos password DISIMPAN DI MEMORI SAJA
  // (tidak pernah masuk localStorage) — dipakai verifikasi PIN langkah 2.
  const branchMem = useRef([]);

  const triggerAlert = (msg) => setErr(msg);

  // v15 F0: gate percobaan PIN/password per perangkat (5 gagal → lock 5 menit)
  const gateCheck = (key) => {
    const st = pinGate.status(key);
    if (st.locked) { triggerAlert(pinGateMsg(st)); return false; }
    return true;
  };

  const handleTenantLogin = async () => {
    setErr('');
    if (!inputId) return triggerAlert("Isi ID Toko dulu, ya!");

    // v15 F0: sesi anonymous Firebase dibuka dulu — prasyarat rules v15
    // (request.auth != null) untuk SEMUA pembacaan Firestore berikutnya.
    await ensureAuth();

    /* ===== LOGIN POS STATION =====
       Perangkat kasir: ID Toko + kode station + PIN station.
       Tanpa password owner di monitor kasir. Station aktif
       langsung ke konteks POS cabangnya (role kasir + isStation). */
    if (mode === 'station') {
      if (!stationCode.trim() || !inputPass) return triggerAlert('Isi kode station & PIN station-nya.');
      const gateKey = `station:${inputId.toLowerCase()}:${stationCode.trim().toLowerCase()}`;
      if (!gateCheck(gateKey)) return;
      setLoading(true);
      try {
        const docRef = doc(db, "licenses", inputId.toLowerCase());
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) { triggerAlert('ID Toko tidak ditemukan!'); setLoading(false); return; }
        const data = docSnap.data(); data.id = docSnap.id;
        if (!data.active) { triggerAlert('Akun toko dinonaktifkan admin.'); setLoading(false); return; }
        if (new Date() > new Date(data.validUntil)) { triggerAlert('Masa aktif habis.'); setLoading(false); return; }

        const snap = await getDocs(collection(db, 'tenants', data.id, 'stations'));
        const st = snap.docs.map(d => ({ cid: d.id, ...d.data() }))
          .find(s => String(s.code || '').toLowerCase() === stationCode.trim().toLowerCase());
        if (!st) { triggerAlert('Kode station tidak ditemukan. Cek di Manajemen Cabang bagian POS Station.'); setLoading(false); return; }
        if (!st.active) { triggerAlert('Station ini sedang dinonaktifkan Owner.'); setLoading(false); return; }
        // v15 F0: PIN station diverifikasi hash (fallback plaintext legacy + upgrade)
        if (!(await verifyCred(inputPass.trim(), st, 'pin', 'cred'))) {
          const gst = pinGate.fail(gateKey);
          triggerAlert(gst.locked ? pinGateMsg(gst) : `PIN station salah! Sisa ${5 - gst.fails} percobaan.`);
          setLoading(false); return;
        }
        pinGate.reset(gateKey);
        if (credIsLegacy(st, 'cred')) upgradeCred(['tenants', data.id, 'stations', st.cid], inputPass.trim(), 'pin', 'cred');

        const sessionData = {
          ...data, currentUserRole: 'kasir', isStation: true,
          stationCode: st.code, stationCid: st.cid,
          branchId: st.branchId || 'PUSAT', branchName: st.branchName || 'Cabang',
          employeeName: null, employeeId: null
        };
        syncSession('LOGIN_STATION', sessionData);
        auditLog(sessionData, 'LOGIN_STATION', { target: st.code });
        onUnlock(sessionData);
      } catch (error) { triggerAlert('Error Koneksi: ' + error.message); }
      setLoading(false);
      return;
    }

    if (!inputPass) return triggerAlert("Isi password dulu, ya!");
    setLoading(true);
    try {
      const docRef = doc(db, "licenses", inputId.toLowerCase());
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        data.id = docSnap.id;
        if (!data.active) { triggerAlert("Akun dinonaktifkan Admin."); setLoading(false); return; }
        if (new Date() > new Date(data.validUntil)) { triggerAlert("Masa aktif habis."); setLoading(false); return; }

        if (mode === 'cabang') {
          // LOGIN CABANG (v15 F0): password dicocokkan ke hash cred tiap
          // cabang (fallback plaintext legacy + auto-upgrade). Rekaman
          // lengkap hanya di memori; versi sanitasi saja yang pernah
          // menyentuh localStorage.
          const snap = await getDocs(collection(db, 'tenants', data.id, 'cabang'));
          const list = snap.docs.map(d => ({ cid: d.id, ...d.data() }));
          const matches = [];
          for (const b of list) {
            if (await verifyCred(inputPass, b, 'password', 'credPass')) matches.push(b);
          }
          if (!matches.length) { triggerAlert("Password cabang salah / belum ada cabang terdaftar."); setLoading(false); return; }
          // upgrade credential cabang legacy pertama yang cocok
          const legacyHit = matches.find(b => credIsLegacy(b, 'credPass'));
          if (legacyHit) upgradeCred(['tenants', data.id, 'cabang', legacyHit.cid], inputPass, 'password', 'credPass');
          branchMem.current = matches;
          setTenantData({ ...data, _branchList: matches.map(b => ({ cid: b.cid, name: b.name, role: b.role })) });
          setBranchId(matches[0].cid);
          setStep(2); // PIN karyawan cabang
        } else {
          // LOGIN OWNER (v15 F0): password diverifikasi hash cred (fallback
          // plaintext legacy + auto-upgrade). Rate-limit per toko+perangkat.
          const gateKey = `owner:${inputId.toLowerCase()}`;
          if (!(await verifyCred(inputPass, data, 'password', 'credPass'))) {
            const gst = pinGate.fail(gateKey);
            triggerAlert(gst.locked ? pinGateMsg(gst) : "Password salah. Coba ingat lagi!");
            setLoading(false); return;
          }
          pinGate.reset(gateKey);
          if (credIsLegacy(data, 'credPass')) upgradeCred(['licenses', data.id], inputPass, 'password', 'credPass');
          setTenantData(data);
          setStep(2); // Lanjut ke PIN Karyawan / Owner
        }
      } else { triggerAlert("ID Tenant tidak ditemukan!"); }
    } catch (error) { triggerAlert("Error Koneksi: " + error.message); }
    setLoading(false);
  };

  const handlePinLogin = async () => {
    setErr('');
    const branchRec = branchMem.current.find(b => b.cid === branchId) || null;
    const branchMeta = tenantData?._branchList?.find(b => b.cid === branchId) || null;
    let role = null;
    let employeeName = null, employeeId = null;
    const gateKey = `pin:${tenantData?.id || inputId.toLowerCase()}:${branchId || 'pusat'}`;
    if (!gateCheck(gateKey)) return;

    if (branchMeta && branchRec) {
      // SESI CABANG (v15 F0): PIN diverifikasi hash credPin cabang
      if (await verifyCred(pin, branchRec, 'pin', 'credPin')) {
        role = branchMeta.role || branchRec.role || 'admin';
        if (credIsLegacy(branchRec, 'credPin')) upgradeCred(['tenants', tenantData.id, 'cabang', branchRec.cid], pin, 'pin', 'credPin');
      }
      employeeName = branchMeta.name ? `Staf ${branchMeta.name}` : 'Staf Cabang';
    } else if (tenantData && !branchMeta) {
      // OWNER PUSAT (v15 F0): ownerPin hash credPin (fallback plaintext)
      if (await verifyCred(pin, tenantData, 'ownerPin', 'credPin')) {
        role = "owner";
        if (credIsLegacy(tenantData, 'credPin')) upgradeCred(['licenses', tenantData.id], pin, 'ownerPin', 'credPin');
      }
    }

    if (role) {
      pinGate.reset(gateKey);
      // v15 F0: sesi disanitasi penuh — password/ownerPin/cred/_branchList
      // kredensial TIDAK PERNAH masuk localStorage (sanitizeSession di App).
      const sessionData = {
        ...tenantData, currentUserRole: role,
        employeeName, employeeId,
        ...(branchMeta ? { branchId: branchMeta.cid, branchName: branchMeta.name, isBranch: true } : { branchId: 'PUSAT' })
      };
      syncSession('LOGIN', sessionData);
      auditLog(sessionData, branchMeta ? 'LOGIN_CABANG' : (role === 'owner' ? 'LOGIN_OWNER' : 'LOGIN_KARYAWAN'), { target: sessionData.id }, { actorRole: role });
      onUnlock(sessionData);
    } else {
      const gst = pinGate.fail(gateKey);
      triggerAlert(gst.locked ? pinGateMsg(gst) : "PIN salah atau akses ditolak!");
      setPin('');
    }
  };

  const pinKeys = ['1','2','3','4','5','6','7','8','9','del','0','go'];

  return (
    <div className="min-h-screen bg-paper dark:bg-night flex items-stretch">

      {/* ============ PANEL BRAND (desktop saja) ============ */}
      <aside className="hidden lg:flex w-[44%] xl:w-[42%] bg-chrome-deep relative flex-col justify-between p-12 overflow-hidden">
        {/* dekor: komposisi cetak aprikot — arc, halftone, struk, gelombang */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-flame-500/10 blur-3xl"></div>
        <div className="absolute -bottom-28 -left-20 w-72 h-72 rounded-full bg-apricot/[.07] blur-3xl"></div>
        <QuarterArcs className="absolute -top-16 -right-16 w-64 text-apricot/[.10]" />
        <Halftone w={9} h={9} gap={18} mask={sphereMask} className="absolute -bottom-10 -right-10 w-56 text-apricot/[.08]" />
        <Receipt className="absolute top-[9%] right-[34%] w-20 rotate-[10deg] text-apricot/[.07]" />
        <WavyLines className="absolute bottom-20 left-10 w-32 text-white/[.06]" />
        <Burst className="absolute top-[52%] right-5 w-8 text-flame-500/25 animate-floaty" style={{ animationDuration: '7.5s' }} />

        <div className="relative">
          <BrandLockup theme="dark" size="lg" withTagline endorsement />
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-[40px] font-extrabold text-ink-inv tracking-tight leading-[1.12]">
            Kelola bisnismu,<br />
            <span className="text-flame-400">lebih gampang.</span>
          </h2>
          <p className="text-ink-inv/60 text-sm font-semibold mt-4 leading-relaxed">
            Dari kasir sampai laporan, semuada ada di satu tempat. Dibuat untuk usaha yang mau naik kelas.
          </p>

          {/* Maskot asli WELP sedang bekerja + catatan tangan */}
          <div className="relative mt-8 mb-6">
            <Mascot pose="kerja" className="w-48 h-48 object-contain animate-floaty" alt="Maskot WELP sedang bekerja" />
            <p className="font-hand text-xl text-flame-300 absolute top-2 right-2 rotate-[-8deg] leading-tight text-center">Langkah kecil,<br/>maju besar!</p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {[
              { icon: HppCalc, title: 'HPP presisi', desc: 'Untung asli tiap produk' },
              { icon: Kasir, title: 'Kasir ngebut', desc: 'Barcode & QRIS langsung jalan' },
              { icon: Laporan, title: 'Laba nyata', desc: 'Bukan tebakan-tebakan' },
              { icon: Pindai, title: 'Siap perangkat', desc: 'Printer & scanner siap' },
            ].map((f, i) => (
              <div key={i} className="flex gap-3 items-start bg-white/[.04] border border-chrome-edge rounded-2xl p-3">
                <f.icon className="w-8 h-8 shrink-0 text-ink-inv" />
                <div className="min-w-0">
                  <p className="text-ink-inv font-extrabold text-[12px] leading-tight">{f.title}</p>
                  <p className="text-ink-inv/45 text-[10.5px] mt-0.5 leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-ink-inv/30 text-[10px] font-bold uppercase tracking-[0.2em]">© WELP by JUSTru Group · Teman usahamu</p>
      </aside>

      {/* ============ PANEL FORM (dengan dekor gradien) ============ */}
      <main className="flex-1 relative flex flex-col items-center justify-center p-5 sm:p-8 overflow-hidden">
        <LoginDecor />

        {/* Lockup mobile/tablet: WELP + tagline + by JUSTru GROUP
            (sebelumnya BrandLogo polos tanpa JUSTru — kini lengkap) */}
        <div className="lg:hidden absolute top-5 sm:top-7 left-1/2 -translate-x-1/2 z-10">
          <BrandLockup size="lg" align="center" withTagline endorsement />
        </div>

        <div className="w-full max-w-[410px] animate-rise z-10 mt-[132px] sm:mt-[146px] lg:mt-0">
          <div className="card p-7 sm:p-8 relative overflow-visible">
            {/* maskot kecil menyapa di sudut kartu (pengganti emoji) */}
            <Mascot pose="menyapa" className="hidden sm:block absolute -top-12 -right-4 w-20 h-20 object-contain pointer-events-none" alt="" />
            {step === 1 ? (
              <>
                <h1 className="text-[26px] font-display font-extrabold text-ink dark:text-ink-inv tracking-tight">Selamat datang!</h1>
                <p className="text-xs text-ink-faint font-bold mt-1 mb-4">Masuk pakai akun tokomu untuk lanjut.</p>

                {/* Mode: Pusat / Cabang / Station */}
                <div className="grid grid-cols-3 gap-1.5 mb-5 p-1 bg-paper dark:bg-white/5 rounded-2xl">
                  {[
                    { id: 'pusat', label: 'Owner', icon: GembokBuddy },
                    { id: 'cabang', label: 'Cabang', icon: Cabang },
                    { id: 'station', label: 'Station', icon: LayarBuddy },
                  ].map(m => (
                    <button key={m.id} type="button" onClick={() => { setMode(m.id); setErr(''); }}
                      className={`flex items-center justify-center gap-1 py-2.5 rounded-xl text-[10.5px] font-extrabold transition press ${mode === m.id ? 'bg-flame-500 text-white shadow-card' : 'text-ink-faint hover:text-ink-soft dark:hover:text-ink-inv'}`}>
                      <m.icon className="w-3.5 h-3.5" /> {m.label}
                    </button>
                  ))}
                </div>

                {err && (
                  <div className="mb-4 px-4 py-3 rounded-2xl bg-brick-soft dark:bg-brick/10 border border-brick/25 text-brick-deep dark:text-brick text-xs font-bold animate-pop">
                    {err}
                  </div>
                )}

                <div className="space-y-4 text-left">
                  <div>
                    <label className="kicker block mb-1.5 ml-0.5">ID Toko</label>
                    <input value={inputId} onChange={e => setInputId(e.target.value)} className="field-lg" placeholder="misal: kopi-senja" autoComplete="username" />
                  </div>
                  {mode === 'station' ? (
                    <>
                      <div>
                        <label className="kicker block mb-1.5 ml-0.5">Kode Station</label>
                        <input value={stationCode} onChange={e => setStationCode(e.target.value)}
                          className="field-lg font-mono" placeholder="POS-001" autoComplete="off" />
                      </div>
                      <div>
                        <label className="kicker block mb-1.5 ml-0.5">PIN Station</label>
                        <input type="password" value={inputPass} onChange={e => setInputPass(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleTenantLogin()}
                          className="field-lg" placeholder="6 digit dari Owner" autoComplete="current-password" />
                      </div>
                      <p className="text-[10px] text-ink-faint font-bold flex items-center gap-1.5">
                        <LayarBuddy className="w-3.5 h-3.5 text-flame-500" /> Mode perangkat kasir: station menetap di monitor, kasir login pribadi setelahnya.
                      </p>
                    </>
                  ) : (
                    <div>
                      <label className="kicker block mb-1.5 ml-0.5">{mode === 'cabang' ? 'Password Cabang' : 'Password'}</label>
                      <input type="password" value={inputPass} onChange={e => setInputPass(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleTenantLogin()}
                        className="field-lg" placeholder="••••••••" autoComplete="current-password" />
                    </div>
                  )}
                  <button onClick={handleTenantLogin} disabled={loading}
                    className="w-full mt-2 bg-flame-600 hover:bg-flame-500 text-white py-3.5 rounded-2xl font-extrabold text-sm transition disabled:opacity-60 shadow-card flex items-center justify-center gap-2 press">
                    {loading ? (<><span className="spinner-ring"></span> Memeriksa...</>) : (mode === 'station' ? 'Aktifkan Station' : 'Masuk')}
                  </button>
                  <p className="text-[10px] text-ink-faint mt-3 flex items-center justify-center gap-1.5 font-bold">
                    <GembokBuddy className="w-3 h-3" /> Koneksi terenkripsi, data toko aman
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <Kredensial className="w-6 h-6 text-flame-500" />
                  <h1 className="text-[26px] font-display font-extrabold text-ink dark:text-ink-inv tracking-tight">PIN Akses</h1>
                </div>
                <p className="text-xs text-ink-faint font-bold mt-1 mb-4">
                  {tenantData?._branchList
                    ? <span>Pilih cabang, lalu masukkan PIN cabangnya.</span>
                    : <span>Halo, <span className="text-flame-700 dark:text-apricot font-extrabold">{tenantData?.tenant || 'Tenant'}</span>! Masuk sebagai Owner atau Karyawan?</span>}
                </p>
                {tenantData?._branchList && (
                  <div className="flex flex-wrap gap-2 justify-center mb-4">
                    {tenantData._branchList.map(b => (
                      <button key={b.cid} type="button" onClick={() => setBranchId(b.cid)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-extrabold border-2 transition press ${branchId === b.cid ? 'border-flame-500 bg-flame-50 dark:bg-flame-900/25 text-flame-700 dark:text-apricot' : 'border-line dark:border-line-dark text-ink-faint hover:border-flame-300'}`}>
                        <Cabang className="w-4 h-4" /> {b.name}
                      </button>
                    ))}
                  </div>
                )}

                {err && (
                  <div className="mb-4 px-4 py-3 rounded-2xl bg-brick-soft dark:bg-brick/10 border border-brick/25 text-brick-deep dark:text-brick text-xs font-bold animate-pop">
                    {err}
                  </div>
                )}

                <div className="flex gap-2 justify-center mb-5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className={`w-9 h-11 rounded-2xl border-2 flex items-center justify-center transition-all ${
                      i < pin.length ? 'border-flame-500 bg-flame-50 dark:bg-flame-900/25' : 'border-line dark:border-line-dark bg-paper dark:bg-night/60'
                    }`}>
                      {i < pin.length && <div className="w-2.5 h-2.5 rounded-full bg-flame-500 animate-pop"></div>}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {pinKeys.map(k => {
                    if (k === 'del') return (
                      <button key={k} onClick={() => setPin(prev => prev.slice(0, -1))} aria-label="Hapus"
                        className="h-14 rounded-2xl bg-brick-soft dark:bg-brick/10 text-brick flex items-center justify-center transition active:scale-95 press">
                        <HapusBuddy className="w-5 h-5" />
                      </button>
                    );
                    if (k === 'go') return (
                      <button key={k} onClick={handlePinLogin} disabled={pin.length !== 6} aria-label="Masuk"
                        className="h-14 rounded-2xl bg-flame-600 text-white flex items-center justify-center transition active:scale-95 press disabled:opacity-40 hover:bg-flame-500">
                        <PerisaiBuddy className="w-5 h-5" />
                      </button>
                    );
                    return (
                      <button key={k} onClick={() => setPin(prev => prev.length < 6 ? prev + k : prev)}
                        className="h-14 rounded-2xl bg-paper dark:bg-white/5 text-ink dark:text-ink-inv text-xl font-extrabold transition active:scale-95 press hover:bg-flame-50 dark:hover:bg-flame-900/20">
                        {k}
                      </button>
                    );
                  })}
                </div>

                <button onClick={() => { setStep(1); setPin(''); setErr(''); }}
                  className="w-full mt-4 py-3 rounded-2xl text-xs font-extrabold text-ink-faint hover:text-ink-soft dark:hover:text-ink-inv transition">
                  Ganti akun
                </button>
              </>
            )}
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-5">
            <Lisensi className="w-3.5 h-3.5 text-flame-600 dark:text-apricot" />
            <p className="text-[10px] font-bold text-ink-faint uppercase tracking-widest">Lisensi terkelola · WELP v15.1</p>
          </div>
        </div>

        {/* maskot kecil menyapa di pojok mobile */}
        <Mascot pose="menyapa" className="lg:hidden fixed bottom-5 right-4 w-20 h-20 object-contain opacity-90 pointer-events-none" alt="" />
      </main>
    </div>
  );
};

export const BannedScreen = ({ id }) => (
  <div className="min-h-screen bg-brick-deep flex items-center justify-center p-4 text-white text-center">
    <div className="animate-rise">
      <div className="w-24 h-24 mx-auto mb-5 bg-white/10 rounded-full flex items-center justify-center">
        <GembokBuddy className="w-10 h-10 opacity-70" />
      </div>
      <h1 className="font-display text-3xl font-extrabold mb-2 tracking-tight">Akses Diblokir</h1>
      <p className="opacity-80 text-sm">ID Aplikasi ({id}) masuk daftar hitam. Hubungi admin untuk bantuan.</p>
    </div>
  </div>
);

export const RestoredScreen = ({ onContinue }) => (
  <div className="min-h-screen bg-chrome-deep flex items-center justify-center p-4 text-white text-center relative overflow-hidden">
    <QuarterArcs className="absolute -top-20 -right-20 w-80 text-white/[.05]" />
    <Halftone w={9} h={9} gap={18} mask={sphereMask} className="absolute -bottom-10 -left-10 w-56 text-flame-400/[.14]" />
    <div className="animate-rise relative">
      <Mascot pose="senang" className="w-28 h-28 object-contain mx-auto mb-4" alt="" />
      <h1 className="font-display text-3xl font-extrabold mb-2 tracking-tight">Akses Dipulihkan</h1>
      <p className="opacity-70 text-sm mb-5">Sesi balik lagi. Siap jualan?</p>
      <button onClick={onContinue} className="bg-flame-500 text-white px-8 py-3 rounded-2xl font-extrabold hover:bg-flame-400 transition press">Lanjutkan</button>
      <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.25em] opacity-40">WELP by JUSTru Group</p>
    </div>
  </div>
);
