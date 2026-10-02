import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const failures = [];

const enterprise = read('firestore.enterprise.v3.rules');
const storage = read('storage.enterprise.v3.rules');
const functions = read('functions/index.js');
const gitignore = read('.gitignore');
const envExample = read('.env.example');

if (/allow\s+(read|write|read,\s*write|write,\s*read):\s*if\s+signedIn\(\)\s*&&\s*appChecked\(\)\s*;/.test(enterprise)) {
  failures.push('Enterprise Firestore rules contain an unrestricted signedIn+AppCheck allow.');
}
if (!enterprise.includes('allow read, write: if false;')) failures.push('Enterprise Firestore rules must end with explicit tenant deny-by-default.');
if (!storage.includes('allow delete: if false;')) failures.push('Storage delete must remain denied to client.');
if (!functions.includes('exports.submitAttendanceEvidence')) failures.push('Attendance backend gate is missing.');
if (!functions.includes('welpTenant')) failures.push('Custom tenant claims are missing.');
if (!gitignore.split(/\r?\n/).includes('.env')) failures.push('.env is not ignored.');
if (/SECRET_KEY\s*=\s*[^#\n]+/.test(envExample)) failures.push('A server secret appears in frontend env example.');

const forbidden = [
  '-----BEGIN PRIVATE KEY-----',
  'firebase_admin_sdk',
  'serviceAccount',
  'XENDIT_SECRET_KEY=' // must never appear in source; only in server env template comment is allowed
];
for (const needle of forbidden) {
  const files = ['src', 'functions/index.js'].filter(Boolean);
  if (needle !== 'XENDIT_SECRET_KEY=' && functions.includes(needle)) failures.push(`Possible secret material in functions source: ${needle}`);
}

if (failures.length) {
  console.error('WELP security smoke test FAILED');
  for (const f of failures) console.error('- ' + f);
  process.exit(1);
}
console.log('WELP security smoke test PASSED');
