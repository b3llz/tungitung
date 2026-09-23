// ============================================================
// DEVELOPER PANEL v8 — route ?dev=panel. Logika 100% sama:
// Firebase Auth (email/password developer), registrasi tenant ke
// Firestore `licenses`, onSnapshot daftar tenant, suspend/aktif,
// hapus, salin kredensial.
// TAMPILAN BARU: mengikuti style aplikasi WELP — kartu surface,
// gradasi flame, ikon Buddy, stat ringkas, badge status.
// ============================================================
import React, { useState, useEffect } from 'react';
import { db, auth, fileToDataUrl, hexToTriplet, writeBrandMirror } from './core.jsx';
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from 'firebase/auth';
import {
  collection, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy
} from 'firebase/firestore';
import { AppSymbol, Mascot } from './brand.jsx';
import {
  PerisaiBuddy, GembokBuddy, Lisensi, Trash2, Copy, Check,
  MonitorPusat, Kredensial, WaktuReal, BahayaBuddy, KoinBuddy, Terang, Gelap, Toko
} from './welp-icons.jsx';

export const DeveloperPanel = () => {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authErr, setAuthErr] = useState('');
  const [storeName, setStoreName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [password, setPassword] = useState('');
  const [ownerPin, setOwnerPin] = useState('');
  const [licType, setLicType] = useState('BASIC');
  const [durVal, setDurVal] = useState(1);
  const [durUnit, setDurUnit] = useState('month');
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [toast, setToast] = useState('');
  const [accessErr, setAccessErr] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // ===== FITUR CUSTOM APLIKASI (white-label) =====
  // Perusahaan yang mau custom bisa request ke developer. Developer
  // memilih tenant di sini, menyalakan custom, menaruh logo perusahaan,
  // lalu memilih warna UI (merah/biru/hijau/kustom sesuai identitas).
  // Logo WELP otomatis diganti logo perusahaan + endorsement jadi "by WELP".
  const [cbTenant, setCbTenant] = useState('');
  const [cbForm, setCbForm] = useState({ aktif: false, namaPerusahaan: '', logo: null, warna: 'oren', warnaHex: '#E2483D' });
  const [cbBusy, setCbBusy] = useState(false);
  const [cbLogoBusy, setCbLogoBusy] = useState(false);

  useEffect(() => {
    if (!cbTenant) return;
    setCbBusy(true);
    getDoc(doc(db, 'tenants', cbTenant, 'pengaturan', 'branding'))
      .then(snap => {
        const d = snap.data();
        setCbForm(d ? {
          aktif: !!d.aktif, namaPerusahaan: d.namaPerusahaan || '', logo: d.logo || null,
          warna: d.warna || 'oren', warnaHex: d.warnaHex || '#E2483D'
        } : { aktif: false, namaPerusahaan: '', logo: null, warna: 'oren', warnaHex: '#E2483D' });
      })
      .catch(() => showToast('Gagal memuat konfigurasi custom tenant ini.'))
      .finally(() => setCbBusy(false));
  }, [cbTenant]);

  const pickCbLogo = async (file) => {
    if (!file) return;
    setCbLogoBusy(true);
    try {
      const logoUrl = await fileToDataUrl(file, 480, 0.8);
      setCbForm(f => ({ ...f, logo: logoUrl }));
    }
    catch (e) { showToast('Gagal memuat logo: ' + (e.message || 'coba lagi')); }
    setCbLogoBusy(false);
  };

  const previewBrand = () => {
    // Pratinjau langsung terasa di console: logo & warna berubah sebelum disimpan.
    // Kustom mati → kembali ke tampilan WELP biasa.
    writeBrandMirror(cbForm.aktif ? { key: 'branding', ...cbForm } : null);
  };

  const saveCustom = async () => {
    if (!cbTenant) return showToast('Pilih tenant dulu.');
    if (cbForm.aktif && cbForm.warna === 'kustom' && !hexToTriplet(cbForm.warnaHex)) return showToast('Warna kustom tidak valid (format #RRGGBB).');
    setCbBusy(true);
    try {
      await setDoc(doc(db, 'tenants', cbTenant, 'pengaturan', 'branding'), {
        key: 'branding', ...cbForm,
        updatedAt: Date.now(), updatedBy: auth.currentUser ? auth.currentUser.email : 'developer'
      });
      showToast('Custom aplikasi tersimpan! Tenant langsung memakai identitas barunya.');
    } catch (e) { showToast('Gagal simpan: ' + (e.message || e.code)); }
    setCbBusy(false);
  };

  // Kontrol tema dev: uji Light & Dark mode langsung dari panel.
  // Preferensi tersimpan di localStorage 'theme' (satu sumber dgn app).
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);
  const toggleDark = () => {
    const nd = !dark; setDark(nd);
    localStorage.setItem('theme', nd ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', nd);
  };

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };

  useEffect(() => {
    // Robustness: bila Firebase gagal init, jangan panggil onAuthStateChanged(null).
    if (!auth) { setAuthReady(true); return; }
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthReady(true); });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const qy = query(collection(db, 'licenses'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(qy, (snap) => { setAccessErr(''); setClients(snap.docs.map((d) => ({ ...d.data(), id: d.id }))); }, (err) => setAccessErr('Akun ini tidak punya izin admin (cek Firestore Rules): ' + err.code));
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const base = storeName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    setTenantId(base);
  }, [storeName]);

  const doLogin = async () => {
    if (!email || !pass) { setAuthErr('Isi email & password developer.'); return; }
    setAuthErr(''); setAuthLoading(true);
    try { await signInWithEmailAndPassword(getAuth(), email.trim(), pass); }
    catch (e) { setAuthErr('Login gagal: ' + (e.code || e.message)); }
    setAuthLoading(false);
  };
  const doLogout = () => signOut(getAuth());

  const genPass = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let p = '';
    for (let i = 0; i < 6; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setPassword(p.slice(0, 3) + '-' + p.slice(3, 6));
  };
  const genPin = () => setOwnerPin(String(Math.floor(100000 + Math.random() * 900000)));

  const saveTenant = async () => {
    if (!storeName || !tenantId || !password || !ownerPin) return showToast('Data belum lengkap!');
    setSaving(true);
    const date = new Date();
    if (durUnit === 'month') date.setMonth(date.getMonth() + Number(durVal));
    if (durUnit === 'year') date.setFullYear(date.getFullYear() + Number(durVal));
    if (durUnit === 'day') date.setDate(date.getDate() + Number(durVal));
    try {
      await setDoc(doc(db, 'licenses', tenantId.toLowerCase()), {
        id: tenantId.toLowerCase(), password, ownerPin, tenant: storeName, type: licType,
        active: true, validUntil: date.toISOString(), createdAt: new Date().toISOString(),
        createdBy: auth.currentUser ? auth.currentUser.email : 'unknown'
      });
      showToast('Tenant ' + storeName + ' berhasil didaftarkan!');
      setStoreName(''); setTenantId(''); setPassword(''); setOwnerPin('');
    } catch (e) { showToast('Gagal simpan: ' + e.message); }
    setSaving(false);
  };
  const toggleStatus = (id, status) => updateDoc(doc(db, 'licenses', id), { active: status }).catch((e) => showToast('Gagal: ' + e.code));
  const delTenant = (id) => { if (confirm('Hapus tenant ' + id + ' permanen?')) deleteDoc(doc(db, 'licenses', id)).catch((e) => showToast('Gagal: ' + e.code)); };
  const copyText = (txt, id) => { navigator.clipboard.writeText(txt); setCopiedId(id); showToast('Disalin!'); setTimeout(() => setCopiedId(null), 1500); };

  const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso) - new Date()) / 864e5));

  if (!authReady) {
    return <div className="min-h-screen bg-paper dark:bg-chrome-deep flex items-center justify-center"><div className="spinner-ring"></div></div>;
  }

  /* ---------------- LOGIN SCREEN ---------------- */
  if (!user) {
    return (
      <div className="min-h-screen bg-paper dark:bg-chrome-deep flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-flame-200/50 dark:bg-flame-500/15 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#E9ECF1]/90 dark:bg-apricot/10 rounded-full blur-3xl"></div>
        {/* kontrol tema: dev bisa uji light/dark sebelum login */}
        <button onClick={toggleDark} aria-label="Ganti tema" className="absolute top-4 right-4 w-10 h-10 rounded-full bg-surface dark:bg-white/5 border border-line dark:border-chrome-edge text-ink-faint dark:text-ink-inv/60 flex items-center justify-center transition">
          {dark ? <Terang className="w-4.5 h-4.5" /> : <Gelap className="w-4.5 h-4.5" />}
        </button>
        <div className="relative w-full max-w-sm bg-surface dark:bg-chrome-panel/90 backdrop-blur-xl border border-line dark:border-chrome-edge rounded-3xl p-7 shadow-pop animate-rise">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-flame-400 to-flame-600 flex items-center justify-center shadow-card mb-3">
              <AppSymbol className="w-10 h-10 text-white" />
            </div>
            <h1 className="font-display text-ink dark:text-ink-inv font-extrabold text-lg">WELP Developer Console</h1>
            <p className="text-[10px] text-ink-faint dark:text-ink-inv/40 font-bold uppercase tracking-[0.2em] mt-1">by JUSTru Group</p>
            <p className="text-[11px] text-ink-faint dark:text-ink-inv/50 font-bold mt-2 flex items-center gap-1.5"><PerisaiBuddy className="w-4 h-4 text-flame-500" /> Area terbatas · khusus developer</p>
          </div>
          <div className="space-y-3">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email developer" className="w-full bg-paper dark:bg-chrome-deep/80 border border-line dark:border-chrome-edge text-ink dark:text-ink-inv text-sm font-bold p-3.5 rounded-2xl outline-none focus:border-flame-400 transition" />
            <input value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doLogin()} type="password" placeholder="Password" className="w-full bg-paper dark:bg-chrome-deep/80 border border-line dark:border-chrome-edge text-ink dark:text-ink-inv text-sm font-bold p-3.5 rounded-2xl outline-none focus:border-flame-400 transition" />
            {authErr && <p className="text-brick text-[11px] font-bold text-center flex items-center justify-center gap-1.5"><BahayaBuddy className="w-4 h-4" /> {authErr}</p>}
            <button onClick={doLogin} disabled={authLoading} className="w-full py-3.5 rounded-2xl bg-flame-600 hover:bg-flame-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 disabled:opacity-60 press shadow-card">{authLoading ? <span className="spinner-ring !border-white/30 !border-t-white"></span> : <><GembokBuddy className="w-4 h-4" /> Masuk Console</>}</button>
          </div>
          <p className="text-[10px] text-ink-faint dark:text-ink-inv/40 text-center mt-5 leading-relaxed">Login memakai Firebase Authentication (Email/Password). Buat akun developer di Firebase Console terlebih dahulu.</p>
        </div>
      </div>
    );
  }

  /* ---------------- CONSOLE ---------------- */
  const activeCount = clients.filter(c => c.active).length;
  const suspendCount = clients.length - activeCount;
  const proCount = clients.filter(c => c.type === 'PRO' || c.type === 'PREMIUM').length;
  const stats = [
    { label: 'Tenant', value: clients.length, icon: MonitorPusat, tone: 'text-flame-700 dark:text-apricot' },
    { label: 'Aktif', value: activeCount, icon: PerisaiBuddy, tone: 'text-leaf-deep dark:text-leaf' },
    { label: 'Suspend', value: suspendCount, icon: BahayaBuddy, tone: 'text-brick' },
    { label: 'PRO', value: proCount, icon: Lisensi, tone: 'text-gold-deep dark:text-gold' },
  ];

  return (
    <div className="min-h-screen bg-paper dark:bg-chrome-deep text-ink dark:text-ink-inv pb-24">
      {/* header gradasi */}
      <nav className="sticky top-0 z-30 bg-gradient-to-r from-flame-600 via-flame-500 to-flame-600 px-4 py-3.5 shadow-pop">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur text-white flex items-center justify-center"><MonitorPusat className="w-5.5 h-5.5" /></div>
            <div>
              <h1 className="font-display font-extrabold text-sm leading-none text-white">Developer Console</h1>
              <p className="text-[10px] text-white/70 font-bold mt-1">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleDark} aria-label="Ganti tema" className="w-9 h-9 rounded-2xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition press">
              {dark ? <Terang className="w-4.5 h-4.5" /> : <Gelap className="w-4.5 h-4.5" />}
            </button>
            <button onClick={doLogout} className="text-[11px] font-extrabold text-white/90 bg-white/15 hover:bg-white/25 px-4 py-2.5 rounded-2xl transition press">Keluar</button>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        {accessErr && <div className="bg-brick-soft dark:bg-brick/15 border border-brick/30 text-brick-deep dark:text-brick text-[11px] font-bold p-3.5 rounded-2xl flex items-start gap-2"><BahayaBuddy className="w-4 h-4 shrink-0 mt-0.5" /> {accessErr}</div>}

        {/* stat ringkas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(s => (
            <div key={s.label} className="bg-surface dark:bg-chrome-panel border border-line dark:border-chrome-edge rounded-3xl p-4 shadow-card">
              <s.icon className={`w-6 h-6 mb-2 ${s.tone}`} />
              <p className="text-2xl font-extrabold money leading-none text-ink dark:text-ink-inv">{s.value}</p>
              <p className="kicker mt-1.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* registrasi tenant */}
        <div className="bg-surface dark:bg-chrome-panel/70 border border-line dark:border-chrome-edge rounded-[1.6rem] p-5 shadow-card">
          <h2 className="font-extrabold text-base mb-4 flex items-center gap-2"><Lisensi className="w-5.5 h-5.5 text-flame-600 dark:text-apricot" /> Registrasi Tenant</h2>
          <div className="space-y-3">
            <div>
              <label className="kicker block mb-1 ml-0.5">Nama Client / Toko</label>
              <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Contoh: Kopi Senja" className="field" />
            </div>
            <div>
              <label className="kicker block mb-1 ml-0.5">ID Tenant (username login)</label>
              <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="field lowercase" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="kicker block mb-1 ml-0.5">Password</label>
                <div className="flex gap-2">
                  <input value={password} onChange={(e) => setPassword(e.target.value)} className="field flex-1 min-w-0 font-mono" />
                  <button onClick={genPass} className="px-3 rounded-xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot text-xs font-extrabold border border-flame-200 dark:border-flame-500/30 press">Acak</button>
                </div>
              </div>
              <div>
                <label className="kicker block mb-1 ml-0.5">Owner PIN (6 digit)</label>
                <div className="flex gap-2">
                  <input value={ownerPin} onChange={(e) => setOwnerPin(e.target.value)} className="field flex-1 min-w-0 font-mono" />
                  <button onClick={genPin} className="px-3 rounded-xl bg-brick-soft dark:bg-brick/15 text-brick text-xs font-extrabold border border-brick/30 press">Acak</button>
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="kicker block mb-1 ml-0.5">Durasi Sewa</label>
                <div className="flex gap-2">
                  <input type="number" value={durVal} onChange={(e) => setDurVal(e.target.value)} className="field w-16" />
                  <select value={durUnit} onChange={(e) => setDurUnit(e.target.value)} className="field flex-1 min-w-0 bg-surface dark:bg-surface-dark"><option value="day">Hari</option><option value="month">Bulan</option><option value="year">Tahun</option></select>
                </div>
              </div>
              <div>
                <label className="kicker block mb-1 ml-0.5">Tipe Lisensi</label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-paper dark:bg-white/5 rounded-xl">
                  {['BASIC', 'PRO'].map(tp => (
                    <button key={tp} onClick={() => setLicType(tp)} className={`py-2 rounded-lg text-[11px] font-extrabold transition press ${licType === tp ? 'bg-flame-500 text-white shadow-card' : 'text-ink-faint'}`}>{tp}</button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={saveTenant} disabled={saving} className="w-full py-3.5 rounded-2xl bg-flame-600 hover:bg-flame-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 disabled:opacity-60 mt-1 press shadow-card">{saving ? <span className="spinner-ring !border-white/30 !border-t-white"></span> : <><Check className="w-4 h-4" /> Simpan ke Firebase</>}</button>
          </div>
        </div>

        {/* FITUR CUSTOM APLIKASI (white-label) */}
        <div className="bg-surface dark:bg-chrome-panel/70 border border-line dark:border-chrome-edge rounded-[1.6rem] p-5 shadow-card">
          <h2 className="font-extrabold text-base mb-1 flex items-center gap-2"><Toko className="w-5.5 h-5.5 text-flame-600 dark:text-apricot" /> Custom Aplikasi</h2>
          <p className="text-[11px] text-ink-faint dark:text-ink-inv/50 font-semibold leading-relaxed mb-4">
            Perusahaan yang mau tampilan sendiri cukup request ke developer. Nyalakan custom di tenantnya, taruh logo perusahaan, dan pilih warna UI sesuai identitasnya. Logo WELP berganti jadi logo perusahaan, dan tulisan pengembangnya jadi "by WELP".
          </p>
          <div className="space-y-3">
            <div>
              <label className="kicker block mb-1 ml-0.5">Pilih Tenant</label>
              <select value={cbTenant} onChange={(e) => setCbTenant(e.target.value)} className="field bg-surface dark:bg-surface-dark">
                <option value="">— pilih tenant —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.tenant} ({c.id})</option>)}
              </select>
            </div>
            {cbTenant && !cbBusy && (
              <>
                <button onClick={() => setCbForm(f => ({ ...f, aktif: !f.aktif }))}
                  className={`w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition press ${cbForm.aktif ? 'bg-flame-50 dark:bg-flame-900/25 border-flame-200 dark:border-flame-500/40' : 'bg-paper dark:bg-white/5 border-line dark:border-chrome-edge'}`}>
                  <span className="text-left">
                    <span className="block text-[12.5px] font-extrabold text-ink dark:text-ink-inv">Custom aktif</span>
                    <span className="block text-[10px] font-semibold text-ink-faint">Tampilan tenant ini memakai identitas perusahaannya</span>
                  </span>
                  <span className={`w-11 h-6 rounded-full p-0.5 transition-all shrink-0 ${cbForm.aktif ? 'bg-flame-600' : 'bg-line dark:bg-white/15'}`}>
                    <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${cbForm.aktif ? 'translate-x-5' : ''}`} />
                  </span>
                </button>
                <div>
                  <label className="kicker block mb-1 ml-0.5">Logo Perusahaan</label>
                  {cbForm.logo ? (
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-paper dark:bg-white/5 border border-line dark:border-chrome-edge">
                      <img src={cbForm.logo} alt="Logo perusahaan" className="h-12 w-auto max-w-[160px] object-contain" />
                      <div className="flex gap-2 ml-auto">
                        <label className="px-3 py-2 rounded-xl bg-surface dark:bg-white/5 border border-line dark:border-chrome-edge text-[10.5px] font-extrabold text-ink-soft dark:text-ink-inv/70 cursor-pointer press">Ganti
                          <input type="file" accept="image/*" className="hidden" onChange={e => pickCbLogo(e.target.files[0])} />
                        </label>
                        <button onClick={() => setCbForm(f => ({ ...f, logo: null }))} className="px-3 py-2 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick text-[10.5px] font-extrabold press">Hapus</button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-line dark:border-chrome-edge rounded-2xl cursor-pointer hover:border-flame-400 transition">
                      {cbLogoBusy ? <><span className="spinner-ring"></span><p className="text-[10px] font-bold text-ink-faint mt-1.5">Memproses logo...</p></> : <>
                        <Toko className="w-7 h-7 text-ink-faint/50 mb-1.5" />
                        <p className="text-[11px] font-extrabold text-ink-soft dark:text-ink-inv/70">Upload logo perusahaan</p>
                        <p className="text-[9px] text-ink-faint font-semibold mt-0.5">PNG/JPG, dikompres otomatis, transparan paling bagus</p>
                      </>}
                      <input type="file" accept="image/*" className="hidden" onChange={e => pickCbLogo(e.target.files[0])} />
                    </label>
                  )}
                </div>
                <div>
                  <label className="kicker block mb-1 ml-0.5">Nama Perusahaan (opsional)</label>
                  <input value={cbForm.namaPerusahaan} onChange={e => setCbForm(f => ({ ...f, namaPerusahaan: e.target.value }))} placeholder="Contoh: Kopi Senja" className="field" />
                </div>
                <div>
                  <label className="kicker block mb-1 ml-0.5">Warna UI / UX</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {['oren', 'merah', 'biru', 'hijau', 'kustom'].map(w => (
                      <button key={w} onClick={() => setCbForm(f => ({ ...f, warna: w }))}
                        className={`py-2 rounded-xl text-[10px] font-extrabold capitalize border-2 transition press ${cbForm.warna === w ? 'border-flame-500 bg-flame-50 dark:bg-flame-900/25 text-flame-700 dark:text-apricot' : 'border-line dark:border-chrome-edge text-ink-faint'}`}>
                        {w}
                      </button>
                    ))}
                  </div>
                  {cbForm.warna === 'kustom' && (
                    <div className="flex items-center gap-2 mt-2">
                      <input type="color" value={cbForm.warnaHex} onChange={e => setCbForm(f => ({ ...f, warnaHex: e.target.value }))} className="w-11 h-11 rounded-xl border border-line dark:border-chrome-edge bg-transparent cursor-pointer" />
                      <input value={cbForm.warnaHex} onChange={e => setCbForm(f => ({ ...f, warnaHex: e.target.value }))} className="field flex-1 min-w-0 font-mono" placeholder="#RRGGBB" />
                      <span className="w-11 h-11 rounded-xl border border-line dark:border-chrome-edge shrink-0" style={{ backgroundColor: cbForm.warnaHex }} />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={saveCustom} className="flex-1 py-3.5 rounded-2xl bg-flame-600 hover:bg-flame-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 press shadow-card"><Check className="w-4 h-4" /> Simpan Custom</button>
                  <button onClick={previewBrand} className="px-4 py-3.5 rounded-2xl bg-paper dark:bg-white/5 border border-line dark:border-chrome-edge text-ink-soft dark:text-ink-inv/70 font-extrabold text-sm press">Pratinjau</button>
                </div>
                <p className="text-[9.5px] text-ink-faint dark:text-ink-inv/40 font-semibold text-center">Pratinjau berlaku di console ini saja. Tekan Simpan supaya tenant ikut berubah. Matikan custom untuk kembali ke tampilan WELP biasa.</p>
              </>
            )}
            {cbTenant && cbBusy && <p className="text-[11px] font-bold text-ink-faint text-center py-3">Memuat konfigurasi...</p>}
          </div>
        </div>

        {/* daftar tenant */}
        <div>
          <h2 className="font-extrabold text-base mb-3 flex items-center gap-2 px-1"><KoinBuddy className="w-5.5 h-5.5 text-flame-600 dark:text-apricot" /> Daftar Tenant <span className="text-[11px] font-bold text-ink-faint">({clients.length})</span></h2>
          <div className="space-y-3">
            {clients.length === 0 && (
              <div className="text-center py-12">
                <Mascot pose="pikir" className="w-20 h-20 object-contain mx-auto mb-2 opacity-80" alt="" />
                <p className="text-xs font-bold text-ink-faint">Belum ada client. Daftarkan tenant pertama di atas.</p>
              </div>
            )}
            {clients.map((c) => (
              <div key={c.id} className="bg-surface dark:bg-chrome-panel/70 border border-line dark:border-chrome-edge rounded-3xl p-4.5 shadow-card">
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-sm flex items-center gap-2 text-ink dark:text-ink-inv">{c.tenant}
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold ${c.type === 'PRO' || c.type === 'PREMIUM' ? 'bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold' : 'bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot'}`}>{c.type}</span>
                    </h4>
                    <p className="text-[10px] text-ink-faint dark:text-ink-inv/50 mt-1 font-semibold flex items-center gap-1.5">
                      <Kredensial className="w-3.5 h-3.5" /> ID: <span className="font-extrabold text-flame-700 dark:text-apricot">{c.id}</span>
                      <span className="text-ink-faint">· s/d {new Date(c.validUntil).toLocaleDateString('id-ID')} ({daysLeft(c.validUntil)} hari)</span>
                    </p>
                  </div>
                  <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-extrabold shrink-0 ${c.active ? 'text-leaf-deep dark:text-leaf bg-leaf-soft dark:bg-leaf/10' : 'text-brick bg-brick-soft dark:bg-brick/10'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.active ? 'bg-leaf animate-pulse-dot' : 'bg-brick'}`} />
                    {c.active ? 'AKTIF' : 'SUSPEND'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-paper dark:bg-chrome-deep/70 border border-line dark:border-chrome-edge p-2.5 rounded-xl flex justify-between items-center">
                    <span className="text-[9px] font-extrabold text-ink-faint flex items-center gap-1"><GembokBuddy className="w-3.5 h-3.5" /> PASS</span>
                    <button onClick={() => copyText(c.password, c.id + 'p')} className="font-mono font-extrabold text-xs text-ink dark:text-ink-inv cursor-pointer flex items-center gap-1">{copiedId === c.id + 'p' ? <Check className="w-3 h-3 text-leaf" /> : <Copy className="w-3 h-3 text-ink-faint/50" />}{c.password}</button>
                  </div>
                  <div className="bg-brick-soft dark:bg-brick/10 p-2.5 rounded-xl flex justify-between items-center">
                    <span className="text-[9px] font-extrabold text-brick">PIN</span>
                    <button onClick={() => copyText(c.ownerPin || '111111', c.id + 'n')} className="font-mono font-extrabold text-xs text-brick cursor-pointer flex items-center gap-1">{copiedId === c.id + 'n' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 opacity-40" />}{c.ownerPin || '111111'}</button>
                  </div>
                </div>
                <div className="flex gap-2">
                  {c.active
                    ? <button onClick={() => toggleStatus(c.id, false)} className="flex-1 py-2.5 rounded-xl bg-brick-soft dark:bg-white/5 border border-brick/30 text-brick text-[11px] font-extrabold press">Suspend</button>
                    : <button onClick={() => toggleStatus(c.id, true)} className="flex-1 py-2.5 rounded-xl bg-flame-600 hover:bg-flame-500 text-white text-[11px] font-extrabold press">Buka Akses</button>}
                  <button onClick={() => delTenant(c.id)} className="w-11 rounded-xl bg-paper dark:bg-white/5 border border-line dark:border-chrome-edge text-ink-faint hover:text-brick flex items-center justify-center transition press"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-[9px] font-extrabold text-ink-faint dark:text-ink-inv/25 uppercase tracking-[0.2em] flex items-center justify-center gap-1.5"><WaktuReal className="w-3.5 h-3.5" /> WELP Developer Console v8 · Fresh Ink</p>
      </div>
      {toast && <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-flame-600 text-white px-5 py-3 rounded-full shadow-pop text-sm font-extrabold animate-slide-up">{toast}</div>}
    </div>
  );
};
