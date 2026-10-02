// ============================================================
// WELP BUSINESS — CUSTOMER / CRM v20
// ------------------------------------------------------------
// Database pelanggan terpusat per tenant:
//   { cid, name, phone, email, address, birthday, note, tags[],
//     createdAt, serverAt }
// Statistik belanja REAL dihitung dari pos_history (transaksi kasir
// nyata) dengan pencocokan nama pembeli — tanpa data dummy.
// CRUD dijaga permission granular (crm.view/create/edit/delete).
// ============================================================
import React, { useState, useMemo } from 'react';
import {
  Users, Plus, Edit3, Trash2, Search, Check, Lokasi, KoinBuddy,
  Riwayat, StrukCetak, PerisaiBuddy,
} from '../welp-icons.jsx';
import {
  formatIDR, useTenantCol, trustedTime, auditLog, dateKeyOf,
} from '../core.jsx';
import { canDo } from '../welp-core/rbac.js';
import { Button, Card, PageTitle, Badge, EmptyState, Modal, ConfirmDialog, Select } from '../ui';

const fmtDT = (ms) => new Date(ms).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const CustomersTab = ({ licenseInfo, triggerAlert, perms }) => {
  const { items: customers, live, addRow, updateRow, removeRow } = useTenantCol(licenseInfo, 'customers', 'customers_db');
  // Transaksi nyata dari POS (sumber data core — bukan duplikat).
  const { items: history } = useTenantCol(licenseInfo, 'pos_history', 'pos_history_db');

  const [q, setQ] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', birthday: '', note: '', tags: '' });

  const canCreate = canDo(perms, 'crm.create');
  const canEdit = canDo(perms, 'crm.edit');
  const canDelete = canDo(perms, 'crm.delete');

  /* Peta belanja per nama pembeli (case-insensitive, trim).
     pos_history item: { buyer, total, date, items?... } */
  const spendByName = useMemo(() => {
    const map = new Map();
    (history || []).forEach(o => {
      const name = String(o.buyer || o.buyerName || '').trim().toLowerCase();
      if (!name || name === 'umum') return;
      const total = Number(o.total || 0);
      const cur = map.get(name) || { count: 0, total: 0, last: 0 };
      cur.count += 1;
      cur.total += total;
      const t = o.date ? new Date(o.date).getTime() : (trustedTime(o).ms || 0);
      if (t > cur.last) cur.last = t;
      map.set(name, cur);
    });
    return map;
  }, [history]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (customers || [])
      .filter(c => !needle ||
        String(c.name || '').toLowerCase().includes(needle) ||
        String(c.phone || '').includes(needle) ||
        String(c.email || '').toLowerCase().includes(needle))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'id'));
  }, [customers, q]);

  const statsOf = (c) => spendByName.get(String(c.name || '').trim().toLowerCase()) || { count: 0, total: 0, last: 0 };

  const openCreate = () => { setEditing(null); setForm({ name: '', phone: '', email: '', address: '', birthday: '', note: '', tags: '' }); setOpenForm(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name || '', phone: c.phone || '', email: c.email || '', address: c.address || '', birthday: c.birthday || '', note: c.note || '', tags: Array.isArray(c.tags) ? c.tags.join(', ') : (c.tags || '') });
    setOpenForm(true);
  };

  const save = () => {
    if (!form.name.trim()) return triggerAlert('Nama pelanggan wajib diisi.', 'error');
    if (form.phone && !/^[0-9+()\-\s]{6,20}$/.test(form.phone.trim())) return triggerAlert('Nomor telepon tidak valid.', 'error');
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      birthday: form.birthday || null,
      note: form.note.trim() || null,
      tags: form.tags ? form.tags.split(',').map(x => x.trim()).filter(Boolean).slice(0, 6) : [],
    };
    if (editing) {
      updateRow(editing.cid, payload);
      auditLog(licenseInfo, 'CUSTOMER_UPDATE', { target: editing.cid, nama: payload.name });
      triggerAlert('Data pelanggan diperbarui.', 'success');
    } else {
      addRow({ ...payload, createdAt: Date.now() });
      auditLog(licenseInfo, 'CUSTOMER_CREATE', { nama: payload.name });
      triggerAlert(`Pelanggan "${payload.name}" ditambahkan.`, 'success');
    }
    setOpenForm(false); setEditing(null);
  };

  const doDelete = () => {
    if (!confirmDel) return;
    removeRow(confirmDel.cid);
    auditLog(licenseInfo, 'CUSTOMER_DELETE', { nama: confirmDel.name });
    triggerAlert('Pelanggan dihapus.', 'success');
    setConfirmDel(null);
  };

  const totalCust = (customers || []).length;
  const withSpend = (customers || []).filter(c => statsOf(c).count > 0).length;
  const revenueLinked = (customers || []).reduce((a, c) => a + statsOf(c).total, 0);

  return (
    <div className="max-w-4xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Customer (CRM)" sub="Database pelanggan & riwayat belanja dari transaksi kasir nyata"
        right={<span className="text-[9px] font-extrabold uppercase tracking-widest text-ink-faint">{totalCust} pelanggan</span>} />

      {/* Ringkasan */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card !rounded-3xl p-4">
          <Users className="w-5 h-5 text-flame-700 dark:text-apricot mb-2" />
          <p className="text-2xl font-extrabold text-ink dark:text-ink-inv money leading-none">{totalCust}</p>
          <p className="kicker mt-1.5">Pelanggan terdaftar</p>
        </div>
        <div className="card !rounded-3xl p-4">
          <Riwayat className="w-5 h-5 text-leaf-deep dark:text-leaf mb-2" />
          <p className="text-2xl font-extrabold text-ink dark:text-ink-inv money leading-none">{withSpend}</p>
          <p className="kicker mt-1.5">Pernah bertransaksi</p>
        </div>
        <div className="card !rounded-3xl p-4">
          <KoinBuddy className="w-5 h-5 text-gold-deep dark:text-gold mb-2" />
          <p className="text-2xl font-extrabold text-ink dark:text-ink-inv money leading-none">{formatIDR(revenueLinked)}</p>
          <p className="kicker mt-1.5">Belanja tercatat</p>
        </div>
      </div>

      {/* Search + add */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
          <input value={q} onChange={e => setQ(e.target.value)} className="field !pl-10" placeholder="Cari nama / telepon / email..." />
        </div>
        {canCreate && <Button onClick={openCreate} icon={Plus} className="shrink-0">Tambah Pelanggan</Button>}
      </div>

      {/* Daftar */}
      <div className="space-y-2.5">
        {list.length === 0 ? (
          <EmptyState mascot="menyapa" icon={Users}
            title={q ? 'Tidak ada yang cocok' : 'Belum ada pelanggan terdaftar'}
            desc={q ? 'Coba kata kunci lain.' : 'Tambahkan pelanggan langganan supaya riwayat & total belanjanya terpantau dari transaksi kasir nyata.'} />
        ) : list.map(c => {
          const st = statsOf(c);
          return (
            <div key={c.cid} className="card p-4.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-extrabold text-[14px] text-ink dark:text-ink-inv truncate">{c.name}</p>
                    {(c.tags || []).map(tag => <Badge key={tag} tone="lime">{tag}</Badge>)}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {c.phone && <p className="text-[10.5px] font-bold text-ink-faint">{c.phone}</p>}
                    {c.email && <p className="text-[10.5px] font-bold text-ink-faint truncate">{c.email}</p>}
                    {c.address && <p className="text-[10.5px] font-semibold text-ink-faint truncate flex items-center gap-1"><Lokasi className="w-3 h-3 shrink-0" />{c.address}</p>}
                  </div>
                  <div className="flex items-center gap-3 mt-2.5">
                    <span className="text-[10.5px] font-extrabold text-leaf-deep dark:text-leaf">{st.count}x transaksi</span>
                    <span className="text-[10.5px] font-extrabold money text-ink-soft dark:text-ink-inv/70">{formatIDR(st.total)}</span>
                    {st.last > 0 && <span className="text-[9.5px] font-bold text-ink-faint">terakhir {fmtDT(st.last)}</span>}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => setDetail(c)} className="p-2 rounded-xl bg-flame-50 dark:bg-flame-900/30 text-flame-700 dark:text-apricot press" aria-label="Detail"><StrukCetak className="w-4 h-4" /></button>
                  {canEdit && <button onClick={() => openEdit(c)} className="p-2 rounded-xl bg-paper dark:bg-white/5 text-ink-soft dark:text-ink-inv/70 press" aria-label="Edit"><Edit3 className="w-4 h-4" /></button>}
                  {canDelete && <button onClick={() => setConfirmDel(c)} className="p-2 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick press" aria-label="Hapus"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL form */}
      <Modal open={openForm} onClose={() => setOpenForm(false)}
        title={editing ? 'Edit Pelanggan' : 'Tambah Pelanggan'} width="max-w-md"
        footer={<>
          <Button variant="secondary" onClick={() => setOpenForm(false)}>Batal</Button>
          <Button onClick={save} icon={Check}>Simpan</Button>
        </>}>
        <div className="space-y-3.5">
          <div>
            <label className="kicker block mb-1.5 ml-0.5">Nama *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="field" placeholder="misal: Bu Sari" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="kicker block mb-1.5 ml-0.5">Telepon / WA</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="field font-mono" placeholder="08…" inputMode="tel" />
            </div>
            <div>
              <label className="kicker block mb-1.5 ml-0.5">Ulang Tahun</label>
              <input type="date" value={form.birthday} onChange={e => setForm({ ...form, birthday: e.target.value })} className="field" />
            </div>
          </div>
          <div>
            <label className="kicker block mb-1.5 ml-0.5">Email</label>
            <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="field" placeholder="opsional" inputMode="email" />
          </div>
          <div>
            <label className="kicker block mb-1.5 ml-0.5">Alamat</label>
            <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="field" placeholder="opsional" />
          </div>
          <div>
            <label className="kicker block mb-1.5 ml-0.5">Tag (pisah koma)</label>
            <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className="field" placeholder="misal: langganan, grosir" />
          </div>
          <div>
            <label className="kicker block mb-1.5 ml-0.5">Catatan</label>
            <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} className="field resize-none" placeholder="preferensi pelanggan, dll." />
          </div>
        </div>
      </Modal>

      {/* MODAL detail + riwayat */}
      <Modal open={!!detail} onClose={() => setDetail(null)}
        title={detail?.name || 'Detail'} sub="Riwayat belanja dari transaksi kasir" width="max-w-md">
        {detail && (() => {
          const needle = String(detail.name || '').trim().toLowerCase();
          const orders = (history || [])
            .filter(o => String(o.buyer || o.buyerName || '').trim().toLowerCase() === needle)
            .sort((a, b) => trustedTime(b).ms - trustedTime(a).ms)
            .slice(0, 12);
          const st = statsOf(detail);
          return (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-paper dark:bg-white/[.03]">
                  <p className="kicker">Total belanja</p>
                  <p className="font-extrabold money text-[15px] text-ink dark:text-ink-inv mt-1">{formatIDR(st.total)}</p>
                </div>
                <div className="p-3 rounded-2xl bg-paper dark:bg-white/[.03]">
                  <p className="kicker">Jumlah transaksi</p>
                  <p className="font-extrabold money text-[15px] text-ink dark:text-ink-inv mt-1">{st.count}x</p>
                </div>
              </div>
              {orders.length === 0 ? (
                <p className="text-[11px] font-bold text-ink-faint text-center py-4">Belum ada transaksi kasir yang tercatat atas nama ini. Pastikan kasir mengisi nama pembeli saat checkout.</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                  {orders.map(o => (
                    <div key={o.cid} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-paper dark:bg-white/[.03]">
                      <div className="min-w-0">
                        <p className="text-[11px] font-extrabold text-ink dark:text-ink-inv">{dateKeyOf(new Date(o.date).getTime() || trustedTime(o).ms)}</p>
                        <p className="text-[9px] font-bold text-ink-faint">{o.paymentMethod || '-'}{(o.items || []).length ? ` · ${(o.items || []).length} item` : ''}</p>
                      </div>
                      <p className="text-[11.5px] font-extrabold money text-ink-soft dark:text-ink-inv/80 shrink-0">{formatIDR(o.total)}</p>
                    </div>
                  ))}
                </div>
              )}
              {detail.note && <p className="text-[10.5px] font-semibold text-ink-faint leading-relaxed">Catatan: {detail.note}</p>}
            </div>
          );
        })()}
      </Modal>

      <ConfirmDialog open={!!confirmDel} danger title={`Hapus pelanggan "${confirmDel?.name}"?`}
        message="Data pelanggan dihapus dari CRM. Riwayat transaksi kasir tidak terpengaruh."
        onConfirm={doDelete} onCancel={() => setConfirmDel(null)} />
    </div>
  );
};
