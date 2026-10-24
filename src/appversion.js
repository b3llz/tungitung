// v21.5.1 SINGLE SOURCE OF TRUTH untuk nomor versi WELP.
// Dulu versi ditulis hardcode di banyak tempat (devpanel "v21.2.0", settings "v21.1",
// lock "v20") sehingga label tampilan tidak pernah sinkron dengan build yang asli.
// Mulai versi ini: UBAH HANYA file ini + package.json, semua footer/label ikut otomatis.
export const APP_VERSION = '21.5.1';
export const APP_TAGLINE = `WELP v${APP_VERSION}`;
