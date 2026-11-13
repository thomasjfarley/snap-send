// Generates the Sign in with Apple client secret (ES256 JWT) used by the web app's
// Apple OAuth provider in Supabase. Apple caps its lifetime at 6 months.
// Usage: node scripts/apple-client-secret.js <path-to-AuthKey.p8> <output-file>
const crypto = require('crypto');
const fs = require('fs');

const TEAM_ID = '4Y5QZF6BXY';
const KEY_ID = 'SP6BJ744YF';
const CLIENT_ID = 'com.snapsend.live.siwa';

const [keyPath, outPath] = process.argv.slice(2);
if (!keyPath || !outPath) {
  console.error('Usage: node scripts/apple-client-secret.js <AuthKey.p8> <output-file>');
  process.exit(1);
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const exp = now + 15777000 - 86400;
const input = `${b64({ alg: 'ES256', kid: KEY_ID })}.${b64({
  iss: TEAM_ID, iat: now, exp, aud: 'https://appleid.apple.com', sub: CLIENT_ID,
})}`;
const sig = crypto.sign('sha256', Buffer.from(input), {
  key: fs.readFileSync(keyPath, 'utf8'),
  dsaEncoding: 'ieee-p1363',
});
fs.writeFileSync(outPath, `${input}.${sig.toString('base64url')}`);
console.log('Secret written. Expires', new Date(exp * 1000).toISOString());
