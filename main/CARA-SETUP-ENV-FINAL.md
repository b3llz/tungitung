# WELP — Setup .env Final

## 1. Jangan upload `.env`

File `.env` hanya untuk local development/Codespaces. GitHub harus hanya menerima `.env.example`.

`.gitignore` sudah melindungi `.env` dan `functions/.env`.

## 2. Root `.env`

Di root project, buat file `.env`:

```env
VITE_FIREBASE_API_KEY=ISI_DARI_FIREBASE_WEB_APP
VITE_FIREBASE_AUTH_DOMAIN=PROJECT_ID.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=PROJECT_ID.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=ISI_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=ISI_FIREBASE_APP_ID
VITE_RECAPTCHA_SITE_KEY=ISI_RECAPTCHA_V3_SITE_KEY
VITE_WELP_SECURITY_MODE=compatibility
```

Firebase Web API key/site key di atas bukan pengganti server secret. Jangan pernah memasukkan Firebase Admin private key atau payment secret ke variable `VITE_*`.

## 3. Functions `.env`

Buat `functions/.env`:

```env
WELP_BOOTSTRAP_EMAILS=email-developer@example.com
```

Email harus akun administrator provisioning yang memang kamu kontrol.

## 4. Netlify

Jangan upload `.env`. Masukkan variable root `.env` di Netlify → Environment variables untuk site production.

Untuk Functions, variable server-only diatur sebagai environment variable Functions/Cloud Functions. Jangan prefix secret dengan `VITE_`.

## 5. Setelah semua variable diisi

```bash
npm install
npm run security:smoke
npm run build
```

Kalau sukses:

```bash
git status
```

Pastikan `.env` dan `functions/.env` tidak muncul sebagai file untuk commit.

Lalu:

```bash
git add .
git commit -m "WELP enterprise security batch 4-7"
git push
```

## 6. Security mode

Tetap gunakan:

```env
VITE_WELP_SECURITY_MODE=compatibility
```

sampai seluruh tenant dan user sudah menerima Firebase Auth custom claims dan seluruh direct Firestore path sudah diuji.

Setelah cutover enterprise selesai, ubah ke:

```env
VITE_WELP_SECURITY_MODE=enterprise
```

dan deploy `firestore.enterprise.v3.rules` + `storage.enterprise.v3.rules` melalui konfigurasi Firebase production yang sudah diuji.
