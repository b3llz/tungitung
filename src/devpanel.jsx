// ============================================================
// DEVELOPER PANEL v6 WELP — route ?dev=panel. Logika 100% sama:
// Firebase Auth (email/password developer), registrasi tenant ke
// Firestore `licenses`, onSnapshot daftar tenant, suspend/aktif,
// hapus, salin kredensial. Tampilan: konsol charcoal netral +
// aksen flame.
// ============================================================
import React, { useState, useEffect } from 'react';
import { db, auth } from './core.jsx';
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from 'firebase/auth';
import {
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy
} from 'firebase/firestore';
import { AppSymbol } from './brand.jsx';
import {
  ShieldCheck, Lock, Crown, Trash2, Terminal, Copy, Check
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

  if (!authReady) {
    return <div className="min-h-screen bg-chrome-deep flex items-center justify-center"><div className="spinner-ring"></div></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-chrome-deep flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-flame-500/15 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-apricot/10 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#FFA36B 1.2px, transparent 1.2px)', backgroundSize: '26px 26px' }}></div>
        <div className="relative w-full max-w-sm bg-chrome-panel/90 backdrop-blur-xl border border-chrome-edge rounded-3xl p-7 shadow-pop animate-rise">
          <div className="flex flex-col items-center mb-6">
            <AppSymbol className="w-14 h-14 mb-3" />
            <h1 className="font-display text-ink-inv font-extrabold text-lg">WELP Developer Console</h1>
            <p className="text-[10px] text-ink-inv/40 font-bold uppercase tracking-[0.2em] mt-1">by JUSTru Group</p>
            <p className="text-[11px] text-ink-inv/50 font-bold mt-2">Area terbatas · khusus developer</p>
          </div>
          <div className="space-y-3">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email developer" className="w-full bg-chrome-deep/80 border border-chrome-edge text-ink-inv text-sm font-bold p-3.5 rounded-2xl outline-none focus:border-flame-400 transition" />
            <input value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doLogin()} type="password" placeholder="Password" className="w-full bg-chrome-deep/80 border border-chrome-edge text-ink-inv text-sm font-bold p-3.5 rounded-2xl outline-none focus:border-flame-400 transition" />
            {authErr && <p className="text-brick text-[11px] font-bold text-center">{authErr}</p>}
            <button onClick={doLogin} disabled={authLoading} className="w-full py-3.5 rounded-2xl bg-flame-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 disabled:opacity-60 press">{authLoading ? <span className="spinner-ring !border-white/30 !border-t-white"></span> : <><Lock className="w-4 h-4" /> Masuk</>}</button>
          </div>
          <p className="text-[10px] text-ink-inv/40 text-center mt-5 leading-relaxed">Login memakai Firebase Authentication (Email/Password). Buat akun developer di Firebase Console terlebih dahulu.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-chrome-deep text-ink-inv pb-24">
      <nav className="sticky top-0 z-30 bg-chrome-panel/90 backdrop-blur-md border-b border-chrome-edge px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-flame-500 text-white flex items-center justify-center"><Terminal className="w-5 h-5" /></div>
          <div><h1 className="font-display font-extrabold text-sm leading-none">Developer Console</h1><p className="text-[10px] text-ink-inv/50 font-bold mt-1">{user.email}</p></div>
        </div>
        <button onClick={doLogout} className="text-[11px] font-extrabold text-ink-inv/70 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-2xl border border-chrome-edge transition">Keluar</button>
      </nav>
      <div className="max-w-md mx-auto px-4 pt-6 space-y-6">
        {accessErr && <div className="bg-brick/15 border border-brick/30 text-brick text-[11px] font-bold p-3 rounded-2xl">{accessErr}</div>}

        {/* registrasi tenant */}
        <div className="bg-chrome-panel/70 border border-chrome-edge rounded-[1.6rem] p-5">
          <h2 className="font-extrabold text-base mb-4 flex items-center gap-2"><Crown className="w-4.5 h-4.5 text-gold" /> Registrasi Tenant</h2>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-extrabold uppercase text-ink-inv/40 ml-1">Nama Client / Toko</label>
              <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Contoh: Kopi Senja" className="w-full bg-chrome-deep/80 border border-chrome-edge p-3 rounded-2xl text-sm font-bold outline-none focus:border-flame-400 transition mt-1 text-ink-inv" />
            </div>
            <div>
              <label className="text-[10px] font-extrabold uppercase text-ink-inv/40 ml-1">ID Tenant (username)</label>
              <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="w-full bg-chrome-deep/80 border border-chrome-edge p-3 rounded-2xl text-sm font-bold outline-none focus:border-flame-400 transition mt-1 lowercase text-ink-inv" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-ink-inv/40 ml-1">Password</label>
                <div className="flex gap-2 mt-1">
                  <input value={password} onChange={(e) => setPassword(e.target.value)} className="flex-1 min-w-0 bg-chrome-deep/80 border border-chrome-edge p-3 rounded-2xl text-sm font-bold outline-none focus:border-flame-400 text-ink-inv" />
                  <button onClick={genPass} className="px-3 rounded-2xl bg-flame-500/15 text-apricot text-xs font-extrabold border border-flame-500/30">Acak</button>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-extrabold uppercase text-ink-inv/40 ml-1">Owner PIN</label>
                <div className="flex gap-2 mt-1">
                  <input value={ownerPin} onChange={(e) => setOwnerPin(e.target.value)} className="flex-1 min-w-0 bg-chrome-deep/80 border border-chrome-edge p-3 rounded-2xl text-sm font-bold outline-none focus:border-flame-400 text-ink-inv" />
                  <button onClick={genPin} className="px-3 rounded-2xl bg-brick/15 text-brick text-xs font-extrabold border border-brick/30">Acak</button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-ink-inv/40 ml-1">Durasi Sewa</label>
                <div className="flex gap-2 mt-1">
                  <input type="number" value={durVal} onChange={(e) => setDurVal(e.target.value)} className="w-16 bg-chrome-deep/80 border border-chrome-edge p-3 rounded-2xl text-sm font-bold outline-none focus:border-flame-400 text-ink-inv" />
                  <select value={durUnit} onChange={(e) => setDurUnit(e.target.value)} className="flex-1 min-w-0 bg-chrome-deep/80 border border-chrome-edge p-3 rounded-2xl text-sm font-bold outline-none focus:border-flame-400 text-ink-inv"><option value="day">Hari</option><option value="month">Bulan</option><option value="year">Tahun</option></select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-extrabold uppercase text-ink-inv/40 ml-1">Tipe Lisensi</label>
                <select value={licType} onChange={(e) => setLicType(e.target.value)} className="w-full bg-chrome-deep/80 border border-chrome-edge p-3 rounded-2xl text-sm font-bold outline-none focus:border-flame-400 mt-1 text-ink-inv"><option value="BASIC">BASIC</option><option value="PRO">PRO</option></select>
              </div>
            </div>
            <button onClick={saveTenant} disabled={saving} className="w-full py-3.5 rounded-2xl bg-flame-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 disabled:opacity-60 mt-1 press">{saving ? <span className="spinner-ring !border-white/30 !border-t-white"></span> : 'Simpan ke Firebase'}</button>
          </div>
        </div>

        {/* daftar tenant */}
        <div>
          <h2 className="font-extrabold text-base mb-3 flex items-center gap-2 px-1">Daftar Tenant <span className="text-[11px] font-bold text-ink-inv/40">({clients.length})</span></h2>
          <div className="space-y-3">
            {clients.length === 0 && <div className="text-center py-10 text-ink-inv/40 text-xs">Belum ada client.</div>}
            {clients.map((c) => (
              <div key={c.id} className="bg-chrome-panel/70 border border-chrome-edge rounded-3xl p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-sm flex items-center gap-2">{c.tenant} <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-flame-500/15 text-apricot">{c.type}</span></h4>
                    <p className="text-[10px] text-ink-inv/50 mt-0.5">ID: <span className="font-bold text-apricot">{c.id}</span> · s/d {new Date(c.validUntil).toLocaleDateString('id-ID')}</p>
                  </div>
                  <span className={c.active ? 'text-leaf bg-leaf/10 px-2 py-0.5 rounded-full text-[9px] font-extrabold' : 'text-brick bg-brick/10 px-2 py-0.5 rounded-full text-[9px] font-extrabold'}>{c.active ? 'AKTIF' : 'SUSPEND'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-chrome-deep/70 p-2 rounded-xl flex justify-between items-center"><span className="text-[9px] font-extrabold text-ink-inv/40">PASS</span><span onClick={() => copyText(c.password, c.id + 'p')} className="font-mono font-extrabold text-xs cursor-pointer flex items-center gap-1">{copiedId === c.id + 'p' ? <Check className="w-3 h-3 text-apricot" /> : <Copy className="w-3 h-3 text-ink-inv/30" />}{c.password}</span></div>
                  <div className="bg-brick/10 p-2 rounded-xl flex justify-between items-center"><span className="text-[9px] font-extrabold text-brick">PIN</span><span onClick={() => copyText(c.ownerPin || '111111', c.id + 'n')} className="font-mono font-extrabold text-xs text-brick cursor-pointer flex items-center gap-1">{copiedId === c.id + 'n' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 opacity-30" />}{c.ownerPin || '111111'}</span></div>
                </div>
                <div className="flex gap-2">
                  {c.active
                    ? <button onClick={() => toggleStatus(c.id, false)} className="flex-1 py-2 rounded-xl bg-white/5 border border-brick/30 text-brick text-[11px] font-extrabold press">Matikan</button>
                    : <button onClick={() => toggleStatus(c.id, true)} className="flex-1 py-2 rounded-xl bg-flame-500 text-white text-[11px] font-extrabold press">Buka Akses</button>}
                  <button onClick={() => delTenant(c.id)} className="w-10 rounded-xl bg-white/5 border border-chrome-edge text-ink-inv/40 hover:text-brick flex items-center justify-center transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {toast && <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-flame-500 text-white px-5 py-3 rounded-full shadow-pop text-sm font-extrabold animate-slide-up">{toast}</div>}
    </div>
  );
};
