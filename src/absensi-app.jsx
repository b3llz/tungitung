// ============================================================
// WELP ABSEN — HALAMAN ABSENSI KARYAWAN STANDALONE (v10)
// ------------------------------------------------------------
// Terpisah dari aplikasi kasir, sengaja dibuat satu fokus:
// absen cepat dari HP karyawan. Buka lewat ?absen=1 (&lic=idToko).
//
// KEAMANAN / ANTI-CHEAT:
//  • Login: ID toko → pilih cabang → PIN cabang (dari Manajemen
//    Cabang) → pilih nama karyawan. Sesi diingat perangkat.
//  • Jam: serverTimestamp Firestore saat data ditulis — tidak
//    bisa diubah/diakali dari HP. Jam HP tidak dipercaya.
//  • Lokasi: GPS wajib (koordinat + akurasi) + jarak ke titik
//    cabang vs Aturan Absensi (radius per cabang).
//  • Selfie: foto kamera wajib, terkirim ke owner.
//  • Kategori otomatis: TEPAT WAKTU / TELAT (jam masuk cabang
//    + toleransi) — dihitung ulang di monitoring owner.
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import {
  Absensi, AbsenMasuk, AbsenPulang, WaktuReal, Lokasi, KameraBuddy,
  Cabang, Tim, PerisaiBuddy, GembokBuddy, BahayaBuddy, Check,
  Kredensial, Perangkat, Lisensi, Keluar, Terang, Gelap, Riwayat
} from './welp-icons.jsx';
import {
  db, safeParse, useTenantCol, trustedTime, getLocation, distanceMeters,
  todayKey, dateKeyOf, dayLabel, dayLabelShort, getAturan, lateInfo,
  DEFAULT_ATURAN, getDeviceId, fileToDataUrl
} from './core.jsx';
import { Button, Toast, Mascot, Badge } from './ui';
import { BrandLogo } from './brand.jsx';

/* ---------- util ---------- */
const fmtTime = (ms) => new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const fmtClock = (ms) => new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const SESSION_KEY = 'welp_absen_session';

const Kicker = ({ children }) => <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-ink-faint dark:text-ink-inv/40">{children}</p>;

/* Status badge dari aturan cabang */
const LateBadge = ({ ms, aturan }) => {
  const li = lateInfo(ms, aturan);
  return li.status === 'telat'
    ? <Badge tone="gold"><WaktuReal className="w-3 h-3" /> Telat {li.telatMin}m</Badge>
    : <Badge tone="green"><Check className="w-3 h-3" /> Tepat Waktu</Badge>;
};

/* ============================================================
   LOGIN — ID toko → cabang → PIN → nama karyawan
   ============================================================ */
const AbsenLogin = ({ preLic, onDone, dark, toggleDark }) => {
  const [step, setStep] = useState('lic');           // lic | cabang | pin | nama
  const [licId, setLicId] = useState(preLic || '');
  const [tenant, setTenant] = useState(null);
  const [branch, setBranch] = useState(null);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const { items: branches } = useTenantCol(tenant ? { id: tenant.id } : null, 'cabang', 'cabang_db');
  const { items: employees } = useTenantCol(tenant ? { id: tenant.id } : null, 'karyawan', 'karyawan_db');

  const checkLic = async () => {
    setErr('');
    if (!licId.trim()) return setErr('Isi ID Toko dulu, ya!');
    setBusy(true);
    try {
      const snap = await getDoc(doc(db, 'licenses', licId.trim().toLowerCase()));
      if (!snap.exists()) { setErr('ID Toko tidak ditemukan. Coba cek lagi.'); setBusy(false); return; }
      const data = snap.data();
      if (!data.active) { setErr('Akun toko dinonaktifkan admin.'); setBusy(false); return; }
      setTenant({ id: snap.id, tenant: data.tenant || snap.id });
      setStep('cabang');
    } catch (e) {
      setErr('Koneksi gagal: ' + (e.message || 'coba lagi') + '. Pastikan internet & Firestore rules aktif.');
    }
    setBusy(false);
  };

  const checkPin = () => {
    setErr('');
    if (!branch) return setErr('Pilih cabang dulu.');
    if (pin.length !== 6) return setErr('PIN harus 6 digit.');
    if (String(branch.pin) !== pin) { setErr('PIN cabang salah!'); setPin(''); return; }
    setStep('nama');
  };

  const pickEmployee = (e) => {
    const session = {
      lic: tenant.id, tenant: tenant.tenant,
      branchId: branch.cid, branchName: branch.name,
      employeeCid: e.cid, employeeName: e.name, role: e.role || 'kasir',
      at: Date.now(), deviceId: getDeviceId()
    };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (err) { }
    onDone(session);
  };

  const staffOfBranch = employees.filter(e => branch && (e.branchId || 'PUSAT') === branch.cid);
  const pinKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'go'];

  return (
    <div className="min-h-screen bg-paper dark:bg-night flex flex-col items-center justify-center p-5 relative overflow-hidden">
      {/* dekor halus */}
      <div className="absolute -top-32 -right-24 w-80 h-80 rounded-full bg-flame-200/30 dark:bg-flame-500/[.07] blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-28 w-80 h-80 rounded-full bg-[#E9ECF1]/70 dark:bg-white/[.03] blur-3xl pointer-events-none" />

      <button onClick={toggleDark} aria-label="Ganti tema"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-surface dark:bg-white/5 border border-line dark:border-line-dark text-ink-faint dark:text-ink-inv/60 flex items-center justify-center transition">
        {dark ? <Terang className="w-4.5 h-4.5" /> : <Gelap className="w-4.5 h-4.5" />}
      </button>

      <div className="w-full max-w-[400px] animate-rise relative z-10">
        <div className="flex justify-center mb-4"><BrandLogo size="md" withTagline={false} /></div>
        <div className="text-center mb-5">
          <p className="font-display text-xl font-extrabold text-ink dark:text-ink-inv tracking-tight">Absen Karyawan</p>
          <p className="text-[11px] text-ink-faint font-bold mt-1 flex items-center justify-center gap-1.5">
            <PerisaiBuddy className="w-3.5 h-3.5 text-flame-600 dark:text-apricot" />
            Selfie · Lokasi · Waktu server terkunci
          </p>
        </div>

        <div className="card p-6">
          {/* indikator langkah */}
          <div className="flex items-center justify-center gap-1.5 mb-5">
            {['lic', 'cabang', 'pin', 'nama'].map(s => (
              <span key={s} className={`h-1.5 rounded-full transition-all ${step === s ? 'w-7 bg-flame-500' : 'w-3 bg-line dark:bg-white/10'}`} />
            ))}
          </div>

          {err && (
            <div className="mb-4 px-4 py-3 rounded-2xl bg-brick-soft dark:bg-brick/10 border border-brick/25 text-brick-deep dark:text-brick text-xs font-bold animate-pop flex items-start gap-2">
              <BahayaBuddy className="w-4 h-4 shrink-0 mt-0.5" /> {err}
            </div>
          )}

          {step === 'lic' && (
            <div className="space-y-4">
              <div className="text-center"><Kicker>Langkah 1 dari 4</Kicker>
                <p className="text-[13px] font-extrabold text-ink dark:text-ink-inv mt-1">Masukkan ID Toko kamu</p>
              </div>
              <div>
                <label className="kicker block mb-1.5 ml-0.5">ID Toko</label>
                <input value={licId} onChange={e => setLicId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && checkLic()}
                  className="field-lg" placeholder="misal: kopi-senja" autoComplete="off" />
              </div>
              <Button onClick={checkLic} disabled={busy} className="w-full py-3.5" icon={busy ? WaktuReal : Lisensi}>
                {busy ? 'Memeriksa...' : 'Lanjut'}
              </Button>
            </div>
          )}

          {step === 'cabang' && (
            <div className="space-y-4">
              <div className="text-center"><Kicker>Langkah 2 dari 4</Kicker>
                <p className="text-[13px] font-extrabold text-ink dark:text-ink-inv mt-1">Pilih cabang tempat kerjamu</p>
              </div>
              {branches.length === 0 ? (
                <div className="py-6 text-center">
                  <Mascot pose="bingung" className="w-20 h-20 object-contain mx-auto mb-2" alt="" />
                  <p className="text-xs font-bold text-ink-faint">Belum ada cabang terdaftar.<br />Minta owner menambahkan di Manajemen Cabang.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {branches.map(b => (
                    <button key={b.cid} onClick={() => { setBranch(b); setErr(''); setStep('pin'); }}
                      className="flex items-center gap-3 p-3.5 rounded-2xl border-2 border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-left hover:border-flame-400 transition press">
                      <span className="w-9 h-9 rounded-xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center shrink-0"><Cabang className="w-4.5 h-4.5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-extrabold text-[13px] text-ink dark:text-ink-inv truncate">{b.name}</span>
                        <span className="block text-[10px] text-ink-faint font-semibold truncate">{b.location || 'Lokasi belum diisi'}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => { setStep('lic'); setErr(''); }} className="w-full py-2.5 text-[11px] font-extrabold text-ink-faint hover:text-ink-soft dark:hover:text-ink-inv transition">Kembali</button>
            </div>
          )}

          {step === 'pin' && (
            <div className="space-y-4">
              <div className="text-center"><Kicker>Langkah 3 dari 4</Kicker>
                <p className="text-[13px] font-extrabold text-ink dark:text-ink-inv mt-1">PIN cabang <span className="text-flame-700 dark:text-apricot">{branch?.name}</span></p>
              </div>
              <div className="flex gap-2 justify-center">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={`w-9 h-11 rounded-2xl border-2 flex items-center justify-center transition-all ${i < pin.length ? 'border-flame-500 bg-flame-50 dark:bg-flame-900/25' : 'border-line dark:border-line-dark bg-paper dark:bg-night/60'}`}>
                    {i < pin.length && <div className="w-2.5 h-2.5 rounded-full bg-flame-500 animate-pop" />}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {pinKeys.map(k => {
                  if (k === 'del') return <button key={k} onClick={() => setPin(p => p.slice(0, -1))} aria-label="Hapus" className="py-3 rounded-2xl bg-brick-soft dark:bg-brick/10 text-brick text-lg font-extrabold transition active:scale-95 press">⌫</button>;
                  if (k === 'go') return <button key={k} onClick={checkPin} disabled={pin.length !== 6} aria-label="Lanjut" className="py-3 rounded-2xl bg-flame-600 text-white flex items-center justify-center transition active:scale-95 press disabled:opacity-40 hover:bg-flame-500"><Check className="w-5 h-5" /></button>;
                  return <button key={k} onClick={() => setPin(p => (p.length < 6 ? p + k : p))} className="py-3 rounded-2xl bg-paper dark:bg-white/5 text-ink dark:text-ink-inv text-lg font-extrabold transition active:scale-95 press hover:bg-flame-50 dark:hover:bg-flame-900/20">{k}</button>;
                })}
              </div>
              <button onClick={() => { setStep('cabang'); setPin(''); setErr(''); }} className="w-full py-2.5 text-[11px] font-extrabold text-ink-faint hover:text-ink-soft dark:hover:text-ink-inv transition">Ganti cabang</button>
            </div>
          )}

          {step === 'nama' && (
            <div className="space-y-4">
              <div className="text-center"><Kicker>Langkah 4 dari 4</Kicker>
                <p className="text-[13px] font-extrabold text-ink dark:text-ink-inv mt-1">Siapa kamu hari ini?</p>
              </div>
              {staffOfBranch.length === 0 ? (
                <div className="py-6 text-center">
                  <Mascot pose="pikir" className="w-20 h-20 object-contain mx-auto mb-2" alt="" />
                  <p className="text-xs font-bold text-ink-faint">Belum ada karyawan terdaftar di cabang ini.<br />Minta owner menambahkan nama di Manajemen Karyawan.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto custom-scrollbar">
                  {staffOfBranch.map(e => (
                    <button key={e.cid} onClick={() => pickEmployee(e)}
                      className="flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 border-line dark:border-line-dark bg-surface dark:bg-surface-dark hover:border-flame-400 transition press">
                      <span className="w-11 h-11 rounded-2xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center font-extrabold text-base">{e.name[0]}</span>
                      <span className="font-extrabold text-[12px] text-ink dark:text-ink-inv truncate max-w-full">{e.name}</span>
                      <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-ink-faint">{e.role === 'admin' ? 'Admin' : 'Kasir'}</span>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => { setStep('pin'); setErr(''); }} className="w-full py-2.5 text-[11px] font-extrabold text-ink-faint hover:text-ink-soft dark:hover:text-ink-inv transition">Kembali</button>
            </div>
          )}
        </div>

        <p className="text-center text-[9px] font-extrabold text-ink-faint dark:text-ink-inv/30 uppercase tracking-[0.22em] mt-5 flex items-center justify-center gap-1.5">
          <GembokBuddy className="w-3 h-3" /> WELP Absen · by JUSTru Group
        </p>
      </div>
    </div>
  );
};

/* ============================================================
   FLOW ABSEN — kamera selfie + GPS + kirim (waktu server)
   ============================================================ */
const AbsenFlow = ({ type, session, branch, aturan, dist0, onClose, onSubmit }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [camOn, setCamOn] = useState(false);
  const [camErr, setCamErr] = useState(null);
  const [geo, setGeo] = useState(null);
  const [geoErr, setGeoErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const grabGeo = async () => {
    setGeoErr(null);
    try { setGeo(await getLocation()); }
    catch (e) { setGeoErr('Lokasi gagal: ' + (e.message || 'izin ditolak') + '. Aktifkan GPS & izinkan lokasi.'); }
  };

  useEffect(() => { grabGeo(); return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); }; }, []);

  const startCam = async () => {
    setCamErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => { }); }
      setCamOn(true);
    } catch (e) {
      setCamOn(false);
      setCamErr('Kamera tidak bisa dibuka (' + (e.name || e.message) + '). Gunakan tombol pilih foto sebagai alternatif — lalu foto selfie via kamera HP.');
    }
  };

  const stopCam = () => { if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; } setCamOn(false); };

  const shoot = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const max = 480;
    const scale = Math.min(1, max / Math.min(v.videoWidth, v.videoHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.round(v.videoWidth * scale);
    cv.height = Math.round(v.videoHeight * scale);
    cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
    setPhoto(cv.toDataURL('image/jpeg', 0.62));
    stopCam();
  };

  const pickFile = async (file) => {
    if (!file) return;
    stopCam();
    try { setPhoto(await fileToDataUrl(file, 480, 0.62)); } catch (e) { setCamErr('Gagal memuat foto: ' + e.message); }
  };

  const dist = geo && branch?.lat != null ? distanceMeters(geo, { lat: branch.lat, lng: branch.lng }) : null;
  const outOfRadius = dist != null && dist > aturan.radius;

  const submit = async () => {
    if (!photo) return;
    setBusy(true);
    await onSubmit({ photo, geo, dist, outOfRadius: !!outOfRadius, type });
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-chrome-deep/75 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-surface dark:bg-surface-dark rounded-t-[1.75rem] sm:rounded-[1.75rem] p-5 max-h-[92vh] overflow-y-auto custom-scrollbar animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className={`w-10 h-10 rounded-2xl flex items-center justify-center ${type === 'in' ? 'bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf' : 'bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold'}`}>
              {type === 'in' ? <AbsenMasuk className="w-5 h-5" /> : <AbsenPulang className="w-5 h-5" />}
            </span>
            <div>
              <p className="font-extrabold text-[15px] text-ink dark:text-ink-inv">{type === 'in' ? 'Absen Masuk' : 'Absen Pulang'}</p>
              <p className="text-[10px] font-bold text-ink-faint">{session.employeeName} · {session.branchName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-paper dark:bg-white/5 text-ink-faint flex items-center justify-center">✕</button>
        </div>

        {/* KAMERA / PREVIEW SELFIE */}
        {!photo ? (
          <div>
            <div className="relative rounded-2xl overflow-hidden bg-night aspect-[3/4] max-h-80 mx-auto border border-line dark:border-line-dark">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              {!camOn && !camErr && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                  <KameraBuddy className="w-10 h-10 text-ink-inv/50 mb-2" />
                  <p className="text-[11px] font-bold text-ink-inv/70">Kamera siap dipakai</p>
                </div>
              )}
              {camErr && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-5">
                  <BahayaBuddy className="w-9 h-9 text-gold mb-2" />
                  <p className="text-[10.5px] font-bold text-ink-inv/80 leading-relaxed">{camErr}</p>
                </div>
              )}
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-black/55 text-white text-[9px] font-extrabold px-2 py-1 rounded-full"><Lokasi className="w-3 h-3" /> Selfie wajib</div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button onClick={startCam} variant="secondary" className="flex-1 py-3 text-xs" icon={KameraBuddy}>{camErr ? 'Coba Lagi' : (camOn ? 'Kamera Aktif' : 'Buka Kamera')}</Button>
              <label className="flex-1 cursor-pointer">
                <span className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-paper dark:bg-white/5 border border-line dark:border-line-dark text-ink-soft dark:text-ink-inv/70 text-xs font-extrabold press">Pilih Foto</span>
                <input type="file" accept="image/*" capture="user" className="hidden" onChange={e => pickFile(e.target.files[0])} />
              </label>
            </div>
            {camOn && (
              <Button onClick={shoot} className="w-full py-4 mt-2 text-sm" icon={KameraBuddy}>Ambil Selfie</Button>
            )}
          </div>
        ) : (
          <div>
            <div className="relative rounded-2xl overflow-hidden border border-line dark:border-line-dark max-h-80 mx-auto">
              <img src={photo} alt="Selfie absensi" className="w-full object-cover" />
              <span className="absolute top-2.5 left-2.5 bg-leaf text-white text-[9px] font-extrabold px-2 py-1 rounded-full flex items-center gap-1"><Check className="w-3 h-3" /> Foto siap</span>
            </div>
            <button onClick={() => { setPhoto(null); startCam(); }} className="w-full py-2.5 mt-2 text-[11px] font-extrabold text-ink-faint hover:text-ink-soft dark:hover:text-ink-inv transition">Ambil ulang foto</button>
          </div>
        )}

        {/* LOKASI */}
        <div className={`mt-4 p-3.5 rounded-2xl border ${geoErr ? 'bg-brick-soft dark:bg-brick/10 border-brick/25' : 'bg-paper dark:bg-white/[.03] border-line dark:border-line-dark'}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-extrabold text-ink dark:text-ink-inv flex items-center gap-1.5">
              <Lokasi className="w-4 h-4 text-flame-600 dark:text-apricot" /> Lokasi {geo ? `terkunci (±${geo.acc}m)` : '—'}
            </p>
            {geoErr && <button onClick={grabGeo} className="text-[10px] font-extrabold text-flame-700 dark:text-apricot">Coba lagi</button>}
          </div>
          {geo && (
            <p className="text-[10px] font-semibold text-ink-faint mt-1 font-mono">
              {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
              {dist != null && <> · {dist}m dari cabang</>}
              {dist == null && branch?.lat == null && <> · titik cabang belum diatur owner</>}
            </p>
          )}
          {geoErr && <p className="text-[10px] font-bold text-brick-deep dark:text-brick mt-1">{geoErr}</p>}
          {outOfRadius && (
            <p className="text-[10px] font-extrabold text-gold-deep dark:text-gold mt-1.5 flex items-start gap-1.5">
              <BahayaBuddy className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Kamu di luar radius {aturan.radius}m — absen tetap tercatat, tapi ditandai owner.
            </p>
          )}
        </div>

        <Button onClick={submit} disabled={!photo || !geo || busy} className="w-full py-4 mt-4 text-sm" icon={busy ? WaktuReal : (type === 'in' ? AbsenMasuk : AbsenPulang)}>
          {busy ? 'Mengirim...' : `Kirim Absen ${type === 'in' ? 'Masuk' : 'Pulang'}`}
        </Button>
        <p className="text-[9.5px] text-ink-faint font-semibold text-center mt-2.5 leading-relaxed flex items-center justify-center gap-1.5">
          <Perangkat className="w-3.5 h-3.5 shrink-0" />
          Jam diambil dari server saat data terkirim — tidak bisa diubah dari HP.
        </p>
      </div>
    </div>
  );
};

/* ============================================================
   HOME — jam realtime, status, tombol absen, riwayat
   ============================================================ */
const AbsenHome = ({ session, onLogout, dark, toggleDark }) => {
  const [now, setNow] = useState(Date.now());
  const [flow, setFlow] = useState(null);            // 'in' | 'out' | null
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);

  const { items: branches } = useTenantCol({ id: session.lic }, 'cabang', 'cabang_db');
  const { items: absensi, addRow, live } = useTenantCol({ id: session.lic }, 'absensi', 'absensi_db');

  const branch = branches.find(b => b.cid === session.branchId) || null;
  const branchName = branch?.name || session.branchName || 'Cabang';
  const aturan = getAturan(branch);
  const today = todayKey();

  const mineToday = absensi.filter(a => a.employeeCid === session.employeeCid && a.date === today);
  const inRec = mineToday.find(a => a.type === 'in');
  const outRec = mineToday.find(a => a.type === 'out');
  const mine = [...absensi].filter(a => a.employeeCid === session.employeeCid).sort((a, b) => trustedTime(b).ms - trustedTime(a).ms).slice(0, 14);

  // kelompokkan per hari
  const byDay = [];
  for (const a of mine) {
    const d = dateKeyOf(trustedTime(a).ms);
    let g = byDay.find(x => x.date === d);
    if (!g) { g = { date: d, ms: trustedTime(a).ms, rows: [] }; byDay.push(g); }
    g.rows.push(a);
  }

  const alert = (message, type = 'success') => { setPopup({ show: true, message, type }); };

  const doSubmit = async ({ photo, geo, dist, outOfRadius, type }) => {
    try {
      const li = lateInfo(Date.now(), aturan);
      addRow({
        employeeName: session.employeeName, employeeCid: session.employeeCid, role: session.role,
        branchId: session.branchId, branchName, date: today, type,
        lat: geo?.lat ?? null, lng: geo?.lng ?? null, acc: geo?.acc ?? null,
        dist: dist ?? null, far: outOfRadius,
        lateMin: type === 'in' ? li.telatMin : null, lateStatus: type === 'in' ? li.status : null,
        photo: photo || null, deviceId: session.deviceId || getDeviceId(), deviceTs: Date.now()
      });
      setFlow(null);
      alert(outOfRadius
        ? `Absen tercatat — tapi kamu ${dist}m dari cabang (di luar radius, ditandai owner).`
        : `Absen ${type === 'in' ? 'masuk' : 'pulang'} tercatat! Waktu dikunci server.`, outOfRadius ? 'error' : 'success');
    } catch (e) {
      alert('Gagal mengirim absensi: ' + (e.message || 'coba lagi'), 'error');
    }
  };

  return (
    <div className="min-h-screen bg-paper dark:bg-night text-ink dark:text-ink-inv pb-10 animate-fade-in">
      {popup.show && <Toast message={popup.message} type={popup.type} onClose={() => setPopup(p => ({ ...p, show: false }))} />}

      {/* HEADER */}
      <div className="bg-chrome-deep px-4 pt-5 pb-6 relative overflow-hidden">
        <div className="absolute -right-12 -top-14 w-48 h-48 rounded-full bg-flame-500/20 blur-2xl pointer-events-none" />
        <div className="max-w-md mx-auto relative">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-apricot/85 text-[9px] font-extrabold uppercase tracking-[0.24em] flex items-center gap-1.5"><Absensi className="w-3.5 h-3.5" /> WELP Absen</p>
              <h1 className="font-display font-extrabold text-xl text-ink-inv tracking-tight mt-1">{session.employeeName}</h1>
              <p className="text-[10.5px] font-bold text-ink-inv/55 mt-0.5 flex items-center gap-1.5"><Cabang className="w-3.5 h-3.5" /> {branchName}<span className={`ml-1.5 inline-flex items-center gap-1 text-[8.5px] font-extrabold uppercase tracking-wider ${live ? 'text-leaf' : 'text-gold'}`}><span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-leaf animate-pulse-dot' : 'bg-gold'}`} />{live ? 'Realtime' : 'Lokal'}</span></p>
            </div>
            <div className="flex gap-1.5">
              <button onClick={toggleDark} aria-label="Ganti tema" className="w-9 h-9 rounded-full bg-white/10 text-ink-inv/80 flex items-center justify-center transition">{dark ? <Terang className="w-4 h-4" /> : <Gelap className="w-4 h-4" />}</button>
              <button onClick={onLogout} aria-label="Ganti akun" className="w-9 h-9 rounded-full bg-white/10 text-ink-inv/80 hover:text-white flex items-center justify-center transition"><Keluar className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 space-y-4 -mt-1">
        {/* JAM REALTIME */}
        <div className="card !rounded-3xl overflow-hidden !bg-chrome-deep !border-chrome-edge relative mt-4">
          <div className="absolute -left-10 -bottom-12 w-40 h-40 rounded-full bg-flame-500/15 blur-2xl pointer-events-none" />
          <div className="p-6 text-center relative">
            <p className="text-apricot/85 text-[10px] font-extrabold uppercase tracking-[0.22em] mb-2">{dayLabel(now)}</p>
            <p className="font-display text-[52px] leading-none font-extrabold text-ink-inv money tracking-tight">{fmtClock(now)}</p>
            <p className="text-ink-inv/50 text-[10px] font-bold mt-2.5 flex items-center justify-center gap-1.5">
              <WaktuReal className="w-4 h-4 text-apricot" /> Jam HP hanya tampil — jam absen dikunci server
            </p>
          </div>
        </div>

        {/* STATUS HARI INI */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`card !rounded-3xl p-4 ${inRec ? 'border-leaf/40' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-xl bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf flex items-center justify-center"><AbsenMasuk className="w-4.5 h-4.5" /></span>
              <p className="kicker">Masuk</p>
            </div>
            <p className="text-xl font-extrabold money leading-none">{inRec ? fmtTime(trustedTime(inRec).ms) : '--:--'}</p>
            <div className="mt-2">{inRec ? <LateBadge ms={trustedTime(inRec).ms} aturan={aturan} /> : <span className="text-[10px] font-bold text-ink-faint">belum absen</span>}</div>
          </div>
          <div className={`card !rounded-3xl p-4 ${outRec ? 'border-gold/40' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-xl bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold flex items-center justify-center"><AbsenPulang className="w-4.5 h-4.5" /></span>
              <p className="kicker">Pulang</p>
            </div>
            <p className="text-xl font-extrabold money leading-none">{outRec ? fmtTime(trustedTime(outRec).ms) : '--:--'}</p>
            <div className="mt-2">{outRec ? <Badge tone="gold"><Check className="w-3 h-3" /> Terisi</Badge> : <span className="text-[10px] font-bold text-ink-faint">belum absen</span>}</div>
          </div>
        </div>

        {/* TOMBOL ABSEN */}
        <div className="card !rounded-3xl p-5">
          {!inRec ? (
            <Button onClick={() => setFlow('in')} className="w-full py-4 text-sm" icon={AbsenMasuk}>Absen Masuk Sekarang</Button>
          ) : !outRec ? (
            <Button onClick={() => setFlow('out')} className="w-full py-4 text-sm" icon={AbsenPulang}>Absen Pulang Sekarang</Button>
          ) : (
            <div className="text-center py-1.5">
              <Check className="w-9 h-9 text-leaf mx-auto mb-2" />
              <p className="font-extrabold text-sm">Absensi hari ini lengkap. Kerja bagus!</p>
              <p className="text-[11px] text-ink-faint font-semibold mt-1">{fmtTime(trustedTime(inRec).ms)} — {fmtTime(trustedTime(outRec).ms)}</p>
            </div>
          )}
          <div className="mt-4 p-3 rounded-2xl bg-paper dark:bg-white/[.03] border border-line dark:border-line-dark">
            <p className="text-[10px] font-extrabold text-ink-soft dark:text-ink-inv/70 flex items-center gap-1.5 mb-1"><Lokasi className="w-3.5 h-3.5 text-flame-600 dark:text-apricot" /> Aturan absensi cabang</p>
            <p className="text-[10px] text-ink-faint font-semibold leading-relaxed">
              Masuk {aturan.jamMasuk} (toleransi {aturan.toleransi} menit) · radius {aturan.radius} meter{branch?.lat != null ? ' · titik GPS cabang aktif' : ' · titik GPS cabang belum diatur owner'}
            </p>
          </div>
        </div>

        {/* RIWAYAT PER HARI */}
        <div className="card !rounded-3xl p-5">
          <p className="font-extrabold text-[13px] flex items-center gap-2 mb-3"><Riwayat className="w-4 h-4 text-flame-600 dark:text-apricot" /> Riwayat Absensiku</p>
          {byDay.length === 0 ? (
            <div className="py-6 text-center">
              <Mascot pose="yuk" className="w-20 h-20 object-contain mx-auto mb-2" alt="" />
              <p className="text-xs font-bold text-ink-faint">Belum ada riwayat. Yuk absen sekarang!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {byDay.map(g => (
                <div key={g.date}>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-[11px] font-extrabold text-ink dark:text-ink-inv">{dayLabelShort(g.ms)}</p>
                    <span className="text-[9px] font-bold text-ink-faint">{new Date(g.ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div className="space-y-1.5">
                    {g.rows.map(a => {
                      const t = trustedTime(a);
                      return (
                        <div key={a.cid} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-paper dark:bg-white/[.03]">
                          {a.photo
                            ? <img src={a.photo} alt="Selfie" className="w-9 h-9 rounded-xl object-cover border border-line dark:border-line-dark" />
                            : <span className="w-9 h-9 rounded-xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center font-extrabold text-[10px]">{a.employeeName?.[0]}</span>}
                          <div className="min-w-0 flex-1">
                            <p className="text-[11.5px] font-extrabold truncate">{a.type === 'in' ? 'Absen masuk' : 'Absen pulang'} · {fmtTime(t.ms)}</p>
                            <p className="text-[9.5px] font-semibold text-ink-faint">
                              {t.source === 'server' ? <span className="text-leaf-deep dark:text-leaf font-extrabold">✓ waktu server</span> : 'waktu perangkat'}
                              {a.dist != null && ` · ${a.dist}m dari cabang`}
                              {a.far && <span className="text-gold-deep dark:text-gold font-extrabold"> · luar radius</span>}
                            </p>
                          </div>
                          {a.type === 'in' && branch && <LateBadge ms={t.ms} aturan={aturan} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-[9px] font-extrabold text-ink-faint dark:text-ink-inv/30 uppercase tracking-[0.22em] pt-1 pb-2">WELP v10 · Fresh Ink</p>
      </div>

      {flow && (
        <AbsenFlow type={flow} session={session} branch={branch} aturan={aturan}
          onClose={() => setFlow(null)} onSubmit={doSubmit} />
      )}
    </div>
  );
};

/* ============================================================
   ROOT — tema + sesi
   ============================================================ */
export const AbsensiApp = ({ preLic = '' }) => {
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

  const [session, setSession] = useState(() => safeParse(SESSION_KEY, null));
  const logout = () => { try { localStorage.removeItem(SESSION_KEY); } catch (e) { } setSession(null); };

  if (!session) return <AbsenLogin preLic={preLic} onDone={setSession} dark={dark} toggleDark={toggleDark} />;
  return <AbsenHome session={session} onLogout={logout} dark={dark} toggleDark={toggleDark} />;
};
