// ============================================================
// WELP — APLIKASI KARYAWAN STANDALONE (v14)
// ------------------------------------------------------------
// Terpisah dari aplikasi kasir (?absen=1). Login memakai sistem
// utama WELP: ID Toko → cabang → PIN cabang → nama + PIN pribadi.
// Identitas (role, perusahaan, cabang) dikenali otomatis dari
// akun karyawan. Semua data difilter ketat milik sendiri —
// karyawan tidak bisa melihat data karyawan lain.
//
// v14: dipakai SELURUH pekerja — kasir, admin, sampai owner.
// Yang membedakan cuma role-nya: atasan punya panel persetujuan
// cuti di tab Ajukan, semua orang punya hak cuti tahunan
// (default 12 hari sesuai UU, bisa dioverride), slip gaji premium
// otomatis masuk ke akun masing-masing, dan dokumen perusahaan
// yang dibagikan tampil di Profil.
//
// ISI: dashboard pribadi, absensi (selfie + GPS + waktu server),
// riwayat absensi, slip gaji pribadi premium, pengajuan
// sakit/izin/cuti + panel persetujuan atasan, dokumen & profil.
//
// ANTI-CHEAT:
//  • Jam absen = serverTimestamp Firestore (tidak bisa diakali HP).
//  • Foto distempel data sistem: logo, perusahaan, cabang,
//    tanggal, jam terpercaya (offset server), GPS, nama karyawan.
//  • Kamera depan: preview mirror = hasil tersimpan (natural).
//  • Framing 3:4 dipotong persis seperti preview (WYSIWYG).
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import {
  Absensi, AbsenMasuk, AbsenPulang, WaktuReal, Lokasi, KameraBuddy,
  Cabang, Tim, PerisaiBuddy, GembokBuddy, BahayaBuddy, Check,
  Kredensial, Perangkat, Lisensi, Keluar, Terang, Gelap, Riwayat,
  Beranda, Penggajian, Plus, BuktiTransfer, SlipGaji, MedaliBuddy,
  GembokBuka, KoinBuddy, Toko
} from './welp-icons.jsx';
import {
  db, safeParse, useTenantCol, trustedTime, getLocation, distanceMeters,
  todayKey, dateKeyOf, dayLabel, dayLabelShort, getAturan, lateInfo,
  lateInfoMs, fmtDurJMD, DEFAULT_ATURAN, getDeviceId, fileToDataUrl,
  stampAbsenPhoto, syncTrustedTime, trustedNow, trustedSourceLabel,
  auditLog, PAYROLL_FLOW, CUTI_TYPES, CUTI_FLOW, daysBetween, formatIDR,
  normShifts, shiftsForBranch, shiftById, shiftOfMs, fmtShiftRange,
  shiftDurMin, fmtJam, pairWorkMinutes, hkTargetOf,
  cutiPolicyOf, hakCutiOf, usedCutiDays, hariKerjaOf, hariLabelOf,
  kontrakOf, buildSlipHtml, writeBrandMirror,
  ensureAuth, verifyCred, credIsLegacy, upgradeCred, makeCred, pinGate, pinGateMsg,   // v15 F0
  empBranchIds, roleLabelOfV15, isAtasanRole, openDataUrl,   // v15 F2/F3/F4
  reverseGeocode, uploadMedia   // v15 F5
} from './core.jsx';
import { Button, Toast, Mascot, Badge } from './ui';
import { BrandLogo, useBrandState } from './brand.jsx';

/* ---------- util ---------- */
const fmtTime = (ms) => new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const fmtClock = (ms) => new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const SESSION_KEY = 'welp_absen_session';

const Kicker = ({ children }) => <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-ink-faint dark:text-ink-inv/40">{children}</p>;

const roleLabelOf = roleLabelOfV15;   // v15 F3: label role lengkap
const isAtasan = (r) => isAtasanRole(r);   // v15 F3: owner/direktur/manager/supervisor/admin/hr

/* Badge keterlambatan, format mudah dibaca: 00j 15m 00d */
const LateBadge = ({ ms, aturan }) => {
  const li = lateInfoMs(ms, aturan);
  return li.status === 'telat'
    ? <Badge tone="gold"><WaktuReal className="w-3 h-3" /> Telat {fmtDurJMD(li.lateMs)}</Badge>
    : <Badge tone="green"><Check className="w-3 h-3" /> Tepat Waktu</Badge>;
};

/* ============================================================
   LOGIN — sistem utama WELP:
   ID Toko → cabang → PIN cabang → nama karyawan → PIN pribadi.
   Identitas otomatis: role, perusahaan, cabang dari akun karyawan.
   ============================================================ */
const AbsenLogin = ({ preLic, onDone, dark, toggleDark }) => {
  // v15 F2: LOGIN AKUN PRIBADI MURNI — ID Toko → Employee ID + PIN pribadi
  // (tanpa PIN cabang). Bila karyawan terkait >1 cabang, muncul pemilih
  // cabang BERBASIS RELASI (branchIds). Jalur "pilih nama + PIN cabang"
  // dihapus (menutup temuan C1/C3).
  const [step, setStep] = useState('lic');           // lic | login | branch
  // v15 F2: "ingat ID toko & Employee ID" (bukan PIN) — dibaca sekali saat mount
  const lastLogin = (() => { try { return JSON.parse(localStorage.getItem('welp_absen_last') || 'null'); } catch (e) { return null; } })();
  const [licId, setLicId] = useState(preLic || lastLogin?.lic || '');
  const [empIdInput, setEmpIdInput] = useState(lastLogin?.empId || '');
  const [tenant, setTenant] = useState(null);
  const [emp, setEmp] = useState(null);
  const [myBranchList, setMyBranchList] = useState([]);
  const [pin2, setPin2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const { items: branches } = useTenantCol(tenant ? { id: tenant.id } : null, 'cabang', 'cabang_db');
  const { items: employees } = useTenantCol(tenant ? { id: tenant.id } : null, 'karyawan', 'karyawan_db');

  const checkLic = async () => {
    setErr('');
    if (!licId.trim()) return setErr('Isi ID Toko dulu, ya!');
    setBusy(true);
    try {
      // v15 F0: sesi anonymous Firebase dulu — prasyarat rules v15.
      await ensureAuth();
      const snap = await getDoc(doc(db, 'licenses', licId.trim().toLowerCase()));
      if (!snap.exists()) { setErr('ID Toko tidak ditemukan. Coba cek lagi.'); setBusy(false); return; }
      const data = snap.data();
      if (!data.active) { setErr('Akun toko dinonaktifkan admin.'); setBusy(false); return; }
      setTenant({ id: snap.id, tenant: data.tenant || snap.id });
      setStep('login');
    } catch (e) {
      setErr('Koneksi gagal: ' + (e.message || 'coba lagi') + '. Pastikan internet & Firestore rules aktif.');
    }
    setBusy(false);
  };

  const finishAt = (e, br) => {
    const session = {
      lic: tenant.id, tenant: tenant.tenant,
      branchId: br?.cid || e.branchId || 'PUSAT', branchName: br?.name || 'Cabang',
      employeeCid: e.cid, employeeName: e.name, empId: e.empId || '', role: e.role || 'kasir',
      hasPin: true, at: Date.now(), deviceId: getDeviceId()
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      localStorage.setItem('welp_absen_last', JSON.stringify({ lic: tenant.id, empId: e.empId || '' }));   // ingat ID (bukan PIN)
    } catch (err) { }
    onDone(session);
  };

  const checkPersonal = async () => {
    setErr('');
    if (!empIdInput.trim()) return setErr('Isi Employee ID kamu (mis. PST-001).');
    if (pin2.length !== 6) return setErr('PIN pribadi harus 6 digit.');
    const rec = employees.find(e => String(e.empId || '').toLowerCase() === empIdInput.trim().toLowerCase());
    if (!rec) return setErr('Employee ID tidak ditemukan di toko ini. Cek lagi, atau minta owner.');
    if (rec.status === 'nonaktif') return setErr('Akun kamu nonaktif. Hubungi owner/admin.');
    if (!rec.pin && !rec.cred) return setErr('PIN pribadimu belum diatur. Minta owner mengaturnya di Manajemen Karyawan (atau minta reset PIN).');
    const gateKey = `absen_login:${tenant.id}:${rec.cid}`;
    const st = pinGate.status(gateKey);
    if (st.locked) return setErr(pinGateMsg(st));
    if (!(await verifyCred(pin2, rec, 'pin'))) {
      const gst = pinGate.fail(gateKey);
      setErr(gst.locked ? pinGateMsg(gst) : `PIN salah! Sisa ${5 - gst.fails} percobaan.`);
      setPin2(''); return;
    }
    pinGate.reset(gateKey);
    if (credIsLegacy(rec)) upgradeCred(['tenants', tenant.id, 'karyawan', rec.cid], pin2, 'pin');
    // Branch context (F2): auto-branch bila 1 relasi, picker bila >1
    const ids = empBranchIds(rec);
    const myBranches = ids.map(bid => branches.find(b => b.cid === bid)).filter(Boolean);
    if (myBranches.length > 1) { setEmp(rec); setMyBranchList(myBranches); setStep('branch'); return; }
    finishAt(rec, myBranches[0] || null);
  };

  const pinKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'go'];

  const StepTitle = ({ n, children }) => (
    <div className="text-center"><Kicker>Langkah {n} dari 3</Kicker>
      <p className="text-[13px] font-extrabold text-ink dark:text-ink-inv mt-1">{children}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper dark:bg-night flex flex-col items-center justify-center p-5 relative overflow-hidden">
      <div className="absolute -top-32 -right-24 w-80 h-80 rounded-full bg-flame-200/30 dark:bg-flame-500/[.07] blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-28 w-80 h-80 rounded-full bg-[#E9ECF1]/70 dark:bg-white/[.03] blur-3xl pointer-events-none" />

      <button onClick={toggleDark} aria-label="Ganti tema"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-surface dark:bg-white/5 border border-line dark:border-line-dark text-ink-faint dark:text-ink-inv/60 flex items-center justify-center transition">
        {dark ? <Terang className="w-4.5 h-4.5" /> : <Gelap className="w-4.5 h-4.5" />}
      </button>

      <div className="w-full max-w-[400px] animate-rise relative z-10">
        <div className="flex justify-center mb-4"><BrandLogo size="md" withTagline={false} /></div>
        <div className="text-center mb-5">
          <p className="font-display text-xl font-extrabold text-ink dark:text-ink-inv tracking-tight">Aplikasi Karyawan</p>
          <p className="text-[11px] text-ink-faint font-bold mt-1 flex items-center justify-center gap-1.5">
            <PerisaiBuddy className="w-3.5 h-3.5 text-flame-600 dark:text-apricot" />
            Absensi · Slip Gaji · Cuti · Login PIN pribadi
          </p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-center gap-1.5 mb-5">
            {['lic', 'login', 'branch'].map(s => {
              const order = { lic: 0, login: 1, branch: 2 };
              return <span key={s} className={`h-1.5 rounded-full transition-all ${order[step] >= order[s] ? 'w-7 bg-flame-500' : 'w-3 bg-line dark:bg-white/10'}`} />;
            })}
          </div>

          {err && (
            <div className="mb-4 px-4 py-3 rounded-2xl bg-brick-soft dark:bg-brick/10 border border-brick/25 text-brick-deep dark:text-brick text-xs font-bold animate-pop flex items-start gap-2">
              <BahayaBuddy className="w-4 h-4 shrink-0 mt-0.5" /> {err}
            </div>
          )}

          {step === 'lic' && (
            <div className="space-y-4">
              <StepTitle n={1}>Masukkan ID Toko kamu</StepTitle>
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

          {/* v15 F2: LOGIN PRIBADI — Employee ID + PIN (tanpa PIN cabang) */}
          {step === 'login' && (
            <div className="space-y-4">
              <StepTitle n={2}>Masuk ke akun pribadimu</StepTitle>
              <div>
                <label className="kicker block mb-1.5 ml-0.5">Employee ID</label>
                <input value={empIdInput} onChange={e => setEmpIdInput(e.target.value.toUpperCase())}
                  className="field-lg font-mono tracking-widest uppercase" placeholder="misal: PST-001" autoComplete="off" />
                {empIdInput && <p className="text-[9.5px] font-bold text-ink-faint mt-1.5">Employee ID-mu tercetak di kartu karyawan / dari owner.</p>}
              </div>
              <div>
                <label className="kicker block mb-1.5 ml-0.5">PIN Pribadi (6 digit)</label>
                <div className="flex gap-2 justify-center">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className={`w-9 h-11 rounded-2xl border-2 flex items-center justify-center transition-all ${i < pin2.length ? 'border-flame-500 bg-flame-50 dark:bg-flame-900/25' : 'border-line dark:border-line-dark bg-paper dark:bg-night/60'}`}>
                      {i < pin2.length && <div className="w-2.5 h-2.5 rounded-full bg-flame-500 animate-pop" />}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {pinKeys.map(k => {
                    if (k === 'del') return <button key={k} onClick={() => setPin2(p => p.slice(0, -1))} aria-label="Hapus" className="py-3 rounded-2xl bg-brick-soft dark:bg-brick/10 text-brick text-lg font-extrabold transition active:scale-95 press">⌫</button>;
                    if (k === 'go') return <button key={k} onClick={checkPersonal} disabled={pin2.length !== 6 || busy} aria-label="Masuk" className="py-3 rounded-2xl bg-flame-600 text-white flex items-center justify-center transition active:scale-95 press disabled:opacity-40 hover:bg-flame-500"><Check className="w-5 h-5" /></button>;
                    return <button key={k} onClick={() => setPin2(p => (p.length < 6 ? p + k : p))} className="py-3 rounded-2xl bg-paper dark:bg-white/5 text-ink dark:text-ink-inv text-lg font-extrabold transition active:scale-95 press hover:bg-flame-50 dark:hover:bg-flame-900/20">{k}</button>;
                  })}
                </div>
              </div>
              <p className="text-[10px] text-ink-faint font-bold text-center leading-relaxed">
                Lupa Employee ID atau PIN? Atasanmu bisa mereset PIN langsung dari Aplikasi Karyawan.
              </p>
              <button onClick={() => { setStep('lic'); setErr(''); }} className="w-full py-2.5 text-[11px] font-extrabold text-ink-faint hover:text-ink-soft dark:hover:text-ink-inv transition">Ganti ID Toko</button>
            </div>
          )}

          {/* v15 F2: PEMILIH CABANG BERBASIS RELASI — muncul hanya bila
              karyawan tercatat di lebih dari satu cabang */}
          {step === 'branch' && emp && (
            <div className="space-y-4">
              <StepTitle n={3}>Halo, {emp.name}! Kerja di cabang mana hari ini?</StepTitle>
              <div className="grid grid-cols-1 gap-2">
                {myBranchList.map(b => (
                  <button key={b.cid} onClick={() => finishAt(emp, b)}
                    className="flex items-center gap-3 p-3.5 rounded-2xl border-2 border-line dark:border-line-dark bg-surface dark:bg-surface-dark text-left hover:border-flame-400 transition press">
                    <span className="w-9 h-9 rounded-xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center shrink-0"><Cabang className="w-4.5 h-4.5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-extrabold text-[13px] text-ink dark:text-ink-inv truncate">{b.name}</span>
                      <span className="block text-[10px] text-ink-faint font-semibold truncate">{b.location || 'Lokasi belum diisi'}</span>
                    </span>
                  </button>
                ))}
              </div>
              <button onClick={() => { setStep('login'); setPin2(''); setErr(''); }} className="w-full py-2.5 text-[11px] font-extrabold text-ink-faint hover:text-ink-soft dark:hover:text-ink-inv transition">Kembali</button>
            </div>
          )}
        </div>

        <p className="text-center text-[9px] font-extrabold text-ink-faint dark:text-ink-inv/30 uppercase tracking-[0.22em] mt-5 flex items-center justify-center gap-1.5">
          <GembokBuddy className="w-3 h-3" /> WELP Karyawan · by JUSTru Group
        </p>
      </div>
    </div>
  );
};

/* ============================================================
   FLOW ABSEN — kamera framing 3:4 WYSIWYG + mirror kamera depan
   + stempel foto dari data sistem (logo, perusahaan, jam, GPS).
   ============================================================ */
const AbsenFlow = ({ type, session, branch, branchName, aturan, brandLogo, onClose, onSubmit }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const facingRef = useRef('user');
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

  // siapkan waktu terpercaya sejak awal (offset jam server via header host)
  useEffect(() => {
    grabGeo();
    syncTrustedTime();
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); };
  }, []);

  const startCam = async () => {
    setCamErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      facingRef.current = 'user';
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => { }); }
      setCamOn(true);
    } catch (e) {
      setCamOn(false);
      setCamErr('Kamera tidak bisa dibuka (' + (e.name || e.message) + '). Pakai tombol Pilih Foto sebagai alternatif, lalu selfie via kamera HP.');
    }
  };

  const stopCam = () => { if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; } setCamOn(false); };

  /* Potret: crop 3:4 PERSIS seperti preview (object-cover center),
     kamera depan di-mirror biar hasilnya natural seperti yang
     dilihat karyawan. Kualitas 720px JPEG — jelas tapi hemat. */
  const shoot = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const vw = v.videoWidth, vh = v.videoHeight;
    let cw = vh * 3 / 4, ch = vh;
    if (cw > vw) { cw = vw; ch = vw * 4 / 3; }
    cw = Math.round(cw); ch = Math.round(ch);
    const cx = Math.round((vw - cw) / 2), cy = Math.round((vh - ch) / 2);
    const maxSide = 720;
    const scale = Math.min(1, maxSide / Math.max(cw, ch));
    const cv = document.createElement('canvas');
    cv.width = Math.round(cw * scale); cv.height = Math.round(ch * scale);
    const ctx = cv.getContext('2d');
    if (facingRef.current === 'user') { ctx.translate(cv.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, cx, cy, cw, ch, 0, 0, cv.width, cv.height);
    const raw = cv.toDataURL('image/jpeg', 0.8);
    setBusy(true);
    // stempel dari data sistem — bukan input manual (logo perusahaan ikut F5/E1)
    const stamped = await stampAbsenPhoto({
      dataUrl: raw, company: session.tenant, branchName,
      employeeName: session.employeeName, type, atMs: trustedNow(), geo,
      trusted: trustedSourceLabel() === 'server', logo: brandLogo
    });
    setBusy(false);
    setPhoto(stamped);
    stopCam();
  };

  const pickFile = async (file) => {
    if (!file) return;
    stopCam();
    try {
      const raw = await fileToDataUrl(file, 720, 0.8);
      const stamped = await stampAbsenPhoto({
        dataUrl: raw, company: session.tenant, branchName,
        employeeName: session.employeeName, type, atMs: trustedNow(), geo,
        trusted: trustedSourceLabel() === 'server', logo: brandLogo
      });
      setPhoto(stamped);
    } catch (e) { setCamErr('Gagal memuat foto: ' + e.message); }
  };

  const dist = geo && branch?.lat != null ? distanceMeters(geo, { lat: branch.lat, lng: branch.lng }) : null;
  const outOfRadius = dist != null && dist > aturan.radius;

  const submit = async () => {
    if (!photo) return;
    setBusy(true);
    // v15 F5/F1: absen TETAP BISA tanpa GPS (izin ditolak/sinyal buruk/
    // desktop) — tercatat dgn flag geoStatus 'unavailable' agar owner
    // tahu lokasi belum terverifikasi.
    await onSubmit({ photo, geo, geoStatus: geo ? 'ok' : 'unavailable', dist, outOfRadius: !!outOfRadius, type });
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
              <p className="text-[10px] font-bold text-ink-faint">{session.employeeName} · {branchName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-paper dark:bg-white/5 text-ink-faint flex items-center justify-center">✕</button>
        </div>

        {/* KAMERA / PREVIEW SELFIE — framing wajah nyaman, tidak terpotong */}
        {!photo ? (
          <div>
            <div className="relative rounded-2xl overflow-hidden bg-night aspect-[3/4] max-h-80 mx-auto border border-line dark:border-line-dark">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
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
              {/* panduan framing wajah */}
              {camOn && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[62%] aspect-[3/4] rounded-[50%] border-2 border-dashed border-white/55 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
                </div>
              )}
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-black/55 text-white text-[9px] font-extrabold px-2 py-1 rounded-full"><Lokasi className="w-3 h-3" /> Posisikan wajah di garis</div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button onClick={startCam} variant="secondary" className="flex-1 py-3 text-xs" icon={KameraBuddy}>{camErr ? 'Coba Lagi' : (camOn ? 'Kamera Aktif' : 'Buka Kamera')}</Button>
              <label className="flex-1 cursor-pointer">
                <span className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-paper dark:bg-white/5 border border-line dark:border-line-dark text-ink-soft dark:text-ink-inv/70 text-xs font-extrabold press">Pilih Foto</span>
                <input type="file" accept="image/*" capture="user" className="hidden" onChange={e => pickFile(e.target.files[0])} />
              </label>
            </div>
            {camOn && (
              <Button onClick={shoot} disabled={busy} className="w-full py-4 mt-2 text-sm" icon={busy ? WaktuReal : KameraBuddy}>{busy ? 'Menyiapkan foto...' : 'Ambil Selfie'}</Button>
            )}
          </div>
        ) : (
          <div>
            <div className="relative rounded-2xl overflow-hidden border border-line dark:border-line-dark max-h-80 mx-auto">
              <img src={photo} alt="Selfie absensi dengan stempel waktu" className="w-full object-cover" />
              <span className="absolute top-2.5 left-2.5 bg-leaf text-white text-[9px] font-extrabold px-2 py-1 rounded-full flex items-center gap-1"><Check className="w-3 h-3" /> Foto distempel otomatis</span>
            </div>
            <p className="text-[9.5px] text-ink-faint font-semibold text-center mt-2">Tanggal, jam, lokasi, nama perusahaan & logo WELP tertulis di foto dari data sistem.</p>
            <button onClick={() => { setPhoto(null); startCam(); }} className="w-full py-2.5 mt-1 text-[11px] font-extrabold text-ink-faint hover:text-ink-soft dark:hover:text-ink-inv transition">Ambil ulang foto</button>
          </div>
        )}

        {/* LOKASI */}
        <div className={`mt-4 p-3.5 rounded-2xl border ${geoErr ? 'bg-brick-soft dark:bg-brick/10 border-brick/25' : 'bg-paper dark:bg-white/[.03] border-line dark:border-line-dark'}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-extrabold text-ink dark:text-ink-inv flex items-center gap-1.5">
              <Lokasi className="w-4 h-4 text-flame-600 dark:text-apricot" /> Lokasi {geo ? `terkunci (±${geo.acc}m)` : 'belum terkunci'}
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
          {!geo && !geoErr && (
            <p className="text-[10px] font-extrabold text-gold-deep dark:text-gold mt-1.5 flex items-start gap-1.5">
              <BahayaBuddy className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Lokasi belum terbaca. Absen tetap bisa dikirim, tapi owner melihat penanda TANPA GPS.
            </p>
          )}
          {outOfRadius && (
            <p className="text-[10px] font-extrabold text-gold-deep dark:text-gold mt-1.5 flex items-start gap-1.5">
              <BahayaBuddy className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Kamu di luar radius {aturan.radius}m. Absen tetap tercatat, tapi ditandai owner.
            </p>
          )}
        </div>

        {/* v15 F5/F1: GPS bukan lagi syarat mutlak — hanya foto */}
        <Button onClick={submit} disabled={!photo || busy} className="w-full py-4 mt-4 text-sm" icon={busy ? WaktuReal : (type === 'in' ? AbsenMasuk : AbsenPulang)}>
          {busy ? 'Mengirim...' : `Kirim Absen ${type === 'in' ? 'Masuk' : 'Pulang'}`}
        </Button>
        <p className="text-[9.5px] text-ink-faint font-semibold text-center mt-2.5 leading-relaxed flex items-center justify-center gap-1.5">
          <Perangkat className="w-3.5 h-3.5 shrink-0" />
          Jam resmi diambil dari server saat data terkirim. Jam di foto adalah jam kamera terverifikasi.
        </p>
      </div>
    </div>
  );
};

/* ============================================================
   BERANDA KARYAWAN — jam realtime, status hari ini, tombol absen,
   ringkasan gaji & pengajuan.
   ============================================================ */
const EmpHome = ({ session, goTab, openFlow, myShift, hasShifts, myTarget, myHak }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);

  const { items: branches } = useTenantCol({ id: session.lic }, 'cabang', 'cabang_db');
  const { items: absensi, live } = useTenantCol({ id: session.lic }, 'absensi', 'absensi_db');
  const { items: payroll } = useTenantCol({ id: session.lic }, 'payroll', 'payroll_db');
  const { items: pengajuan } = useTenantCol({ id: session.lic }, 'pengajuan', 'pengajuan_db');
  const { items: settings } = useTenantCol({ id: session.lic }, 'pengaturan', 'pengaturan_db');

  const branch = branches.find(b => b.cid === session.branchId) || null;
  const branchName = branch?.name || session.branchName || 'Cabang';
  const aturan = getAturan(branch);
  const today = todayKey();

  // === data milik sendiri saja (isolasinya dari session.employeeCid) ===
  const mineToday = absensi.filter(a => a.employeeCid === session.employeeCid && a.date === today);
  const inRec = mineToday.find(a => a.type === 'in');
  const outRec = mineToday.find(a => a.type === 'out');
  const lastPay = [...payroll].filter(p => p.employeeCid === session.employeeCid)
    .sort((a, b) => trustedTime(b).ms - trustedTime(a).ms)[0] || null;
  const myReq = pengajuan.filter(p => p.employeeCid === session.employeeCid)
    .sort((a, b) => trustedTime(b).ms - trustedTime(a).ms)[0] || null;

  // Slip gaji baru: dibayar tapi belum pernah dibuka di tab Gaji
  const seenKey = `welp_seen_slip_${session.employeeCid}`;
  const seenCid = localStorage.getItem(seenKey);
  const newSlip = lastPay && (lastPay.status === 'DIBAYAR' || lastPay.status === 'SELESAI') && lastPay.cid !== seenCid;

  // Hak cuti tahun ini (v14): policy perusahaan / override karyawan
  const policy = cutiPolicyOf(settings);
  const hak = myHak || policy.hakTahunan;
  const sisa = Math.max(0, hak - usedCutiDays(pengajuan, session.employeeCid));

  const firstName = session.employeeName.split(' ')[0];

  return (
    <div>
      {/* HEADER */}
      <div className="bg-chrome-deep px-4 pt-5 pb-6 relative overflow-hidden">
        <div className="absolute -right-12 -top-14 w-48 h-48 rounded-full bg-flame-500/20 blur-2xl pointer-events-none" />
        <div className="max-w-md mx-auto relative">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-apricot/85 text-[9px] font-extrabold uppercase tracking-[0.24em] flex items-center gap-1.5"><Beranda className="w-3.5 h-3.5" /> Aplikasi Karyawan</p>
              <h1 className="font-display font-extrabold text-xl text-ink-inv tracking-tight mt-1">Halo, {firstName}</h1>
              <p className="text-[10.5px] font-bold text-ink-inv/55 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <Cabang className="w-3.5 h-3.5" /> {branchName}
                <span className="font-mono">· {session.empId || 'ID belum diatur'}</span>
                <span className="inline-flex items-center gap-1 text-[8.5px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/10 text-ink-inv/85">{roleLabelOf(session.role)}</span>
                <span className={`inline-flex items-center gap-1 text-[8.5px] font-extrabold uppercase tracking-wider ${live ? 'text-leaf' : 'text-gold'}`}><span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-leaf animate-pulse-dot' : 'bg-gold'}`} />{live ? 'Realtime' : 'Lokal'}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 space-y-4 pb-32">
        {/* JAM REALTIME */}
        <div className="card !rounded-3xl overflow-hidden !bg-chrome-deep !border-chrome-edge relative mt-4">
          <div className="absolute -left-10 -bottom-12 w-40 h-40 rounded-full bg-flame-500/15 blur-2xl pointer-events-none" />
          <div className="p-6 text-center relative">
            <p className="text-apricot/85 text-[10px] font-extrabold uppercase tracking-[0.22em] mb-2">{dayLabel(now)}</p>
            <p className="font-display text-[52px] leading-none font-extrabold text-ink-inv money tracking-tight">{fmtClock(now)}</p>
            <p className="text-ink-inv/50 text-[10px] font-bold mt-2.5 flex items-center justify-center gap-1.5">
              <WaktuReal className="w-4 h-4 text-apricot" /> Jam HP hanya tampil. Jam absen dikunci server.
            </p>
          </div>
        </div>

        {/* SLIP GAJI BARU (v14) — gaji dibayar otomatis masuk ke akunmu */}
        {newSlip && (
          <button onClick={() => goTab('gaji')} className="card !rounded-3xl p-4.5 w-full text-left hover:border-flame-300 transition press flex items-center gap-3 border-gold/50 !bg-gold-soft dark:!bg-gold/10">
            <span className="w-10 h-10 rounded-2xl bg-gold text-white flex items-center justify-center shrink-0 animate-pulse-dot"><KoinBuddy className="w-5 h-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">Gaji periode {lastPay.period} sudah dibayar!</p>
              <p className="text-[10.5px] font-bold text-gold-deep dark:text-gold">{formatIDR(lastPay.amount)} · buka tab Gaji buat lihat slipnya</p>
            </div>
            <SlipGaji className="w-4.5 h-4.5 text-gold-deep dark:text-gold shrink-0" />
          </button>
        )}

        {/* SHIFT KAMU (v12) */}
        {myShift ? (
          <div className="card !rounded-3xl p-4.5 flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center shrink-0"><WaktuReal className="w-5 h-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="kicker">Shift kamu</p>
              <p className="font-extrabold text-[14px] text-ink dark:text-ink-inv leading-tight">{myShift.nama} · {fmtShiftRange(myShift)}</p>
              <p className="text-[9.5px] font-bold text-ink-faint mt-0.5">Durasi {fmtJam(shiftDurMin(myShift))} · dipasangkan owner</p>
            </div>
            <Badge tone={shiftOfMs([myShift], now) ? 'green' : 'neutral'}>{shiftOfMs([myShift], now) ? 'Sedang berjalan' : 'Di luar jam'}</Badge>
          </div>
        ) : hasShifts ? (
          <div className="card !rounded-3xl p-4.5 border-gold/40">
            <p className="font-extrabold text-[12.5px] flex items-center gap-1.5"><WaktuReal className="w-4 h-4 text-gold-deep dark:text-gold" /> Kamu belum dipasangkan shift</p>
            <p className="text-[10.5px] font-semibold text-ink-faint mt-1 leading-relaxed">Cabangmu punya sistem shift. Minta owner/admin memasangkan shiftmu di Manajemen Karyawan, atau absenmu akan tercatat fleksibel.</p>
          </div>
        ) : null}

        {/* TARGET HK BULAN INI (v13) — progres hadir vs target atasan */}
        {myTarget > 0 && (() => {
          const mStart = new Date().setDate(1); const _d = new Date();
          const msStart = new Date(_d.getFullYear(), _d.getMonth(), 1).getTime();
          const monthRows = absensi.filter(a => a.employeeCid === session.employeeCid && trustedTime(a).ms >= msStart);
          const monthWork = pairWorkMinutes(monthRows);
          const pct = Math.min(100, Math.round((monthWork.hk / myTarget) * 100));
          return (
            <div className="card !rounded-3xl p-4.5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="kicker">Target HK bulan ini</p>
                <p className="font-extrabold text-[12px] money text-ink dark:text-ink-inv">{monthWork.hk}<span className="text-ink-faint">/{myTarget} hari</span></p>
              </div>
              <div className="h-2.5 rounded-full bg-paper dark:bg-white/10 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${monthWork.hk >= myTarget ? 'bg-leaf-500' : 'bg-gradient-to-r from-flame-500 to-flame-600'}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[9.5px] font-semibold text-ink-faint mt-1.5">
                {monthWork.hk >= myTarget ? 'Target bulan ini sudah tercapai. Mantap!' : `Sisa ${myTarget - monthWork.hk} hari lagi ke target ${myTarget} HK`}
              </p>
            </div>
          );
        })()}

        {/* HAK CUTI & HARI KERJA (v14) */}
        {(() => {
          const hkr = hariKerjaOf(settings);
          return (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => goTab('ajukan')} className="card !rounded-3xl p-4 text-left hover:border-flame-300 transition press">
                <MedaliBuddy className="w-5 h-5 text-teal2 mb-2" />
                <p className="text-xl font-extrabold money leading-none text-ink dark:text-ink-inv">{sisa}<span className="text-sm text-ink-faint">/{hak} hari</span></p>
                <p className="kicker mt-1.5">Sisa cuti tahun ini</p>
              </button>
              <div className="card !rounded-3xl p-4">
                <WaktuReal className="w-5 h-5 text-leaf-deep dark:text-leaf mb-2" />
                <p className="text-[12.5px] font-extrabold text-ink dark:text-ink-inv leading-tight">{hkr.hari.length} hari kerja</p>
                <p className="kicker mt-1.5">Off: {hkr.off.length ? hariLabelOf(hkr.off) : 'tidak tetap'}</p>
              </div>
            </div>
          );
        })()}

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
            <Button onClick={() => openFlow('in')} className="w-full py-4 text-sm" icon={AbsenMasuk}>Absen Masuk Sekarang</Button>
          ) : !outRec ? (
            <Button onClick={() => openFlow('out')} className="w-full py-4 text-sm" icon={AbsenPulang}>Absen Pulang Sekarang</Button>
          ) : (
            <div className="text-center py-1.5">
              <Check className="w-9 h-9 text-leaf mx-auto mb-2" />
              <p className="font-extrabold text-sm">Absensi hari ini lengkap. Kerja bagus!</p>
              <p className="text-[11px] text-ink-faint font-semibold mt-1">{fmtTime(trustedTime(inRec).ms)} - {fmtTime(trustedTime(outRec).ms)}</p>
            </div>
          )}
          <div className="mt-4 p-3 rounded-2xl bg-paper dark:bg-white/[.03] border border-line dark:border-line-dark">
            <p className="text-[10px] font-extrabold text-ink-soft dark:text-ink-inv/70 flex items-center gap-1.5 mb-1"><Lokasi className="w-3.5 h-3.5 text-flame-600 dark:text-apricot" /> Aturan absensi cabang</p>
            <p className="text-[10px] text-ink-faint font-semibold leading-relaxed">
              Masuk {aturan.jamMasuk} (toleransi {aturan.toleransi} menit) · radius {aturan.radius} meter{branch?.lat != null ? ' · titik GPS cabang aktif' : ' · titik GPS cabang belum diatur owner'}
            </p>
          </div>
        </div>

        {/* RINGKASAN GAJI TERAKHIR */}
        {lastPay && (
          <button onClick={() => goTab('gaji')} className="card !rounded-3xl p-4.5 w-full text-left hover:border-flame-300 transition press flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center shrink-0"><Penggajian className="w-5 h-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="kicker">Gaji terakhir · {lastPay.period}</p>
              <p className="font-extrabold text-[15px] money text-ink dark:text-ink-inv leading-tight">{formatIDR(lastPay.amount)}</p>
              <p className="text-[9.5px] font-bold text-ink-faint mt-0.5">{(PAYROLL_FLOW[lastPay.status] || PAYROLL_FLOW.DIBAYAR).label}</p>
            </div>
            <SlipGaji className="w-4.5 h-4.5 text-ink-faint shrink-0" />
          </button>
        )}

        {/* STATUS PENGAJUAN TERAKHIR */}
        {myReq && (
          <button onClick={() => goTab('ajukan')} className="card !rounded-3xl p-4.5 w-full text-left hover:border-flame-300 transition press flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold flex items-center justify-center shrink-0"><Riwayat className="w-5 h-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="kicker">Pengajuan terakhirmu</p>
              <p className="font-extrabold text-[12.5px] text-ink dark:text-ink-inv truncate">{(CUTI_TYPES.find(x => x.id === myReq.type)?.label) || myReq.type} · {myReq.startDate}</p>
              <p className="text-[9.5px] font-bold text-ink-faint mt-0.5">{(CUTI_FLOW[myReq.status] || CUTI_FLOW.DIAJUKAN).desc}</p>
            </div>
            <Badge tone={(CUTI_FLOW[myReq.status] || CUTI_FLOW.DIAJUKAN).tone}>{(CUTI_FLOW[myReq.status] || CUTI_FLOW.DIAJUKAN).label}</Badge>
          </button>
        )}

        {!session.hasPin && (
          <div className="card !rounded-3xl p-4.5 border-gold/40">
            <p className="font-extrabold text-[12.5px] flex items-center gap-1.5"><BahayaBuddy className="w-4 h-4 text-gold-deep dark:text-gold" /> Akunmu belum pakai PIN pribadi</p>
            <p className="text-[10.5px] font-semibold text-ink-faint mt-1 leading-relaxed">Atur PIN di tab Profil supaya namamu tidak bisa dipakai orang lain.</p>
            <Button onClick={() => goTab('profil')} variant="secondary" className="w-full py-3 mt-3 text-xs">Atur PIN Sekarang</Button>
          </div>
        )}

        <p className="text-center text-[9px] font-extrabold text-ink-faint dark:text-ink-inv/30 uppercase tracking-[0.22em] pt-1 pb-2">WELP v14 · Fresh Ink</p>
      </div>
    </div>
  );
};

/* ============================================================
   TAB RIWAYAT ABSENSI PRIBADI
   ============================================================ */
const EmpAbsensi = ({ session, target = 0 }) => {
  const { items: branches } = useTenantCol({ id: session.lic }, 'cabang', 'cabang_db');
  const { items: absensi } = useTenantCol({ id: session.lic }, 'absensi', 'absensi_db');
  const branch = branches.find(b => b.cid === session.branchId) || null;
  const aturan = getAturan(branch);

  const mine = [...absensi].filter(a => a.employeeCid === session.employeeCid)
    .sort((a, b) => trustedTime(b).ms - trustedTime(a).ms).slice(0, 42);

  const byDay = [];
  for (const a of mine) {
    const d = dateKeyOf(trustedTime(a).ms);
    let g = byDay.find(x => x.date === d);
    if (!g) { g = { date: d, ms: trustedTime(a).ms, rows: [] }; byDay.push(g); }
    g.rows.push(a);
  }

  // rekap 7 hari
  const weekAgo = Date.now() - 7 * 864e5;
  const weekRows = mine.filter(a => trustedTime(a).ms >= weekAgo);
  const hadir = new Set(weekRows.filter(a => a.type === 'in').map(a => dateKeyOf(trustedTime(a).ms))).size;
  const telat = weekRows.filter(a => a.type === 'in' && lateInfoMs(trustedTime(a).ms, aturan).status === 'telat').length;
  const work = pairWorkMinutes(weekRows);   // HK + total jam (pasangan masuk→pulang)

  return (
    <div className="max-w-md mx-auto px-4 pb-32 pt-4 space-y-4">
      <h2 className="font-display font-extrabold text-lg text-ink dark:text-ink-inv flex items-center gap-2"><Absensi className="w-5 h-5 text-flame-600 dark:text-apricot" /> Absensiku</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="card !rounded-3xl p-4">
          <MedaliBuddy className="w-5 h-5 text-leaf-deep dark:text-leaf mb-2" />
          <p className="text-2xl font-extrabold money leading-none text-ink dark:text-ink-inv">{hadir}<span className="text-sm text-ink-faint">/7</span></p>
          <p className="kicker mt-1.5">Hadir minggu ini</p>
        </div>
        <div className="card !rounded-3xl p-4">
          <WaktuReal className="w-5 h-5 text-gold-deep dark:text-gold mb-2" />
          <p className="text-2xl font-extrabold money leading-none text-ink dark:text-ink-inv">{telat}<span className="text-sm text-ink-faint">x</span></p>
          <p className="kicker mt-1.5">Telat minggu ini</p>
        </div>
      </div>

      <div className="card !rounded-3xl p-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center shrink-0"><WaktuReal className="w-5 h-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="kicker">Total jam kerja minggu ini</p>
            <p className="text-xl font-extrabold money leading-none text-ink dark:text-ink-inv">{fmtJam(work.totalMin)}</p>
            <p className="text-[9.5px] font-bold text-ink-faint mt-1">Dihitung dari absen masuk → pulang ({work.hk} hari tercatat){work.days.some(d => d.running) ? ' · hari ini masih berjalan' : ''}</p>
          </div>
        </div>
      </div>

      {/* TARGET HK BULAN INI (v13) */}
      {target > 0 && (() => {
        const _d = new Date();
        const msStart = new Date(_d.getFullYear(), _d.getMonth(), 1).getTime();
        const monthWork = pairWorkMinutes(absensi.filter(a => a.employeeCid === session.employeeCid && trustedTime(a).ms >= msStart));
        const pct = Math.min(100, Math.round((monthWork.hk / target) * 100));
        return (
          <div className="card !rounded-3xl p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="kicker flex items-center gap-1.5"><MedaliBuddy className="w-4 h-4 text-flame-600 dark:text-apricot" /> Target HK bulan ini</p>
              <p className="font-extrabold text-[12px] money text-ink dark:text-ink-inv">{monthWork.hk}<span className="text-ink-faint">/{target} hari</span></p>
            </div>
            <div className="h-2.5 rounded-full bg-paper dark:bg-white/10 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${monthWork.hk >= target ? 'bg-leaf-500' : 'bg-gradient-to-r from-flame-500 to-flame-600'}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[9.5px] font-semibold text-ink-faint mt-1.5">
              {monthWork.hk >= target ? 'Target bulan ini sudah tercapai. Mantap!' : `Sisa ${target - monthWork.hk} hari lagi ke target ${target} HK`}
            </p>
          </div>
        );
      })()}

      <div className="card !rounded-3xl p-5">
        <p className="font-extrabold text-[13px] flex items-center gap-2 mb-3"><Riwayat className="w-4 h-4 text-flame-600 dark:text-apricot" /> Riwayat per Hari</p>
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
                        {(a.photo || a.photoUrl)
                          ? <img src={a.photoUrl || a.photo} alt="Selfie absensi" className="w-9 h-9 rounded-xl object-cover border border-line dark:border-line-dark" />
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
    </div>
  );
};

/* ============================================================
   TAB GAJI PRIBADI — hanya slip milik sendiri
   ============================================================ */
const EmpGaji = ({ session }) => {
  const { items: payroll } = useTenantCol({ id: session.lic }, 'payroll', 'payroll_db');
  const { items: settings } = useTenantCol({ id: session.lic }, 'pengaturan', 'pengaturan_db');
  const coProfile = settings.find(s => s.key === 'perusahaan') || {};
  const [view, setView] = useState(null);
  const mine = [...payroll].filter(p => p.employeeCid === session.employeeCid)
    .sort((a, b) => trustedTime(b).ms - trustedTime(a).ms);

  // Slip gaji premium otomatis masuk ke akun karyawan — begitu owner
  // menandai Dibayar, slipnya langsung muncul di sini (realtime).
  // Tandai "sudah dilihat" supaya kartu notifikasi di Beranda hilang.
  useEffect(() => {
    const paid = mine.find(p => p.status === 'DIBAYAR' || p.status === 'SELESAI');
    if (paid) { try { localStorage.setItem(`welp_seen_slip_${session.employeeCid}`, paid.cid); } catch (e) { } }
  }, [mine.length, session.employeeCid]);

  const printSlip = (rec) => {
    const w = window.open('', '_blank', 'width=560,height=800');
    if (!w) return;
    w.document.write(buildSlipHtml({ rec, company: session.tenant || 'Perusahaan', profile: coProfile, roleLabel: roleLabelOf(rec.role || session.role) }));
    w.document.close();
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-32 pt-4 space-y-4">
      <h2 className="font-display font-extrabold text-lg text-ink dark:text-ink-inv flex items-center gap-2"><Penggajian className="w-5 h-5 text-flame-600 dark:text-apricot" /> Slip Gajiku</h2>

      {mine.length === 0 ? (
        <div className="card !rounded-3xl">
          <div className="py-10 text-center px-6">
            <Mascot pose="pikir" className="w-24 h-24 object-contain mx-auto mb-3" alt="" />
            <p className="text-sm font-extrabold text-ink dark:text-ink-inv">Belum ada slip gaji</p>
            <p className="text-[11px] font-semibold text-ink-faint mt-1 leading-relaxed">Slip gaji dari owner/admin akan muncul di sini setelah payroll kamu diproses.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {mine.map(p => {
            const st = p.status || 'DIBAYAR';
            const flow = PAYROLL_FLOW[st] || PAYROLL_FLOW.DIBAYAR;
            const paid = st === 'DIBAYAR' || st === 'SELESAI';
            return (
              <div key={p.cid} className="card p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-extrabold text-[13.5px] text-ink dark:text-ink-inv">Periode {p.period}</p>
                    <p className="text-[10px] font-bold text-ink-faint mt-0.5">{p.branchName || '-'}{p.paidAt ? ` · dibayar ${new Date(p.paidAt).toLocaleDateString('id-ID')}` : ''}</p>
                    <p className="font-extrabold money text-flame-700 dark:text-apricot text-lg mt-1">{formatIDR(p.amount)}</p>
                  </div>
                  <Badge tone={flow.tone}>{flow.label}</Badge>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setView(p)} className="flex-1 py-2.5 rounded-xl bg-paper dark:bg-white/5 border border-line dark:border-line-dark text-ink-soft dark:text-ink-inv/80 text-[11px] font-extrabold flex items-center justify-center gap-1.5 press"><Kredensial className="w-4 h-4" /> Rincian</button>
                  {paid && (
                    <button onClick={() => printSlip(p)} className="flex-1 py-2.5 rounded-xl bg-flame-600 hover:bg-flame-500 text-white text-[11px] font-extrabold flex items-center justify-center gap-1.5 press"><SlipGaji className="w-4 h-4" /> Cetak Slip</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL RINCIAN SLIP */}
      {view && (
        <div className="fixed inset-0 z-[120] bg-chrome-deep/75 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in" onClick={() => setView(null)}>
          <div className="w-full sm:max-w-md bg-surface dark:bg-surface-dark rounded-t-[1.75rem] sm:rounded-[1.75rem] p-5 max-h-[92vh] overflow-y-auto custom-scrollbar animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="kicker">Slip Gaji</p>
                <p className="font-extrabold text-[15px] text-ink dark:text-ink-inv">Periode {view.period}</p>
              </div>
              <button onClick={() => setView(null)} className="w-9 h-9 rounded-full bg-paper dark:bg-white/5 text-ink-faint flex items-center justify-center">✕</button>
            </div>
            <div className="p-4 rounded-2xl bg-flame-50 dark:bg-flame-900/25 text-center mb-3">
              <p className="kicker">Total Diterima</p>
              <p className="text-2xl font-extrabold money text-flame-700 dark:text-apricot mt-1">{formatIDR(view.amount)}</p>
            </div>
            <div className="space-y-1.5 text-[12px] font-bold">
              {[
                [view.jenisKontrak === 'harian' ? `Upah Harian × ${view.hk || 0} hari masuk` : 'Gaji Pokok', view.components?.pokok],
                ['Tunjangan', view.components?.tunjangan],
                ['Bonus', view.components?.bonus],
                ['Lembur', view.components?.lembur],
                ['Potongan', view.components?.potongan ? -(view.components.potongan) : null],
              ].map(([k, v]) => v ? (
                <div key={k} className="flex justify-between"><span className="text-ink-faint">{k}</span><span className="money text-ink dark:text-ink-inv">{formatIDR(v)}</span></div>
              ) : null)}
              <div className="flex justify-between border-t border-dashed border-line dark:border-line-dark pt-2"><span className="text-ink-faint">Status</span><span>{(PAYROLL_FLOW[view.status || 'DIBAYAR'] || PAYROLL_FLOW.DIBAYAR).label}</span></div>
              {view.paidAt && <div className="flex justify-between"><span className="text-ink-faint">Tanggal Bayar</span><span>{new Date(view.paidAt).toLocaleString('id-ID')}</span></div>}
              {(view.approvals || []).filter(a => a.action === 'approve').slice(-1).map((a, i) => (
                <div key={i} className="flex justify-between"><span className="text-ink-faint">Disetujui</span><span>{a.by} · {new Date(a.at).toLocaleDateString('id-ID')}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================
   TAB PENGAJUAN (v14) — sakit / izin / cuti + upload surat dokter.
   Status: Diajukan → Ditinjau → Disetujui / Ditolak (dgn alasan).
   Baru: hak cuti tahunan (default 12 hari sesuai UU) dengan sisa
   kuota live, dan PANEL PERSETUJUAN untuk atasan (Owner/Admin)
   — semua orang pakai app yang sama, bedanya cuma role.
   ============================================================ */
const EmpAjukan = ({ session, me }) => {
  const { items: pengajuan, addRow, updateRow } = useTenantCol({ id: session.lic }, 'pengajuan', 'pengajuan_db');
  const { items: settings } = useTenantCol({ id: session.lic }, 'pengaturan', 'pengaturan_db');
  const { items: karyawan } = useTenantCol({ id: session.lic }, 'karyawan', 'karyawan_db');
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState({ type: 'sakit', startDate: '', endDate: '', reason: '' });
  const [letter, setLetter] = useState(null);
  const [letterBusy, setLetterBusy] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState({ show: false, message: '', type: 'success' });
  const [rejectId, setRejectId] = useState(null);
  const [rejectNote, setRejectNote] = useState('');

  const alert = (message, type = 'success') => { setPopup({ show: true, message, type }); };

  // hak cuti pribadi (policy perusahaan / override di akun karyawan)
  const policy = cutiPolicyOf(settings);
  const myRec = me || karyawan.find(k => k.cid === session.employeeCid) || null;
  const hak = hakCutiOf(policy, myRec);
  const sisa = Math.max(0, hak - usedCutiDays(pengajuan, session.employeeCid));

  const mine = [...pengajuan].filter(p => p.employeeCid === session.employeeCid)
    .sort((a, b) => trustedTime(b).ms - trustedTime(a).ms);

  // ===== PANEL PERSETUJUAN (khusus atasan: Owner & Admin) =====
  const atasan = isAtasan(session.role);
  const pendingAll = pengajuan
    .filter(p => p.status === 'DIAJUKAN' || p.status === 'DITINJAU')
    .filter(p => session.role === 'owner' ? true : (p.branchId === session.branchId))
    .sort((a, b) => trustedTime(a).ms - trustedTime(b).ms);
  const doneAll = pengajuan
    .filter(p => (p.status === 'DISETUJUI' || p.status === 'DITOLAK') && (session.role === 'owner' ? true : (p.branchId === session.branchId)))
    .sort((a, b) => trustedTime(b).ms - trustedTime(a).ms).slice(0, 6);

  // v15 F2: reset PIN karyawan oleh atasan (dengan audit)
  const [showResetPin, setShowResetPin] = useState(false);
  const [resetTarget, setResetTarget] = useState('Pilih karyawan...');
  const doResetPin = async () => {
    const cid = resetTarget.split('||')[0];
    const rec = karyawan.find(k => k.cid === cid);
    if (!rec) return alert('Pilih dulu karyawan yang PIN-nya mau direset.', 'error');
    const np = String(Math.floor(100000 + Math.random() * 900000));
    const cred = await makeCred(np);
    updateRow(rec.cid, { cred, pin: null });
    auditLog({ id: session.lic, tenant: session.tenant, currentUserRole: session.role, branchId: session.branchId, employeeName: session.employeeName },
      'KARYAWAN_PIN_RESET', { target: rec.empId || rec.cid, oleh: session.employeeName });
    alert(`PIN ${rec.name} baru: ${np} — catat sekarang, tampil sekali.`, 'success');
    setResetTarget('Pilih karyawan...');
  };

  const reviewReq = (rec, to, note = '') => {
    const from = rec.status || 'DIAJUKAN';
    updateRow(rec.cid, {
      status: to,
      ...(to === 'DITOLAK' ? { rejectReason: note } : {}),
      history: [...(Array.isArray(rec.history) ? rec.history : []),
        { from, to, by: session.employeeName, role: session.role, at: Date.now(), note }]
    });
    auditLog({ id: session.lic, tenant: session.tenant, currentUserRole: session.role, branchId: session.branchId, employeeName: session.employeeName },
      'PENGAJUAN_' + to, { karyawan: rec.employeeName, jenis: rec.type, note });
    alert(to === 'DISETUJUI' ? `Pengajuan ${rec.employeeName} disetujui.` : to === 'DITOLAK' ? 'Pengajuan ditolak, alasannya dikirim ke yang bersangkutan.' : 'Pengajuan ditandai sedang ditinjau.', 'success');
  };

  const pickLetter = async (file) => {
    if (!file) return;
    setLetterBusy(true);
    try { setLetter(await fileToDataUrl(file, 720, 0.66)); }
    catch (e) { setErr('Gagal memuat gambar surat: ' + e.message); }
    setLetterBusy(false);
  };

  const submit = () => {
    setErr('');
    if (!form.startDate) return setErr('Pilih dulu tanggal mulainya.');
    const end = form.endDate || form.startDate;
    if (new Date(end) < new Date(form.startDate)) return setErr('Tanggal selesai tidak boleh sebelum tanggal mulai.');
    const ct = CUTI_TYPES.find(x => x.id === form.type);
    if (ct.needLetter && !letter) return setErr('Untuk pengajuan Sakit, lampirkan foto surat dokter ya.');
    if (form.reason.trim().length < 5) return setErr('Tulis keterangannya sedikit lebih jelas (minimal 5 huruf).');
    const days = daysBetween(form.startDate, end);
    // Cuti memotong kuota tahunan: tolak bila sisa tidak cukup
    if (form.type === 'cuti' && days > sisa) {
      return setErr(`Sisa cutimu tinggal ${sisa} hari, kurang dari ${days} hari yang diajukan. Coba kurangi durasinya, atau ajukan izin lalu konsultasi dengan atasan.`);
    }
    setBusy(true);
    // daftar tanggal (maks 60 hari) utk monitoring owner
    const dates = [];
    const d0 = new Date(form.startDate + 'T00:00:00');
    for (let i = 0; i < Math.min(days, 60); i++) {
      const d = new Date(d0.getTime() + i * 864e5);
      dates.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
    }
    addRow({
      employeeCid: session.employeeCid, employeeName: session.employeeName, empId: session.empId || '',
      branchId: session.branchId, branchName: session.branchName,
      type: form.type, startDate: form.startDate, endDate: end, days, dates,
      reason: form.reason.trim(), letter: letter || null, status: 'DIAJUKAN',
      history: [{ from: 'BARU', to: 'DIAJUKAN', by: session.employeeName, role: session.role, at: Date.now(), note: 'Diajukan sendiri' }]
    });
    auditLog({ id: session.lic, tenant: session.tenant, currentUserRole: session.role, branchId: session.branchId, employeeName: session.employeeName },
      'PENGAJUAN_DIAJUKAN', { jenis: form.type, mulai: form.startDate, selesai: end, hari: days });
    setBusy(false);
    setOpenForm(false);
    setForm({ type: 'sakit', startDate: '', endDate: '', reason: '' }); setLetter(null);
    alert('Pengajuan terkirim! Atasan akan meninjau. Pantau statusnya di sini.', 'success');
  };

  const btn = 'flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl transition press';
  const CutiBadgeMini = ({ type }) => (
    <Badge tone={type === 'sakit' ? 'red' : type === 'cuti' ? 'teal' : 'gold'}>
      {(CUTI_TYPES.find(x => x.id === type)?.label) || type}
    </Badge>
  );

  return (
    <div className="max-w-md mx-auto px-4 pb-32 pt-4 space-y-4">
      {popup.show && <Toast message={popup.message} type={popup.type} onClose={() => setPopup(p => ({ ...p, show: false }))} />}

      <div className="flex justify-between items-center">
        <h2 className="font-display font-extrabold text-lg text-ink dark:text-ink-inv flex items-center gap-2"><Riwayat className="w-5 h-5 text-flame-600 dark:text-apricot" /> Pengajanku</h2>
        <Button onClick={() => { setOpenForm(!openForm); setErr(''); }} className="py-2.5 px-3.5 text-xs" icon={Plus}>Ajukan</Button>
      </div>

      {/* KUOTA CUTI TAHUN INI */}
      <div className="card !rounded-3xl p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="kicker flex items-center gap-1.5"><MedaliBuddy className="w-4 h-4 text-flame-600 dark:text-apricot" /> Hak cuti tahun ini</p>
          <p className="font-extrabold text-[12px] money text-ink dark:text-ink-inv">{sisa}<span className="text-ink-faint">/{hak} hari</span></p>
        </div>
        <div className="h-2.5 rounded-full bg-paper dark:bg-white/10 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${sisa === 0 ? 'bg-brick' : 'bg-gradient-to-r from-flame-500 to-flame-600'}`} style={{ width: `${hak ? Math.min(100, (sisa / hak) * 100) : 0}%` }} />
        </div>
        <p className="text-[9.5px] font-semibold text-ink-faint mt-1.5">
          {hak} hari per tahun sesuai kebijakan perusahaan (standar UU 12 hari). Sakit & izin tidak memotong kuota ini.
        </p>
      </div>

      {openForm && (
        <div className="card !rounded-3xl p-5 space-y-3.5 animate-pop">
          <p className="font-extrabold text-[13.5px]">Form Pengajuan Ketidakhadiran</p>
          {err && <p className="px-3.5 py-2.5 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick text-xs font-bold">{err}</p>}

          <div>
            <label className="kicker block mb-1.5">Jenis Pengajuan</label>
            <div className="grid grid-cols-4 gap-1.5">
              {CUTI_TYPES.map(ct => (
                <button key={ct.id} onClick={() => setForm(f => ({ ...f, type: ct.id }))}
                  className={`py-2.5 rounded-xl text-[10px] font-extrabold border-2 transition press ${form.type === ct.id ? 'border-flame-500 bg-flame-50 dark:bg-flame-900/25 text-flame-700 dark:text-apricot' : 'border-line dark:border-line-dark text-ink-faint'}`}>
                  {ct.label}
                </button>
              ))}
            </div>
            {form.type === 'cuti' && (
              <p className={`text-[10px] font-extrabold mt-2 ${sisa > 0 ? 'text-leaf-deep dark:text-leaf' : 'text-brick'}`}>
                Cuti memotong kuota tahunan. Sisa cutimu: {sisa} hari.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="kicker block mb-1.5">Mulai</label>
              <input type="date" className="field !px-3" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="kicker block mb-1.5">Sampai</label>
              <input type="date" className="field !px-3" value={form.endDate} min={form.startDate || undefined} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="kicker block mb-1.5">Keterangan</label>
            <textarea rows={3} className="field resize-none" placeholder="Contoh: demam tinggi, ada surat dokter dari klinik."
              value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
          </div>

          {CUTI_TYPES.find(x => x.id === form.type)?.needLetter && (
            <div>
              <label className="kicker block mb-1.5">Surat Dokter / Bukti</label>
              {letter ? (
                <div className="relative rounded-xl overflow-hidden border border-line dark:border-line-dark">
                  <img src={letter} alt="Surat dokter" className="w-full h-36 object-cover" />
                  <button onClick={() => setLetter(null)} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-brick text-white text-xs font-extrabold">✕</button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-line dark:border-line-dark rounded-xl cursor-pointer hover:border-flame-400 transition">
                  {letterBusy ? <><WaktuReal className="w-6 h-6 text-flame-500 animate-spin" /><p className="text-[10px] font-bold text-ink-faint mt-1.5">Memproses gambar...</p></> : <>
                    <BuktiTransfer className="w-8 h-8 text-ink-faint/50 mb-1.5" />
                    <p className="text-[11px] font-extrabold text-ink-soft dark:text-ink-inv/70">Foto / Pilih Surat Dokter</p>
                    <p className="text-[9px] text-ink-faint font-semibold mt-0.5">JPG/PNG, dikompres otomatis</p>
                  </>}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => pickLetter(e.target.files[0])} />
                </label>
              )}
            </div>
          )}

          <Button onClick={submit} disabled={busy} className="w-full py-3.5" icon={busy ? WaktuReal : Check}>Kirim Pengajuan</Button>
          <p className="text-[9.5px] text-ink-faint font-semibold text-center">Pengajuan diteruskan ke Admin Cabang & Owner sesuai aturan cabang.</p>
        </div>
      )}

      {/* PANEL PERSETUJUAN ATASAN */}
      {atasan && (
        <div className="card !rounded-3xl p-5">
          <p className="font-extrabold text-[13px] flex items-center gap-2 mb-1"><PerisaiBuddy className="w-4 h-4 text-flame-600 dark:text-apricot" /> Menunggu Persetujuanmu</p>
          <p className="text-[10px] font-semibold text-ink-faint leading-relaxed mb-3">
            {session.role === 'owner' ? 'Sebagai Owner, semua pengajuan dari seluruh cabang muncul di sini.' : 'Sebagai Admin Cabang, pengajuan karyawan cabangmu muncul di sini.'}
          </p>
          {pendingAll.length === 0 ? (
            <div className="py-5 text-center">
              <Mascot pose="kerja" className="w-16 h-16 object-contain mx-auto mb-2" alt="" />
              <p className="text-xs font-bold text-ink-faint">Tidak ada pengajuan menunggu. Lancar!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingAll.map(p => {
                const t = trustedTime(p);
                const ownReq = p.employeeCid === session.employeeCid;
                const emp2 = karyawan.find(k => k.cid === p.employeeCid) || null;
                const hak2 = hakCutiOf(policy, emp2);
                const sisa2 = Math.max(0, hak2 - usedCutiDays(pengajuan, p.employeeCid));
                return (
                  <div key={p.cid} className="p-3.5 rounded-2xl border border-line dark:border-line-dark bg-paper dark:bg-white/[.03]">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <p className="font-extrabold text-[12.5px] text-ink dark:text-ink-inv">{p.employeeName} <CutiBadgeMini type={p.type} /></p>
                        <p className="text-[10px] font-bold text-ink-faint mt-0.5">
                          {p.startDate === p.endDate ? p.startDate : `${p.startDate} s/d ${p.endDate}`} · {p.days} hari · {p.branchName || '-'}
                        </p>
                        {p.type === 'cuti' && (
                          <p className={`text-[9.5px] font-extrabold mt-0.5 ${sisa2 >= p.days ? 'text-leaf-deep dark:text-leaf' : 'text-gold-deep dark:text-gold'}`}>
                            sisa cuti {sisa2}/{hak2} hari
                          </p>
                        )}
                        {p.reason && <p className="text-[10.5px] font-semibold text-ink-soft dark:text-ink-inv/70 mt-1 leading-snug">"{p.reason}"</p>}
                        <p className="text-[9px] font-bold text-ink-faint mt-1 flex items-center gap-1"><WaktuReal className="w-3 h-3" /> diajukan {new Date(t.ms).toLocaleString('id-ID')}{t.source === 'server' ? ' · ✓ server' : ''}</p>
                      </div>
                      <Badge tone={(CUTI_FLOW[p.status] || CUTI_FLOW.DIAJUKAN).tone}>{(CUTI_FLOW[p.status] || CUTI_FLOW.DIAJUKAN).label}</Badge>
                    </div>
                    {ownReq ? (
                      <p className="text-[10px] font-bold text-gold-deep dark:text-gold mt-2.5 bg-gold-soft dark:bg-gold/10 rounded-xl px-3 py-2">
                        Ini pengajuanmu sendiri. Minta atasan lain atau Owner yang menyetujuinya ya.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {p.letter && (
                          <button type="button" onClick={() => openDataUrl(p.letter, 'surat')} className="py-2.5 px-3 rounded-xl bg-surface dark:bg-white/5 border border-line dark:border-line-dark text-[10.5px] font-extrabold text-ink-soft dark:text-ink-inv/80 flex items-center gap-1.5 press">
                            <BuktiTransfer className="w-3.5 h-3.5" /> Surat
                          </button>
                        )}
                        {p.status === 'DIAJUKAN' && (
                          <button onClick={() => reviewReq(p, 'DITINJAU')} className="py-2.5 px-3 rounded-xl bg-surface dark:bg-white/5 border border-line dark:border-line-dark text-[10.5px] font-extrabold text-ink-soft dark:text-ink-inv/80 press">Ditinjau</button>
                        )}
                        <button onClick={() => reviewReq(p, 'DISETUJUI')} className="py-2.5 px-3.5 rounded-xl bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf text-[10.5px] font-extrabold press">Setujui</button>
                        <button onClick={() => { setRejectId(rejectId === p.cid ? null : p.cid); setRejectNote(''); }} className="py-2.5 px-3.5 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick text-[10.5px] font-extrabold press">Tolak</button>
                      </div>
                    )}
                    {rejectId === p.cid && !ownReq && (
                      <div className="mt-2.5 space-y-2">
                        <textarea rows={2} className="field resize-none !text-[11px]" placeholder="Tulis alasannya, biar yang bersangkutan paham."
                          value={rejectNote} onChange={e => setRejectNote(e.target.value)} />
                        <button onClick={() => { if (!rejectNote.trim()) { alert('Tulis dulu alasannya, ya.', 'error'); return; } reviewReq(p, 'DITOLAK', rejectNote.trim()); setRejectId(null); setRejectNote(''); }}
                          className="w-full py-2.5 rounded-xl bg-brick text-white text-[11px] font-extrabold press">Kirim Penolakan</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* v15 F2: RESET PIN KARYAWAN OLEH ATASAN — langsung dari app,
              dengan audit log. PIN baru ditampilkan SEKALI. */}
          <div className="mt-4 pt-4 border-t border-line dark:border-line-dark">
            <button type="button" onClick={() => setShowResetPin(!showResetPin)}
              className="text-[11px] font-extrabold text-ink-soft dark:text-ink-inv/70 flex items-center gap-1.5">
              <Kredensial className="w-3.5 h-3.5 text-flame-600 dark:text-apricot" /> Reset PIN karyawan {showResetPin ? '▲' : '▼'}
            </button>
            {showResetPin && (
              <div className="mt-2.5 space-y-2">
                <select value={resetTarget} onChange={e => setResetTarget(e.target.value)}
                  className="field !text-[11px] w-full">
                  <option value="Pilih karyawan...">Pilih karyawan...</option>
                  {karyawan.filter(k => k.cid !== session.employeeCid && (session.role === 'owner' || empBranchIds(k).includes(session.branchId))).map(k => (
                    <option key={k.cid} value={`${k.cid}||${k.name}${k.empId ? ' (' + k.empId + ')' : ''}`}>{k.name}{k.empId ? ` (${k.empId})` : ''}</option>
                  ))}
                </select>
                <button onClick={doResetPin} className="w-full py-2.5 rounded-xl bg-flame-600 text-white text-[11px] font-extrabold press">Buat PIN Baru (acak)</button>
                <p className="text-[9.5px] font-bold text-ink-faint leading-relaxed">PIN baru tampil sekali — berikan langsung ke yang bersangkutan, lalu minta ia menggantinya sendiri di Profil.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {mine.length === 0 ? (
          <div className="card !rounded-3xl">
            <div className="py-10 text-center px-6">
              <Mascot pose="menyapa" className="w-24 h-24 object-contain mx-auto mb-3" alt="" />
              <p className="text-sm font-extrabold text-ink dark:text-ink-inv">Belum ada pengajuan</p>
              <p className="text-[11px] font-semibold text-ink-faint mt-1 leading-relaxed">Kalau kamu sakit, izin, atau butuh cuti, ajukan dari tombol Ajukan di atas.</p>
            </div>
          </div>
        ) : mine.map(p => {
          const t = trustedTime(p);
          const flow = CUTI_FLOW[p.status] || CUTI_FLOW.DIAJUKAN;
          const ct = CUTI_TYPES.find(x => x.id === p.type);
          return (
            <div key={p.cid} className="card p-4">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">{ct?.label || p.type} <span className="text-[10px] font-bold text-ink-faint">· {p.days} hari</span></p>
                  <p className="text-[10.5px] font-bold text-ink-faint mt-0.5">{p.startDate === p.endDate ? p.startDate : `${p.startDate} s/d ${p.endDate}`}</p>
                  {p.reason && <p className="text-[10.5px] font-semibold text-ink-soft dark:text-ink-inv/70 mt-1 leading-snug">"{p.reason}"</p>}
                  {p.status === 'DITOLAK' && p.rejectReason && (
                    <p className="text-[10.5px] font-bold text-brick-deep dark:text-brick mt-1.5">Alasan ditolak: {p.rejectReason}</p>
                  )}
                  <p className="text-[9.5px] font-bold text-ink-faint mt-1.5 flex items-center gap-1"><WaktuReal className="w-3 h-3" /> diajukan {new Date(t.ms).toLocaleString('id-ID')}{t.source === 'server' ? ' · ✓ server' : ''}</p>
                </div>
                <Badge tone={flow.tone}>{flow.label}</Badge>
              </div>
              {p.letter && (
                <button type="button" onClick={() => openDataUrl(p.letter, 'surat')} className="mt-3 inline-flex items-center gap-1.5 py-2 px-3 rounded-xl bg-paper dark:bg-white/5 border border-line dark:border-line-dark text-[10.5px] font-extrabold text-ink-soft dark:text-ink-inv/80">
                  <BuktiTransfer className="w-3.5 h-3.5" /> Lihat surat/bukti terlampir
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================
   TAB PROFIL — identitas, dokumen pribadi, ganti PIN, tema.
   ============================================================ */
const EmpProfil = ({ session, dark, toggleDark, onLogout }) => {
  const { items: employees, updateRow } = useTenantCol({ id: session.lic }, 'karyawan', 'karyawan_db');
  const { items: payroll } = useTenantCol({ id: session.lic }, 'payroll', 'payroll_db');
  const { items: pengajuan } = useTenantCol({ id: session.lic }, 'pengajuan', 'pengajuan_db');
  const { items: dokumen } = useTenantCol({ id: session.lic }, 'dokumen', 'dokumen_db');
  const companyDocs = dokumen.filter(d => d.share);
  const brand = useBrandState();
  const brandCustom = !!(brand && brand.aktif);
  const brandNama = brand?.namaPerusahaan || '';
  const [stage, setStage] = useState('idle');   // idle | old | new
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [err, setErr] = useState('');
  const me = employees.find(e => e.cid === session.employeeCid);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'go'];

  const submitPin = async () => {
    setErr('');
    if (newPin.length !== 6) return setErr('PIN baru harus 6 digit.');
    // v15 F0: PIN baru disimpan sebagai hash cred (plaintext tidak disimpan)
    const cred = await makeCred(newPin);
    updateRow(session.employeeCid, { cred, pin: null });
    auditLog({ id: session.lic, tenant: session.tenant, currentUserRole: 'karyawan', branchId: session.branchId, employeeName: session.employeeName }, 'KARYAWAN_GANTI_PIN', { oleh: 'karyawan sendiri' });
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
      s.hasPin = true; localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch (e) { }
    setStage('idle'); setOldPin(''); setNewPin('');
    alertPin();
  };

  const [pinToast, setPinToast] = useState({ show: false, msg: '', ok: true });
  const alertPin = () => setPinToast({ show: true, msg: 'PIN pribadi berhasil diperbarui!', ok: true });

  const mySlips = payroll.filter(p => p.employeeCid === session.employeeCid);
  const myLetters = pengajuan.filter(p => p.employeeCid === session.employeeCid && p.letter);

  return (
    <div className="max-w-md mx-auto px-4 pb-32 pt-4 space-y-4">
      {pinToast.show && <Toast message={pinToast.msg} type="success" onClose={() => setPinToast(p => ({ ...p, show: false }))} />}

      <h2 className="font-display font-extrabold text-lg text-ink dark:text-ink-inv flex items-center gap-2"><Tim className="w-5 h-5 text-flame-600 dark:text-apricot" /> Profil</h2>

      {/* KARTU IDENTITAS */}
      <div className="card !rounded-3xl overflow-hidden !bg-chrome-deep !border-chrome-edge">
        <div className="p-5 flex items-center gap-3.5 relative">
          <div className="absolute -right-8 -top-10 w-32 h-32 rounded-full bg-flame-500/20 blur-2xl pointer-events-none" />
          <span className="w-14 h-14 rounded-3xl bg-flame-500 text-white flex items-center justify-center font-extrabold text-xl shrink-0">{session.employeeName[0]}</span>
          <div className="min-w-0">
            <p className="font-display font-extrabold text-lg text-ink-inv truncate">{session.employeeName}</p>
            <p className="text-[10px] font-bold text-ink-inv/60 font-mono">{session.empId || 'Employee ID belum diatur'}</p>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              <span className="text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full bg-white/10 text-ink-inv/85">{roleLabelOf(session.role)}</span>
              <span className="text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full bg-white/10 text-ink-inv/85">{session.branchName}</span>
              <span className="text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full bg-white/10 text-ink-inv/85">{session.tenant}</span>
              {me && <span className="text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full bg-white/10 text-ink-inv/85">{kontrakOf(me).short}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* DOKUMEN PRIBADI */}
      <div className="card !rounded-3xl p-5">
        <p className="font-extrabold text-[13px] flex items-center gap-2 mb-3"><Kredensial className="w-4 h-4 text-flame-600 dark:text-apricot" /> Dokumen Pribadi</p>
        <div className="space-y-2">
          <p className="text-[10px] font-extrabold text-ink-faint uppercase tracking-wider">Slip Gaji ({mySlips.length})</p>
          {mySlips.length === 0 ? <p className="text-[11px] font-bold text-ink-faint">Belum ada slip gaji.</p> : mySlips.slice(0, 3).map(p => (
            <div key={p.cid} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-paper dark:bg-white/[.03]">
              <p className="text-[11px] font-extrabold text-ink dark:text-ink-inv truncate">Slip {p.period}</p>
              <Badge tone={(PAYROLL_FLOW[p.status || 'DIBAYAR'] || PAYROLL_FLOW.DIBAYAR).tone}>{(PAYROLL_FLOW[p.status || 'DIBAYAR'] || PAYROLL_FLOW.DIBAYAR).label}</Badge>
            </div>
          ))}
          <p className="text-[10px] font-extrabold text-ink-faint uppercase tracking-wider pt-1.5">Surat / Bukti Pengajuan ({myLetters.length})</p>
          {myLetters.length === 0 ? <p className="text-[11px] font-bold text-ink-faint">Belum ada surat terlampir.</p> : myLetters.slice(0, 3).map(p => (
            <button key={p.cid} type="button" onClick={() => openDataUrl(p.letter, 'surat')} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-paper dark:bg-white/[.03] hover:border-flame-300 border border-transparent transition text-left w-full">
              <p className="text-[11px] font-extrabold text-ink dark:text-ink-inv truncate">{(CUTI_TYPES.find(x => x.id === p.type)?.label) || p.type} · {p.startDate}</p>
              <BuktiTransfer className="w-4 h-4 text-ink-faint shrink-0" />
            </button>
          ))}
          <p className="text-[9.5px] text-ink-faint font-semibold pt-1">Dokumen ini hanya milikmu. Karyawan lain tidak bisa melihatnya.</p>
        </div>
      </div>

      {/* DOKUMEN PERUSAHAAN (v14) — yang dibagikan owner ke seluruh karyawan */}
      <div className="card !rounded-3xl p-5">
        <p className="font-extrabold text-[13px] flex items-center gap-2 mb-3"><Toko className="w-4 h-4 text-flame-600 dark:text-apricot" /> Dokumen Perusahaan</p>
        {(() => {
          const shared = [...companyDocs].sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
          if (shared.length === 0) return <p className="text-[11px] font-bold text-ink-faint">Belum ada dokumen yang dibagikan perusahaan.</p>;
          return (
            <div className="space-y-2">
              {shared.map(d => (
                <button key={d.cid} type="button" onClick={() => d.fileUrl ? window.open(d.fileUrl, '_blank') : openDataUrl(d.fileData, 'dokumen')} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-paper dark:bg-white/[.03] hover:border-flame-300 border border-transparent transition text-left w-full">
                  {d.fileType === 'application/pdf'
                    ? <span className="w-9 h-9 rounded-lg bg-brick-soft dark:bg-brick/10 text-brick flex items-center justify-center font-extrabold text-[8.5px] shrink-0">PDF</span>
                    : (d.fileData || d.fileUrl) ? <img src={d.fileUrl || d.fileData} alt={d.nama} className="w-9 h-9 rounded-lg object-cover shrink-0" /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] font-extrabold text-ink dark:text-ink-inv truncate">{d.nama}</p>
                    <p className="text-[9px] font-bold text-ink-faint">{d.kategori}</p>
                  </div>
                  <BuktiTransfer className="w-4 h-4 text-ink-faint shrink-0" />
                </button>
              ))}
              <p className="text-[9.5px] text-ink-faint font-semibold pt-1">Dokumen resmi dari perusahaan: kontrak kerja, hak karyawan, dan kebijakan.</p>
            </div>
          );
        })()}
      </div>

      {/* GANTI PIN PRIBADI */}
      <div className="card !rounded-3xl p-5">
        <p className="font-extrabold text-[13px] flex items-center gap-2 mb-1"><GembokBuddy className="w-4 h-4 text-flame-600 dark:text-apricot" /> PIN Pribadi</p>
        <p className="text-[10.5px] font-semibold text-ink-faint leading-relaxed mb-3">
          {me?.pin ? 'PIN dipakai saat login aplikasi ini dan di POS Station. Ganti berkala supaya aman.' : 'Akunmu belum punya PIN. Atur sekarang biar namamu tidak bisa dipakai orang lain.'}
        </p>
        {err && <p className="mb-3 px-3.5 py-2.5 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick text-xs font-bold">{err}</p>}
        {stage === 'idle' && (
          <Button variant="secondary" className="w-full py-3" onClick={() => { setStage(me?.pin ? 'old' : 'new'); setErr(''); }} icon={GembokBuddy}>
            {me?.pin ? 'Ganti PIN' : 'Atur PIN Sekarang'}
          </Button>
        )}
        {stage === 'old' && (
          <div>
            <p className="text-[11px] font-extrabold text-center mb-2">Masukkan PIN lama dulu</p>
            <div className="flex gap-2 justify-center mb-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`w-8 h-10 rounded-xl border-2 flex items-center justify-center ${i < oldPin.length ? 'border-flame-500 bg-flame-50 dark:bg-flame-900/25' : 'border-line dark:border-line-dark'}`}>
                  {i < oldPin.length && <div className="w-2 h-2 rounded-full bg-flame-500" />}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {keys.map(k => k === 'del'
                ? <button key={k} onClick={() => setOldPin(p => p.slice(0, -1))} className="py-2.5 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick font-extrabold active:scale-95 press">⌫</button>
                : k === 'go'
                  ? <button key={k} disabled={oldPin.length !== 6} onClick={async () => { if (!(await verifyCred(oldPin, me, 'pin'))) { setErr('PIN lama salah!'); setOldPin(''); return; } setErr(''); setStage('new'); }} className="py-2.5 rounded-xl bg-flame-600 text-white flex items-center justify-center disabled:opacity-40 active:scale-95 press"><Check className="w-4.5 h-4.5" /></button>
                  : <button key={k} onClick={() => setOldPin(p => (p.length < 6 ? p + k : p))} className="py-2.5 rounded-xl bg-paper dark:bg-white/5 text-ink dark:text-ink-inv font-extrabold active:scale-95 press">{k}</button>)}
            </div>
            <button onClick={() => { setStage('idle'); setErr(''); }} className="w-full mt-3 py-2 text-[11px] font-extrabold text-ink-faint">Batal</button>
          </div>
        )}
        {stage === 'new' && (
          <div>
            <p className="text-[11px] font-extrabold text-center mb-2">Masukkan PIN baru (6 digit)</p>
            <div className="flex gap-2 justify-center mb-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`w-8 h-10 rounded-xl border-2 flex items-center justify-center ${i < newPin.length ? 'border-flame-500 bg-flame-50 dark:bg-flame-900/25' : 'border-line dark:border-line-dark'}`}>
                  {i < newPin.length && <div className="w-2 h-2 rounded-full bg-flame-500" />}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {keys.map(k => k === 'del'
                ? <button key={k} onClick={() => setNewPin(p => p.slice(0, -1))} className="py-2.5 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick font-extrabold active:scale-95 press">⌫</button>
                : k === 'go'
                  ? <button key={k} disabled={newPin.length !== 6} onClick={submitPin} className="py-2.5 rounded-xl bg-flame-600 text-white flex items-center justify-center disabled:opacity-40 active:scale-95 press"><Check className="w-4.5 h-4.5" /></button>
                  : <button key={k} onClick={() => setNewPin(p => (p.length < 6 ? p + k : p))} className="py-2.5 rounded-xl bg-paper dark:bg-white/5 text-ink dark:text-ink-inv font-extrabold active:scale-95 press">{k}</button>)}
            </div>
            <button onClick={() => { setStage('idle'); setErr(''); }} className="w-full mt-3 py-2 text-[11px] font-extrabold text-ink-faint">Batal</button>
          </div>
        )}
      </div>

      {/* TEMA & KELUAR */}
      <div className="card !rounded-3xl p-3 space-y-1">
        <button onClick={toggleDark} className="w-full flex items-center gap-3 p-3 rounded-xl text-[13px] font-bold text-ink-soft dark:text-ink-inv/70 hover:bg-paper dark:hover:bg-white/5 transition">
          {dark ? <Terang className="w-5 h-5" /> : <Gelap className="w-5 h-5" />}
          {dark ? 'Mode Terang' : 'Mode Gelap'}
        </button>
        <button onClick={onLogout} className="w-full flex items-center gap-3 p-3 rounded-xl text-[13px] font-extrabold text-brick hover:bg-brick/10 transition">
          <Keluar className="w-5 h-5" /> Keluar dari akun ini
        </button>
      </div>

      <p className="text-center text-[9px] font-extrabold text-ink-faint dark:text-ink-inv/30 uppercase tracking-[0.22em]">{brandCustom ? (brandNama || 'WELP') + ' Karyawan · by WELP' : 'WELP Karyawan · by JUSTru Group'}</p>
    </div>
  );
};

/* ============================================================
   ROOT APLIKASI KARYAWAN — bottom nav 5 tab + tema + sesi
   ============================================================ */
const TABS = [
  { id: 'home', label: 'Beranda', icon: Beranda },
  { id: 'absensi', label: 'Absensi', icon: Absensi },
  { id: 'gaji', label: 'Gaji', icon: Penggajian },
  { id: 'ajukan', label: 'Ajukan', icon: Plus },
  { id: 'profil', label: 'Profil', icon: Tim },
];

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

  // v15 F0: sesi anonymous Firebase sejak boot (sesi tersimpan pun
  // butuh auth untuk listener tenant).
  useEffect(() => { ensureAuth(); }, []);

  const [session, setSession] = useState(() => safeParse(SESSION_KEY, null));
  const [tab, setTab] = useState('home');
  const [flow, setFlow] = useState(null);            // 'in' | 'out' | null
  const [popup, setPopup] = useState({ show: false, message: '', type: 'success' });
  const alert = (message, type = 'success') => { setPopup({ show: true, message, type }); };

  const logout = () => { try { localStorage.removeItem(SESSION_KEY); } catch (e) { } setSession(null); setTab('home'); };

  // data utk flow absen (branch + aturan + shift) — dibaca sekali di root
  const { items: branches } = useTenantCol(session ? { id: session.lic } : null, 'cabang', 'cabang_db');
  const { items: karyawan } = useTenantCol(session ? { id: session.lic } : null, 'karyawan', 'karyawan_db');
  const { items: settings } = useTenantCol(session ? { id: session.lic } : null, 'pengaturan', 'pengaturan_db');
  const { addRow, live } = useTenantCol(session ? { id: session.lic } : null, 'absensi', 'absensi_db');

  const branch = session ? (branches.find(b => b.cid === session.branchId) || null) : null;
  const branchName = branch?.name || session?.branchName || 'Cabang';
  const aturan = getAturan(branch);

  // Custom Aplikasi (v14): terapkan logo & warna perusahaan dari
  // pengaturan tenant — app karyawan ikut white-label seperti app utama.
  useEffect(() => {
    if (!settings || settings.length === 0) return;
    const rec = settings.find(s => s.key === 'branding');
    writeBrandMirror(rec && rec.aktif ? rec : null);
  }, [settings]);

  // SHIFT (v12): prioritas penugasan owner; bila fleksibel, deteksi
  // otomatis dari jam absen terhadap shift cabang yang aktif.
  const me = session ? (karyawan.find(k => k.cid === session.employeeCid) || null) : null;
  const pusatShifts = normShifts((settings || []).find(s => s.key === 'shift_pusat')?.shifts);
  const branchShifts = shiftsForBranch(session?.branchId, branches, pusatShifts);
  const myShift = me?.shiftId ? shiftById(branchShifts, me.shiftId) : null;
  const myTarget = hkTargetOf(aturan, me);   // target HK efektif karyawan (v13)

  // v15 F5/E1: logo perusahaan (Custom Aplikasi) dipakai sbg watermark foto
  const brandLogo = (() => {
    const rec = (settings || []).find(s => s.key === 'branding');
    return rec && rec.aktif ? (rec.logo || null) : null;
  })();

  const doSubmit = async ({ photo, geo, geoStatus, dist, outOfRadius, type }) => {
    try {
      // v15 F4-H11: telat dihitung dari waktu terpercaya (offset server)
      const li = lateInfo(trustedNow(), aturan);
      const sh = myShift || shiftOfMs(branchShifts, Date.now());   // shift tercatat di absensi
      // v15 F5/F2: alamat manusiawi dari koordinat (Nominatim) — koordinat
      // & akurasi ASLI tetap disimpan; gagal resolve = tanpa alamat.
      let alamat = null;
      if (geo && geo.lat != null) alamat = await reverseGeocode(geo.lat, geo.lng);
      // v15 F5/J3: foto diunggah ke Storage (URL hemat kuota baca);
      // bila Storage belum siap → fallback base64 inline seperti sebelumnya.
      let photoUrl = null;
      if (photo) photoUrl = await uploadMedia(session.lic, `absensi/${todayKey()}/${session.employeeCid}_${Date.now()}.jpg`, photo);
      addRow({
        employeeName: session.employeeName, employeeCid: session.employeeCid, empId: session.empId || '', role: session.role,
        branchId: session.branchId, branchName, date: todayKey(), type,
        shiftId: sh?.id || null, shiftNama: sh?.nama || null,
        lat: geo?.lat ?? null, lng: geo?.lng ?? null, acc: geo?.acc ?? null,
        dist: dist ?? null, far: outOfRadius,
        geoStatus: geoStatus || (geo ? 'ok' : 'unavailable'), alamat,
        lateMin: type === 'in' ? li.telatMin : null, lateStatus: type === 'in' ? li.status : null,
        photo: photoUrl ? null : (photo || null), photoUrl,
        deviceId: session.deviceId || getDeviceId(), deviceTs: Date.now()
      });
      auditLog({ id: session.lic, tenant: session.tenant, currentUserRole: 'karyawan', branchId: session.branchId, employeeName: session.employeeName },
        'ABSEN_' + (type === 'in' ? 'MASUK' : 'PULANG'), { jarak: dist, luarRadius: outOfRadius, tanpaGps: !geo });
      setFlow(null);
      alert(!geo
        ? 'Absen tercatat TANPA lokasi GPS. Owner melihat penandanya.'
        : outOfRadius
        ? `Absen tercatat, tapi kamu ${dist}m dari cabang. Owner akan melihat tandanya.`
        : `Absen ${type === 'in' ? 'masuk' : 'pulang'} tercatat! Waktu dikunci server.`, (!geo || outOfRadius) ? 'error' : 'success');
    } catch (e) {
      alert('Gagal mengirim absensi: ' + (e.message || 'coba lagi'), 'error');
    }
  };

  if (!session) return <AbsenLogin preLic={preLic} onDone={setSession} dark={dark} toggleDark={toggleDark} />;

  return (
    <div className="min-h-screen bg-paper dark:bg-night text-ink dark:text-ink-inv animate-fade-in">
      {popup.show && <Toast message={popup.message} type={popup.type} onClose={() => setPopup(p => ({ ...p, show: false }))} />}

      {tab === 'home' && <EmpHome session={session} goTab={setTab} openFlow={setFlow} myShift={myShift} hasShifts={branchShifts.length > 0} myTarget={myTarget} myHak={hakCutiOf(cutiPolicyOf(settings), me)} />}
      {tab === 'absensi' && <EmpAbsensi session={session} target={myTarget} />}
      {tab === 'gaji' && <EmpGaji session={session} />}
      {tab === 'ajukan' && <EmpAjukan session={session} me={me} />}
      {tab === 'profil' && <EmpProfil session={session} dark={dark} toggleDark={toggleDark} onLogout={logout} />}

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-surface/95 dark:bg-chrome-deep/95 backdrop-blur-md border-t border-line dark:border-chrome-edge">
        <div className="grid grid-cols-5 max-w-md mx-auto h-16">
          {TABS.map(it => {
            const isActive = tab === it.id;
            const Icon = it.icon;
            return (
              <button key={it.id} onClick={() => setTab(it.id)} aria-label={it.label}
                className={`relative flex flex-col items-center justify-center gap-1 transition press ${isActive ? 'text-flame-600 dark:text-apricot' : 'text-ink-faint dark:text-ink-inv/45 hover:text-ink-soft dark:hover:text-ink-inv/80'}`}>
                {isActive && <span className="absolute top-0 w-9 h-1 bg-flame-500 rounded-b-full" />}
                <Icon className="w-[21px] h-[21px]" />
                <span className={`text-[9px] ${isActive ? 'font-extrabold' : 'font-bold'}`}>{it.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {flow && (
        <AbsenFlow type={flow} session={session} branch={branch} branchName={branchName} aturan={aturan} brandLogo={brandLogo}
          onClose={() => setFlow(null)} onSubmit={doSubmit} />
      )}
    </div>
  );
};
