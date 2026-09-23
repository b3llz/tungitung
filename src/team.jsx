// ============================================================
// TEAM MODULE v14 — Manajemen Cabang, POS Station, Manajemen
// Karyawan (Employee ID + PIN pribadi + status kontrak), Monitoring
// Terpusat, Kelola Absensi + review Pengajuan Cuti, Manajemen
// Penggajian dengan workflow approval nyata + slip gaji premium,
// dan Manajemen Perusahaan (profil, hari kerja, hak cuti, dokumen).
// DATA: Firestore tenants/{licenseId}/{cabang|karyawan|absensi|
// payroll|pengajuan|stations|pengaturan|dokumen|audit_log} via
// useTenantCol (onSnapshot realtime) + mirror localStorage agar
// tetap jalan offline. Konfigurasi lama (payrollEnabled, PIN PUSAT)
// tetap hidup.
// ============================================================
import React, { useState, useEffect, useMemo } from 'react';
import {
  Cabang, Tim, Lokasi, Kredensial, Absensi, AbsenMasuk, AbsenPulang,
  Penggajian, BuktiTransfer, SlipGaji, WaktuReal, Perangkat,
  PerisaiBuddy, Trash2, Check, GembokBuddy, GembokBuka, BahayaBuddy,
  KoinBuddy, StrukCetak, Riwayat, MedaliBuddy, LayarBuddy, Edit3, Plus,
  Search, Toko
} from './welp-icons.jsx';
import {
  formatIDR, useTenantCol, trustedTime, getLocation,
  distanceMeters, todayKey, fileToDataUrl,
  getAturan, DEFAULT_ATURAN, lateInfo, lateInfoMs, fmtDurJMD,
  dateKeyOf, dayLabel, dayLabelShort, qrUrl,
  auditLog, makeEmpId, PAYROLL_FLOW, payrollPushHistory,
  CUTI_TYPES, CUTI_FLOW, daysBetween,
  normShifts, shiftsForBranch, shiftDurMin, fmtShiftRange, shiftOfMs,
  shiftById, fmtJam, pairWorkMinutes, hhmmToMin, hkTargetOf,
  JENIS_KONTRAK, kontrakOf, cutiPolicyOf, hakCutiOf, usedCutiDays,
  hariKerjaOf, hariLabelOf, HARI_MINGGUAN, brandAccentHex, brandAccentDeepHex,
  buildSlipHtml
} from './core.jsx';
import { Button, Card, PageTitle, Badge, EmptyState, Modal, Toggle, Select, NumericInput } from './ui';

/* ---------- util kecil ---------- */
const fmtTime = (ms) => new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (ms) => new Date(ms).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = (ms) => `${new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} · ${fmtTime(ms)}`;
const RoleBadge = ({ role }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9.5px] font-extrabold uppercase tracking-wider ${role === 'owner' ? 'bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold' : role === 'admin' ? 'bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot' : 'bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf'}`}>
    {role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin Cabang' : 'Kasir'}
  </span>
);
const LiveDot = ({ live }) => (
  <span className={`inline-flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest ${live ? 'text-leaf-deep dark:text-leaf' : 'text-gold-deep dark:text-gold'}`}>
    <span className={`w-2 h-2 rounded-full ${live ? 'bg-leaf animate-pulse-dot' : 'bg-gold'}`} />
    {live ? 'Realtime' : 'Mode Lokal'}
  </span>
);

/* ---------- INPUT MODERN (kartu field + ikon buddy) ---------- */
const FieldCard = ({ icon: Icon, label, desc, children }) => (
  <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-2xl p-4 focus-within:border-flame-400 focus-within:ring-2 focus-within:ring-flame-500/20 transition-all">
    <div className="flex items-center gap-2.5 mb-2.5">
      <span className="w-8 h-8 rounded-xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center shrink-0"><Icon className="w-4.5 h-4.5" /></span>
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold text-ink dark:text-ink-inv uppercase tracking-wider leading-none">{label}</p>
        {desc && <p className="text-[10px] text-ink-faint font-semibold mt-1 leading-none">{desc}</p>}
      </div>
    </div>
    {children}
  </div>
);

const PinDots = ({ pin, onKey }) => (
  <div>
    <div className="flex gap-2 justify-center mb-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={`w-8 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${i < pin.length ? 'border-flame-500 bg-flame-50 dark:bg-flame-900/25' : 'border-line dark:border-line-dark bg-paper dark:bg-white/5'}`}>
          {i < pin.length && <div className="w-2 h-2 rounded-full bg-flame-500" />}
        </div>
      ))}
    </div>
    <div className="grid grid-cols-6 gap-1.5">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'rand', '0', 'del'].map(k => (
        <button key={k} type="button" onClick={() => onKey(k)}
          className={`h-9 rounded-lg text-sm font-extrabold transition active:scale-95 press ${k === 'del' ? 'bg-brick-soft dark:bg-brick/10 text-brick' : k === 'rand' ? 'bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold text-[10px] uppercase' : 'bg-paper dark:bg-white/5 text-ink dark:text-ink-inv hover:bg-flame-50 dark:hover:bg-flame-900/20'}`}>
          {k === 'del' ? '⌫' : k === 'rand' ? 'Acak' : k}
        </button>
      ))}
    </div>
  </div>
);

/* ---------- STEP FIELD (angka + unit jelas, anti keypad berantakan)
   Toleransi pakai "menit", radius pakai "meter" — selalu tampil,
   bisa diketik atau diketuk +/- biar aman di layar sentuh. ---------- */
const StepField = ({ label, value, onChange, min, max, step, unit, hint }) => {
  const num = parseInt(value, 10) || 0;
  return (
    <div>
      <label className="kicker block mb-1.5">{label} <span className="text-flame-600 dark:text-apricot normal-case tracking-normal">({unit})</span></label>
      <div className="flex items-stretch gap-1.5">
        <button type="button" aria-label={`Kurangi ${unit}`}
          onClick={() => onChange(Math.max(min, num - step))}
          className="w-10 shrink-0 rounded-xl bg-paper dark:bg-white/5 border border-line dark:border-line-dark text-lg font-extrabold text-ink-soft dark:text-ink-inv/70 hover:border-flame-300 transition active:scale-95 press">−</button>
        <div className="relative flex-1 min-w-0">
          <input type="text" inputMode="numeric" value={String(value)}
            onChange={e => onChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
            className="field text-center !pr-14" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-ink-faint pointer-events-none uppercase">{unit}</span>
        </div>
        <button type="button" aria-label={`Tambah ${unit}`}
          onClick={() => onChange(Math.min(max, num + step))}
          className="w-10 shrink-0 rounded-xl bg-flame-50 dark:bg-flame-900/40 border border-flame-200 dark:border-flame-900/70 text-lg font-extrabold text-flame-700 dark:text-apricot hover:bg-flame-100 transition active:scale-95 press">+</button>
      </div>
      {hint && <p className="text-[9.5px] font-semibold text-ink-faint mt-1.5 leading-snug">{hint}</p>}
    </div>
  );
};

/* ============================================================
   SHIFT EDITOR v12 — daftar shift (maks 4) dgn nama, jam mulai &
   selesai, saklar aktif. Durasi dihitung otomatis & mendukung
   shift lintas tengah malam (mis. 22:00 – 06:00).
   ============================================================ */
export const ShiftEditor = ({ shifts, onChange, maxShifts = 4 }) => {
  const upd = (i, patch) => onChange(shifts.map((s, j) => j === i ? { ...s, ...patch } : s));
  const del = (i) => onChange(shifts.filter((_, j) => j !== i));
  const add = () => {
    if (shifts.length >= maxShifts) return;
    onChange([...shifts, { id: 'sh_' + Date.now().toString(36), nama: `Shift ${shifts.length + 1}`, mulai: '08:00', selesai: '16:00', aktif: true }]);
  };
  return (
    <div className="space-y-2.5">
      {shifts.length === 0 && (
        <p className="text-[11px] font-bold text-ink-faint text-center py-3 bg-paper dark:bg-white/[.03] rounded-xl">Belum ada shift. Tambahkan kalau karyawan kerja bergantian.</p>
      )}
      {shifts.map((s, i) => {
        const dur = s.mulai && s.selesai && s.mulai !== s.selesai ? shiftDurMin(s) : null;
        return (
          <div key={s.id || i} className={`p-3 rounded-2xl border transition-all ${s.aktif === false ? 'border-line dark:border-line-dark bg-paper dark:bg-white/[.02] opacity-70' : 'border-flame-200/60 dark:border-flame-900/50 bg-flame-50/40 dark:bg-flame-900/[.12]'}`}>
            <div className="flex items-center gap-2 mb-2">
              <input value={s.nama} onChange={e => upd(i, { nama: e.target.value })} placeholder={`Shift ${i + 1}`}
                className="field !py-2 !text-[12px] flex-1 min-w-0 font-extrabold" />
              <Toggle size="sm" on={s.aktif !== false} onClick={() => upd(i, { aktif: s.aktif === false })} />
              <button onClick={() => del(i)} aria-label={`Hapus ${s.nama || 'shift'}`}
                className="p-2 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick hover:bg-brick hover:text-white transition press"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="time" value={s.mulai} onChange={e => upd(i, { mulai: e.target.value })}
                className="field !py-2 !px-3 !text-[12px] font-mono w-[108px]" aria-label="Jam mulai shift" />
              <span className="text-ink-faint font-extrabold text-xs">s/d</span>
              <input type="time" value={s.selesai} onChange={e => upd(i, { selesai: e.target.value })}
                className="field !py-2 !px-3 !text-[12px] font-mono w-[108px]" aria-label="Jam selesai shift" />
              {dur != null && (
                <Badge tone="neutral"><WaktuReal className="w-3 h-3" /> {fmtJam(dur)}
                  {(hhmmToMin(s.selesai) <= hhmmToMin(s.mulai)) && ' · lewat tengah malam'}
                </Badge>
              )}
            </div>
          </div>
        );
      })}
      {shifts.length < maxShifts && (
        <button type="button" onClick={add}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-line dark:border-line-dark text-[11px] font-extrabold text-flame-700 dark:text-apricot hover:border-flame-400 transition press flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> Tambah Shift ({shifts.length}/{maxShifts})
        </button>
      )}
    </div>
  );
};

/* ============================================================
   SHIFT CABANG PUSAT (v12) — Pusat adalah cabang virtual tanpa
   doc di koleksi cabang, jadi definisi shift-nya disimpan di
   koleksi 'pengaturan' (doc key: shift_pusat). UI & aturannya
   sama persis dgn shift cabang lain.
   ============================================================ */
export const PusatShiftsCard = ({ licenseInfo }) => {
  const { items: settings, live, addRow, updateRow } = useTenantCol(licenseInfo, 'pengaturan', 'pengaturan_db');
  const rec = settings.find(s => s.key === 'shift_pusat') || null;
  const [draft, setDraft] = useState(null);          // null = tidak sedang diedit
  const shifts = draft !== null ? draft : normShifts(rec?.shifts);

  const save = () => {
    const clean = draft.map(s => ({ id: s.id, nama: (s.nama || '').trim() || 'Shift', mulai: s.mulai, selesai: s.selesai, aktif: s.aktif !== false }));
    if (rec) updateRow(rec.cid, { shifts: clean });
    else addRow({ key: 'shift_pusat', shifts: clean });
    auditLog(licenseInfo, 'SHIFT_PUSAT_SIMPAN', { jumlah: clean.length });
    setDraft(null);
  };

  return (
    <Card title="Shift Kerja Cabang Pusat" icon={WaktuReal}
      help="Karyawan Pusat tidak terikat doc cabang, jadi shift-nya diatur di sini. Pola sama: beri nama shift, tentukan jam mulai & selesai, lalu tetapkan siapa saja yang memakainya di Manajemen Karyawan."
      action={<LiveDot live={live} />}>
      {draft === null ? (
        <>
          <ShiftEditor shifts={shifts} onChange={() => { }} maxShifts={0} />
          {shifts.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              {shifts.map(s => (
                <span key={s.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-extrabold border ${s.aktif !== false ? 'bg-flame-50 dark:bg-flame-900/30 text-flame-700 dark:text-apricot border-flame-200/70 dark:border-flame-900/60' : 'bg-paper dark:bg-white/5 text-ink-faint border-line dark:border-line-dark line-through'}`}>
                  <WaktuReal className="w-3 h-3" /> {s.nama} {fmtShiftRange(s)} · {fmtJam(shiftDurMin(s))}
                </span>
              ))}
            </div>
          )}
          <Button variant="secondary" className="mt-3 py-3 px-4 text-xs" icon={Edit3}
            onClick={() => setDraft(shifts.map(s => ({ ...s })))}>
            {shifts.length ? 'Ubah Shift Pusat' : 'Atur Shift Pusat'}
          </Button>
        </>
      ) : (
        <>
          <ShiftEditor shifts={draft} onChange={setDraft} />
          <div className="flex gap-2 mt-3">
            <Button className="flex-1 py-3" icon={Check} onClick={save}>Simpan Shift Pusat</Button>
            <Button variant="secondary" className="py-3" onClick={() => setDraft(null)}>Batal</Button>
          </div>
        </>
      )}
    </Card>
  );
};

/* ============================================================
   MANAJEMEN CABANG — nama + lokasi (alamat + GPS), password &
   PIN login cabang, role default, saklar penggajian, aturan
   absensi (jam masuk / toleransi menit / radius meter), dan
   SHIFT KERJA per cabang (v12).
   ============================================================ */
export const BranchTab = ({ licenseInfo, triggerAlert }) => {
  const { items: branches, live, addRow, updateRow, removeRow } = useTenantCol(licenseInfo, 'cabang', 'cabang_db');
  const { items: employees } = useTenantCol(licenseInfo, 'karyawan', 'karyawan_db');
  const [form, setForm] = useState({ name: '', location: '', password: '', pin: '', role: 'admin', payrollEnabled: false, jamMasuk: DEFAULT_ATURAN.jamMasuk, toleransi: DEFAULT_ATURAN.toleransi, radius: DEFAULT_ATURAN.radius, hkBulan: DEFAULT_ATURAN.hkBulan, shifts: [] });
  const [pin, setPin] = useState('');
  const [geo, setGeo] = useState(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [revealPinId, setRevealPinId] = useState(null);   // PIN cabang: tersembunyi, tampil sesaat saat diminta
  const [editingId, setEditingId] = useState(null);

  const resetForm = () => { setForm({ name: '', location: '', password: '', pin: '', role: 'admin', payrollEnabled: false, jamMasuk: DEFAULT_ATURAN.jamMasuk, toleransi: DEFAULT_ATURAN.toleransi, radius: DEFAULT_ATURAN.radius, hkBulan: DEFAULT_ATURAN.hkBulan, shifts: [] }); setPin(''); setGeo(null); setEditingId(null); };

  const pickGeo = async () => {
    setGeoBusy(true);
    try { const g = await getLocation(); setGeo(g); triggerAlert('Titik lokasi cabang berhasil diambil.', 'success'); }
    catch (e) { triggerAlert('Gagal ambil lokasi: ' + (e.message || 'izin ditolak'), 'error'); }
    setGeoBusy(false);
  };

  const save = () => {
    if (!form.name.trim()) return triggerAlert('Nama cabang wajib diisi dulu, ya!', 'error');
    if (!form.password) return triggerAlert('Password cabang wajib diisi (dipakai login cabang)!', 'error');
    if (pin.length !== 6 && !(editingId && branches.find(b => b.cid === editingId)?.pin)) return triggerAlert('PIN 6 digit wajib diisi (dipakai login cabang)!', 'error');
    // Validasi shift: nama & jam wajib, mulai tidak boleh sama dgn selesai
    const badShift = form.shifts.find(s => !s.mulai || !s.selesai || s.mulai === s.selesai);
    if (badShift) return triggerAlert(`Shift "${badShift.nama || 'tanpa nama'}" belum lengkap — jam mulai & selesai tidak boleh sama/kosong.`, 'error');
    const oldRec = editingId ? branches.find(b => b.cid === editingId) : null;
    const payload = {
      name: form.name.trim(), location: form.location.trim(),
      password: form.password, pin: pin || oldRec?.pin, role: form.role, payrollEnabled: !!form.payrollEnabled,
      aturan: {
        jamMasuk: form.jamMasuk || DEFAULT_ATURAN.jamMasuk,
        toleransi: Math.max(0, parseInt(form.toleransi, 10) || 0),
        radius: Math.max(20, parseInt(form.radius, 10) || DEFAULT_ATURAN.radius),
        hkBulan: Math.min(31, Math.max(0, parseInt(form.hkBulan, 10) || 0))
      },
      shifts: form.shifts.map(s => ({ id: s.id, nama: (s.nama || '').trim() || 'Shift', mulai: s.mulai, selesai: s.selesai, aktif: s.aktif !== false })),
      lat: geo?.lat ?? oldRec?.lat ?? null, lng: geo?.lng ?? oldRec?.lng ?? null, geoAcc: geo?.acc ?? oldRec?.geoAcc ?? null
    };
    if (editingId) { updateRow(editingId, payload); auditLog(licenseInfo, 'CABANG_UBAH', { target: editingId, nama: payload.name }); triggerAlert('Cabang diperbarui!', 'success'); }
    else { addRow(payload); auditLog(licenseInfo, 'CABANG_TAMBAH', { nama: payload.name }); triggerAlert('Cabang baru tersimpan & langsung bisa dipakai login!', 'success'); }
    resetForm();
  };

  const startEdit = (b) => {
    const at = getAturan(b);
    setEditingId(b.cid);
    setForm({ name: b.name || '', location: b.location || '', password: b.password || '', pin: '', role: b.role || 'admin', payrollEnabled: !!b.payrollEnabled, jamMasuk: at.jamMasuk, toleransi: at.toleransi, radius: at.radius, hkBulan: at.hkBulan, shifts: normShifts(b.shifts) });
    setPin(''); setGeo(b.lat != null ? { lat: b.lat, lng: b.lng, acc: b.geoAcc } : null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-3xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Manajemen Cabang" sub="Data cabang, kredensial login & POS Station"
        right={<LiveDot live={live} />} />

      <Card title={editingId ? 'Ubah Cabang' : 'Tambah Cabang Baru'} icon={Cabang}>
        <div className="space-y-3.5">
          <FieldCard icon={Cabang} label="Nama Cabang" desc="Contoh: WELP Cabang Kemang">
            <input className="field" placeholder="Nama cabang yang jelas & unik" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} />
          </FieldCard>

          <FieldCard icon={Lokasi} label="Lokasi Cabang" desc="Alamat teks + titik GPS untuk validasi absensi">
            <textarea className="field h-20 resize-none" placeholder="Alamat lengkap cabang..."
              value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Button variant="secondary" onClick={pickGeo} className="py-2.5 px-3.5 text-xs" icon={geoBusy ? WaktuReal : Lokasi}>
                {geoBusy ? 'Mengambil...' : 'Ambil Titik GPS'}
              </Button>
              {geo ? (
                <span className="text-[10px] font-extrabold text-leaf-deep dark:text-leaf flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)} (±{geo.acc}m)
                </span>
              ) : <span className="text-[10px] text-ink-faint font-semibold">Belum ada titik GPS</span>}
            </div>
          </FieldCard>

          <div className="grid sm:grid-cols-2 gap-3.5">
            <FieldCard icon={Kredensial} label="Password Cabang" desc="Dipakai di layar login, mode Cabang">
              <div className="flex gap-2">
                <input className="field min-w-0 flex-1" type={showPw ? 'text' : 'password'} placeholder="Password cabang"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                <button type="button" aria-label={showPw ? 'Sembunyikan password' : 'Lihat password'} onClick={() => setShowPw(!showPw)} className="px-2.5 rounded-xl bg-paper dark:bg-white/5 text-ink-faint hover:text-ink-soft transition">
                  {showPw ? <GembokBuka className="w-4 h-4" /> : <GembokBuddy className="w-4 h-4" />}
                </button>
              </div>
            </FieldCard>
            <FieldCard icon={PerisaiBuddy} label="Role Default Cabang" desc="Akses sesi yang login dari cabang ini">
              <Select value={form.role === 'admin' ? 'Admin (akses penuh cabang)' : 'Kasir (kasir & absen saja)'}
                options={['Admin (akses penuh cabang)', 'Kasir (kasir & absen saja)']}
                onChange={v => setForm({ ...form, role: v.startsWith('Admin') ? 'admin' : 'kasir' })} />
            </FieldCard>
          </div>

          <FieldCard icon={Absensi} label="PIN Login Cabang (6 digit)" desc="Masuk sebagai staf cabang ini">
            <PinDots pin={pin} onKey={(k) => {
              if (k === 'del') setPin(p => p.slice(0, -1));
              else if (k === 'rand') setPin(String(Math.floor(100000 + Math.random() * 900000)));
              else setPin(p => (p.length < 6 ? p + k : p));
            }} />
            {editingId && <p className="text-[10px] text-ink-faint font-semibold mt-2">Biarkan kosong bila tidak ingin mengganti PIN lama.</p>}
          </FieldCard>

          {/* ATURAN ABSENSI — unit selalu terlihat: menit & meter */}
          <FieldCard icon={WaktuReal} label="Aturan Absensi Karyawan" desc="Dipakai otomatis di Aplikasi Karyawan & monitoring owner">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="kicker block mb-1.5">Jam Masuk</label>
                <input type="time" className="field !px-3" value={form.jamMasuk}
                  onChange={e => setForm({ ...form, jamMasuk: e.target.value })} />
                <p className="text-[9.5px] font-semibold text-ink-faint mt-1.5">Batas hadir tiap hari</p>
              </div>
              <StepField label="Target HK / Bulan" unit="hari" value={form.hkBulan}
                onChange={v => setForm({ ...form, hkBulan: v })} min={0} max={31} step={1}
                hint="0 = tanpa target. Jadi pembanding di rekap, payroll & aplikasi karyawan" />
              <StepField label="Toleransi Telat" unit="menit" value={form.toleransi}
                onChange={v => setForm({ ...form, toleransi: v })} min={0} max={120} step={5}
                hint="Telat dihitung dari jam masuk + toleransi ini" />
              <StepField label="Radius Lokasi" unit="meter" value={form.radius}
                onChange={v => setForm({ ...form, radius: v })} min={20} max={5000} step={10}
                hint="Jarak maksimal dari titik GPS cabang" />
            </div>
            <p className="text-[10px] text-ink-faint font-semibold mt-2.5 leading-relaxed flex items-start gap-1.5">
              <Lokasi className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Absen melewati jam masuk + toleransi otomatis dikategorikan TELAT. Jarak melebihi radius tetap tercatat, tapi ditandai di luar area untuk owner.
            </p>
          </FieldCard>

          {/* SHIFT KERJA — definisi bergantian per cabang (v12) */}
          <FieldCard icon={WaktuReal} label="Shift Kerja (Opsional)" desc="Atur ada berapa shift & jamnya, lalu tetapkan siapa saja lewat Manajemen Karyawan">
            <ShiftEditor shifts={form.shifts} onChange={shifts => setForm(f => ({ ...f, shifts }))} />
            {form.shifts.length > 0 && (
              <p className="text-[10px] text-ink-faint font-semibold mt-2.5 leading-relaxed flex items-start gap-1.5">
                <Tim className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Karyawan yang dipakai shift ini otomatis tercatat di absensinya, tampil di Rekap Shift & Jam Kerja, dan jadi acuan HK saat payroll.
              </p>
            )}
          </FieldCard>

          <div className="flex items-center justify-between gap-3 bg-gold-soft/60 dark:bg-gold/[.07] border border-gold/30 rounded-2xl p-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-gold/20 text-gold-deep dark:text-gold flex items-center justify-center shrink-0"><Penggajian className="w-5 h-5" /></span>
              <div className="min-w-0">
                <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">Manajemen Penggajian</p>
                <p className="text-[10px] text-ink-faint font-semibold leading-snug">ON bila cabang sudah punya manajer yang mengelola gaji sendiri.</p>
              </div>
            </div>
            <Toggle on={!!form.payrollEnabled} onClick={() => setForm(f => ({ ...f, payrollEnabled: !f.payrollEnabled }))} />
          </div>

          <div className="flex gap-2">
            <Button onClick={save} className="flex-1 py-3.5" icon={Check}>{editingId ? 'Simpan Perubahan' : 'Simpan Cabang'}</Button>
            {editingId && <Button variant="secondary" onClick={resetForm} className="py-3.5">Batal</Button>}
          </div>
        </div>
      </Card>

      <div className="space-y-2.5">
        <h3 className="font-extrabold text-[13px] text-ink dark:text-ink-inv px-1 flex items-center gap-2">
          Daftar Cabang ({branches.length})
        </h3>
        {branches.length === 0 && <EmptyState mascot="kerja" title="Belum ada cabang" desc="Tambahkan cabang pertama. Lengkapi password & PIN, langsung bisa dipakai login dari perangkat lain." />}
        {branches.map(b => {
          const staff = employees.filter(e => e.branchId === b.cid).length;
          const at = getAturan(b);
          const revealed = revealPinId === b.cid;
          return (
            <div key={b.cid} className="card p-4.5 hover:border-flame-300 transition-all">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-extrabold text-ink dark:text-ink-inv text-[15px]">{b.name}</h4>
                    <RoleBadge role={b.role} />
                    {b.payrollEnabled && <Badge tone="gold"><Penggajian className="w-3 h-3" /> Gaji ON</Badge>}
                  </div>
                  <p className="text-[11px] text-ink-faint font-semibold mt-1 flex items-center gap-1.5">
                    <Lokasi className="w-3.5 h-3.5 shrink-0" /> {b.location || 'Lokasi belum diisi'}
                    {b.lat != null && <span className="text-leaf-deep dark:text-leaf">· GPS OK</span>}
                  </p>
                  <p className="text-[10px] text-ink-faint font-bold uppercase tracking-wider mt-1.5 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><Tim className="w-3.5 h-3.5" /> {staff} karyawan</span>
                    <span className="flex items-center gap-1 normal-case tracking-normal"><WaktuReal className="w-3.5 h-3.5" /> masuk {at.jamMasuk} · toleransi {at.toleransi} menit · radius {at.radius} meter</span>
                    {at.hkBulan > 0 && <span className="flex items-center gap-1 normal-case tracking-normal">· target {at.hkBulan} HK/bulan</span>}
                  </p>
                  {(normShifts(b.shifts).length > 0) && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {normShifts(b.shifts).map(s => (
                        <span key={s.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-extrabold border ${s.aktif !== false ? 'bg-flame-50 dark:bg-flame-900/30 text-flame-700 dark:text-apricot border-flame-200/70 dark:border-flame-900/60' : 'bg-paper dark:bg-white/5 text-ink-faint border-line dark:border-line-dark line-through'}`}>
                          <WaktuReal className="w-3 h-3" /> {s.nama} {fmtShiftRange(s)} · {fmtJam(shiftDurMin(s))}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* PIN cabang: tersembunyi, tampil hanya saat tombol mata ditekan */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-extrabold text-ink-soft dark:text-ink-inv/70 flex items-center gap-1.5 bg-paper dark:bg-white/5 border border-line dark:border-line-dark rounded-lg px-2 py-1">
                      <Kredensial className="w-3.5 h-3.5 text-ink-faint" /> PIN: <span className="font-mono tracking-widest">{b.pin ? (revealed ? b.pin : '••••••') : '-'}</span>
                    </span>
                    {b.pin && (
                      <button onClick={() => setRevealPinId(revealed ? null : b.cid)} aria-label={revealed ? 'Sembunyikan PIN' : 'Lihat PIN'}
                        className="p-1.5 rounded-lg bg-paper dark:bg-white/5 border border-line dark:border-line-dark text-ink-faint hover:text-flame-600 dark:hover:text-apricot transition">
                        {revealed ? <GembokBuka className="w-3.5 h-3.5" /> : <GembokBuddy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => startEdit(b)} aria-label="Ubah cabang" className="bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot p-2.5 rounded-xl hover:bg-flame-100 dark:hover:bg-flame-900/70 transition press"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => { if (confirm(`Hapus cabang "${b.name}"?`)) { removeRow(b.cid); auditLog(licenseInfo, 'CABANG_HAPUS', { target: b.cid, nama: b.name }); } }} className="bg-brick-soft dark:bg-brick/10 text-brick p-2.5 rounded-xl hover:bg-brick hover:text-white transition press"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* SHIFT CABANG PUSAT — Pusat tidak punya doc cabang, jadi
          definisinya disimpan di koleksi pengaturan (key shift_pusat) */}
      <PusatShiftsCard licenseInfo={licenseInfo} />

      {/* POS STATION — perangkat kasir, bukan akun manusia */}
      <StationsCard licenseInfo={licenseInfo} branches={branches} triggerAlert={triggerAlert} />
    </div>
  );
};

/* ============================================================
   POS STATION — identitas perangkat kasir yang menetap di monitor.
   Station = perangkat (POS-001 dst), terikat satu cabang, PIN
   sendiri. Bukan akun manusia: tanpa payroll, tanpa data pribadi.
   Kasir yang memakainya tetap login personal via PIN karyawan.
   ============================================================ */
const StationsCard = ({ licenseInfo, branches, triggerAlert }) => {
  const { items: stations, live, addRow, updateRow, removeRow } = useTenantCol(licenseInfo, 'stations', 'stations_db');
  const [newBranch, setNewBranch] = useState(branches[0]?.cid || 'PUSAT');
  const [revealId, setRevealId] = useState(null);

  const nextCode = () => {
    let n = 1;
    const used = new Set(stations.map(s => s.code));
    while (used.has('POS-' + String(n).padStart(3, '0'))) n++;
    return 'POS-' + String(n).padStart(3, '0');
  };

  const create = () => {
    const bid = newBranch;
    const bname = bid === 'PUSAT' ? 'Pusat' : (branches.find(b => b.cid === bid)?.name || 'Cabang');
    const code = nextCode();
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    addRow({ code, name: code, branchId: bid, branchName: bname, pin, active: true });
    auditLog(licenseInfo, 'STATION_BUAT', { target: code, cabang: bname });
    triggerAlert(`Station ${code} siap. PIN-nya ${pin} — catat, nanti dipakai login di monitor kasir.`, 'success');
  };

  const branchName = (id) => id === 'PUSAT' ? 'Pusat' : (branches.find(b => b.cid === id)?.name || '-');

  return (
    <Card title="POS Station (Perangkat Kasir)" icon={LayarBuddy}
      help="Station adalah perangkat, bukan orang. Ia menetap login di monitor kasir dengan konteks cabang yang benar. Kasir yang memakainya tetap identifikasi diri dengan PIN pribadi masing-masing. Station tidak punya akses gaji, data pribadi, atau pengaturan bisnis."
      action={<LiveDot live={live} />}>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="flex-1 min-w-0">
          <Select label="Ikat ke cabang" value={branchName(newBranch)}
            options={branches.length ? branches.map(b => b.name) : ['Pusat']}
            onChange={v => setNewBranch(branches.find(b => b.name === v)?.cid || 'PUSAT')} />
        </div>
        <Button onClick={create} className="py-3 px-4 shrink-0" icon={Plus}>Buat Station Baru</Button>
      </div>

      <div className="mt-4 space-y-2">
        {stations.length === 0 ? (
          <p className="text-[11px] font-bold text-ink-faint text-center py-3">Belum ada station. Buat satu untuk tiap monitor kasir di cabang.</p>
        ) : stations.map(s => {
          const revealed = revealId === s.cid;
          return (
            <div key={s.cid} className={`flex items-center gap-3 p-3.5 rounded-2xl border ${s.active ? 'border-line dark:border-line-dark bg-surface dark:bg-surface-dark' : 'border-line dark:border-line-dark bg-paper dark:bg-white/[.02] opacity-70'}`}>
              <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${s.active ? 'bg-chrome-deep text-apricot' : 'bg-paper dark:bg-white/5 text-ink-faint'}`}><LayarBuddy className="w-5 h-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv flex items-center gap-2">
                  {s.code} {s.name && s.name !== s.code && <span className="text-ink-faint font-bold text-[11px]">· {s.name}</span>}
                  <Badge tone={s.active ? 'green' : 'grey'}>{s.active ? 'Aktif' : 'Nonaktif'}</Badge>
                </p>
                <p className="text-[10px] font-bold text-ink-faint mt-0.5 flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1"><Cabang className="w-3 h-3" /> {s.branchName || branchName(s.branchId)}</span>
                  <span className="flex items-center gap-1 font-mono">PIN: {revealed ? s.pin : '••••••'}</span>
                  <button onClick={() => setRevealId(revealed ? null : s.cid)} aria-label="Lihat PIN station" className="text-flame-600 dark:text-apricot normal-case font-extrabold">
                    {revealed ? 'sembunyikan' : 'lihat'}
                  </button>
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Toggle size="sm" on={!!s.active} onClick={() => { updateRow(s.cid, { active: !s.active }); auditLog(licenseInfo, s.active ? 'STATION_NONAKTIF' : 'STATION_AKTIF', { target: s.code }); }} />
                <button onClick={() => { const np = String(Math.floor(100000 + Math.random() * 900000)); updateRow(s.cid, { pin: np }); setRevealId(s.cid); triggerAlert(`PIN ${s.code} diganti: ${np}`, 'success'); auditLog(licenseInfo, 'STATION_PIN_GANTI', { target: s.code }); }}
                  aria-label="Ganti PIN station" className="p-2 rounded-xl bg-paper dark:bg-white/5 border border-line dark:border-line-dark text-ink-faint hover:text-flame-600 dark:hover:text-apricot transition"><Kredensial className="w-4 h-4" /></button>
                <button onClick={() => { if (confirm(`Hapus station ${s.code}?`)) { removeRow(s.cid); auditLog(licenseInfo, 'STATION_HAPUS', { target: s.code }); } }}
                  className="p-2 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick hover:bg-brick hover:text-white transition"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-ink-faint font-semibold mt-3 leading-relaxed flex items-start gap-1.5">
        <PerisaiBuddy className="w-3.5 h-3.5 shrink-0 mt-0.5 text-flame-600 dark:text-apricot" />
        Station login di layar kasir pakai ID Toko + kode station + PIN di atas. Pindah cabang hanya bisa lewat halaman ini (Owner), tidak bisa dari perangkat.
      </p>
    </Card>
  );
};

/* ============================================================
   MANAJEMEN KARYAWAN v12 — struktur cabang-first:
   pilih cabang dulu, baru daftar karyawannya. Tiap karyawan
   punya Employee ID unik otomatis + PIN pribadi 6 digit +
   status aktif. PIN pribadi dipakai di Aplikasi Karyawan &
   POS Station. Data sensitif tidak ditampilkan di daftar.
   ============================================================ */
export const KaryawanTab = ({ licenseInfo, triggerAlert }) => {
  const { items: employees, live, addRow, removeRow, updateRow } = useTenantCol(licenseInfo, 'karyawan', 'karyawan_db');
  const { items: branches } = useTenantCol(licenseInfo, 'cabang', 'cabang_db');
  const { items: settings } = useTenantCol(licenseInfo, 'pengaturan', 'pengaturan_db');
  const pusatShifts = normShifts((settings || []).find(s => s.key === 'shift_pusat')?.shifts);
  const shiftsOf = (bid) => shiftsForBranch(bid, branches, pusatShifts);
  const [openBranch, setOpenBranch] = useState(null);          // cid cabang yang dibuka
  const [form, setForm] = useState({ name: '', role: 'kasir', branchId: 'PUSAT', pin: '', status: 'aktif', shiftId: '', hkBulan: '', jenisKontrak: 'tetap', upahHarian: '', gajiPokok: '', hakCuti: '' });
  const [editingId, setEditingId] = useState(null);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('semua');
  const [revealPinId, setRevealPinId] = useState(null);
  const [showPinForm, setShowPinForm] = useState(false);

  const branchName = (id) => id === 'PUSAT' ? 'Pusat' : (branches.find(b => b.cid === id)?.name || 'Cabang');
  const reset = () => { setForm({ name: '', role: 'kasir', branchId: 'PUSAT', pin: '', status: 'aktif', shiftId: '', hkBulan: '', jenisKontrak: 'tetap', upahHarian: '', gajiPokok: '', hakCuti: '' }); setEditingId(null); setShowPinForm(false); };
  const formShifts = shiftsOf(form.branchId);
  const formKontrak = JENIS_KONTRAK[form.jenisKontrak] || JENIS_KONTRAK.tetap;

  const roleLabelOf = (r) => r === 'owner' ? 'Owner' : (r === 'admin' ? 'Admin Cabang' : 'Kasir');

  const save = () => {
    if (!form.name.trim()) return triggerAlert('Nama karyawan wajib diisi dulu!', 'error');
    const oldRec = editingId ? employees.find(e => e.cid === editingId) : null;
    if (!editingId && form.pin.length !== 6) return triggerAlert('Atur PIN pribadi 6 digit dulu (bisa tekan Acak).', 'error');
    if (editingId && form.pin && form.pin.length !== 6) return triggerAlert('PIN harus 6 digit.', 'error');
    const pin = form.pin || oldRec?.pin || '';
    const payload = {
      name: form.name.trim(), role: form.role, branchId: form.branchId,
      pin, status: form.status || 'aktif',
      shiftId: formShifts.some(s => s.id === form.shiftId) ? form.shiftId : '',
      // Target HK khusus (v13): 0/kosong = ikuti aturan cabang
      hkBulan: Math.min(31, Math.max(0, parseInt(form.hkBulan, 10) || 0)) || null,
      // Status kontrak (v14): daily worker pakai upah harian;
      // PKWT / karyawan tetap pakai gaji tetap per periode.
      jenisKontrak: JENIS_KONTRAK[form.jenisKontrak] ? form.jenisKontrak : 'tetap',
      upahHarian: form.jenisKontrak === 'harian' ? (Math.max(0, Number(form.upahHarian) || 0) || null) : null,
      gajiPokok: form.jenisKontrak !== 'harian' ? (Math.max(0, Number(form.gajiPokok) || 0) || null) : null,
      // Hak cuti khusus (v14): kosong = ikuti policy perusahaan
      hakCuti: Math.min(365, Math.max(0, parseInt(form.hakCuti, 10) || 0)) || null,
      ...(editingId ? {} : { empId: makeEmpId(branchName(form.branchId), employees.map(e => e.empId)) })
    };
    if (editingId) { updateRow(editingId, payload); auditLog(licenseInfo, 'KARYAWAN_UBAH', { target: editingId, nama: payload.name }); triggerAlert('Data karyawan diperbarui!', 'success'); }
    else {
      addRow(payload);
      auditLog(licenseInfo, 'KARYAWAN_TAMBAH', { target: payload.empId, nama: payload.name, role: payload.role });
      triggerAlert(`${payload.name} masuk tim! Employee ID: ${payload.empId}`, 'success');
    }
    reset();
  };

  const startEdit = (e) => {
    setEditingId(e.cid);
    setForm({ name: e.name, role: e.role || 'kasir', branchId: e.branchId || 'PUSAT', pin: '', status: e.status || 'aktif', shiftId: e.shiftId || '', hkBulan: e.hkBulan ?? '', jenisKontrak: JENIS_KONTRAK[e.jenisKontrak] ? e.jenisKontrak : 'tetap', upahHarian: e.upahHarian ?? '', gajiPokok: e.gajiPokok ?? '', hakCuti: e.hakCuti ?? '' });
    setShowPinForm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const regenPin = (e) => {
    const np = String(Math.floor(100000 + Math.random() * 900000));
    updateRow(e.cid, { pin: np });
    setRevealPinId(e.cid);
    auditLog(licenseInfo, 'KARYAWAN_PIN_GANTI', { target: e.empId || e.cid, nama: e.name });
    triggerAlert(`PIN ${e.name} diganti: ${np}`, 'success');
  };

  const groupIds = ['PUSAT', ...branches.map(b => b.cid)];
  const openList = openBranch
    ? employees.filter(e => (e.branchId || 'PUSAT') === openBranch)
      .filter(e => roleFilter === 'semua' || (e.role || 'kasir') === roleFilter)
      .filter(e => !q.trim() || (e.name || '').toLowerCase().includes(q.toLowerCase()) || (e.empId || '').toLowerCase().includes(q.toLowerCase()))
    : [];

  return (
    <div className="max-w-3xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Manajemen Karyawan" sub="Tim per cabang, Employee ID & PIN pribadi"
        right={<LiveDot live={live} />} />

      <Card title={editingId ? 'Ubah Karyawan' : 'Tambah Karyawan'} icon={Tim}>
        <div className="space-y-3.5">
          <FieldCard icon={Tim} label="Nama Karyawan" desc="Nama panggilan yang terbaca di absensi & gaji">
            <input className="field" placeholder="Contoh: Rani" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </FieldCard>
          <div className="grid sm:grid-cols-2 gap-3.5">
            <FieldCard icon={PerisaiBuddy} label="Role" desc="Menentukan menu yang terlihat & hak di Aplikasi Karyawan">
              <Select value={form.role === 'kasir' ? 'Kasir' : (form.role === 'owner' ? 'Owner' : 'Admin')} options={['Kasir', 'Admin', 'Owner']}
                onChange={v => setForm({ ...form, role: v.toLowerCase() })} />
            </FieldCard>
            <FieldCard icon={Cabang} label="Cabang" desc="Tempat tugas karyawan ini">
              <Select value={branchName(form.branchId)}
                options={['Pusat', ...branches.map(b => b.name)]}
                onChange={v => {
                  const bid = v === 'Pusat' ? 'PUSAT' : (branches.find(b => b.name === v)?.cid || 'PUSAT');
                  // ganti cabang → shift lama tak selalu berlaku: reset bila tidak ada di cabang baru
                  const sh = shiftsOf(bid);
                  setForm(f => ({ ...f, branchId: bid, shiftId: sh.some(s => s.id === f.shiftId) ? f.shiftId : '' }));
                }} />
            </FieldCard>
          </div>

          <FieldCard icon={WaktuReal} label="Shift Kerja & Target HK" desc="Pilih shift dari cabangnya; target HK opsional khusus karyawan ini">
            {formShifts.length === 0 ? (
              <p className="text-[11px] font-bold text-ink-faint">
                Cabang ini belum punya shift. Atur dulu di Manajemen Cabang{form.branchId === 'PUSAT' ? ' — bagian Shift Kerja Cabang Pusat' : ''}, lalu karyawan bisa dipasangkan di sini.
              </p>
            ) : (
              <Select value={formShifts.some(s => s.id === form.shiftId)
                ? `${shiftById(formShifts, form.shiftId)?.nama} · ${fmtShiftRange(shiftById(formShifts, form.shiftId))}`
                : 'Fleksibel (tanpa shift)'}
                options={['Fleksibel (tanpa shift)', ...formShifts.map(s => `${s.nama} · ${fmtShiftRange(s)}`)]}
                onChange={v => {
                  const found = formShifts.find(s => v.startsWith(s.nama + ' · '));
                  setForm({ ...form, shiftId: found ? found.id : '' });
                }} />
            )}
            <div className="mt-3">
              <StepField label="Target HK Khusus (Opsional)" unit="hari" value={form.hkBulan}
                onChange={v => setForm(f => ({ ...f, hkBulan: v }))} min={0} max={31} step={1}
                hint="0 = ikuti target cabang. Isi bila karyawan ini punya aturan berbeda (mis. paruh waktu)" />
            </div>
          </FieldCard>

          <FieldCard icon={KoinBuddy} label="Status Kontrak & Upah" desc="Cara gajinya dihitung di Manajemen Penggajian">
            <div className="grid grid-cols-3 gap-1.5">
              {Object.keys(JENIS_KONTRAK).map(k => (
                <button key={k} type="button" onClick={() => setForm(f => ({ ...f, jenisKontrak: k }))}
                  className={`py-2.5 px-1.5 rounded-xl text-[10px] font-extrabold border-2 transition press ${form.jenisKontrak === k ? 'border-flame-500 bg-flame-50 dark:bg-flame-900/25 text-flame-700 dark:text-apricot' : 'border-line dark:border-line-dark text-ink-faint'}`}>
                  {JENIS_KONTRAK[k].short}
                </button>
              ))}
            </div>
            <p className="text-[10px] font-semibold text-ink-faint mt-2">{formKontrak.desc}{form.jenisKontrak === 'harian' ? ' — totalnya dihitung sendiri dari hari masuk saat buat payroll.' : ' — dipakai sebagai gaji pokok saat buat payroll.'}</p>
            {form.jenisKontrak === 'harian' ? (
              <div className="mt-2.5">
                <NumericInput label="Upah per Hari *" prefix="Rp" placeholder="Contoh: 150000"
                  value={form.upahHarian} onChange={v => setForm(f => ({ ...f, upahHarian: v }))} />
              </div>
            ) : (
              <div className="mt-2.5">
                <NumericInput label="Gaji Pokok per Periode" prefix="Rp" placeholder="Contoh: 3500000"
                  value={form.gajiPokok} onChange={v => setForm(f => ({ ...f, gajiPokok: v }))} />
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-line dark:border-line-dark">
              <StepField label="Hak Cuti Khusus (Opsional)" unit="hari/tahun" value={form.hakCuti}
                onChange={v => setForm(f => ({ ...f, hakCuti: v }))} min={0} max={365} step={1}
                hint="Kosong = ikuti hak cuti perusahaan (default 12 hari/tahun sesuai UU). Isi bila karyawan ini berbeda, mis. kontrak tidak dapat cuti" />
            </div>
          </FieldCard>

          <FieldCard icon={Kredensial} label="PIN Pribadi (6 digit)" desc="Dipakai login di Aplikasi Karyawan & POS Station">
            {!showPinForm ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold text-ink-faint flex items-center gap-1.5 font-mono">
                  <GembokBuddy className="w-3.5 h-3.5" /> {editingId ? 'PIN lama tetap terpakai' : 'Belum diatur'}
                </p>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => { setForm(f => ({ ...f, pin: String(Math.floor(100000 + Math.random() * 900000)) })); setShowPinForm(true); }}
                    className="px-3 py-2 rounded-xl bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold text-[10.5px] font-extrabold uppercase tracking-wider press">Acak PIN</button>
                  <button type="button" onClick={() => setShowPinForm(true)}
                    className="px-3 py-2 rounded-xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot text-[10.5px] font-extrabold uppercase tracking-wider press">Atur Manual</button>
                </div>
              </div>
            ) : (
              <>
                <PinDots pin={form.pin} onKey={(k) => {
                  if (k === 'del') setForm(f => ({ ...f, pin: f.pin.slice(0, -1) }));
                  else if (k === 'rand') setForm(f => ({ ...f, pin: String(Math.floor(100000 + Math.random() * 900000)) }));
                  else setForm(f => ({ ...f, pin: f.pin.length < 6 ? f.pin + k : f.pin }));
                }} />
                {editingId && <p className="text-[10px] text-ink-faint font-semibold mt-2">Kosongkan bila tidak ingin mengganti PIN lama.</p>}
              </>
            )}
          </FieldCard>

          {editingId && (
            <div className="flex items-center justify-between gap-3 bg-paper dark:bg-white/[.03] border border-line dark:border-line-dark rounded-2xl p-4">
              <div>
                <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">Status Karyawan</p>
                <p className="text-[10px] text-ink-faint font-semibold">Nonaktif = tidak muncul di daftar login station</p>
              </div>
              <Toggle on={form.status !== 'nonaktif'} onClick={() => setForm(f => ({ ...f, status: f.status === 'nonaktif' ? 'aktif' : 'nonaktif' }))} />
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={save} className="flex-1 py-3.5" icon={Check}>{editingId ? 'Simpan Perubahan' : 'Tambah Karyawan'}</Button>
            {editingId && <Button variant="secondary" onClick={reset} className="py-3.5">Batal</Button>}
          </div>
        </div>
      </Card>

      {/* ===== STRUKTUR CABANG-FIRST ===== */}
      <div className="space-y-2.5">
        <h3 className="font-extrabold text-[13px] text-ink dark:text-ink-inv px-1">Tim per Cabang ({employees.length} karyawan)</h3>
        {employees.length === 0 && branches.length === 0 && (
          <EmptyState mascot="menyapa" title="Belum ada tim" desc="Tambahkan karyawan pertama di form atas. Nanti karyawan bisa absen & login dari Aplikasi Karyawan." />
        )}
        {groupIds.map(bid => {
          const list = employees.filter(e => (e.branchId || 'PUSAT') === bid);
          if (!list.length && bid !== 'PUSAT') return null;
          const open = openBranch === bid;
          return (
            <div key={bid} className="card overflow-hidden !p-0">
              <button onClick={() => { setOpenBranch(open ? null : bid); setQ(''); setRoleFilter('semua'); }}
                className="w-full flex justify-between items-center gap-3 p-4 text-left hover:bg-paper/60 dark:hover:bg-white/[.02] transition">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-2xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center shrink-0"><Cabang className="w-5 h-5" /></span>
                  <div className="min-w-0">
                    <p className="font-extrabold text-[14px] text-ink dark:text-ink-inv truncate">{branchName(bid)}</p>
                    <p className="text-[10.5px] font-bold text-ink-faint">{list.length} karyawan · {list.filter(e => e.status !== 'nonaktif').length} aktif</p>
                  </div>
                </div>
                <span className="flex items-center gap-2 text-[11px] font-extrabold text-flame-700 dark:text-apricot shrink-0">
                  {open ? 'Tutup' : 'Lihat Karyawan'}
                  <svg viewBox="0 0 12 12" className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              </button>

              {open && (
                <div className="border-t border-line dark:border-line-dark p-3.5 space-y-2.5">
                  {/* pencarian + filter role */}
                  <div className="flex gap-2">
                    <div className="relative flex-1 min-w-0">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="w-3.5 h-3.5 text-ink-faint" /></span>
                      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama / Employee ID..."
                        className="field !pl-9 !py-2.5 !text-[12px]" />
                    </div>
                    <div className="flex bg-paper dark:bg-white/5 border border-line dark:border-line-dark rounded-xl p-0.5 shrink-0">
                      {['semua', 'kasir', 'admin', 'owner'].map(r => (
                        <button key={r} onClick={() => setRoleFilter(r)}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold uppercase transition ${roleFilter === r ? 'bg-flame-500 text-white' : 'text-ink-faint'}`}>{r}</button>
                      ))}
                    </div>
                  </div>

                  {openList.length === 0 ? (
                    <p className="text-[11px] font-bold text-ink-faint text-center py-4">Tidak ada karyawan yang cocok.</p>
                  ) : openList.map(e => {
                    const eShift = shiftById(shiftsOf(e.branchId || 'PUSAT'), e.shiftId);
                    return (
                    <div key={e.cid} className="flex items-center gap-3 p-3 rounded-2xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark">
                      <div className="w-10 h-10 bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center rounded-2xl font-extrabold shrink-0">{e.name?.[0]}</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv truncate">{e.name}</p>
                        <p className="text-[9.5px] font-extrabold text-ink-faint font-mono tracking-wider">{e.empId || 'ID-'} · <span className="font-sans">{roleLabelOf(e.role)}</span></p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge tone={e.status === 'nonaktif' ? 'grey' : 'green'}>{e.status === 'nonaktif' ? 'Nonaktif' : 'Aktif'}</Badge>
                          {eShift && <Badge tone="lime"><WaktuReal className="w-3 h-3" /> {eShift.nama} {fmtShiftRange(eShift)}</Badge>}
                          {Number(e.hkBulan) > 0 && <Badge tone="neutral">target {e.hkBulan} HK</Badge>}
                          <Badge tone={e.jenisKontrak === 'harian' ? 'gold' : 'teal'}>{kontrakOf(e).short}{e.jenisKontrak === 'harian' && e.upahHarian ? ` · ${formatIDR(e.upahHarian)}/hari` : ''}</Badge>
                          {Number(e.hakCuti) > 0 && <Badge tone="neutral">cuti {e.hakCuti} hari</Badge>}
                          {e.pin && (
                            <span className="text-[9px] font-extrabold font-mono text-ink-faint bg-paper dark:bg-white/5 border border-line dark:border-line-dark rounded-md px-1.5 py-0.5 tracking-widest">
                              {revealPinId === e.cid ? e.pin : 'PIN ••••••'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {e.pin && (
                          <button onClick={() => setRevealPinId(revealPinId === e.cid ? null : e.cid)} aria-label="Lihat PIN pribadi"
                            className="p-2 rounded-xl bg-paper dark:bg-white/5 border border-line dark:border-line-dark text-ink-faint hover:text-flame-600 dark:hover:text-apricot transition">
                            {revealPinId === e.cid ? <GembokBuka className="w-3.5 h-3.5" /> : <GembokBuddy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button onClick={() => regenPin(e)} aria-label="Ganti PIN pribadi acak"
                          className="p-2 rounded-xl bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold hover:brightness-95 transition"><Kredensial className="w-3.5 h-3.5" /></button>
                        <button onClick={() => startEdit(e)} aria-label="Ubah karyawan"
                          className="bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot p-2 rounded-xl hover:bg-flame-100 dark:hover:bg-flame-900/70 transition press"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => { if (confirm(`Hapus karyawan ${e.name}?`)) { removeRow(e.cid); auditLog(licenseInfo, 'KARYAWAN_HAPUS', { target: e.empId || e.cid, nama: e.name }); } }}
                          className="bg-brick-soft dark:bg-brick/10 text-brick p-2 rounded-xl hover:bg-brick hover:text-white transition press"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================
   MULTI OUTLET — MONITORING TERPUSAT (realtime)
   ============================================================ */
export const OutletTab = ({ licenseInfo }) => {
  const { items: branches, live } = useTenantCol(licenseInfo, 'cabang', 'cabang_db');
  const { items: employees } = useTenantCol(licenseInfo, 'karyawan', 'karyawan_db');
  const { items: absensi } = useTenantCol(licenseInfo, 'absensi', 'absensi_db');
  const { items: payroll } = useTenantCol(licenseInfo, 'payroll', 'payroll_db');
  const { items: stations } = useTenantCol(licenseInfo, 'stations', 'stations_db');
  const { items: pengajuan } = useTenantCol(licenseInfo, 'pengajuan', 'pengajuan_db');

  const today = todayKey();
  const inToday = absensi.filter(a => a.date === today && a.type === 'in');
  const presentCount = new Set(inToday.map(a => a.employeeName + '|' + a.branchId)).size;
  const payrollOn = branches.filter(b => b.payrollEnabled).length;
  const pengajuanPending = pengajuan.filter(p => p.status === 'DIAJUKAN' || p.status === 'DITINJAU').length;
  const feed = [...absensi].sort((a, b) => (trustedTime(b).ms) - (trustedTime(a).ms)).slice(0, 8);

  const stats = [
    { label: 'Total Cabang', value: branches.length, icon: Cabang, tone: 'text-flame-700 dark:text-apricot' },
    { label: 'Total Karyawan', value: employees.length, icon: Tim, tone: 'text-flame-700 dark:text-apricot' },
    { label: 'Hadir Hari Ini', value: presentCount, icon: Absensi, tone: 'text-leaf-deep dark:text-leaf' },
    { label: 'Pengajuan Baru', value: pengajuanPending, icon: BahayaBuddy, tone: 'text-gold-deep dark:text-gold' },
  ];

  return (
    <div className="max-w-3xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Multi Outlet" sub="Monitoring terpusat seluruh cabang, realtime"
        right={<LiveDot live={live} />} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="card !rounded-3xl p-4">
            <s.icon className={`w-6 h-6 mb-2.5 ${s.tone}`} />
            <p className="text-2xl font-extrabold text-ink dark:text-ink-inv money leading-none">{s.value}</p>
            <p className="kicker mt-1.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* POS STATION RINGKAS */}
      <Card title="POS Station Aktif" icon={LayarBuddy}>
        {stations.length === 0 ? (
          <p className="text-[11px] font-bold text-ink-faint text-center py-2">Belum ada station. Atur di Manajemen Cabang, bagian POS Station.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stations.map(s => (
              <span key={s.cid} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10.5px] font-extrabold border ${s.active ? 'bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf border-leaf/25' : 'bg-paper dark:bg-white/5 text-ink-faint border-line dark:border-line-dark'}`}>
                <LayarBuddy className="w-3.5 h-3.5" /> {s.code} · {s.branchName}
              </span>
            ))}
          </div>
        )}
      </Card>

      <div className="space-y-2.5">
        <h3 className="font-extrabold text-[13px] text-ink dark:text-ink-inv px-1">Status Cabang</h3>
        {branches.length === 0 && <EmptyState mascot="pikir" title="Belum ada cabang" desc="Tambahkan cabang di menu Manajemen Cabang, lalu pantau semuanya dari sini secara realtime." />}
        {branches.map(b => {
          const staff = employees.filter(e => e.branchId === b.cid);
          const inList = inToday.filter(a => a.branchId === b.cid);
          const present = new Set(inList.map(a => a.employeeName)).size;
          const lastTs = inList.length ? Math.max(...inList.map(a => trustedTime(a).ms)) : null;
          const stList = stations.filter(s => s.branchId === b.cid && s.active);
          return (
            <div key={b.cid} className="card p-4.5">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-extrabold text-ink dark:text-ink-inv text-[15px]">{b.name}</h4>
                    {b.payrollEnabled ? <Badge tone="gold"><Penggajian className="w-3 h-3" /> Gaji ON</Badge> : <Badge tone="grey">Gaji OFF</Badge>}
                    {stList.length > 0 && <Badge tone="lime"><LayarBuddy className="w-3 h-3" /> {stList.length} station</Badge>}
                  </div>
                  <p className="text-[11px] text-ink-faint font-semibold mt-1 flex items-center gap-1.5"><Lokasi className="w-3.5 h-3.5 shrink-0" />{b.location || 'Lokasi belum diisi'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-2xl font-extrabold money leading-none ${present > 0 ? 'text-leaf-deep dark:text-leaf' : 'text-ink-faint'}`}>{present}<span className="text-sm text-ink-faint">/{staff.length}</span></p>
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-ink-faint mt-1">hadir</p>
                </div>
              </div>
              {lastTs && (
                <p className="text-[10px] text-ink-faint font-bold mt-2.5 flex items-center gap-1.5">
                  <WaktuReal className="w-3.5 h-3.5" /> Aktivitas terakhir {fmtTime(lastTs)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <Card title="Aktivitas Absensi Terbaru" icon={WaktuReal}>
        {feed.length === 0 ? (
          <div className="py-6 text-center">
            <Absensi className="w-10 h-10 text-ink-faint/40 mx-auto mb-2" />
            <p className="text-xs text-ink-faint font-bold">Belum ada aktivitas absensi.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {feed.map(a => {
              const t = trustedTime(a);
              return (
                <div key={a.cid} className="flex items-center gap-3 p-2.5 rounded-xl bg-paper dark:bg-white/[.03]">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${a.type === 'in' ? 'bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf' : 'bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold'}`}>
                    {a.type === 'in' ? <AbsenMasuk className="w-5 h-5" /> : <AbsenPulang className="w-5 h-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-extrabold text-ink dark:text-ink-inv truncate">{a.employeeName} <span className="text-ink-faint font-bold">· {a.branchName}</span></p>
                    <p className="text-[10px] text-ink-faint font-semibold">{a.type === 'in' ? 'Absen masuk' : 'Absen pulang'} · {fmtDateTime(t.ms)}
                      {t.source === 'server' && <span className="text-leaf-deep dark:text-leaf font-extrabold"> · ✓ server</span>}
                      {a.dist != null && <span className={a.dist > 500 ? 'text-gold-deep dark:text-gold' : ''}> · {a.dist}m dari cabang</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

/* ============================================================
   KELOLA ABSENSI (owner/admin) v12 — monitoring per HARI.
   • Statistik hari ini (hadir / telat / belum absen / total staf)
   • Kehadiran hari ini dgn foto selfie, jam server, kategori
     Tepat Waktu / Telat (durasi "00j 15m 00d")
   • Rekap 7 hari per karyawan + status cuti disetujui
   • Riwayat dikelompokkan per hari
   • QR + link APLIKASI KARYAWAN (?absen=1 — terpisah dari kasir)
   • Review pengajuan sakit / izin / cuti
   ============================================================ */
export const AbsensiTab = ({ licenseInfo, triggerAlert, sessionRole, sessionBranchId }) => {
  const { items: branches, live } = useTenantCol(licenseInfo, 'cabang', 'cabang_db');
  const { items: employees } = useTenantCol(licenseInfo, 'karyawan', 'karyawan_db');
  const { items: absensi } = useTenantCol(licenseInfo, 'absensi', 'absensi_db');
  const { items: pengajuan, updateRow } = useTenantCol(licenseInfo, 'pengajuan', 'pengajuan_db');
  const { items: settings } = useTenantCol(licenseInfo, 'pengaturan', 'pengaturan_db');
  const pusatShifts = normShifts((settings || []).find(s => s.key === 'shift_pusat')?.shifts);
  const shiftsOf = (bid) => shiftsForBranch(bid, branches, pusatShifts);
  const [rekapDays, setRekapDays] = useState(7);
  const [filterBranch, setFilterBranch] = useState(sessionRole === 'admin' ? (sessionBranchId || 'PUSAT') : 'ALL');
  const [viewRec, setViewRec] = useState(null);
  const [copied, setCopied] = useState(false);
  const [rejectFor, setRejectFor] = useState(null);
  const [rejectNote, setRejectNote] = useState('');

  const isAdmin = sessionRole === 'admin';
  const today = todayKey();
  const scope = (a) => filterBranch === 'ALL' || a.branchId === filterBranch;
  const branchOf = (a) => branches.find(b => b.cid === a.branchId) || null;
  const aturanOf = (a) => getAturan(branchOf(a));

  // Enrichment: waktu server, tanggal, kategori telat (presisi ms), status radius.
  const enrich = (list) => list.map(a => {
    const t = trustedTime(a);
    const at = aturanOf(a);
    const li = a.type === 'in' ? lateInfoMs(t.ms, at) : null;
    const far = a.dist != null && a.dist > at.radius;
    return { ...a, _t: t.ms, _src: t.source, _date: dateKeyOf(t.ms), _late: li, _far: far, _aturan: at };
  }).sort((x, y) => y._t - x._t);

  const all = enrich(absensi.filter(scope));
  const todayRows = all.filter(a => a._date === today);
  const staffScope = employees.filter(e => filterBranch === 'ALL' || (e.branchId || 'PUSAT') === filterBranch);

  const stats = [
    { label: 'Hadir Hari Ini', value: new Set(todayRows.filter(a => a.type === 'in').map(a => a.employeeName + '|' + a.branchId)).size, icon: AbsenMasuk, tone: 'text-leaf-deep dark:text-leaf' },
    { label: 'Telat Hari Ini', value: new Set(todayRows.filter(a => a.type === 'in' && a._late?.status === 'telat').map(a => a.employeeName + '|' + a.branchId)).size, icon: WaktuReal, tone: 'text-gold-deep dark:text-gold' },
    { label: 'Belum Absen', value: Math.max(0, staffScope.length - new Set(todayRows.filter(a => a.type === 'in').map(a => a.employeeName + '|' + a.branchId)).size), icon: BahayaBuddy, tone: 'text-brick-deep dark:text-brick' },
    { label: 'Total Karyawan', value: staffScope.length, icon: Tim, tone: 'text-flame-700 dark:text-apricot' },
  ];

  // Cuti/izin disetujui hari ini (utk konteks rekap)
  const offToday = pengajuan.filter(p => p.status === 'DISETUJUI' && p.dates && p.dates.includes(today));

  // Rekap 7 hari per karyawan
  const weekAgo = Date.now() - 7 * 864e5;
  const week = all.filter(a => a._t >= weekAgo);
  const rekap = staffScope.map(e => {
    const bid = filterBranch !== 'ALL' ? filterBranch : (e.branchId || 'PUSAT');
    const mine = week.filter(a => a.employeeName === e.name && a.branchId === bid && a.type === 'in');
    const days = new Set(mine.map(a => a._date));
    const telat = mine.filter(a => a._late?.status === 'telat').length;
    return { ...e, bid, hadir: days.size, telat };
  });

  // REKAP SHIFT & JAM KERJA (v12, target HK v13): HK = hari hadir,
  // jam = pasangan masuk→pulang (hari ini berjalan), telat, shift,
  // dan pembanding target HK per karyawan (aturan cabang/override).
  const rekapShiftAgo = Date.now() - rekapDays * 864e5;
  const rekapShift = staffScope.map(e => {
    const bid = filterBranch !== 'ALL' ? filterBranch : (e.branchId || 'PUSAT');
    const mine = all.filter(a => a._t >= rekapShiftAgo && a.branchId === bid
      && (a.employeeCid ? a.employeeCid === e.cid : a.employeeName === e.name));
    const work = pairWorkMinutes(mine);
    const telat = mine.filter(a => a.type === 'in' && a._late?.status === 'telat').length;
    const shift = shiftById(shiftsOf(bid), e.shiftId);
    const target = hkTargetOf(getAturan(branches.find(b => b.cid === bid)), e);
    return { ...e, bid, work, telat, shift, target };
  });

  // Riwayat dikelompokkan per hari (14 hari terakhir)
  const histAgo = Date.now() - 14 * 864e5;
  const hist = all.filter(a => a._t >= histAgo);
  const byDay = [];
  for (const a of hist) {
    let g = byDay.find(x => x.date === a._date);
    if (!g) { g = { date: a._date, ms: a._t, rows: [] }; byDay.push(g); }
    g.rows.push(a);
  }
  byDay.sort((a, b) => b.ms - a.ms);

  // ===== PENGAJUAN (cuti/izin/sakit) — scope sesuai role =====
  const pengajuanScope = pengajuan
    .filter(p => isAdmin ? p.branchId === (sessionBranchId || 'PUSAT') : (filterBranch === 'ALL' || p.branchId === filterBranch))
    .sort((a, b) => trustedTime(b).ms - trustedTime(a).ms);
  const pendingReq = pengajuanScope.filter(p => p.status === 'DIAJUKAN' || p.status === 'DITINJAU');
  const doneReq = pengajuanScope.filter(p => p.status === 'DISETUJUI' || p.status === 'DITOLAK').slice(0, 10);

  const reviewReq = (rec, to, note = '') => {
    const from = rec.status || 'DIAJUKAN';
    const actor = licenseInfo.employeeName || licenseInfo.tenant || 'Owner';
    updateRow(rec.cid, {
      status: to,
      ...(to === 'DITOLAK' ? { rejectReason: note } : {}),
      history: [...(Array.isArray(rec.history) ? rec.history : []), { from, to, by: actor, role: isAdmin ? 'admin' : 'owner', at: Date.now(), note }]
    });
    auditLog(licenseInfo, 'PENGAJUAN_' + to, { target: rec.cid, karyawan: rec.employeeName, jenis: rec.type, note });
  };

  const absenUrl = `${window.location.origin}${window.location.pathname}?absen=1${licenseInfo?.id ? '&lic=' + encodeURIComponent(licenseInfo.id) : ''}`;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(absenUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); triggerAlert('Link Aplikasi Karyawan dikopi!', 'success'); }
    catch (e) { triggerAlert('Gagal mengopi link. Salin manual dari kolom, ya.', 'error'); }
  };

  const StatusBadge = ({ a }) => {
    if (a.type !== 'in') return <Badge tone="gold"><AbsenPulang className="w-3 h-3" /> Pulang</Badge>;
    if (!a._late) return <Badge tone="grey">-</Badge>;
    return a._late.status === 'telat'
      ? <Badge tone="gold"><WaktuReal className="w-3 h-3" /> Telat {fmtDurJMD(a._late.lateMs)}</Badge>
      : <Badge tone="green"><Check className="w-3 h-3" /> Tepat Waktu</Badge>;
  };

  const PhotoThumb = ({ rec, size = 'w-11 h-11' }) => (
    <button onClick={() => rec.photo && setViewRec(rec)} className={`${size} rounded-xl overflow-hidden shrink-0 border border-line dark:border-line-dark bg-paper dark:bg-white/5 flex items-center justify-center ${rec.photo ? 'cursor-zoom-in press' : 'cursor-default'}`} aria-label="Foto selfie absensi">
      {rec.photo ? <img src={rec.photo} alt="Selfie absensi" className="w-full h-full object-cover" />
        : <span className="font-extrabold text-ink-faint/60 text-[10px]">{rec.employeeName?.[0] || '?'}</span>}
    </button>
  );

  const CutiBadge = ({ type }) => (
    <Badge tone={type === 'sakit' ? 'red' : type === 'cuti' ? 'teal' : 'gold'}>
      {(CUTI_TYPES.find(x => x.id === type)?.label) || type}
    </Badge>
  );

  return (
    <div className="max-w-3xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Kelola Absensi" sub="Kehadiran semua karyawan, dikelompokkan per hari"
        right={<LiveDot live={live} />} />

      {!isAdmin && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[{ cid: 'ALL', name: 'Semua Cabang' }, ...branches].map(b => (
            <button key={b.cid} onClick={() => setFilterBranch(b.cid)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-extrabold whitespace-nowrap transition-all border ${filterBranch === b.cid ? 'bg-flame-600 text-white border-flame-600 shadow-card' : 'bg-surface dark:bg-surface-dark text-ink-faint border-line dark:border-line-dark hover:border-flame-300'}`}>
              <Cabang className="w-3.5 h-3.5" /> {b.name}
            </button>
          ))}
        </div>
      )}

      {/* STATISTIK HARI INI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="card !rounded-3xl p-4">
            <s.icon className={`w-6 h-6 mb-2.5 ${s.tone}`} />
            <p className="text-2xl font-extrabold text-ink dark:text-ink-inv money leading-none">{s.value}</p>
            <p className="kicker mt-1.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* APLIKASI KARYAWAN (entry point karyawan, terpisah dari kasir) */}
      <Card title="Aplikasi Karyawan" icon={PerisaiBuddy}>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="bg-white p-2.5 rounded-2xl border-2 border-dashed border-line dark:border-line-dark shrink-0">
            <img src={qrUrl(absenUrl, 200)} width="120" height="120" className="w-[120px] h-[120px]" alt="QR Aplikasi Karyawan" />
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-[12.5px] font-extrabold text-ink dark:text-ink-inv">Aplikasi terpisah untuk seluruh pekerja</p>
            <p className="text-[11px] text-ink-faint font-semibold leading-relaxed mt-1">
              Cetak / bagikan QR ini ke tim. Semua orang (kasir, admin, sampai owner yang dicatat sebagai karyawan) login pakai <b>PIN pribadi</b> masing-masing: absen dengan <b>selfie + lokasi + waktu server</b> yang tidak bisa diubah, mengajukan sakit/izin/cuti sesuai hak cutinya, atasan menyetujui dari app-nya juga, sampai melihat slip gaji premium. Datanya masuk realtime ke halaman ini.
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <input readOnly value={absenUrl} className="field !py-2 !text-[10.5px] min-w-0 flex-1 font-mono" onFocus={e => e.target.select()} />
              <Button onClick={copyLink} className="py-2.5 px-3.5 text-xs shrink-0" icon={copied ? Check : KoinBuddy}>{copied ? 'Terkopi' : 'Copy'}</Button>
            </div>
          </div>
        </div>
      </Card>

      {/* KEHADIRAN HARI INI */}
      <Card title={`Hari Ini · ${dayLabel(Date.now())}`} icon={Absensi}>
        {staffScope.length === 0 ? (
          <EmptyState mascot="bingung" title="Belum ada karyawan" desc="Tambahkan karyawan lewat menu Manajemen Karyawan, lalu arahkan ke cabangnya." />
        ) : todayRows.length === 0 && (
          <div className="py-6 text-center">
            <Absensi className="w-10 h-10 text-ink-faint/40 mx-auto mb-2" />
            <p className="text-xs text-ink-faint font-bold">Belum ada yang absen hari ini.</p>
          </div>
        )}
        <div className="space-y-2">
          {['PUSAT', ...branches.map(b => b.cid)].filter(bid => filterBranch === 'ALL' || bid === filterBranch).map(bid => {
            const list = employees.filter(e => (e.branchId || 'PUSAT') === bid);
            if (!list.length) return null;
            const bRec = branches.find(b => b.cid === bid);
            const bName = bid === 'PUSAT' ? 'Pusat' : (bRec?.name || 'Cabang');
            const at = getAturan(bRec);
            return (
              <div key={bid}>
                <p className="kicker px-0.5 mb-2 mt-1 flex items-center gap-2">{bName}
                  <span className="text-[9px] font-extrabold normal-case tracking-normal text-ink-faint/70">masuk {at.jamMasuk} · toleransi {at.toleransi} menit · radius {at.radius} meter</span>
                </p>
                <div className="space-y-2">
                  {list.map(e => {
                    const inRec = todayRows.find(a => a.employeeName === e.name && a.branchId === bid && a.type === 'in');
                    const outRec = todayRows.find(a => a.employeeName === e.name && a.branchId === bid && a.type === 'out');
                    const off = offToday.find(p => p.employeeCid === e.cid);
                    return (
                      <div key={e.cid} className="flex items-center gap-3 p-3 rounded-2xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark">
                        <PhotoThumb rec={inRec || { employeeName: e.name }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv truncate">{e.name}</p>
                            {inRec && <StatusBadge a={inRec} />}
                            {inRec?._far && <Badge tone="gold"><Lokasi className="w-3 h-3" /> di luar radius</Badge>}
                            {off && <Badge tone="teal">Cuti / Izin</Badge>}
                          </div>
                          <div className="flex gap-3 mt-0.5 text-[10px] font-bold flex-wrap">
                            {inRec ? (
                              <span className="text-leaf-deep dark:text-leaf flex items-center gap-1"><AbsenMasuk className="w-3 h-3" /> Masuk {fmtTime(inRec._t)}{inRec._src === 'server' ? ' ✓' : ''}
                                {inRec.dist != null && <span className="text-ink-faint"> · {inRec.dist}m</span>}
                              </span>
                            ) : <span className="text-ink-faint">{off ? 'Sedang cuti/izin hari ini' : 'Belum absen masuk'}</span>}
                            {outRec && <span className="text-gold-deep dark:text-gold flex items-center gap-1"><AbsenPulang className="w-3 h-3" /> Pulang {fmtTime(outRec._t)}{outRec._src === 'server' ? ' ✓' : ''}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* PENGAJUAN CUTI/IZIN/SAKIT */}
      <Card title="Pengajuan Cuti, Izin & Sakit" icon={Riwayat}
        help={isAdmin ? 'Sebagai Admin Cabang, kamu meninjau pengajuan karyawan cabangmu. Keputusan akhir tetap bisa di-override Owner.' : 'Pengajuan diteruskan ke Admin Cabang dan Owner. Setujui bila memenuhi aturan cabang.'}>
        {pengajuanScope.length === 0 ? (
          <div className="py-6 text-center">
            <Riwayat className="w-10 h-10 text-ink-faint/40 mx-auto mb-2" />
            <p className="text-xs text-ink-faint font-bold">Belum ada pengajuan dari karyawan.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {[...pendingReq, ...doneReq].map(p => {
              const t = trustedTime(p);
              const flow = CUTI_FLOW[p.status] || CUTI_FLOW.DIAJUKAN;
              return (
                <div key={p.cid} className="p-3.5 rounded-2xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">{p.employeeName} <CutiBadge type={p.type} /></p>
                      <p className="text-[10.5px] font-bold text-ink-faint mt-0.5">
                        {p.startDate === p.endDate ? p.startDate : `${p.startDate} s/d ${p.endDate}`} · {p.days} hari
                      </p>
                      {p.type === 'cuti' && (() => {
                        const emp2 = employees.find(e => e.cid === p.employeeCid) || null;
                        const hak = hakCutiOf(cutiPolicyOf(settings), emp2);
                        const sisa = Math.max(0, hak - usedCutiDays(pengajuan, p.employeeCid));
                        return <p className={`text-[9.5px] font-extrabold mt-1 ${sisa >= p.days ? 'text-leaf-deep dark:text-leaf' : 'text-gold-deep dark:text-gold'}`}>Hak cuti tahun ini: sisa {sisa} dari {hak} hari</p>;
                      })()}
                      {p.reason && <p className="text-[10.5px] font-semibold text-ink-soft dark:text-ink-inv/70 mt-1 leading-snug">"{p.reason}"</p>}
                      {p.status === 'DITOLAK' && p.rejectReason && (
                        <p className="text-[10.5px] font-bold text-brick-deep dark:text-brick mt-1">Alasan tolak: {p.rejectReason}</p>
                      )}
                      <p className="text-[9.5px] font-bold text-ink-faint mt-1.5 flex items-center gap-1"><WaktuReal className="w-3 h-3" /> diajukan {fmtDateTime(t.ms)}{t.source === 'server' ? ' · ✓ server' : ''}</p>
                    </div>
                    <Badge tone={flow.tone}>{flow.label}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {p.letter && (
                      <a href={p.letter} target="_blank" rel="noreferrer" className="py-2.5 px-3.5 rounded-xl bg-paper dark:bg-white/5 border border-line dark:border-line-dark text-[11px] font-extrabold text-ink-soft dark:text-ink-inv/80 flex items-center gap-1.5 press">
                        <BuktiTransfer className="w-4 h-4" /> Surat Dokter
                      </a>
                    )}
                    {(p.status === 'DIAJUKAN') && (
                      <Button variant="secondary" className="py-2.5 px-3.5 text-xs" onClick={() => reviewReq(p, 'DITINJAU')} icon={WaktuReal}>Tandai Ditinjau</Button>
                    )}
                    {(p.status === 'DIAJUKAN' || p.status === 'DITINJAU') && (
                      <>
                        <Button className="py-2.5 px-3.5 text-xs" onClick={() => reviewReq(p, 'DISETUJUI')} icon={Check}>Setujui</Button>
                        <Button variant="danger" className="py-2.5 px-3.5 text-xs" onClick={() => { setRejectFor(p); setRejectNote(''); }} icon={BahayaBuddy}>Tolak</Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* REKAP SHIFT & JAM KERJA (v12) — HK, total jam, telat, dan pembagian orang per shift */}
      <Card title="Rekap Shift & Jam Kerja" icon={WaktuReal}
        help="HK = hari kerja (jumlah hari absen masuk dalam periode). Total jam dihitung dari pasangan absen masuk → pulang; hari ini dihitung berjalan sampai jam sekarang. Target HK diatur per cabang (Aturan Absensi di Manajemen Cabang) atau khusus per karyawan di Manajemen Karyawan.">
        <div className="flex items-center gap-2 mb-3.5">
          {[7, 30].map(d => (
            <button key={d} onClick={() => setRekapDays(d)}
              className={`px-3.5 py-2 rounded-xl text-[11px] font-extrabold transition-all border ${rekapDays === d ? 'bg-flame-600 text-white border-flame-600 shadow-card' : 'bg-surface dark:bg-surface-dark text-ink-faint border-line dark:border-line-dark hover:border-flame-300'}`}>
              {d} Hari Terakhir
            </button>
          ))}
        </div>
        {staffScope.length === 0 ? (
          <EmptyState mascot="pikir" title="Belum ada karyawan" desc="Rekap shift & jam kerja muncul otomatis setelah ada karyawan dan absensi." />
        ) : (
          <div className="space-y-4">
            {['PUSAT', ...branches.map(b => b.cid)].filter(bid => filterBranch === 'ALL' || bid === filterBranch).map(bid => {
                const rows = rekapShift.filter(r => r.bid === bid);
                if (!rows.length) return null;
                const shs = shiftsOf(bid);
                const bName = bid === 'PUSAT' ? 'Pusat' : (branches.find(b => b.cid === bid)?.name || 'Cabang');
                const flexNames = rows.filter(r => !r.shift).map(r => r.name);
                const bidTarget = hkTargetOf(getAturan(branches.find(b => b.cid === bid)), null);
                return (
                  <div key={bid}>
                    <p className="kicker px-0.5 mb-2 flex items-center gap-2 flex-wrap">{bName}
                      {bidTarget > 0 && <span className="text-[9px] font-extrabold normal-case tracking-normal text-flame-700 dark:text-apricot">target {bidTarget} HK/bulan</span>}
                      {shs.length === 0 && <span className="text-[9px] font-extrabold normal-case tracking-normal text-ink-faint/70">belum ada shift · semua fleksibel</span>}
                    </p>
                    {shs.length > 0 && (
                      <div className="grid sm:grid-cols-2 gap-2 mb-2.5">
                        {shs.map(s => {
                          const members = rows.filter(r => r.shift && r.shift.id === s.id);
                          return (
                            <div key={s.id} className={`p-3 rounded-2xl border ${s.aktif !== false ? 'border-flame-200/60 dark:border-flame-900/50 bg-flame-50/40 dark:bg-flame-900/[.12]' : 'border-line dark:border-line-dark bg-paper dark:bg-white/[.02] opacity-70'}`}>
                              <p className="font-extrabold text-[11.5px] text-ink dark:text-ink-inv flex items-center gap-1.5 flex-wrap">
                                <WaktuReal className="w-3.5 h-3.5 text-flame-600 dark:text-apricot" /> {s.nama}
                                <span className="font-mono text-ink-faint">{fmtShiftRange(s)}</span>
                                <span className="text-ink-faint">· {fmtJam(shiftDurMin(s))}</span>
                                {s.aktif === false && <Badge tone="grey">Nonaktif</Badge>}
                              </p>
                              <p className="text-[10px] font-bold text-ink-soft dark:text-ink-inv/70 mt-1 leading-relaxed">
                                {members.length ? members.map(m => m.name).join(', ') : 'Belum ada karyawan di shift ini'}
                              </p>
                            </div>
                          );
                        })}
                        {flexNames.length > 0 && (
                          <div className="p-3 rounded-2xl border border-line dark:border-line-dark bg-paper dark:bg-white/[.02]">
                            <p className="font-extrabold text-[11.5px] text-ink dark:text-ink-inv">Fleksibel (tanpa shift)</p>
                            <p className="text-[10px] font-bold text-ink-soft dark:text-ink-inv/70 mt-1 leading-relaxed">{flexNames.join(', ')}</p>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      {rows.map(r => (
                        <div key={r.cid} className="flex items-center gap-3 p-3 rounded-2xl bg-paper dark:bg-white/[.03]">
                          <div className="w-9 h-9 rounded-xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center font-extrabold text-xs shrink-0">{r.name[0]}</div>
                          <div className="min-w-0 flex-1">
                            <p className="font-extrabold text-[12.5px] text-ink dark:text-ink-inv truncate">{r.name} <span className="text-[9px] font-mono text-ink-faint">{r.empId || ''}</span></p>
                            <p className="text-[9.5px] font-bold text-ink-faint">{r.shift ? `${r.shift.nama} · ${fmtShiftRange(r.shift)}` : 'Fleksibel'}</p>
                          </div>
                          <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                            {/* Target HK dibandingkan di rekap 30 hari (target per bulan) */}
                            {rekapDays === 30 && r.target > 0
                              ? <Badge tone={r.work.hk >= r.target ? 'green' : 'gold'}>HK {r.work.hk}/{r.target}</Badge>
                              : <Badge tone="neutral">HK {r.work.hk} hari</Badge>}
                            <Badge tone={r.work.totalMin > 0 ? 'green' : 'neutral'}>{fmtJam(r.work.totalMin)}</Badge>
                            {r.telat > 0 && <Badge tone="gold">telat {r.telat}x</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </Card>

      {/* REKAP 7 HARI */}
      <Card title="Rekap 7 Hari per Karyawan" icon={MedaliBuddy}>
        {rekap.length === 0 ? (
          <EmptyState mascot="pikir" title="Belum ada karyawan" desc="Rekap kehadiran mingguan muncul otomatis di sini." />
        ) : (
          <div className="space-y-2">
            {rekap.map(r => (
              <div key={r.cid} className="flex items-center gap-3 p-3 rounded-2xl bg-paper dark:bg-white/[.03]">
                <div className="w-9 h-9 rounded-xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center font-extrabold text-xs shrink-0">{r.name[0]}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-[12.5px] text-ink dark:text-ink-inv truncate">{r.name}</p>
                  <p className="text-[10px] text-ink-faint font-bold">{r.bid === 'PUSAT' ? 'Pusat' : (branches.find(b => b.cid === r.bid)?.name || '-')}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Badge tone={r.hadir >= 5 ? 'green' : r.hadir > 0 ? 'gold' : 'grey'}>{r.hadir}/7 hadir</Badge>
                  {r.telat > 0 && <Badge tone="gold">telat {r.telat}x</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* RIWAYAT PER HARI */}
      <Card title="Riwayat Absensi (14 Hari)" icon={Riwayat}>
        {byDay.length === 0 ? (
          <div className="py-6 text-center">
            <Riwayat className="w-10 h-10 text-ink-faint/40 mx-auto mb-2" />
            <p className="text-xs text-ink-faint font-bold">Belum ada riwayat absensi.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {byDay.map(g => (
              <div key={g.date}>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <span className="w-8 h-8 rounded-xl bg-chrome-deep dark:bg-white/5 text-ink-inv dark:text-ink-inv/80 text-[9px] font-extrabold uppercase flex flex-col items-center justify-center leading-none shrink-0">
                    <span>{new Date(g.ms).toLocaleDateString('id-ID', { day: 'numeric' })}</span>
                    <span className="mt-0.5">{new Date(g.ms).toLocaleDateString('id-ID', { month: 'short' })}</span>
                  </span>
                  <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">{new Date(g.ms).toLocaleDateString('id-ID', { weekday: 'long' })}</p>
                  <span className="text-[10px] font-bold text-ink-faint">{new Date(g.ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  <span className="ml-auto text-[10px] font-extrabold text-ink-faint uppercase tracking-wider">{g.rows.length} catatan</span>
                </div>
                <div className="space-y-2">
                  {g.rows.map(a => (
                    <div key={a.cid} className="flex items-center gap-3 p-2.5 rounded-xl bg-paper dark:bg-white/[.03]">
                      <PhotoThumb rec={a} size="w-10 h-10" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-extrabold text-ink dark:text-ink-inv truncate">
                          {a.employeeName} <span className="text-ink-faint font-bold">· {a.branchName || a.branchId}</span>
                        </p>
                        <p className="text-[10px] text-ink-faint font-semibold">
                          {a.type === 'in' ? 'Absen masuk' : 'Absen pulang'} {fmtTime(a._t)}
                          {a._src === 'server' ? <span className="text-leaf-deep dark:text-leaf font-extrabold"> · ✓ server</span> : <span className="text-gold-deep dark:text-gold font-extrabold"> · waktu perangkat</span>}
                          {a.dist != null && ` · ${a.dist}m`}
                          {a._far && <span className="text-gold-deep dark:text-gold font-extrabold"> · luar radius</span>}
                        </p>
                      </div>
                      {a.type === 'in' && <StatusBadge a={a} />}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* MODAL FOTO SELFIE + DETAIL */}
      <Modal open={!!viewRec} onClose={() => setViewRec(null)} title="Bukti Absensi">
        {viewRec && (
          <div className="space-y-3">
            {viewRec.photo ? (
              <img src={viewRec.photo} alt="Selfie absensi" className="w-full rounded-2xl border border-line dark:border-line-dark" />
            ) : (
              <div className="py-8 text-center text-ink-faint text-xs font-bold">Catatan ini tanpa foto selfie.</div>
            )}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
              <div className="p-3 rounded-xl bg-paper dark:bg-white/[.03]"><p className="kicker mb-1">Karyawan</p><p className="text-ink dark:text-ink-inv">{viewRec.employeeName}</p></div>
              <div className="p-3 rounded-xl bg-paper dark:bg-white/[.03]"><p className="kicker mb-1">Cabang</p><p className="text-ink dark:text-ink-inv">{viewRec.branchName || viewRec.branchId || '-'}</p></div>
              <div className="p-3 rounded-xl bg-paper dark:bg-white/[.03]"><p className="kicker mb-1">Waktu (server)</p><p className="text-ink dark:text-ink-inv">{new Date(trustedTime(viewRec).ms).toLocaleString('id-ID')}</p></div>
              <div className="p-3 rounded-xl bg-paper dark:bg-white/[.03]"><p className="kicker mb-1">Jenis</p><p className="text-ink dark:text-ink-inv">{viewRec.type === 'in' ? 'Absen Masuk' : 'Absen Pulang'}</p></div>
              {viewRec.lat != null && <div className="p-3 rounded-xl bg-paper dark:bg-white/[.03]"><p className="kicker mb-1">Koordinat</p><p className="text-ink dark:text-ink-inv font-mono text-[10px]">{Number(viewRec.lat).toFixed(5)}, {Number(viewRec.lng).toFixed(5)}</p></div>}
              {viewRec.dist != null && <div className="p-3 rounded-xl bg-paper dark:bg-white/[.03]"><p className="kicker mb-1">Jarak ke Cabang</p><p className={`text-ink dark:text-ink-inv ${viewRec.dist > (viewRec._aturan?.radius || 500) ? 'text-gold-deep dark:text-gold' : ''}`}>{viewRec.dist} meter</p></div>}
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL ALASAN PENOLAKAN PENGAJUAN */}
      <Modal open={!!rejectFor} onClose={() => setRejectFor(null)} title="Tolak Pengajuan"
        sub={rejectFor ? `${rejectFor.employeeName} · ${(CUTI_TYPES.find(x => x.id === rejectFor.type)?.label) || ''}` : ''}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setRejectFor(null)}>Batal</Button>
            <Button variant="danger" className="flex-1" icon={Check}
              onClick={() => { if (!rejectNote.trim()) return triggerAlert('Tulis dulu alasannya, biar karyawan paham.', 'error'); reviewReq(rejectFor, 'DITOLAK', rejectNote.trim()); setRejectFor(null); }}>
              Tolak Pengajuan
            </Button>
          </div>
        }>
        <p className="text-[11.5px] font-semibold text-ink-soft dark:text-ink-inv/75 leading-relaxed mb-3">
          Alasan penolakan akan tampil di aplikasi karyawan. Tulis singkat dan jelas, misal jadwal kurang orang atau pengajuan menumpuk.
        </p>
        <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3}
          className="field resize-none" placeholder="Contoh: Sabtu ramai, ditunda minggu depan ya." />
      </Modal>
    </div>
  );
};

/* ============================================================
   MANAJEMEN PENGAJIAN v12 — WORKFLOW NYATA:
   DRAFT → DIAJUKAN → DISETUJUI → DIBAYAR → SELESAI
   (DITOLAK → revisi → ajukan ulang).
   • Admin Cabang (payroll ON): buat & ajukan payroll cabangnya,
     TIDAK bisa menyetujui sendiri.
   • Owner: review, setujui/tolak (approval digital), tandai
     dibayar (bukti transfer), selesaikan.
   • Setiap perubahan status tercatat: siapa, kapan, role, dari
     status apa ke status apa + catatan. payrollEnabled tetap hidup.
   ============================================================ */
const PERIODE = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const periodeNow = () => PERIODE[new Date().getMonth()] + ' ' + new Date().getFullYear();

// 'September 2026' → { start, end } (ms) — untuk rekap HK & jam kerja periode gaji
const monthRangeMs = (periodLabel) => {
  const [nama, y] = String(periodLabel || '').split(' ');
  const m = PERIODE.indexOf(nama);
  if (m < 0) return null;
  const year = parseInt(y, 10) || new Date().getFullYear();
  return { start: new Date(year, m, 1, 0, 0, 0, 0).getTime(), end: new Date(year, m + 1, 1, 0, 0, 0, 0).getTime() - 1 };
};

const PayStatusBadge = ({ status }) => {
  const f = PAYROLL_FLOW[status] || PAYROLL_FLOW.DIBAYAR;     // data lama tanpa status = terbayar
  return <Badge tone={f.tone}>{f.label}</Badge>;
};

export const PayrollTab = ({ licenseInfo, triggerAlert, sessionRole, sessionBranchId }) => {
  const { items: branches, live } = useTenantCol(licenseInfo, 'cabang', 'cabang_db');
  const { items: employees } = useTenantCol(licenseInfo, 'karyawan', 'karyawan_db');
  const { items: payroll, addRow, updateRow, removeRow } = useTenantCol(licenseInfo, 'payroll', 'payroll_db');
  const { items: absensi } = useTenantCol(licenseInfo, 'absensi', 'absensi_db');
  const { items: settings } = useTenantCol(licenseInfo, 'pengaturan', 'pengaturan_db');
  // Profil perusahaan (v14) dipakai di slip gaji premium
  const coProfile = settings.find(s => s.key === 'perusahaan') || {};
  const [selBranch, setSelBranch] = useState(sessionRole === 'admin' ? (sessionBranchId || 'PUSAT') : 'ALL');
  const [payFor, setPayFor] = useState(null);                    // karyawan yang dibuat payrollnya
  const [form, setForm] = useState({ period: periodeNow(), note: '' });
  const [comp, setComp] = useState({ pokok: '', tunjangan: '', bonus: '', lembur: '', potongan: '' });
  const [editingId, setEditingId] = useState(null);
  const [payModal, setPayModal] = useState(null);                // payroll DISETUJUI yang akan dibayar
  const [proof, setProof] = useState(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [viewProof, setViewProof] = useState(null);
  const [rejectFor, setRejectFor] = useState(null);
  const [rejectNote, setRejectNote] = useState('');

  const isOwner = sessionRole !== 'admin';
  const myBranch = sessionRole === 'admin' ? branches.find(b => b.cid === sessionBranchId) : null;
  const blocked = sessionRole === 'admin' && myBranch && !myBranch.payrollEnabled;
  const shownBranch = selBranch === 'ALL' ? null : branches.find(b => b.cid === selBranch);
  const list = employees.filter(e => e.status !== 'nonaktif').filter(e => (sessionRole === 'admin' ? e.branchId === sessionBranchId : (selBranch === 'ALL' || e.branchId === selBranch)));
  const history = [...payroll]
    .filter(p => sessionRole === 'admin' ? p.branchId === sessionBranchId : (selBranch === 'ALL' || p.branchId === selBranch))
    .sort((a, b) => trustedTime(b).ms - trustedTime(a).ms);

  const lastPay = (empCid) => history.find(h => h.employeeCid === empCid);
  const compTotal = (c = comp) =>
    (Number(c.pokok) || 0) + (Number(c.tunjangan) || 0) + (Number(c.bonus) || 0) + (Number(c.lembur) || 0) - (Number(c.potongan) || 0);

  // Rekap absensi satu karyawan dalam periode gaji: HK + total jam +
  // telat + target HK (v13) sebagai pembanding.
  const periodWork = (empCid, empName, periodLabel) => {
    const r = monthRangeMs(periodLabel);
    if (!r) return { hk: 0, totalMin: 0, telat: 0, target: 0 };
    const rows = absensi.filter(a => {
      if (a.employeeCid ? a.employeeCid !== empCid : a.employeeName !== empName) return false;
      const ms = trustedTime(a).ms;
      return ms >= r.start && ms <= r.end;
    });
    const work = pairWorkMinutes(rows);
    const telat = rows.filter(a => a.type === 'in' && (a.lateStatus
      ? a.lateStatus === 'telat'
      : lateInfoMs(trustedTime(a).ms, getAturan(branches.find(b => b.cid === a.branchId))).status === 'telat')).length;
    const emp = employees.find(e => (empCid && e.cid === empCid) || e.name === empName) || null;
    const bid = emp?.branchId || 'PUSAT';
    const target = hkTargetOf(getAturan(branches.find(b => b.cid === bid)), emp);
    return { hk: work.hk, totalMin: work.totalMin, telat, target };
  };

  const openPay = (e, bid) => {
    setPayFor({ ...e, branchId: bid, branchName: bid === 'PUSAT' ? 'Pusat' : (branches.find(b => b.cid === bid)?.name || '-') });
    setForm({ period: periodeNow(), note: '' });
    // Prefill dari status kontrak (v14): harian → upah x hari masuk
    // periode ini; PKWT/tetap → gaji pokok per periode.
    const kk = kontrakOf(e);
    const pref = { pokok: '', tunjangan: '', bonus: '', lembur: '', potongan: '' };
    if (kk.payMode === 'harian') {
      const pw0 = periodWork(e.cid, e.name, periodeNow());
      pref.pokok = String((Number(e.upahHarian) || 0) * pw0.hk);
    } else if (Number(e.gajiPokok) > 0) {
      pref.pokok = String(Number(e.gajiPokok));
    }
    setComp(pref);
    setEditingId(null);
  };

  // Hitung ulang upah harian dari hari masuk periode terpilih.
  const recomputeHarian = (periodLabel) => {
    if (!payFor || kontrakOf(payFor).payMode !== 'harian') return;
    const pw0 = periodWork(payFor.cid, payFor.name, periodLabel || form.period);
    setComp(c => ({ ...c, pokok: String((Number(payFor.upahHarian) || 0) * pw0.hk) }));
  };

  // status aktor: nama + role + cabang, waktu server menyusul via serverAt
  const actor = licenseInfo.employeeName || licenseInfo.tenant || 'Owner';

  const savePay = (submit) => {
    if (!payFor) return;
    const total = compTotal();
    if (total <= 0) return triggerAlert('Isi komponen gajinya dulu, minimal gaji pokok.', 'error');
    const pw = periodWork(payFor.cid, payFor.name, form.period);   // HK & jam kerja periode ini
    const payload = {
      branchId: payFor.branchId, branchName: payFor.branchName,
      employeeCid: payFor.cid || '', employeeName: payFor.name, empId: payFor.empId || '', role: payFor.role,
      period: form.period, note: form.note.trim(),
      components: { pokok: Number(comp.pokok) || 0, tunjangan: Number(comp.tunjangan) || 0, bonus: Number(comp.bonus) || 0, lembur: Number(comp.lembur) || 0, potongan: Number(comp.potongan) || 0 },
      amount: total,
      hk: pw.hk, jamKerja: pw.totalMin, telat: pw.telat, hkTarget: pw.target,
      // snapshot status kontrak (v14) supaya slip & riwayat tetap
      // benar walau kontrak karyawan diganti nanti
      jenisKontrak: kontrakOf(payFor).payMode === 'harian' ? 'harian' : (payFor.jenisKontrak || 'tetap'),
      upahHarian: kontrakOf(payFor).payMode === 'harian' ? (Number(payFor.upahHarian) || 0) : null,
      status: submit ? 'DIAJUKAN' : 'DRAFT'
    };
    if (editingId) {
      const rec = payroll.find(p => p.cid === editingId);
      const from = rec?.status || 'DRAFT';
      updateRow(editingId, {
        ...payload,
        history: payrollPushHistory(rec, from, payload.status, actor, sessionRole, submit ? 'Diajukan ulang setelah revisi' : 'Draft diperbarui')
      });
      auditLog(licenseInfo, submit ? 'PAYROLL_DIAJUKAN' : 'PAYROLL_DRAFT', { target: editingId, karyawan: payFor.name, periode: form.period, total });
      triggerAlert(submit ? 'Payroll diajukan. Sekarang menunggu persetujuan Owner.' : 'Draft payroll disimpan.', 'success');
    } else {
      const cid = addRow({ ...payload, history: [{ from: 'BARU', to: payload.status, by: actor, role: sessionRole, at: Date.now(), note: submit ? 'Diajukan' : 'Dibuat sebagai draft' }] });
      auditLog(licenseInfo, submit ? 'PAYROLL_DIAJUKAN' : 'PAYROLL_DRAFT', { target: cid, karyawan: payFor.name, periode: form.period, total });
      triggerAlert(submit ? 'Payroll diajukan. Sekarang menunggu persetujuan Owner.' : 'Draft payroll disimpan.', 'success');
    }
    setPayFor(null); setEditingId(null);
  };

  const startEdit = (rec) => {
    const st = rec.status || 'DIBAYAR';
    if (st !== 'DRAFT' && st !== 'DITOLAK') return;
    const c = rec.components || { pokok: rec.amount || 0, tunjangan: 0, bonus: 0, lembur: 0, potongan: 0 };
    setPayFor({ cid: rec.employeeCid, name: rec.employeeName, empId: rec.empId, role: rec.role, branchId: rec.branchId, branchName: rec.branchName, jenisKontrak: rec.jenisKontrak, upahHarian: rec.upahHarian });
    setForm({ period: rec.period, note: rec.note || '' });
    setComp({ pokok: String(c.pokok || ''), tunjangan: String(c.tunjangan || ''), bonus: String(c.bonus || ''), lembur: String(c.lembur || ''), potongan: String(c.potongan || '') });
    setEditingId(rec.cid);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const act = (rec, to, note = '', extra = {}) => {
    const from = rec.status || 'DRAFT';
    updateRow(rec.cid, { status: to, ...extra, history: payrollPushHistory(rec, from, to, actor, sessionRole, note) });
    auditLog(licenseInfo, 'PAYROLL_' + to, { target: rec.cid, karyawan: rec.employeeName, periode: rec.period, dari: from, ke: to, note });
  };

  const approve = (rec) => {
    const approvals = [...(Array.isArray(rec.approvals) ? rec.approvals : []), { action: 'approve', by: actor, role: sessionRole, at: Date.now(), method: 'Akun WELP', note: 'Disetujui lewat Manajemen Penggajian' }];
    act(rec, 'DISETUJUI', 'Disetujui oleh ' + actor, { approvals });
    triggerAlert('Payroll disetujui. Lanjut tandai dibayar setelah transfer.', 'success');
  };

  const doReject = () => {
    if (!rejectNote.trim()) return triggerAlert('Tulis dulu alasannya, biar bisa diperbaiki.', 'error');
    const approvals = [...(Array.isArray(rejectFor.approvals) ? rejectFor.approvals : []), { action: 'reject', by: actor, role: sessionRole, at: Date.now(), method: 'Akun WELP', note: rejectNote.trim() }];
    act(rejectFor, 'DITOLAK', rejectNote.trim(), { rejectReason: rejectNote.trim(), approvals });
    setRejectFor(null); setRejectNote('');
    triggerAlert('Payroll ditolak & dikembalikan untuk revisi.', 'success');
  };

  const pickProof = async (file) => {
    if (!file) return;
    setProofBusy(true);
    try { setProof(await fileToDataUrl(file, 720, 0.66)); }
    catch (e) { triggerAlert('Gagal memuat gambar: ' + e.message, 'error'); }
    setProofBusy(false);
  };

  const markPaid = () => {
    if (!payModal) return;
    act(payModal, 'DIBAYAR', 'Dibayarkan oleh ' + actor, { proof: proof || payModal.proof || null, paidAt: Date.now() });
    setPayModal(null); setProof(null);
    triggerAlert('Pembayaran gaji tercatat dengan waktu server.', 'success');
  };

  /* Cetak slip gaji premium (v14): logo perusahaan, band warna brand,
     rincian komponen, stempel status, approval digital & QR verifikasi. */
  const printSlip = (rec) => {
    const w = window.open('', '_blank', 'width=560,height=800');
    if (!w) return triggerAlert('Popup diblokir browser. Izinkan popup untuk mencetak slip.', 'error');
    const roleLabel = rec.role === 'admin' ? 'Admin Cabang' : (rec.role === 'owner' ? 'Owner' : 'Karyawan');
    w.document.write(buildSlipHtml({ rec, company: licenseInfo?.tenant || 'Toko', profile: coProfile, roleLabel }));
    w.document.close();
  };

  if (blocked) {
    return (
      <div className="max-w-3xl mx-auto w-full pb-24">
        <PageTitle title="Manajemen Penggajian" sub={myBranch?.name || 'Cabang'} />
        <EmptyState mascot="capek" title="Penggajian dimatikan Owner"
          desc="Untuk cabang ini, penggajian masih dikelola langsung oleh Owner pusat. Minta Owner mengaktifkan saklar Manajemen Penggajian pada cabangmu bila sudah dikelola manajer." />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Manajemen Penggajian" sub="Workflow payroll: draft, persetujuan, pembayaran & slip"
        right={<LiveDot live={live} />} />

      {sessionRole !== 'admin' && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[{ cid: 'ALL', name: 'Semua Cabang' }, ...branches].map(b => (
            <button key={b.cid} onClick={() => setSelBranch(b.cid)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-extrabold whitespace-nowrap transition-all border ${selBranch === b.cid ? 'bg-flame-600 text-white border-flame-600 shadow-card' : 'bg-surface dark:bg-surface-dark text-ink-faint border-line dark:border-line-dark hover:border-flame-300'}`}>
              <Cabang className="w-3.5 h-3.5" /> {b.name}
            </button>
          ))}
        </div>
      )}

      <Card title={`Daftar Karyawan${shownBranch ? ' · ' + shownBranch.name : ''}`} icon={Penggajian}>
        {list.length === 0 ? (
          <EmptyState mascot="pikir" title="Belum ada karyawan di cabang ini" desc="Tambahkan karyawan dulu di menu Manajemen Karyawan, lalu buat payrollnya di sini." />
        ) : (
          <div className="space-y-2">
            {list.map(e => {
              const bid = e.branchId || 'PUSAT';
              const last = lastPay(e.cid);
              return (
                <div key={e.cid} className="flex items-center gap-3 p-3 rounded-2xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark">
                  <div className="w-10 h-10 rounded-2xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center font-extrabold shrink-0">{e.name[0]}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv truncate">{e.name} <span className="text-[9.5px] font-mono text-ink-faint">{e.empId || ''}</span></p>
                    {last ? (
                      <p className="text-[10px] font-bold text-leaf-deep dark:text-leaf truncate">
                        Terakhir: {last.period} · {formatIDR(last.amount)} · {fmtDateTime(trustedTime(last).ms)}
                      </p>
                    ) : <p className="text-[10px] font-bold text-ink-faint">Belum ada pembayaran tercatat</p>}
                  </div>
                  <Button onClick={() => openPay(e, bid)} className="py-2.5 px-3.5 text-xs" icon={Plus}>Buat Payroll</Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Riwayat & Status Payroll" icon={Riwayat}
        help="Alur: Draft lalu diajukan Admin, Owner menyetujui, dicatat dibayar, dan selesai. Jika ditolak, payroll kembali untuk revisi lalu diajukan ulang. Semua perubahan tercatat dengan nama pelakunya.">
        {history.length === 0 ? (
          <div className="py-6 text-center">
            <Riwayat className="w-10 h-10 text-ink-faint/40 mx-auto mb-2" />
            <p className="text-xs text-ink-faint font-bold">Belum ada payroll tercatat.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {history.map(h => {
              const t = trustedTime(h);
              const st = h.status || 'DIBAYAR';
              const canEdit = isOwner && (st === 'DRAFT' || st === 'DITOLAK');
              const canSubmit = (st === 'DRAFT' || st === 'DITOLAK') && (isOwner || (sessionRole === 'admin' && h.branchId === sessionBranchId));
              const canReview = isOwner && st === 'DIAJUKAN';
              const canPay = isOwner && st === 'DISETUJUI';
              const canFinish = isOwner && st === 'DIBAYAR';
              return (
                <div key={h.cid} className="p-3.5 rounded-2xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">{h.employeeName} <span className="text-ink-faint font-bold text-[11px]">· {h.branchName}</span></p>
                      <p className="text-[10px] text-ink-faint font-bold">{h.period}{h.note ? ' · ' + h.note : ''}</p>
                      {h.hk != null && (
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          <Badge tone="neutral">HK {h.hk} hari</Badge>
                          {fmtJam(h.jamKerja) !== '0m' && <Badge tone="green">{fmtJam(h.jamKerja)}</Badge>}
                          {h.telat > 0 && <Badge tone="gold">telat {h.telat}x</Badge>}
                          {h.jenisKontrak === 'harian' && h.upahHarian != null && <Badge tone="lime">{formatIDR(h.upahHarian)}/hari × {h.hk}</Badge>}
                        </div>
                      )}
                      <p className="text-[10px] font-bold mt-0.5 flex items-center gap-1 text-ink-faint">
                        <WaktuReal className="w-3 h-3" /> {new Date(t.ms).toLocaleString('id-ID')}
                        {t.source === 'server' && <span className="text-leaf-deep dark:text-leaf">· ✓ realtime server</span>}
                      </p>
                      {st === 'DITOLAK' && h.rejectReason && <p className="text-[10px] font-bold text-brick-deep dark:text-brick mt-1">Alasan tolak: {h.rejectReason}</p>}
                      {/* timeline approval singkat */}
                      {Array.isArray(h.history) && h.history.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {h.history.slice(-3).map((hh, i) => (
                            <p key={i} className="text-[9.5px] font-semibold text-ink-faint">
                              <span className="font-extrabold text-ink-soft dark:text-ink-inv/70">{hh.by}</span> ({hh.role}) → {PAYROLL_FLOW[hh.to]?.label || hh.to} · {new Date(hh.at).toLocaleString('id-ID')}{hh.note ? ` · ${hh.note}` : ''}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <PayStatusBadge status={st} />
                      <p className="font-extrabold money text-flame-700 dark:text-apricot text-sm mt-1.5">{formatIDR(h.amount)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {canEdit && <Button variant="secondary" className="py-2.5 px-3.5 text-xs" onClick={() => startEdit(h)} icon={Edit3}>Revisi</Button>}
                    {canSubmit && <Button className="py-2.5 px-3.5 text-xs" onClick={() => act(h, 'DIAJUKAN', 'Diajukan untuk persetujuan')} icon={Check}>Ajukan</Button>}
                    {canReview && <Button className="py-2.5 px-3.5 text-xs" onClick={() => approve(h)} icon={Check}>Setujui</Button>}
                    {canReview && <Button variant="danger" className="py-2.5 px-3.5 text-xs" onClick={() => { setRejectFor(h); setRejectNote(''); }} icon={BahayaBuddy}>Tolak</Button>}
                    {canPay && <Button className="py-2.5 px-3.5 text-xs" onClick={() => { setPayModal(h); setProof(h.proof || null); }} icon={KoinBuddy}>Tandai Dibayar</Button>}
                    {canFinish && <Button variant="secondary" className="py-2.5 px-3.5 text-xs" onClick={() => { act(h, 'SELESAI', 'Siklus payroll selesai'); triggerAlert('Payroll diselesaikan.', 'success'); }} icon={MedaliBuddy}>Selesaikan</Button>}
                    <button onClick={() => printSlip(h)} className="flex-1 min-w-[130px] py-2.5 rounded-xl bg-flame-600 hover:bg-flame-500 text-white text-[11px] font-extrabold flex items-center justify-center gap-1.5 press"><SlipGaji className="w-4 h-4" /> Cetak Slip Gaji</button>
                    {h.proof && <button onClick={() => setViewProof(h)} className="py-2.5 px-3.5 rounded-xl bg-paper dark:bg-white/5 border border-line dark:border-line-dark text-ink-soft dark:text-ink-inv/70 text-[11px] font-extrabold flex items-center justify-center gap-1.5 press"><BuktiTransfer className="w-4 h-4" /> Bukti</button>}
                    {isOwner && (st === 'DRAFT' || st === 'DITOLAK') && (
                      <button onClick={() => { if (confirm(`Hapus draft payroll ${h.employeeName} periode ${h.period}?`)) { removeRow(h.cid); auditLog(licenseInfo, 'PAYROLL_HAPUS', { target: h.cid, karyawan: h.employeeName }); } }}
                        className="p-2.5 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick hover:bg-brick hover:text-white transition press" aria-label="Hapus draft"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Modal buat / revisi payroll */}
      <Modal open={!!payFor} onClose={() => { setPayFor(null); setEditingId(null); }}
        title={editingId ? 'Revisi Payroll' : 'Buat Payroll'}
        sub={payFor ? `${payFor.name} · ${payFor.branchName}` : ''}>
        {payFor && (
          <div className="space-y-3.5">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-flame-50 dark:bg-flame-900/25">
              <div className="w-10 h-10 rounded-2xl bg-flame-600 text-white flex items-center justify-center font-extrabold">{payFor.name[0]}</div>
              <div><p className="font-extrabold text-sm text-ink dark:text-ink-inv">{payFor.name}</p><p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">{payFor.empId || 'ID belum ada'} · {payFor.branchName} · {payFor.role === 'admin' ? 'Admin Cabang' : (payFor.role === 'owner' ? 'Owner' : 'Kasir')}</p></div>
              <span className="ml-auto shrink-0"><Badge tone={kontrakOf(payFor).payMode === 'harian' ? 'gold' : 'teal'}>{kontrakOf(payFor).short}</Badge></span>
            </div>
            {/* Referensi kehadiran periode ini (dari absensi nyata) */}
            {(() => {
              const pw = periodWork(payFor.cid, payFor.name, form.period);
              return (
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-paper dark:bg-white/[.03] border border-line dark:border-line-dark">
                  <span className="w-9 h-9 rounded-xl bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf flex items-center justify-center shrink-0"><MedaliBuddy className="w-5 h-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="kicker">Rekap absensi periode {form.period}</p>
                    <p className="font-extrabold text-[12.5px] text-ink dark:text-ink-inv mt-0.5">
                      {pw.hk} HK{pw.target > 0 ? <span className="text-ink-faint"> / target {pw.target}</span> : ''} · {fmtJam(pw.totalMin)}{pw.telat > 0 ? ` · telat ${pw.telat}x` : ' · tanpa telat'}
                    </p>
                    <p className="text-[9.5px] font-semibold text-ink-faint mt-0.5">Otomatis ikut tersimpan di payroll & slip sebagai catatan hari kerja.</p>
                  </div>
                </div>
              );
            })()}
            <FieldCard icon={WaktuReal} label="Periode Gaji" desc="Bulan yang dibayarkan">
              <Select value={form.period} options={PERIODE.map(p => p + ' ' + new Date().getFullYear())} onChange={v => { setForm({ ...form, period: v }); recomputeHarian(v); }} />
            </FieldCard>
            {/* Daily worker: total upah = upah harian x hari masuk */}
            {kontrakOf(payFor).payMode === 'harian' && (() => {
              const up = Number(payFor.upahHarian) || 0;
              const pw2 = periodWork(payFor.cid, payFor.name, form.period);
              return (
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-gold-soft dark:bg-gold/10 border border-gold/30">
                  <span className="w-9 h-9 rounded-xl bg-gold text-white flex items-center justify-center shrink-0"><KoinBuddy className="w-5 h-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="kicker">Upah harian</p>
                    <p className="font-extrabold text-[12.5px] text-ink dark:text-ink-inv mt-0.5">{formatIDR(up)} × {pw2.hk} hari masuk = <span className="text-gold-deep dark:text-gold">{formatIDR(up * pw2.hk)}</span></p>
                    <p className="text-[9.5px] font-semibold text-ink-faint mt-0.5">Angka ini otomatis mengisi Gaji Pokok. Ganti periode akan menghitung ulang.</p>
                  </div>
                  <Button variant="secondary" className="py-2 px-3 text-[10px] shrink-0" icon={WaktuReal} onClick={() => recomputeHarian()}>Hitung Ulang</Button>
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-3">
              {[
                { k: 'pokok', label: 'Gaji Pokok', req: true },
                { k: 'tunjangan', label: 'Tunjangan' },
                { k: 'bonus', label: 'Bonus' },
                { k: 'lembur', label: 'Lembur' },
              ].map(f => (
                <NumericInput key={f.k} label={f.label + (f.req ? ' *' : '')} prefix="Rp" placeholder="0"
                  value={comp[f.k]} onChange={v => setComp(c => ({ ...c, [f.k]: v }))} />
              ))}
              <NumericInput label="Potongan" prefix="Rp" placeholder="0"
                value={comp.potongan} onChange={v => setComp(c => ({ ...c, potongan: v }))} />
              <div className="flex flex-col justify-end p-3 rounded-2xl bg-flame-50 dark:bg-flame-900/25 border border-flame-200/60 dark:border-flame-900/60">
                <p className="kicker">Total Diterima</p>
                <p className="text-lg font-extrabold money text-flame-700 dark:text-apricot leading-tight">{formatIDR(compTotal())}</p>
              </div>
            </div>
            <FieldCard icon={StrukCetak} label="Catatan" desc="Opsional, mis. bonus THR atau potongan BPJS">
              <input className="field" placeholder="Catatan payroll..." value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            </FieldCard>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1 py-3.5" onClick={() => savePay(false)} icon={Check}>Simpan Draft</Button>
              <Button className="flex-1 py-3.5" onClick={() => savePay(true)} icon={Check}>Simpan & Ajukan</Button>
            </div>
            {!isOwner && (
              <p className="text-[10px] font-bold text-ink-faint text-center leading-relaxed">
                Sebagai Admin Cabang kamu membuat & mengajukan payroll. Persetujuan akhir oleh Owner lewat approval digital.
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Modal tandai dibayar */}
      <Modal open={!!payModal} onClose={() => { setPayModal(null); setProof(null); }} title="Tandai Dibayar"
        sub={payModal ? `${payModal.employeeName} · ${payModal.period} · ${formatIDR(payModal.amount)}` : ''}
        footer={
          <Button className="w-full py-3.5" onClick={markPaid} icon={Check}>Konfirmasi Sudah Ditransfer</Button>
        }>
        <div className="space-y-3">
          <p className="text-[11.5px] font-semibold text-ink-soft dark:text-ink-inv/75 leading-relaxed">
            Pastikan dana sudah benar-benar terkirim. Waktu pembayaran dikunci pakai waktu server, dan status berubah jadi Dibayar.
          </p>
          {proof ? (
            <div className="relative rounded-xl overflow-hidden border border-line dark:border-line-dark">
              <img src={proof} alt="Bukti transfer" className="w-full h-36 object-cover" />
              <button onClick={() => setProof(null)} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-brick text-white text-xs font-extrabold">✕</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-line dark:border-line-dark rounded-xl cursor-pointer hover:border-flame-400 transition">
              {proofBusy ? <><WaktuReal className="w-6 h-6 text-flame-500 animate-spin" /><p className="text-[10px] font-bold text-ink-faint mt-1.5">Memproses gambar...</p></> : <>
                <BuktiTransfer className="w-8 h-8 text-ink-faint/50 mb-1.5" />
                <p className="text-[11px] font-extrabold text-ink-soft dark:text-ink-inv/70">Lampirkan Bukti Transfer</p>
                <p className="text-[9px] text-ink-faint font-semibold mt-0.5">JPG/PNG, dikompres otomatis</p>
              </>}
              <input type="file" accept="image/*" className="hidden" onChange={e => pickProof(e.target.files[0])} />
            </label>
          )}
        </div>
      </Modal>

      {/* Modal alasan penolakan payroll */}
      <Modal open={!!rejectFor} onClose={() => setRejectFor(null)} title="Tolak Payroll"
        sub={rejectFor ? `${rejectFor.employeeName} · ${rejectFor.period}` : ''}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setRejectFor(null)}>Batal</Button>
            <Button variant="danger" className="flex-1" icon={Check} onClick={doReject}>Tolak & Kirim Revisi</Button>
          </div>
        }>
        <p className="text-[11.5px] font-semibold text-ink-soft dark:text-ink-inv/75 leading-relaxed mb-3">
          Payroll akan kembali ke pembuatnya untuk direvisi lalu diajukan ulang. Catatan ini tercatat di approval record.
        </p>
        <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3}
          className="field resize-none" placeholder="Contoh: nominal lembur cek ulang dulu, baru diajukan lagi." />
      </Modal>

      {/* Modal lihat bukti */}
      <Modal open={!!viewProof} onClose={() => setViewProof(null)} title="Bukti Transfer">
        {viewProof && (
          <div>
            <img src={viewProof.proof} alt="Bukti transfer" className="w-full rounded-2xl border border-line dark:border-line-dark" />
            <p className="text-center text-[11px] font-bold text-ink-faint mt-3">
              {viewProof.employeeName} · {viewProof.period} · {formatIDR(viewProof.amount)}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

/* ============================================================
   MANAJEMEN PERUSAHAAN (v14) — pusat identitas & kebijakan
   perusahaan biar rasa "ekosistem kantor"-nya terasa utuh:
   profil legal, hari kerja & off day, hak cuti tahunan
   (default 12 hari sesuai UU, bisa diatur), dokumen perusahaan
   (kontrak kerja, hak karyawan, kebijakan, dll), dan ringkasan
   status kontrak tim. Data di koleksi pengaturan & dokumen.
   ============================================================ */
const DOK_KATEGORI = ['Kontrak Kerja', 'Hak Karyawan', 'Kebijakan Perusahaan', 'Struktur Organisasi', 'SLA & Formulir', 'Lainnya'];

export const PerusahaanTab = ({ licenseInfo, triggerAlert }) => {
  const { items: settings, live, addRow, updateRow } = useTenantCol(licenseInfo, 'pengaturan', 'pengaturan_db');
  const { items: employees } = useTenantCol(licenseInfo, 'karyawan', 'karyawan_db');
  const { items: pengajuan } = useTenantCol(licenseInfo, 'pengajuan', 'pengajuan_db');
  const { items: dokumen, addRow: addDok, removeRow: removeDok, updateRow: updateDok } = useTenantCol(licenseInfo, 'dokumen', 'dokumen_db');

  const upsertSetting = (key, patch) => {
    const rec = settings.find(s => s.key === key);
    if (rec) updateRow(rec.cid, patch);
    else addRow({ key, ...patch });
  };

  const coRec = settings.find(s => s.key === 'perusahaan') || null;
  const [co, setCo] = useState(null);            // draft profil perusahaan
  const hk = hariKerjaOf(settings);
  const [hariSel, setHariSel] = useState(null);  // draft hari kerja
  const policy = cutiPolicyOf(settings);
  const [cutiDraft, setCutiDraft] = useState(null);

  // --- DOKUMEN PERUSAHAAN ---
  const [dokForm, setDokForm] = useState({ nama: '', kategori: 'Kontrak Kerja', ket: '', share: false, fileData: null, fileName: '', fileType: '', size: 0 });
  const [dokBusy, setDokBusy] = useState(false);
  const [viewDok, setViewDok] = useState(null);

  const resetDok = () => setDokForm({ nama: '', kategori: 'Kontrak Kerja', ket: '', share: false, fileData: null, fileName: '', fileType: '', size: 0 });

  const pickDok = async (file) => {
    if (!file) return;
    const isPdf = file.type === 'application/pdf';
    const isImg = (file.type || '').startsWith('image/');
    if (!isPdf && !isImg) return triggerAlert('Formatnya PNG/JPG atau PDF ya.', 'error');
    if (isPdf && file.size > 600 * 1024) return triggerAlert('PDF maksimal 600KB biar aman tersimpan. Silakan kompres dulu.', 'error');
    setDokBusy(true);
    try {
      const data = isPdf
        ? await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Gagal membaca PDF')); r.readAsDataURL(file); })
        : await fileToDataUrl(file, 1100, 0.72);
      setDokForm(f => ({ ...f, fileData: data, fileName: file.name, fileType: isPdf ? 'application/pdf' : 'image/jpeg', size: Math.round((data.length * 0.75) / 1024) }));
    } catch (e) { triggerAlert('Gagal memuat file: ' + (e.message || 'coba lagi'), 'error'); }
    setDokBusy(false);
  };

  const saveDok = () => {
    if (!dokForm.nama.trim()) return triggerAlert('Beri nama dokumennya dulu, ya.', 'error');
    if (!dokForm.fileData) return triggerAlert('Pilih file dokumennya dulu.', 'error');
    addDok({
      nama: dokForm.nama.trim(), kategori: dokForm.kategori, ket: dokForm.ket.trim(),
      fileData: dokForm.fileData, fileName: dokForm.fileName, fileType: dokForm.fileType, size: dokForm.size,
      share: !!dokForm.share,
      uploadedBy: licenseInfo.employeeName || licenseInfo.tenant || 'Owner', uploadedAt: Date.now()
    });
    auditLog(licenseInfo, 'DOKUMEN_TAMBAH', { nama: dokForm.nama.trim(), kategori: dokForm.kategori, dibagikan: !!dokForm.share });
    resetDok();
    triggerAlert('Dokumen tersimpan di arsip perusahaan.', 'success');
  };

  // ringkasan kontrak tim
  const byKontrak = {
    harian: employees.filter(e => e.jenisKontrak === 'harian'),
    pkwt: employees.filter(e => e.jenisKontrak === 'pkwt'),
    tetap: employees.filter(e => !e.jenisKontrak || e.jenisKontrak === 'tetap'),
  };
  const roleLabel = (r) => r === 'owner' ? 'Owner' : (r === 'admin' ? 'Admin Cabang' : 'Kasir');

  return (
    <div className="max-w-3xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Manajemen Perusahaan" sub="Identitas, kebijakan kerja, hak cuti & arsip dokumen"
        right={<LiveDot live={live} />} />

      {/* PROFIL PERUSAHAAN */}
      <Card title="Profil Perusahaan" icon={Toko}
        help="Nama legal perusahaan, alamat, dan kontak ini otomatis muncul di slip gaji karyawan.">
        {co === null ? (
          <>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {[
                ['Nama Legal', coRec?.nama || licenseInfo?.tenant || '', 'nama'],
                ['Alamat', coRec?.alamat || '', 'alamat'],
                ['Telepon', coRec?.telepon || '', 'telepon'],
                ['Email', coRec?.email || '', 'email'],
              ].map(([label, val, k]) => (
                <div key={k} className={`p-3 rounded-2xl bg-paper dark:bg-white/[.03] border border-line dark:border-line-dark ${k === 'alamat' ? 'sm:col-span-2' : ''}`}>
                  <p className="kicker">{label}</p>
                  <p className="font-extrabold text-[12.5px] text-ink dark:text-ink-inv mt-0.5 break-words">{val || '-'}</p>
                </div>
              ))}
            </div>
            <Button variant="secondary" className="mt-3 py-3 px-4 text-xs" icon={Edit3}
              onClick={() => setCo({ nama: coRec?.nama || licenseInfo?.tenant || '', alamat: coRec?.alamat || '', telepon: coRec?.telepon || '', email: coRec?.email || '' })}>
              {coRec ? 'Ubah Profil' : 'Isi Profil Perusahaan'}
            </Button>
          </>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <FieldCard icon={Toko} label="Nama Legal"><input className="field" value={co.nama} onChange={e => setCo({ ...co, nama: e.target.value })} placeholder="PT Contoh Sukses" /></FieldCard>
              <FieldCard icon={Kredensial} label="Telepon"><input className="field" value={co.telepon} onChange={e => setCo({ ...co, telepon: e.target.value })} placeholder="0812..." /></FieldCard>
              <div className="sm:col-span-2"><FieldCard icon={Lokasi} label="Alamat"><input className="field" value={co.alamat} onChange={e => setCo({ ...co, alamat: e.target.value })} placeholder="Jl. ..." /></FieldCard></div>
              <div className="sm:col-span-2"><FieldCard icon={PerisaiBuddy} label="Email"><input className="field" value={co.email} onChange={e => setCo({ ...co, email: e.target.value })} placeholder="hrd@perusahaan.co.id" /></FieldCard></div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button className="flex-1 py-3" icon={Check} onClick={() => { if (!co.nama.trim()) return triggerAlert('Nama legalnya wajib diisi.', 'error'); upsertSetting('perusahaan', { nama: co.nama.trim(), alamat: co.alamat.trim(), telepon: co.telepon.trim(), email: co.email.trim() }); auditLog(licenseInfo, 'PERUSAHAAN_PROFIL', { nama: co.nama.trim() }); setCo(null); triggerAlert('Profil perusahaan tersimpan.', 'success'); }}>Simpan Profil</Button>
              <Button variant="secondary" className="py-3" onClick={() => setCo(null)}>Batal</Button>
            </div>
          </>
        )}
      </Card>

      {/* HARI KERJA & OFF DAY */}
      <Card title="Hari Kerja & Off Day" icon={WaktuReal}
        help="Hari kerja standar seluruh karyawan & hari liburnya. Shift khusus per cabang tetap diatur di Manajemen Cabang.">
        {hariSel === null ? (
          <>
            <div className="flex gap-1.5 flex-wrap">
              {HARI_MINGGUAN.map(h => {
                const kerja = hk.hari.includes(h.id);
                return (
                  <span key={h.id} className={`px-3 py-1.5 rounded-xl text-[10.5px] font-extrabold border ${kerja ? 'bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf border-leaf/30' : 'bg-brick-soft dark:bg-brick/10 text-brick border-brick/25'}`}>
                    {h.label} {kerja ? '· kerja' : '· off'}
                  </span>
                );
              })}
            </div>
            <p className="text-[10.5px] font-semibold text-ink-faint mt-2.5">
              {hk.hari.length} hari kerja per minggu · off: {hk.off.length ? hariLabelOf(hk.off) : 'tidak ada hari off tetap'}
            </p>
            <Button variant="secondary" className="mt-3 py-3 px-4 text-xs" icon={Edit3} onClick={() => setHariSel({ hari: [...hk.hari], off: [...hk.off] })}>Atur Hari Kerja</Button>
          </>
        ) : (
          <>
            <p className="text-[11px] font-bold text-ink-soft dark:text-ink-inv/70 mb-2">Tap hari untuk menandai hari kerja. Yang tidak dipilih otomatis jadi off day.</p>
            <div className="flex gap-1.5 flex-wrap">
              {HARI_MINGGUAN.map(h => {
                const kerja = hariSel.hari.includes(h.id);
                return (
                  <button key={h.id} type="button"
                    onClick={() => setHariSel(s => {
                      const hari = kerja ? s.hari.filter(x => x !== h.id) : [...s.hari, h.id];
                      return { hari, off: HARI_MINGGUAN.map(x => x.id).filter(x => !hari.includes(x)) };
                    })}
                    className={`px-3.5 py-2 rounded-xl text-[11px] font-extrabold border-2 transition press ${kerja ? 'bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf border-leaf/40' : 'bg-paper dark:bg-white/5 text-ink-faint border-line dark:border-line-dark'}`}>
                    {h.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-3">
              <Button className="flex-1 py-3" icon={Check} onClick={() => { if (!hariSel.hari.length) return triggerAlert('Minimal satu hari kerja, ya.', 'error'); upsertSetting('hari_kerja', { hari: hariSel.hari, off: hariSel.off }); auditLog(licenseInfo, 'PERUSAHAAN_HARI_KERJA', { hari: hariSel.hari.join(','), off: hariSel.off.join(',') }); setHariSel(null); triggerAlert('Hari kerja perusahaan tersimpan.', 'success'); }}>Simpan</Button>
              <Button variant="secondary" className="py-3" onClick={() => setHariSel(null)}>Batal</Button>
            </div>
          </>
        )}
      </Card>

      {/* HAK CUTI TAHUNAN */}
      <Card title="Hak Cuti Tahunan" icon={MedaliBuddy}
        help="Standar UU Ketenagakerjaan: minimal 12 hari cuti per tahun setelah 12 bulan bekerja. Angka ini berlaku untuk seluruh karyawan; karyawan tertentu bisa dibedakan lewat Hak Cuti Khusus di Manajemen Karyawan.">
        {cutiDraft === null ? (
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-teal2-soft dark:bg-teal2/15 text-teal2 flex items-center justify-center shrink-0"><MedaliBuddy className="w-5.5 h-5.5" /></span>
            <div className="flex-1">
              <p className="font-extrabold text-[15px] text-ink dark:text-ink-inv">{policy.hakTahunan} hari / tahun</p>
              <p className="text-[10px] font-semibold text-ink-faint">Hak cuti bawaan untuk semua karyawan · sakit & izin tidak memotong kuota ini</p>
            </div>
            <Button variant="secondary" className="py-2.5 px-3.5 text-xs" icon={Edit3} onClick={() => setCutiDraft(policy.hakTahunan)}>Atur</Button>
          </div>
        ) : (
          <>
            <StepField label="Hak Cuti Tahunan" unit="hari/tahun" value={cutiDraft} onChange={setCutiDraft} min={1} max={365} step={1}
              hint="Rekomendasi: 12 hari (sesuai UU). Bisa lebih sesuai kebijakan perusahaan" />
            <div className="flex gap-2 mt-3">
              <Button className="flex-1 py-3" icon={Check} onClick={() => { upsertSetting('cuti_policy', { hakTahunan: cutiDraft }); auditLog(licenseInfo, 'PERUSAHAAN_CUTI_POLICY', { hakTahunan: cutiDraft }); setCutiDraft(null); triggerAlert('Hak cuti tahunan tersimpan.', 'success'); }}>Simpan</Button>
              <Button variant="secondary" className="py-3" onClick={() => setCutiDraft(null)}>Batal</Button>
            </div>
          </>
        )}
      </Card>

      {/* DOKUMEN PERUSAHAAN */}
      <Card title="Dokumen Perusahaan" icon={Kredensial}
        help="Arsip kontrak kerja, hak-hak karyawan, kebijakan, dan dokumen penting lainnya. Dokumen yang dibagikan otomatis muncul di tab Profil Aplikasi Karyawan.">
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <FieldCard icon={Kredensial} label="Nama Dokumen">
              <input className="field" placeholder="Contoh: Kontrak Kerja 2026" value={dokForm.nama} onChange={e => setDokForm(f => ({ ...f, nama: e.target.value }))} />
            </FieldCard>
            <FieldCard icon={Toko} label="Kategori">
              <Select value={dokForm.kategori} options={DOK_KATEGORI} onChange={v => setDokForm(f => ({ ...f, kategori: v }))} />
            </FieldCard>
          </div>
          <FieldCard icon={Edit3} label="Keterangan (opsional)">
            <input className="field" placeholder="Contoh: kontrak tahunan seluruh karyawan tetap" value={dokForm.ket} onChange={e => setDokForm(f => ({ ...f, ket: e.target.value }))} />
          </FieldCard>
          {dokForm.fileData ? (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-paper dark:bg-white/[.03] border border-line dark:border-line-dark">
              {dokForm.fileType === 'application/pdf'
                ? <span className="w-10 h-10 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick flex items-center justify-center font-extrabold text-[9px]">PDF</span>
                : <img src={dokForm.fileData} alt="Pratinjau dokumen" className="w-10 h-10 rounded-xl object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-extrabold text-ink dark:text-ink-inv truncate">{dokForm.fileName}</p>
                <p className="text-[9.5px] font-bold text-ink-faint">{dokForm.size} KB · siap disimpan</p>
              </div>
              <button onClick={() => setDokForm(f => ({ ...f, fileData: null }))} className="w-8 h-8 rounded-full bg-brick-soft dark:bg-brick/10 text-brick font-extrabold shrink-0">✕</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center py-5 border-2 border-dashed border-line dark:border-line-dark rounded-2xl cursor-pointer hover:border-flame-400 transition">
              {dokBusy ? <><WaktuReal className="w-6 h-6 text-flame-500 animate-spin" /><p className="text-[10px] font-bold text-ink-faint mt-1.5">Memproses file...</p></> : <>
                <BuktiTransfer className="w-7 h-7 text-ink-faint/50 mb-1.5" />
                <p className="text-[11px] font-extrabold text-ink-soft dark:text-ink-inv/70">Pilih File Dokumen</p>
                <p className="text-[9px] text-ink-faint font-semibold mt-0.5">PNG/JPG (dikompres otomatis) atau PDF maks 600KB</p>
              </>}
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => pickDok(e.target.files[0])} />
            </label>
          )}
          <div className="flex items-center justify-between gap-3 bg-paper dark:bg-white/[.03] border border-line dark:border-line-dark rounded-2xl p-3.5">
            <div>
              <p className="font-extrabold text-[12.5px] text-ink dark:text-ink-inv">Bagikan ke Seluruh Karyawan</p>
              <p className="text-[10px] text-ink-faint font-semibold">Dokumen ini tampil di tab Profil Aplikasi Karyawan</p>
            </div>
            <Toggle on={dokForm.share} onClick={() => setDokForm(f => ({ ...f, share: !f.share }))} />
          </div>
          <Button onClick={saveDok} className="w-full py-3.5" icon={Plus}>Simpan ke Arsip Perusahaan</Button>
        </div>

        {/* daftar dokumen */}
        <div className="mt-4 space-y-2">
          <p className="kicker">Arsip ({dokumen.length} dokumen)</p>
          {dokumen.length === 0 ? (
            <p className="text-[11px] font-bold text-ink-faint text-center py-4">Belum ada dokumen. Mulai dari kontrak kerja atau surat hak karyawan.</p>
          ) : [...dokumen].sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0)).map(d => (
            <div key={d.cid} className="flex items-center gap-3 p-3 rounded-2xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark">
              {d.fileType === 'application/pdf'
                ? <span className="w-10 h-10 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick flex items-center justify-center font-extrabold text-[9px] shrink-0">PDF</span>
                : d.fileData ? <img src={d.fileData} alt={d.nama} className="w-10 h-10 rounded-xl object-cover shrink-0" /> : null}
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-[12.5px] text-ink dark:text-ink-inv truncate">{d.nama}</p>
                <p className="text-[9.5px] font-bold text-ink-faint">{d.kategori} · {d.size} KB · {d.uploadedBy || '-'}{d.share ? ' · dibagikan' : ''}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setViewDok(d)} className="p-2 rounded-xl bg-flame-50 dark:bg-flame-900/30 text-flame-700 dark:text-apricot press" aria-label="Lihat dokumen"><Kredensial className="w-4 h-4" /></button>
                <button onClick={() => updateDok(d.cid, { share: !d.share })} className={`p-2 rounded-xl press ${d.share ? 'bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf' : 'bg-paper dark:bg-white/5 text-ink-faint'}`} aria-label="Bagikan dokumen"><Tim className="w-4 h-4" /></button>
                <button onClick={() => { if (confirm(`Hapus dokumen "${d.nama}" dari arsip?`)) { removeDok(d.cid); auditLog(licenseInfo, 'DOKUMEN_HAPUS', { nama: d.nama }); } }} className="p-2 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick press" aria-label="Hapus dokumen"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* STATUS KONTRAK TIM */}
      <Card title="Status Kontrak Tim" icon={Tim}
        help="Ringkasan cara gaji tiap karyawan. Daily worker dihitung per hari masuk; PKWT & tetap pakai gaji tetap. Ubah statusnya di Manajemen Karyawan.">
        <div className="grid grid-cols-3 gap-2.5 mb-3">
          {[
            { k: 'harian', label: 'Daily Worker', tone: 'bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold' },
            { k: 'pkwt', label: 'PKWT', tone: 'bg-teal2-soft dark:bg-teal2/15 text-teal2' },
            { k: 'tetap', label: 'Tetap', tone: 'bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf' },
          ].map(x => (
            <div key={x.k} className={`p-3.5 rounded-2xl ${x.tone}`}>
              <p className="text-2xl font-extrabold money leading-none">{byKontrak[x.k].length}</p>
              <p className="kicker mt-1.5">{x.label}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {employees.length === 0 ? (
            <p className="text-[11px] font-bold text-ink-faint text-center py-4">Belum ada karyawan terdaftar.</p>
          ) : [...employees].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(e => (
            <div key={e.cid} className="flex items-center gap-3 p-3 rounded-2xl bg-paper dark:bg-white/[.03]">
              <div className="w-9 h-9 rounded-xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center font-extrabold text-xs shrink-0">{e.name?.[0]}</div>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-[12.5px] text-ink dark:text-ink-inv truncate">{e.name} <span className="text-[9px] font-mono text-ink-faint">{e.empId || ''}</span></p>
                <p className="text-[9.5px] font-bold text-ink-faint">{roleLabel(e.role)} · cuti {hakCutiOf(policy, e)} hari/tahun{Number(e.hakCuti) > 0 ? ' (khusus)' : ''}</p>
              </div>
              <div className="text-right shrink-0">
                <Badge tone={e.jenisKontrak === 'harian' ? 'gold' : 'teal'}>{kontrakOf(e).short}</Badge>
                <p className="text-[9.5px] font-extrabold text-ink-faint mt-1">
                  {e.jenisKontrak === 'harian' && e.upahHarian ? `${formatIDR(e.upahHarian)}/hari` : (e.gajiPokok ? `${formatIDR(e.gajiPokok)}/periode` : 'belum diisi')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* MODAL LIHAT DOKUMEN */}
      <Modal open={!!viewDok} onClose={() => setViewDok(null)} title={viewDok?.nama || 'Dokumen'} sub={viewDok ? `${viewDok.kategori} · ${viewDok.size} KB` : ''}>
        {viewDok && (
          <div className="space-y-3">
            {viewDok.fileType === 'application/pdf' ? (
              <a href={viewDok.fileData} target="_blank" rel="noreferrer" className="block w-full py-3.5 rounded-xl bg-flame-600 text-white text-center text-xs font-extrabold press">Buka PDF di Tab Baru</a>
            ) : (
              <img src={viewDok.fileData} alt={viewDok.nama} className="w-full rounded-2xl border border-line dark:border-line-dark" />
            )}
            {viewDok.ket && <p className="text-[11px] font-semibold text-ink-soft dark:text-ink-inv/70">{viewDok.ket}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
};
