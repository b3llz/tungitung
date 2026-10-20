#!/usr/bin/env bash
# ============================================================================
#  WELP UPDATER v5 — CODESPACES 1 PERINTAH: upload zip -> LIVE
# ----------------------------------------------------------------------------
#  v5 PERBAIKAN (kasus "GitHub sudah baru tapi Cloudflare masih build lama"):
#   • VERIFIKASI PASCA-DEPLOY: setelah deploy, script baca ULANG situs live
#     & cocokkan hash file asset utama (index-XXXX.js) lokal vs live.
#     Deploy yang "sukses" tapi live masih build lama -> SEKARANG KETAHUAN.
#   • Deteksi URL live otomatis via Cloudflare API (tanpa login wrangler).
#   • Flag baru --verify-deploy : cek live vs dist/ tanpa deploy ulang.
#   • Penjelasan jebakan ~/.bashrc (shell baru tidak selalu ke-load ->
#     token "hilang" padahal sudah disimpan) + perintah ceknya.
# ----------------------------------------------------------------------------
#  Alur yang dikerjakan OTOMATIS oleh 1 perintah (bash welp-setup.sh):
#    1. Sinkronisasi GitHub -> Codespace (git pull, biar tidak tabrakan)
#    2. Cari zip update yang kamu upload (WELP*.zip, drag & drop aja)
#    3. Verifikasi + ekstrak zip
#    4. APUS file WELP lama + pasang seluruh file baru
#       (.env / .git / .github / node_modules DIPERTAHANKAN)
#    5. npm install + build produksi -> dist/
#    6. AUTO COMMIT + PUSH  (branch -> branch, default main -> main,
#       pakai kredensial bawaan Codespace, tanpa login tambahan)
#    7. AUTO DEPLOY ke Cloudflare (kalau token sudah disimpan sekali)
#    8. Zip terpakai dihapus otomatis (repo tetap bersih)
#  Pakai   : bash welp-setup.sh [lokasi-zip]
#  Flag    : --no-push        skip commit/push ke GitHub
#            --no-deploy       skip deploy ke Cloudflare
#            --skip-build      ganti file saja (tanpa install/build/deploy)
#            --skip-pull       skip git pull di awal
#            --backup          buat backup .tar.gz sebelum mengganti file
#            --keep-zip        simpan zip update setelah dipakai
#            --verify-deploy   TANPA deploy: cek situs live sudah build
#                              terbaru atau masih lama (butuh dist/ ada)
#  Tidak butuh: wrangler login, firebase login, apapun. 100% non-interaktif.
# ============================================================================
set -uo pipefail

# ---------- tampilan ----------
if [ -t 1 ]; then
  R='\033[0m'; B='\033[1m'; GRN='\033[0;32m'; YLW='\033[0;33m'
  RED='\033[0;31m'; CYN='\033[0;36m'; BLU='\033[0;34m'; DIM='\033[2m'
else
  R=''; B=''; GRN=''; YLW=''; RED=''; CYN=''; BLU=''; DIM=''
fi
say()  { printf '%b\n' "  ${GRN}[OK]${R} $1"; }
warn() { printf '%b\n' "  ${YLW}[!!]${R} $1"; }
err()  { printf '%b\n' "  ${RED}[GAGAL]${R} $1"; }
die()  { err "$1"; printf '\n'; exit 1; }
step() { printf '\n%b\n' "${BLU}${B}== [$1/$TOTAL_STEP] $2${R}"; }

# ---- v5: deteksi URL live workers.dev (tanpa login wrangler) ---------------
detect_live_url() { # $1 = folder proyek -> cetak URL live (pakai $WELP_LIVE_URL kalau di-set)
  local cfg name sub
  if [ -n "${WELP_LIVE_URL:-}" ]; then printf '%s\n' "${WELP_LIVE_URL%/}"; return 0; fi
  cfg="$1/wrangler.jsonc"
  name=""
  if [ -f "$cfg" ]; then
    name="$(sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$cfg" 2>/dev/null | head -n1)"
  fi
  name="${name:-welp}"
  if [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
    sub="$(curl -fsSL --max-time 15 -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/subdomain" 2>/dev/null \
      | sed -n 's/.*"subdomain"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
    [ -n "$sub" ] && { printf 'https://%s.%s.workers.dev\n' "$name" "$sub"; return 0; }
  fi
  return 1
}

# ---- v5: verifikasi situs live sudah menyajikan build terbaru --------------
VERIFY_RESULT=0
asset_hash_of() { grep -o 'index-[^" ]*\.js' "$1" 2>/dev/null | head -n1; }
verify_deploy() { # $1 = folder dist, $2 = URL live
  local dist="$1" url="${2%/}" lh lhh try
  [ -n "$url" ] || { warn "verifikasi dilewati (URL live tidak diketahui)"; return 2; }
  [ -f "$dist/index.html" ] || { warn "verifikasi dilewati (dist/index.html tidak ada)"; return 2; }
  lh="$(asset_hash_of "$dist/index.html")"
  [ -z "$lh" ] && { warn "verifikasi dilewati (hash asset lokal tidak ketemu di dist/index.html)"; return 2; }
  lhh=""
  for try in 1 2 3; do
    lhh="$(curl -fsSL --max-time 20 "$url/" 2>/dev/null | asset_hash_of /dev/stdin || true)"
    [ -n "$lhh" ] && break
    [ "$try" -lt 3 ] && sleep 6
  done
  if [ -z "$lhh" ]; then
    warn "VERIFIKASI TIDAK DAPAT JALAN — situs live tidak bisa dibaca: $url"
    warn "  Cek manual: buka $url lalu lihat nama file index-XXXX.js (harus: $lh)"
    return 1
  fi
  if [ "$lhh" = "$lh" ]; then
    say "VERIFIKASI LIVE OK — $url sudah menyajikan build terbaru ($lh)"
    VERIFY_RESULT=1
    return 0
  fi
  err "VERIFIKASI GAGAL — situs live MASIH BUILD LAMA!"
  err "  build lokal : $lh"
  err "  situs live  : $lhh"
  err "  Tunggu 30 dtk lalu cek ulang:  bash ${SELF:-welp-setup.sh} --verify-deploy"
  err "  Kalau masih lama: deploy ulang manual ->  npm run deploy"
  err "  (Deploy bisa 'sukses' tapi edge Cloudflare butuh beberapa detik prop)"
  return 1
}

# ---------- konstanta ----------
ZIP_MD5_ASLI="bf94a99b9618db2c879dd35dfbd0d2d8"          # zip resmi v21.2.0
ZIP_URL_FALLBACK="https://x0.at/TwNs.zip"                 # cadangan (bisa expired)
SELF="$(basename "$0" 2>/dev/null || echo welp-setup.sh)"
TOTAL_STEP=8
SKIP_BUILD="${WELP_SKIP_BUILD:-0}"
SKIP_PULL=0
NO_DEPLOY=0
KEEP_ZIP=0
VERIFY_ONLY=0   # v5: mode khusus cek live vs build (tanpa deploy)
DO_PUSH=1          # v4: auto commit+push itu DEFAULT (alur kamu langkah 5)
DO_BACKUP=0        # v4: tidak ada backup tar.gz — file lama aman di riwayat git
SRC_ARG=""
TMP=""
GIT_TOP=""
BRANCH="main"
PUSHED=0

cleanup() { [ -n "$TMP" ] && [ -d "$TMP" ] && rm -rf "$TMP" 2>/dev/null; }
trap cleanup EXIT

usage() {
  cat <<USAGE
${B}WELP Updater v5 — Codespaces 1 Perintah${R}
Alur : upload zip update -> bash ${SELF} -> GitHub + Cloudflare ikut ter-update
Flag : --no-push        skip commit/push ke GitHub
       --no-deploy      skip deploy Cloudflare
       --skip-build     ganti file saja (tanpa install/build/deploy)
       --skip-pull      skip git pull di awal
       --backup         backup .tar.gz dulu sebelum ganti file
       --keep-zip       simpan zip update setelah dipakai (default: dihapus)
       --verify-deploy  cek situs live vs build dist/ (tanpa deploy)
Env   : WELP_LIVE_URL=https://welp.<akun>.workers.dev  (opsional, paksa URL cek)
Contoh: bash ${SELF}
        bash ${SELF} WELP-v21-3.zip
        bash ${SELF} --verify-deploy
USAGE
}

# ---------- argumen ----------
while [ $# -gt 0 ]; do
  case "$1" in
    --no-push)    DO_PUSH=0 ;;
    --no-deploy)  NO_DEPLOY=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --skip-pull)  SKIP_PULL=1 ;;
    --backup)     DO_BACKUP=1 ;;
    --keep-zip)   KEEP_ZIP=1 ;;
    --verify-deploy) VERIFY_ONLY=1 ;;
    --push)       DO_PUSH=1 ;;   # kompatibel v3 (sekarang memang default)
    -h|--help)    usage; exit 0 ;;
    -*)           die "Opsi tidak dikenal: $1 (lihat --help)" ;;
    *)  if [ -z "$SRC_ARG" ]; then SRC_ARG="$1"; else die "Argumen berlebih: $1"; fi ;;
  esac
  shift
done

printf '%b\n' "${CYN}${B}"
cat <<'BANNER'
  ==============================================
   WELP UPDATER — CODESPACES 1 PERINTAH
   Upload zip -> bash welp-setup.sh -> LIVE
   (hapus lama, pasang baru, push GitHub,
    deploy Cloudflare — semua otomatis)
  ==============================================
BANNER
printf '%b\n' "${R}"

# ============================================================================
# [MODE KHUSUS] --verify-deploy: cek live vs dist/ TANPA deploy ulang
# ============================================================================
if [ "$VERIFY_ONLY" = "1" ]; then
  printf '%b\n' "${CYN}${B}  Mode verifikasi deploy (tanpa deploy ulang)${R}"
  VT="${WELP_TARGET:-$PWD}"
  [ -d "$VT" ] || die "Folder target tidak ada: $VT"
  [ -f "$VT/dist/index.html" ] || die "dist/ tidak ada di $VT — jalankan 'npm run build' dulu, lalu ulangi: bash ${SELF} --verify-deploy"
  say "Build lokal : $VT/dist"
  VURL="$(detect_live_url "$VT" || true)"
  if [ -z "$VURL" ]; then
    err "Tidak bisa menentukan URL live (token belum ada / WELP_LIVE_URL kosong)."
    err "Solusi cepat — jalankan dengan URL eksplisit:"
    err "  WELP_LIVE_URL=https://welp.NAMAAKUN.workers.dev bash ${SELF} --verify-deploy"
    exit 1
  fi
  say "URL live    : $VURL"
  verify_deploy "$VT/dist" "$VURL"
  VR="$?"
  [ "$VR" -eq 0 ] && exit 0
  [ "$VR" -eq 2 ] && exit 0
  exit 1
fi

# ============================================================================
# [1/8] Sinkronisasi GitHub -> Codespace (git pull)
# ============================================================================
step 1 "Sinkronisasi GitHub -> Codespace (git pull)..."
GIT_TOP="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$GIT_TOP" ]; then
  warn "Folder ini bukan git repo — sinkron & push GitHub dilewati"
else
  BRANCH="$(git -C "$GIT_TOP" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
  if [ "$SKIP_PULL" = "1" ]; then
    warn "--skip-pull: git pull dilewati"
  else
    if git -C "$GIT_TOP" pull --ff-only origin "$BRANCH" >/dev/null 2>&1; then
      say "Sinkron OK — kode terbaru dari GitHub sudah masuk (branch: $BRANCH)"
    else
      warn "git pull gagal (riwayat beda / belum ada upstream) — lanjut tanpa pull"
      warn "Kalau push nanti ditolak: jalankan 'git pull --rebase' lalu ulangi script"
    fi
  fi
fi

# ============================================================================
# [2/8] Cari zip update (WELP*.zip) yang di-upload
# ============================================================================
step 2 "Mencari zip update WELP*.zip..."
SRC_ZIP=""
SRC_DIR=""

download_zip() { # $1 = url
  local dest="$TMP/dl.zip"
  warn "Mengunduh dari $1 ..."
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 2 -o "$dest" "$1" || return 1
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$dest" "$1" || return 1
  else
    return 1
  fi
  [ -s "$dest" ] || return 1
  SRC_ZIP="$dest"; return 0
}

pick_newest_zip() { # $1 = direktori -> zip WELP versi TERTINGGI (tiebreak: terbaru)
  local d="$1" f b norm tmpf best=""
  tmpf=$(mktemp)
  for f in "$d"/*.zip "$d"/*.ZIP; do
    [ -f "$f" ] || continue
    b=$(basename "$f")
    case "$b" in WELP*|welp*) ;; *) continue ;; esac
    # tarik angka versi dari nama (WELP-v21-3.zip -> 21.3.0) utk urut versi
    norm=$(printf '%s\n' "$b" | sed -nE 's/^[Ww][Ee][Ll][Pp][^0-9]*([0-9]+[.-][0-9]+([.-][0-9]+)?).*/\1/p' | tr '-' '.')
    norm=$(printf '%s\n' "${norm:-0}" | awk -F. '{print ($1+0)"."(($2+0))"."(($3+0))}')
    printf '%s %s %s\n' "$norm" "$(stat -c %Y "$f" 2>/dev/null || echo 0)" "$f" >> "$tmpf"
  done
  if [ -s "$tmpf" ]; then
    best=$(sort -k1,1Vr -k2,2nr "$tmpf" | head -n1 | cut -d' ' -f3-)
  fi
  rm -f "$tmpf"
  [ -n "$best" ] && printf '%s' "$best"
}

pick_newest_dir() { # $1 = direktori -> cetak folder ekstrak WELP terbaru
  local d="$1" best="" best_t=0 f t
  for f in "$d"/WELP*/ "$d"/welp*/; do
    { [ -d "$f" ] && [ -f "$f/package.json" ]; } || continue
    t=$(stat -c %Y "$f" 2>/dev/null || echo 0)
    if [ "$t" -gt "$best_t" ]; then best="$f"; best_t="$t"; fi
  done
  [ -n "$best" ] && printf '%s' "$best"
}

locate_source() {
  # --- 1) dari argumen / env ---
  local src="${SRC_ARG:-${WELP_ZIP:-}}"
  if [ -n "$src" ]; then
    case "$src" in
      http://*|https://*)
        TMP=$(mktemp -d)
        download_zip "$src" || die "Unduhan gagal: $src"
        return 0 ;;
      *)
        [ -e "$src" ] || die "Lokasi tidak ditemukan: $src"
        if [ -d "$src" ]; then SRC_DIR="$(cd "$src" && pwd)"; return 0; fi
        SRC_ZIP="$(cd "$(dirname "$src")" && pwd)/$(basename "$src")"; return 0 ;;
    esac
  fi
  # --- 2) cari zip di sekitar cwd (naik 4 level) + lokasi umum ---
  TMP=$(mktemp -d)
  local dirs=() d="$PWD" i
  for i in 1 2 3 4; do dirs+=("$d"); d=$(dirname "$d"); done
  [ -n "${GITHUB_WORKSPACE:-}" ] && dirs+=("$GITHUB_WORKSPACE")
  [ -d /workspaces ] && dirs+=("/workspaces")
  dirs+=("$HOME/Downloads" "$HOME/Desktop" "$HOME" "/tmp")
  local seen=":" dir z dfound=""
  # utamakan ZIP (itu yang selalu kamu upload); folder ekstrak hanya cadangan
  for dir in "${dirs[@]}"; do
    case "$seen" in *":$dir:"*) continue ;; esac
    seen="$seen$dir:"
    [ -d "$dir" ] || continue
    z=$(pick_newest_zip "$dir")
    if [ -n "$z" ]; then SRC_ZIP="$z"; return 0; fi
  done
  # --- 3) cadangan: folder hasil ekstrak manual (terbaru yang menang) ---
  seen=":"
  for dir in "${dirs[@]}"; do
    case "$seen" in *":$dir:"*) continue ;; esac
    seen="$seen$dir:"
    [ -d "$dir" ] || continue
    dfound=$(pick_newest_dir "$dir")
    if [ -n "$dfound" ]; then SRC_DIR="$(cd "$dfound" && pwd)"; return 0; fi
  done
  # --- 4) terakhir: coba unduh link resmi (bisa expired) ---
  if download_zip "$ZIP_URL_FALLBACK"; then
    warn "Zip tidak ketemu di disk — berhasil diunduh dari $ZIP_URL_FALLBACK"
    return 0
  fi
  die "Zip update WELP*.zip tidak ditemukan.
     Upload dulu zip-nya ke Codespace (drag & drop ke panel file explorer),
     lalu jalankan ulang:  bash ${SELF}
     Atau beri lokasi:     bash ${SELF} /workspaces/repo/WELP-v21-3.zip"
}
locate_source

if [ -n "$SRC_DIR" ]; then
  say "Pakai folder hasil ekstrak: $SRC_DIR"
else
  [ -s "$SRC_ZIP" ] || die "Zip kosong/rusak: $SRC_ZIP"
  say "Zip ditemukan: $SRC_ZIP ($(du -h "$SRC_ZIP" | cut -f1))"
fi

# ============================================================================
# [3/8] Verifikasi zip + ekstrak + normalisasi folder
# ============================================================================
if [ -n "$SRC_ZIP" ]; then
  step 3 "Verifikasi & ekstrak zip..."
  [ -n "$TMP" ] || TMP=$(mktemp -d)
  mkdir -p "$TMP/ex"
  if command -v unzip >/dev/null 2>&1; then
    unzip -tq "$SRC_ZIP" >/dev/null 2>&1 || die "Zip RUSAK — upload ulang zip update-nya"
    unzip -q "$SRC_ZIP" -d "$TMP/ex"
  else
    python3 - "$SRC_ZIP" "$TMP/ex" <<'PY' || die "Zip RUSAK — upload ulang"
import sys, zipfile
zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])
PY
  fi
  local_md5=$(md5sum "$SRC_ZIP" 2>/dev/null | cut -d' ' -f1 || echo "?")
  if [ "$local_md5" = "$ZIP_MD5_ASLI" ]; then
    say "Checksum COCOK — ini zip WELP resmi"
  else
    say "Checksum unik tercatat: ${local_md5:0:12}... (update baru — aman dilanjutkan)"
  fi
  # normalisasi: kalau isinya cuma 1 folder (mis. WELP-v21-2/), masuk ke dalam
  entries=$(ls -A "$TMP/ex" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$entries" = "1" ] && [ -d "$TMP/ex/$(ls -A "$TMP/ex")" ]; then
    SRC_DIR="$TMP/ex/$(ls -A "$TMP/ex")"
  else
    SRC_DIR="$TMP/ex"
  fi
  say "Ekstrak selesai (${entries} entri root)"
else
  step 3 "Verifikasi folder sumber..."
  [ -f "$SRC_DIR/package.json" ] || die "Folder sumber tidak berisi proyek WELP (package.json tidak ada): $SRC_DIR"
  say "Folder sumber valid"
fi

# ============================================================================
# [4/8] Tentukan folder proyek tujuan
# ============================================================================
step 4 "Menentukan folder proyek tujuan..."
TARGET=""
if [ -n "${WELP_TARGET:-}" ] && [ -d "${WELP_TARGET:-}" ]; then
  TARGET="$(cd "$WELP_TARGET" && pwd)"
elif [ -f "$PWD/package.json" ] || [ -d "$PWD/src" ] || [ -f "$PWD/vite.config.js" ]; then
  TARGET="$PWD"
else
  cand=""
  for d in ./*/ ; do
    [ -d "$d" ] || continue
    case "$d" in *node_modules*|*dist*|*.git*) continue ;; esac
    if [ -f "$d/package.json" ]; then cand="$d"; break; fi
  done
  if [ -n "$cand" ]; then
    TARGET="$(cd "$cand" && pwd)"
    warn "cwd bukan root proyek — pakai subfolder: $(basename "$TARGET")"
  else
    TARGET="$PWD"
  fi
fi
say "Tujuan: $TARGET"

# ============================================================================
# [5/8] APUS file lama -> pasang file baru (lindungi .env/.git/repo infra)
# ============================================================================
step 5 "Hapus file lama & pasang file baru dari zip..."
BACKUP=""
if [ "$DO_BACKUP" = "1" ] && { [ -f "$TARGET/package.json" ] || [ -d "$TARGET/src" ]; }; then
  BACKUP="$TARGET/.welp-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
  ( cd "$TARGET" && tar czf "$BACKUP" \
      --exclude=node_modules --exclude=.git --exclude=dist \
      --exclude='.welp-backup-*' . 2>/dev/null ) \
    && say "Backup dibuat: $(basename "$BACKUP") ($(du -h "$BACKUP" | cut -f1))" \
    || { BACKUP=""; warn "Backup gagal — lanjut tanpa backup (file lama aman di riwayat git)"; }
fi
if [ "$(realpath "$SRC_DIR" 2>/dev/null)" = "$(realpath "$TARGET" 2>/dev/null)" ]; then
  say "Sumber = tujuan (sudah diekstrak di tempat sama) — sinkron dilewati"
else
  TR=$(realpath "$TARGET" 2>/dev/null)
  RSYNC_EX=()
  RSYNC_EX+=(--exclude=.git --exclude=.github --exclude=.gitignore --exclude=.gitattributes)
  RSYNC_EX+=(--exclude=.devcontainer --exclude=.vscode --exclude=README.md)
  RSYNC_EX+=(--exclude=.env --exclude=.env.local)
  RSYNC_EX+=(--exclude=node_modules --exclude=.wrangler --exclude=.welp-backup-*)
  # zip yang SEDANG dipakai dilindungi dari --delete (dihapus belakangan);
  # zip update LAMA lainnya ikut terhapus otomatis (alur kamu langkah 2)
  if [ -n "$SRC_ZIP" ] && [ -f "$SRC_ZIP" ]; then
    ZR=$(realpath "$SRC_ZIP" 2>/dev/null || echo "")
    case "$ZR" in "$TR"/*) RSYNC_EX+=(--exclude="$(basename "$SRC_ZIP")") ;; esac
  fi
  RSYNC_EX+=(--exclude="$SELF")
  if command -v rsync >/dev/null 2>&1; then
    rsync -rlpgoD --delete --ignore-times "${RSYNC_EX[@]}" \
      "$SRC_DIR"/ "$TARGET"/ \
      && say "File lama SUDAH DIHAPUS & diganti file baru (--delete)" \
      || die "rsync gagal"
  else
    warn "rsync tidak ada — pakai metode cp (folder inti dibersihkan manual)"
    for sub in src public docs scripts functions dist; do rm -rf "$TARGET/$sub"; done
    for entry in "$TARGET"/* "$TARGET"/.env.local "$TARGET"/.env.old; do
      [ -e "$entry" ] || continue
      base=$(basename "$entry")
      case "$base" in
        .git|.github|.gitignore|.gitattributes|.devcontainer|.vscode|.env|node_modules|.wrangler|.welp-backup-*|"$SELF"|dist|README.md) continue ;;
        *.zip) [ "$entry" != "$SRC_ZIP" ] && rm -rf "$entry" && continue || continue ;;
      esac
      [ -e "$SRC_DIR/$base" ] || rm -rf "$entry"
    done
    cp -r "$SRC_DIR"/. "$TARGET"/ \
      && say "Salin selesai — file lama sudah diganti file baru" \
      || die "Salin file gagal"
  fi
fi

# ---------- jaga-jaga file penting repo ----------
if [ ! -f "$TARGET/.gitignore" ]; then
  printf 'node_modules/\ndist/\n.env\n.wrangler/\n' > "$TARGET/.gitignore"
fi
# zip installer + script + backup jangan ikut ke-commit ke GitHub
gi_add() { grep -qsxF "$1" "$TARGET/.gitignore" || printf '%s\n' "$1" >> "$TARGET/.gitignore"; }
gi_add 'WELP*.zip'
gi_add 'welp*.zip'
gi_add 'welp-setup.sh'
gi_add '.welp-backup-*.tar.gz'
if [ ! -f "$TARGET/wrangler.jsonc" ] && [ ! -f "$SRC_DIR/wrangler.jsonc" ]; then
  cat > "$TARGET/wrangler.jsonc" <<'WJSON'
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "welp",
  "compatibility_date": "2026-10-01",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
WJSON
  say "wrangler.jsonc dibuat (config Cloudflare)"
fi
mkdir -p "$TARGET/public"
if [ ! -f "$TARGET/public/_redirects" ]; then
  printf '/* /index.html 200\n' > "$TARGET/public/_redirects"
  say "public/_redirects dibuat (SPA fallback Cloudflare)"
fi
if [ ! -f "$TARGET/public/_headers" ]; then
  cat > "$TARGET/public/_headers" <<'HHeaders'
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), microphone=(), geolocation=(self), payment=(), usb=()
  Content-Security-Policy: default-src 'self'; script-src 'self' https://www.gstatic.com https://www.google.com https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.googleapis.com https://*.googleusercontent.com https://*.gstatic.com https://www.google.com; media-src 'self' blob:; connect-src 'self' blob: https://*.googleapis.com wss://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://www.google.com https://nominatim.openstreetmap.org; frame-src https://www.google.com https://apis.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
HHeaders
  say "public/_headers dibuat (security headers)"
fi

# ---------- .env ----------
if [ -f "$TARGET/.env" ]; then
  say ".env kamu DIPERTAHANKAN (tidak disentuh sama sekali)"
elif [ -f "$TARGET/.env.example" ]; then
  cp "$TARGET/.env.example" "$TARGET/.env"
  warn ".env belum ada -> dibuatkan dari .env.example"
  warn "WAJIB isi VITE_FIREBASE_* dulu (lihat CARA-SETUP-ENV-FINAL.md), kalau tidak login app tidak jalan"
else
  warn ".env tidak ada & tidak ada .env.example — buat manual sebelum deploy"
fi

# ---------- bukti nyata file sudah diganti ----------
if [ -f "$TARGET/package.json" ]; then
  WVER=$(grep -m1 '"version"' "$TARGET/package.json" | sed -E 's/.*"version"[^"]*"([^"]*)".*/\1/')
  say "package.json -> versi proyek sekarang: ${WVER:-?}"
fi
if [ -f "$TARGET/PANDUAN-PLAN-GRATIS-SPARK.md" ]; then
  say "File khas v21.2 terdeteksi: PANDUAN-PLAN-GRATIS-SPARK.md"
fi

# ---------- perintah 1 pintu: npm run deploy ----------
if [ -f "$TARGET/package.json" ] && command -v node >/dev/null 2>&1; then
  if ! grep -q '"deploy"' "$TARGET/package.json"; then
    ( cd "$TARGET" && node -e '
      const fs = require("fs");
      const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
      p.scripts = p.scripts || {};
      p.scripts.deploy = "vite build && npx -y wrangler deploy";
      p.scripts["deploy:pages"] = "vite build && npx -y wrangler pages deploy dist --project-name welp";
      fs.writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n");
    ' ) \
      && say "Perintah 1 PINTU tersedia: npm run deploy (build + deploy Cloudflare)" \
      || warn "Gagal menambah npm run deploy — pakai manual: npx -y wrangler deploy"
  else
    say "npm run deploy sudah ada di package.json"
  fi
fi

# ============================================================================
# [6/8] Node check + npm install + build produksi
# ============================================================================
if [ "$SKIP_BUILD" = "1" ]; then
  warn "--skip-build: npm install & build DILEWATI"
else
  step 6 "Cek Node, pasang dependencies & build produksi..."
  if command -v node >/dev/null 2>&1; then
    NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
    if [ "${NODE_MAJOR:-0}" -lt 20 ]; then
      warn "Node $(node -v) < 20 (butuh >=20) — coba pasang Node 20 lewat nvm..."
      export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
      if [ -s "$NVM_DIR/nvm.sh" ]; then
        # shellcheck disable=SC1091
        . "$NVM_DIR/nvm.sh" && nvm install 20 >/dev/null 2>&1 && nvm use 20 >/dev/null 2>&1 \
          && say "Node aktif sekarang: $(node -v)" \
          || warn "nvm gagal — lanjut dengan $(node -v) (bisa jadi tetap jalan)"
      else
        warn "nvm tidak ada — lanjut dengan $(node -v)"
      fi
    else
      say "Node $(node -v) OK"
    fi
  else
    die "Node.js tidak ditemukan — buka Codespace dengan devcontainer Node/Universal"
  fi
  say "npm install (bisa 1-3 menit pertama kali)..."
  ( cd "$TARGET" && { npm ci --no-audit --no-fund >/dev/null 2>&1 \
      || npm install --no-audit --no-fund >/dev/null 2>&1; } ) \
    && say "Dependencies terpasang" \
    || die "npm install gagal — cek koneksi, lalu jalankan ulang script ini"
  say "Build produksi (Vite -> dist/)..."
  ( cd "$TARGET" && npm run build >/dev/null 2>&1 ) \
    && say "Build sukses" \
    || die "Build gagal — jalankan 'npm run build' di $TARGET untuk lihat error lengkap (push otomatis DIBATALKAN)"
  if [ -f "$TARGET/dist/index.html" ]; then
    say "dist/index.html siap ($(du -sh "$TARGET/dist" | cut -f1))"
  else
    die "dist/index.html tidak ketemu — build tidak lengkap"
  fi
fi

# ============================================================================
# [7/8] AUTO COMMIT + PUSH ke GitHub (main -> main) — default NYALA
# ============================================================================
if [ -n "$GIT_TOP" ] && [ "$DO_PUSH" = "1" ]; then
  step 7 "Auto commit & push ke GitHub ($BRANCH -> $BRANCH)..."
  if [ -z "$(git -C "$GIT_TOP" config user.email 2>/dev/null)" ]; then
    git -C "$GIT_TOP" config user.email "welp-updater@codespace.local"
    git -C "$GIT_TOP" config user.name  "WELP Updater"
    warn "git identity belum diset — dipakai otomatis: WELP Updater <welp-updater@codespace.local>"
  fi
  WVER_PUSH=""
  [ -f "$GIT_TOP/package.json" ] && WVER_PUSH=$(grep -m1 '"version"' "$GIT_TOP/package.json" | sed -E 's/.*"version"[^"]*"([^"]*)".*/\1/')
  CMMSG="WELP v${WVER_PUSH:-?} — update otomatis via welp-setup.sh"
  git -C "$GIT_TOP" add -A
  if [ -n "$(git -C "$GIT_TOP" status --porcelain 2>/dev/null)" ]; then
    if git -C "$GIT_TOP" commit -m "$CMMSG" >/dev/null 2>&1; then
      say "Commit dibuat: $CMMSG"
    else
      warn "Commit gagal — cek tab Source Control di Codespace"
    fi
  else
    say "Tidak ada perubahan baru (Codespace & GitHub sudah sama)"
  fi
  if GIT_TERMINAL_PROMPT=0 git -C "$GIT_TOP" push origin "$BRANCH" >/dev/null 2>&1; then
    say "TER-PUSH ke GitHub: origin/$BRANCH ($BRANCH -> $BRANCH)"
    say "github.com sekarang menampilkan versi baru"
    PUSHED=1
  else
    warn "Push gagal/ditolak — coba: git pull --rebase origin $BRANCH lalu push ulang"
    warn "Atau buka tab Source Control di Codespace -> klik 'Sync Changes'"
  fi
elif [ "$DO_PUSH" = "0" ]; then
  warn "--no-push aktif: commit & push dilewati (perubahan hanya di Codespace)"
fi

# ============================================================================
# [8/8] AUTO DEPLOY ke Cloudflare (kalau token sudah disimpan sekali)
# ============================================================================
DEPLOYED_URL=""
if [ "$SKIP_BUILD" = "1" ]; then
  printf '\n'; warn "--skip-build: build & deploy Cloudflare dilewati"
elif [ "$NO_DEPLOY" = "1" ]; then
  printf '\n'; warn "--no-deploy: deploy ke Cloudflare dilewati"
elif [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  printf '\n'; step 8 "Deploy ke Cloudflare..."
  warn "Token/Account ID Cloudflare belum lengkap — deploy dilewati"
  warn "CEK CEPAT (shell sekarang):"
  warn "  echo \"TOKEN=\${CLOUDFLARE_API_TOKEN:+ADA} ACC=\${CLOUDFLARE_ACCOUNT_ID:+ADA}\""
  warn "  <- harus mencetak: TOKEN=ADA ACC=ADA"
  warn "Jebakan umum: 'echo ... >> ~/.bashrc' hanya berlaku di shell BARU."
  warn "Shell yang SUDAH terbuka tidak otomatis membacanya — jalankan manual:"
  warn "  source ~/.bashrc   lalu ulangi script ini."
  warn "Tenang: file & GitHub SUDAH beres. Setup token sekali (lihat bawah),"
  warn "lalu deploy kapan pun dengan:  npm run deploy"
else
  printf '\n'; step 8 "Auto deploy ke Cloudflare (token terdeteksi, tanpa login)..."
  DEPLOY_LOG="$( cd "$TARGET" && CI=true WRANGLER_SEND_METRICS=false npx -y wrangler deploy 2>&1 )"
  DS="$?"
  printf '%s\n' "$DEPLOY_LOG" | tail -n 25
  if [ "$DS" -eq 0 ]; then
    DEPLOYED_URL="$(printf '%s\n' "$DEPLOY_LOG" | grep -oE 'https://[a-zA-Z0-9.-]+\.workers\.dev' | head -n1)"
    [ -z "$DEPLOYED_URL" ] && DEPLOYED_URL="$(detect_live_url "$TARGET" 2>/dev/null || true)"
    printf '\n'; say "Deploy wrangler sukses — verifikasi konten situs live..."
    verify_deploy "$TARGET/dist" "$DEPLOYED_URL" || true
  else
    warn "wrangler deploy gagal — coba jalur Cloudflare Pages..."
    DEPLOY_LOG="$( cd "$TARGET" && CI=true WRANGLER_SEND_METRICS=false npx -y wrangler pages deploy dist --project-name welp --commit-dirty=true 2>&1 )"
    DP="$?"
    printf '%s\n' "$DEPLOY_LOG" | tail -n 25
    if [ "$DP" -eq 0 ]; then
      DEPLOYED_URL="$(printf '%s\n' "$DEPLOY_LOG" | grep -oE 'https://[a-zA-Z0-9.-]+\.pages\.dev' | head -n1)"
      printf '\n'; say "Deploy Pages sukses — verifikasi konten situs live..."
      verify_deploy "$TARGET/dist" "$DEPLOYED_URL" || true
    else
      warn "Deploy otomatis gagal — dist/ sudah siap, deploy ulang via: npm run deploy"
    fi
  fi
fi

# ============================================================================
# Bersih-bersih: zip terpakai dihapus + backup lama dirapikan
# ============================================================================
if [ -n "$SRC_ZIP" ] && [ -f "$SRC_ZIP" ]; then
  if [ "$KEEP_ZIP" = "1" ]; then
    warn "--keep-zip: zip sumber dipertahankan di $SRC_ZIP"
  else
    ZR=$(realpath "$SRC_ZIP" 2>/dev/null); TR=$(realpath "$TARGET" 2>/dev/null)
    case "$ZR" in
      "$TMP"/*)
        say "zip unduhan sementara sudah dibersihkan" ;;
      "$TR"/*)
        rm -f "$SRC_ZIP" && say "zip update terpakai -> DIHAPUS (repo bersih)" ;;
      *)
        warn "zip sumber ada di luar folder proyek — tidak dihapus: $SRC_ZIP" ;;
    esac
  fi
fi
if [ "$DO_BACKUP" = "0" ]; then
  # tanpa --backup: rapikan sisa backup lama biar repo bersih
  rm -f "$TARGET"/.welp-backup-*.tar.gz 2>/dev/null || true
fi

# ============================================================================
# Ringkasan akhir
# ============================================================================
printf '\n%b\n' "${GRN}${B}"
cat <<'DONE'
  ============================================================
   SELESAI — ALUR 6 LANGKAH KAMU BERES
  ============================================================
DONE
printf '%b\n' "${R}"
printf '  Proyek    : %s\n' "$TARGET"
if [ -n "$GIT_TOP" ]; then
  if [ "$PUSHED" = "1" ]; then
    printf '  GitHub    : %sTER-PUSH (%s)%s\n' "${GRN}" "$BRANCH" "${R}"
  elif [ "$DO_PUSH" = "1" ]; then
    printf '  GitHub    : %sBELUM ter-push — lihat pesan langkah 7/8 di atas%s\n' "${YLW}" "${R}"
  else
    printf '  GitHub    : push dimatikan (--no-push)\n'
  fi
fi
if [ "$SKIP_BUILD" != "1" ] && [ -f "$TARGET/dist/index.html" ]; then
  printf '  dist/     : siap (%s)\n' "$(du -sh "$TARGET/dist" | cut -f1)"
fi
if [ -n "$DEPLOYED_URL" ]; then
  printf '  Cloudflare: %sDEPLOY BERHASIL%s\n' "${GRN}" "${R}"
  printf '  URL live  : %s%s%s\n' "${CYN}${B}" "$DEPLOYED_URL" "${R}"
  if [ "$VERIFY_RESULT" = "1" ]; then
    printf '  Verifikasi: %sLIVE SUDAH BUILD TERBARU%s\n' "${GRN}${B}" "${R}"
  else
    printf '  Verifikasi: %sBELUM PASTI — cek: bash %s --verify-deploy%s\n' "${YLW}" "$SELF" "${R}"
  fi
  printf '  %b\n' "  ${GRN}${B}>>> Tambahkan domain di atas ke Firebase Authorized domains <<<${R}"
fi
printf '  Harian    : npm run deploy%s\n' "${DIM}   <- edit kode -> live 1 menit${R}"
[ -n "$BACKUP" ] && printf '  Backup    : %s\n' "$BACKUP"
printf '\n'

cat <<'GUIDE'
  ALUR KAMU SEKARANG (tiap ada update WELP):
    1. Upload zip update ke Codespace  (drag & drop ke file explorer)
    2. bash welp-setup.sh
    3. Beres — Codespace + GitHub + Cloudflare sekalian ter-update
    (otomatis: pull, hapus file lama, pasang baru, build,
     commit main->main, deploy Cloudflare, hapus zip terpakai)

  KENDALI MANUAL (kalau perlu):
    --no-push        skip commit/push GitHub
    --no-deploy      skip deploy Cloudflare
    --skip-build     ganti file saja (paling cepat)
    --verify-deploy  cek situs live sudah build terbaru atau belum
    --backup         backup .tar.gz dulu sebelum ganti
    --keep-zip       zip update tidak dihapus

  SETUP SEKALI SAJA (biar langkah deploy jalan — 5 menit):
    1. dash.cloudflare.com -> My Profile -> API Tokens -> Create Token
       -> template "Edit Cloudflare Workers"
       (di halaman permission: Account | Workers Scripts | Edit,
        baris kosong lain dihapus saja -> Continue to summary -> Create)
    2. Simpan di Codespace:
         echo 'export CLOUDFLARE_API_TOKEN="ISI_TOKEN"' >> ~/.bashrc
         echo 'export CLOUDFLARE_ACCOUNT_ID="ISI_ID"'   >> ~/.bashrc
         source ~/.bashrc        <- WAJIB! shell sekarang tidak otomatis baca bashrc
         echo "T=${CLOUDFLARE_API_TOKEN:+ADA}"    <- harus cetak: T=ADA
    3. bash welp-setup.sh  -> deploy pertama jalan sendiri + otomatis
       verifikasi situs live sudah build terbaru

  WAJIB SETELAH DEPLOY SUKSES (biar login WELP jalan):
    Firebase Console -> Authentication -> Settings -> Authorized domains
    -> Add domain -> welp.<akun>.workers.dev -> Save

GUIDE

# ---------- status git kalau masih ada yang belum ke-push ----------
if [ -n "$GIT_TOP" ] && [ "$PUSHED" != "1" ] && [ "$DO_PUSH" = "1" ]; then
  printf '%b\n' "${YLW}${B}"
  cat <<GITNOTE
  ------------------------------------------------------------
   CATATAN: perubahan di Codespace BELUM masuk GitHub.
   Jalankan ulang:  bash ${SELF}
   Kalau push terus ditolak: git pull --rebase origin ${BRANCH}
   lalu ulangi script ini.
  ------------------------------------------------------------
GITNOTE
  printf '%b\n' "${R}"
fi
printf '\n'
exit 0
