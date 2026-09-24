// ============================================================
// UI PRIMITIVES — WELP Design System v6 "Fresh Ink"
// Komponen dasar: netral & bersih, orange hanya sebagai aksen.
// Brand (logo/lockup/maskot) diambil SATU PINTU dari brand.jsx
// agar tidak ada logo manual yang berbeda-beda antar halaman.
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, HelpCircle, AlertCircle, Check } from './welp-icons.jsx';
import { BrandLogo, BrandLockup, Mascot, AppSymbol } from './brand.jsx';
import Cropper from "react-easy-crop";
import { formatNumberDisplay, parseNumberID } from './core.jsx';

/* Brand dibuka kembali dari sini supaya pemanggil lama yang
   mengimpor dari './ui' tetap satu sumber (brand.jsx). */
export { BrandLogo, BrandLockup, Mascot, AppSymbol };

/* ---------- TOAST ----------
   Posisi responsif agar tidak menutupi navigasi & aksi utama:
   • Mobile   : tengah-bawah, DI ATAS bottom nav & bar keranjang.
   • Tablet/PC: kanan-atas, di luar jalur kerja utama. */
export const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return createPortal(
    <div className="fixed z-[9999] left-1/2 -translate-x-1/2 bottom-[6.2rem] sm:left-auto sm:right-5 sm:top-5 sm:bottom-auto sm:translate-x-0 max-w-[calc(100vw-2rem)] sm:max-w-sm animate-slide-up">
      <div className={`flex items-center gap-3 pl-3 pr-5 py-3 rounded-2xl shadow-pop border ${
        type === 'error'
          ? 'bg-brick-deep border-brick/40 text-white'
          : 'bg-chrome-deep border-chrome-edge text-ink-inv'
      }`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          type === 'error' ? 'bg-white/15' : 'bg-flame-500 text-white'
        }`}>
          {type === 'error' ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">{type === 'error' ? 'Ups, tunggu' : 'Siap!'}</p>
          <p className="text-xs font-bold leading-snug break-words">{message}</p>
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ---------- BUTTON ---------- */
export const Button = ({ children, onClick, variant = 'primary', className = "", icon: Icon, disabled }) => {
  const styles = {
    primary: "bg-flame-600 hover:bg-flame-500 text-white shadow-card",
    bright: "bg-flame-500 hover:bg-flame-400 text-flame-950",
    secondary: "bg-surface dark:bg-surface-dark border-2 border-line dark:border-line-dark text-ink-soft dark:text-ink-inv/80 hover:border-flame-300 dark:hover:border-flame-600",
    ghost: "bg-transparent text-ink-soft dark:text-ink-inv/70 hover:bg-paper dark:hover:bg-white/5",
    outline: "border-2 border-dashed border-line dark:border-line-dark text-ink-faint hover:border-flame-400 hover:text-flame-700 dark:hover:text-apricot",
    danger: "bg-brick-soft dark:bg-brick/10 border-2 border-brick/30 text-brick-deep dark:text-brick hover:bg-brick hover:text-white hover:border-brick",
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl font-extrabold text-xs transition-all active:scale-[.98] press disabled:opacity-50 disabled:pointer-events-none ${styles[variant]} ${className}`}>
      {Icon && <Icon className="w-4 h-4" />} {children}
    </button>
  );
};

/* ---------- CARD ---------- */
// v15 F4-H1: HelpBox dikeluarkan dari h3.truncate — judul panjang
// tidak lagi memotong ikon tanda tanya (akar bug ikon hilang di 320px).
export const Card = ({ children, className = "", title, icon: Icon, action, help, flush }) => (
  <section className={`card ${className}`}>
    {(title || action) && (
      <header className="flex justify-between items-center gap-3 px-5 py-3.5 border-b border-line/70 dark:border-line-dark/70">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && <Icon className="w-5 h-5 text-flame-500 dark:text-apricot shrink-0" />}
          <h3 className="font-extrabold text-[14px] text-ink dark:text-ink-inv truncate min-w-0">{title}</h3>
          {help && <span className="shrink-0 inline-flex"><HelpBox text={help} /></span>}
        </div>
        {action}
      </header>
    )}
    <div className={flush ? '' : 'p-5'}>{children}</div>
  </section>
);

/* ---------- PAGE TITLE (gaya WELP: besar, ramah) ---------- */
export const PageTitle = ({ title, sub, right, mascot }) => (
  <div className="flex justify-between items-end gap-4 mb-5">
    <div className="min-w-0">
      {sub && <p className="text-[11px] font-bold text-flame-600 dark:text-apricot mb-0.5 flex items-center gap-1.5">{sub}</p>}
      <h1 className="text-[22px] md:text-[26px] font-extrabold tracking-tight text-ink dark:text-ink-inv leading-tight">{title}</h1>
    </div>
    {right && <div className="shrink-0">{right}</div>}
  </div>
);

/* ---------- NUMERIC INPUT ---------- */
// v15 F4-H3: format ribuan gaya Indonesia (TITIK: 150.000), desimal
// KOMA — konsisten dengan formatIDR & cara baca pengguna Indonesia.
export const NumericInput = ({ value, onChange, placeholder, className, prefix, suffix, label }) => {
  const [displayValue, setDisplayValue] = useState('');
  useEffect(() => { setDisplayValue(formatNumberDisplay(value)); }, [value]);
  const handleChange = (e) => {
    const rawValue = e.target.value;
    if (rawValue === '' || /^[0-9.,]*$/.test(rawValue)) {
      setDisplayValue(rawValue);
      onChange(rawValue === '' ? 0 : parseNumberID(rawValue));
    }
  };
  return (
    <div className="w-full group">
      {label && <label className="kicker block mb-1.5 ml-0.5">{label}</label>}
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-3.5 text-ink-faint text-xs font-extrabold z-10 pointer-events-none group-focus-within:text-flame-600 dark:group-focus-within:text-apricot transition-colors">{prefix}</span>}
        <input type="text" value={displayValue} onChange={handleChange} placeholder={placeholder} inputMode="decimal"
          className={`field money text-right ${prefix ? 'pl-9' : 'pl-3.5'} ${suffix ? 'pr-10' : 'pr-3.5'} ${className || ''}`}
        />
        {suffix && <span className="absolute right-3.5 text-ink-faint text-[10px] font-extrabold pointer-events-none">{suffix}</span>}
      </div>
    </div>
  );
};

/* ---------- SELECT (dropdown) ---------- */
export const Select = ({ label, value, options, onChange, className = "" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref]);
  return (
    <div className={`relative ${className}`} ref={ref}>
      {label && <label className="kicker block mb-1.5 ml-0.5">{label}</label>}
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between field text-left hover:border-flame-300 dark:hover:border-flame-600">
        <span className="truncate">{value}</span>
        <svg viewBox="0 0 12 12" className={`w-3 h-3 text-ink-faint transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-2xl shadow-pop max-h-48 overflow-y-auto z-[70] animate-pop custom-scrollbar">
          {options.map((opt) => (
            <div key={opt} onClick={() => { onChange(opt); setOpen(false); }}
              className={`px-4 py-2.5 text-xs font-bold cursor-pointer transition-colors first:rounded-t-2xl last:rounded-b-2xl ${value === opt ? 'bg-flame-50 dark:bg-flame-900/30 text-flame-700 dark:text-apricot' : 'text-ink-soft dark:text-ink-inv/70 hover:bg-paper dark:hover:bg-white/5'}`}>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ---------- TOGGLE ---------- */
export const Toggle = ({ on, onClick, size = 'md' }) => (
  <button type="button" onClick={onClick} aria-pressed={on}
    className={`relative rounded-full transition-colors shrink-0 ${size === 'md' ? 'w-11 h-6 p-1' : 'w-8 h-[18px] p-0.5'} ${on ? 'bg-flame-500' : 'bg-line dark:bg-line-dark'}`}>
    <div className={`bg-white rounded-full shadow-sm transition-transform ${size === 'md' ? 'w-4 h-4' : 'w-3 h-3'} ${on ? (size === 'md' ? 'translate-x-5' : 'translate-x-3.5') : ''}`}></div>
  </button>
);

/* ---------- SEGMENTED CONTROL ---------- */
export const Segmented = ({ items, value, onChange, className = "" }) => (
  <div className={`inline-flex bg-surface dark:bg-surface-dark border-2 border-line dark:border-line-dark rounded-2xl p-1 shadow-card ${className}`}>
    {items.map(it => (
      <button key={it.id} onClick={() => onChange(it.id)}
        className={`px-4 py-2 rounded-xl text-[11px] font-extrabold transition-all whitespace-nowrap ${value === it.id
          ? 'bg-flame-600 text-white shadow-card'
          : 'text-ink-faint hover:text-ink-soft dark:hover:text-ink-inv/80'}`}>
        {it.label}
      </button>
    ))}
  </div>
);

/* ---------- BADGE ---------- */
export const Badge = ({ tone = 'neutral', children, className = "" }) => {
  const tones = {
    neutral: 'bg-paper dark:bg-white/5 text-ink-faint dark:text-ink-inv/60',
    grey: 'bg-paper dark:bg-white/5 text-ink-faint dark:text-ink-inv/60',   // v15 F4-H12: alias neutral
    green: 'bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf',
    gold: 'bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold',
    red: 'bg-brick-soft dark:bg-brick/10 text-brick-deep dark:text-brick',
    lime: 'bg-flame-50 dark:bg-flame-500/15 text-flame-700 dark:text-apricot',
    teal: 'bg-teal2-soft dark:bg-teal2/15 text-teal2 dark:text-teal2'
  };
  return <span className={`badge ${tones[tone] || tones.neutral} ${className}`}>{children}</span>;
};

/* ---------- MODAL BASE ---------- */
export const Modal = ({ open, onClose, title, sub, children, width = 'max-w-md', footer, tone = 'light' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-chrome-deep/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className={`w-full ${width} max-h-[92vh] rounded-t-[1.8rem] sm:rounded-[1.8rem] shadow-pop flex flex-col overflow-hidden animate-pop ${
        tone === 'dark' ? 'bg-chrome-panel border border-chrome-edge text-ink-inv' : 'bg-surface dark:bg-surface-dark border border-line dark:border-line-dark'
      }`} onClick={e => e.stopPropagation()}>
        <header className={`flex justify-between items-center gap-3 px-5 py-4 border-b ${tone === 'dark' ? 'border-chrome-edge' : 'border-line/70 dark:border-line-dark/70'}`}>
          <div className="min-w-0">
            {sub && <p className={`text-[10px] font-extrabold uppercase tracking-widest ${tone === 'dark' ? 'text-apricot/80' : 'text-flame-600 dark:text-apricot'}`}>{sub}</p>}
            <h3 className={`font-extrabold text-base truncate ${tone === 'dark' ? 'text-ink-inv' : 'text-ink dark:text-ink-inv'}`}>{title}</h3>
          </div>
          <button onClick={onClose} aria-label="Tutup" className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
            tone === 'dark' ? 'bg-white/5 text-ink-inv/60 hover:text-ink-inv hover:bg-white/10' : 'bg-paper dark:bg-white/5 text-ink-faint hover:text-brick'
          }`}><X className="w-4 h-4" /></button>
        </header>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">{children}</div>
        {footer && <div className={`px-5 py-4 border-t ${tone === 'dark' ? 'border-chrome-edge' : 'border-line/70 dark:border-line-dark/70'}`}>{footer}</div>}
      </div>
    </div>
  );
};

/* ---------- CONFIRM DIALOG (v15 F4/K2) ----------
   Pengganti confirm() native untuk aksi berisiko: konsisten dengan
   design system, bisa ditutup dgn Escape, dan mendukung mode
   "ketik kata kunci" utk aksi destruktif yang tak bisa dibatalkan
   (mis. Reset Aplikasi yang menghapus seluruh data lokal). */
export const ConfirmDialog = ({ open, title, message, confirmLabel = 'Ya, lanjutkan', cancelLabel = 'Batal', danger, typeWord, onConfirm, onCancel }) => {
  const [word, setWord] = useState('');
  useEffect(() => { if (open) setWord(''); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onCancel && onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
  if (!open) return null;
  const armed = !typeWord || word.trim().toUpperCase() === String(typeWord).toUpperCase();
  return createPortal(
    <div className="fixed inset-0 z-[170] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-chrome-deep/70 backdrop-blur-sm animate-fade-in" onClick={onCancel}>
      <div className="w-full max-w-sm bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-t-[1.8rem] sm:rounded-[1.8rem] shadow-pop p-5 animate-pop" onClick={e => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <div className="flex items-start gap-3 mb-4">
          <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${danger ? 'bg-brick-soft dark:bg-brick/15 text-brick' : 'bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold'}`}>
            <AlertCircle className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-extrabold text-[15px] text-ink dark:text-ink-inv leading-snug">{title}</h3>
            {message && <p className="text-xs text-ink-faint font-semibold mt-1 leading-relaxed">{message}</p>}
          </div>
        </div>
        {typeWord && (
          <div className="mb-4">
            <label className="kicker block mb-1.5 ml-0.5">Ketik <span className="text-brick font-mono uppercase">{typeWord}</span> untuk konfirmasi</label>
            <input value={word} onChange={e => setWord(e.target.value)} placeholder={typeWord}
              className="field font-mono uppercase tracking-widest" autoComplete="off" />
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2.5 rounded-2xl text-xs font-extrabold bg-paper dark:bg-white/5 text-ink-soft dark:text-ink-inv/70 hover:bg-line/40 transition press">{cancelLabel}</button>
          <button onClick={() => armed && onConfirm && onConfirm()} disabled={!armed}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition press disabled:opacity-40 disabled:pointer-events-none ${danger ? 'bg-brick hover:bg-brick-deep text-white' : 'bg-flame-600 hover:bg-flame-500 text-white'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ---------- EMPTY STATE (maskot asli WELP, tanpa emoji) ---------- */
export const EmptyState = ({ icon: Icon, mascot, title, desc, action, compact }) => (
  <div className={`flex flex-col items-center justify-center ${compact ? 'py-8' : 'py-12'} px-6 text-center`}>
    {mascot ? (
      <div className="animate-floaty mb-2">
        <Mascot pose={mascot} className="w-28 h-28 object-contain drop-shadow-sm" alt={title || ''} />
      </div>
    ) : Icon && (
      <div className="animate-floaty mb-3"><Icon className="w-14 h-14 text-flame-500 dark:text-apricot drop-shadow-sm" /></div>
    )}
    <p className="font-display font-bold text-base text-ink dark:text-ink-inv">{title}</p>
    {desc && <p className="text-xs text-ink-faint mt-1.5 max-w-xs leading-relaxed">{desc}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/* ---------- HELP BOX ---------- */
export const HelpBox = ({ text }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} aria-label="Info" className="text-ink-faint hover:text-flame-600 dark:hover:text-apricot transition">
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[9998] bg-chrome-deep/70 backdrop-blur-sm animate-fade-in" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}></div>
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[85%] max-w-xs p-5 bg-chrome-deep text-ink-inv text-sm rounded-3xl shadow-pop animate-pop border border-chrome-edge" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-chrome-edge">
              <span className="text-[10px] font-extrabold text-apricot uppercase tracking-[0.18em]">Info singkat</span>
              <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="text-ink-inv/50 hover:text-ink-inv transition"><X className="w-3.5 h-3.5" /></button>
            </div>
            <p className="leading-relaxed text-ink-inv/85 font-medium text-xs">{text}</p>
          </div>
        </>,
        document.body
      )}
    </span>
  );
};

/* ---------- IMAGE CROPPER (logika sama, wajah baru) ---------- */
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });

const getCroppedImg = async (imageSrc, pixelCrop) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
  return canvas.toDataURL('image/jpeg');
};

export const ImageCropperModal = ({ imageSrc, onCropComplete, onClose }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const processCrop = async () => {
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedImage);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-chrome-deep/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="w-[95%] md:w-[500px] bg-chrome-deep rounded-3xl overflow-hidden shadow-pop border border-chrome-edge flex flex-col h-[80vh] relative">
        <div className="absolute top-4 right-4 z-20">
          <button onClick={onClose} className="bg-white/10 text-ink-inv p-2 rounded-full hover:bg-brick transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="relative flex-1 bg-chrome-deep touch-none">
          <Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)} onZoomChange={setZoom} showGrid={false} />
        </div>
        <div className="p-5 bg-chrome-deep border-t border-chrome-edge space-y-4">
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-2xl bg-white/5 text-ink-inv font-extrabold text-xs hover:bg-white/10 transition">Batal</button>
            <button onClick={processCrop} className="flex-1 py-3 rounded-2xl bg-flame-500 text-white font-extrabold text-xs hover:bg-flame-400 transition">Pakai Foto Ini</button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- ONBOARDING SPOTLIGHT (maskot asli + sapaan) ---------- */
export const MascotGreeting = ({ pose = 'menyapa', title, note, className = '' }) => (
  <div className={`flex items-center gap-4 ${className}`}>
    <Mascot pose={pose} className="w-20 h-20 object-contain shrink-0" alt="" />
    <div>
      <p className="font-display font-extrabold text-lg text-ink dark:text-ink-inv leading-snug">{title}</p>
      {note && <p className="font-hand text-base text-flame-600 dark:text-apricot mt-0.5" style={{ transform: 'rotate(-1.5deg)' }}>{note}</p>}
    </div>
  </div>
);
