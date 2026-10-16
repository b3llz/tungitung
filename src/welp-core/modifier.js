// ============================================================
// WELP CORE — MODIFIER ENGINE v21.1
// ------------------------------------------------------------
// Model produk dua mode (spesifikasi v21 #7):
//   • QUICK PRODUCT      → TAP → langsung masuk cart
//   • CONFIGURABLE       → TAP → Modifier Sheet → Cart
//
// Modifier Group mendukung (spesifikasi #8):
//   name, active, required, multi, min, max,
//   options[{ name, priceDelta, active, isDefault }], sortOrder
//
// ATURAN:
//   • TIDAK membuat SKU baru per kombinasi — line item menyimpan
//     modifiers[] di dalam cart/order/transaction/receipt.
//   • Harga line akhir = base price + Σ priceDelta.
//   • PURE FUNCTION — tanpa React, tanpa Firestore.
//   • Kompatibel mundur: produk tanpa mode/modifier = QUICK.
// ============================================================

// ------------------------------------------------------------
// 1. NORMALISASI GRUP MODIFIER (dari Firestore / mirror)
// ------------------------------------------------------------
export const normModifierGroups = (rows) => (Array.isArray(rows) ? rows : [])
  .filter(g => g && String(g.name || '').trim())
  .map((g, gi) => ({
    id: g.id || g.cid || `mgrp_${gi}`,
    name: String(g.name).trim(),
    active: g.active !== false,
    required: !!g.required,
    multi: !!g.multi,
    min: Math.max(0, Number(g.min) || 0),
    max: Math.max(0, Number(g.max) || 0),   // 0 = tanpa batas (multi)
    sortOrder: Number.isFinite(Number(g.sortOrder)) ? Number(g.sortOrder) : gi,
    options: (Array.isArray(g.options) ? g.options : [])
      .filter(o => o && String(o.name || '').trim())
      .map((o, oi) => ({
        id: o.id || `opt_${gi}_${oi}`,
        name: String(o.name).trim(),
        priceDelta: Math.round(Number(o.priceDelta) || 0),
        active: o.active !== false,
        isDefault: !!o.isDefault,
        sortOrder: Number.isFinite(Number(o.sortOrder)) ? Number(o.sortOrder) : oi,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }))
  .sort((a, b) => a.sortOrder - b.sortOrder);

// ------------------------------------------------------------
// 2. PRODUK → MODE & GRUP AKTIF
// ------------------------------------------------------------
export const productMode = (p) =>
  p && p.mode === 'configurable' ? 'configurable' : 'quick';

// Grup modifier AKTIF yang terpasang di produk (urut sortOrder).
export const activeGroupsForProduct = (product, groups) => {
  const ids = Array.isArray(product?.modifierGroupIds) ? product.modifierGroupIds : [];
  const all = normModifierGroups(groups).filter(g => g.active && g.options.length > 0);
  const picked = ids.map(id => all.find(g => g.id === id)).filter(Boolean);
  return picked;
};

// Produk butuh sheet modifier sebelum masuk cart?
export const needsModifierSheet = (product, groups) =>
  productMode(product) === 'configurable' && activeGroupsForProduct(product, groups).length > 0;

// ------------------------------------------------------------
// 3. SELEKSI — bentuk kanonik: { [groupId]: optionId | optionId[] }
// ------------------------------------------------------------
// Pra-isi opsi default (spec: default option). Grup required tanpa
// default dibiarkan kosong agar kasir memilih sadar.
export const defaultSelection = (groups) => {
  const sel = {};
  (groups || []).forEach(g => {
    const def = g.options.filter(o => o.active && o.isDefault);
    if (!def.length) return;
    if (g.multi) sel[g.id] = def.map(o => o.id);
    else if (def[0]) sel[g.id] = def[0].id;
  });
  return sel;
};

export const selectedOptionIds = (sel, groupId) => {
  const v = sel?.[groupId];
  if (v == null || v === '') return [];
  return Array.isArray(v) ? v : [v];
};

// Validasi terhadap aturan grup: required / min / max / multi.
// Return { ok, errors: [{groupId, msg}] } — pesan siap tampil di sheet.
export const validateSelection = (groups, sel) => {
  const errors = [];
  (groups || []).forEach(g => {
    const chosen = selectedOptionIds(sel, g.id).filter(id => g.options.some(o => o.id === id && o.active));
    if (!g.multi && chosen.length > 1) {
      errors.push({ groupId: g.id, msg: `${g.name} hanya boleh satu pilihan.` });
      return;
    }
    if (g.required && chosen.length === 0) {
      errors.push({ groupId: g.id, msg: `${g.name} wajib dipilih.` });
      return;
    }
    if (g.min > 0 && chosen.length < g.min) {
      errors.push({ groupId: g.id, msg: `${g.name}: pilih minimal ${g.min}.` });
      return;
    }
    if (g.max > 0 && chosen.length > g.max) {
      errors.push({ groupId: g.id, msg: `${g.name}: maksimal ${g.max} pilihan.` });
    }
  });
  return { ok: errors.length === 0, errors };
};

// ------------------------------------------------------------
// 4. HARGA & LINE ITEM
// ------------------------------------------------------------
// unit price final = (base price — sudah termasuk tier) + Σ priceDelta
export const lineUnitPrice = (basePrice, groups, sel) => {
  let price = Math.round(Number(basePrice) || 0);
  (groups || []).forEach(g => {
    selectedOptionIds(sel, g.id).forEach(optId => {
      const opt = g.options.find(o => o.id === optId);
      if (opt) price += opt.priceDelta;
    });
  });
  return Math.max(0, price);
};

// Payload modifiers[] yang tersimpan di cart/order/transaction/receipt
// (spesifikasi: groupId, groupName, optionId, optionName, priceDelta).
export const lineModifiersPayload = (groups, sel) => {
  const out = [];
  (groups || []).forEach(g => {
    selectedOptionIds(sel, g.id).forEach(optId => {
      const opt = g.options.find(o => o.id === optId);
      if (!opt) return;
      out.push({
        groupId: g.id, groupName: g.name,
        optionId: opt.id, optionName: opt.name,
        priceDelta: opt.priceDelta,
      });
    });
  });
  return out;
};

// Kunci keranjang: baris yang PERSIS sama (produk + tier + modifier)
// digabung qty-nya; kombinasi berbeda = baris berbeda.
export const cartLineKey = (productId, tier, modifiersPayload) =>
  `${productId}::${tier || 'retail'}::` +
  (modifiersPayload || []).map(m => m.optionId).sort().join(',');

// Ringkasan modifier utk struk/riwayat: "Level: Pedas · Bumbu: BBQ (+2000)"
export const modifiersLabel = (modifiers) =>
  (modifiers || [])
    .map(m => `${m.optionName}${m.priceDelta ? ` (+${m.priceDelta})` : ''}`)
    .join(' · ');

export const modifiersLabelByGroup = (modifiers) => {
  const byGroup = {};
  (modifiers || []).forEach(m => {
    if (!byGroup[m.groupName]) byGroup[m.groupName] = [];
    byGroup[m.groupName].push(m.optionName + (m.priceDelta ? ` (+${m.priceDelta})` : ''));
  });
  return Object.entries(byGroup).map(([g, opts]) => `${g}: ${opts.join(', ')}`);
};
