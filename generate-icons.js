/**
 * Generates all app icon assets with a mailbox design matching the 📬 emoji.
 * Run: node generate-icons.js
 * Requires: npm install --save-dev sharp (already installed)
 */

const sharp = require('sharp');
const path = require('path');

const ASSETS = path.join(__dirname, 'assets');

// Shared mailbox shapes (all coordinates in a 1024x1024 space)
// Arch goes OVER the top (dome): sweep=1 from left→right in SVG goes upward.
// Arch span x=90–800, dome peak ~y=330 (ry=200 above y=530 endpoints), bottom y=782
// Flag post x=786–812, top y=162, flag points left
const MAILBOX_PATHS = `
  <!-- Rectangular body (below arch): primary blue with rounded bottom corners -->
  <path d="M 90 530 L 90 760 Q 90 782 112 782 L 778 782 Q 800 782 800 760 L 800 530 Z" fill="#2563EB"/>

  <!-- Arch dome (over the top, dark navy): sweep=1 arcs upward -->
  <path d="M 90 530 A 355 200 0 0 1 800 530 Z" fill="#1E40AF"/>

  <!-- Interior hollow of dome (darkest navy): slightly inset arch -->
  <path d="M 132 530 A 313 168 0 0 1 758 530 Z" fill="#1E3A8A"/>

  <!-- Envelope (white, visible inside the dome hollow) -->
  <rect x="275" y="370" width="340" height="162" rx="10" fill="white"/>
  <!-- V-fold at top of envelope -->
  <path d="M 275 370 L 445 452 L 615 370" fill="none" stroke="#93C5FD" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>

  <!-- Mail slot on front face -->
  <rect x="200" y="640" width="240" height="22" rx="11" fill="#1D4ED8" opacity="0.6"/>

  <!-- Flag post (right side, full mailbox height) -->
  <rect x="786" y="162" width="26" height="620" rx="8" fill="#374151"/>
  <!-- Post ball cap -->
  <circle cx="799" cy="160" r="16" fill="#4B5563"/>
  <!-- Flag raised (triangle pointing left from post top): sweep=1 arc fixes -->
  <path d="M 812 162 L 812 266 L 614 214 Z" fill="#DC2626"/>
  <!-- Flag shine highlight -->
  <path d="M 812 162 L 812 205 L 680 186 Z" fill="#EF4444" opacity="0.35"/>
`;

// White monochrome version (for Android monochrome adaptive icon)
const MONO_PATHS = `
  <!-- Rectangular mailbox body (white) -->
  <path d="M 90 530 L 90 760 Q 90 782 112 782 L 778 782 Q 800 782 800 760 L 800 530 Z" fill="white"/>
  <!-- Arch dome (white, sweep=1 goes upward) -->
  <path d="M 90 530 A 355 200 0 0 1 800 530 Z" fill="white"/>
  <!-- Interior hollow hint (semi-transparent) -->
  <path d="M 132 530 A 313 168 0 0 1 758 530 Z" fill="rgba(0,0,0,0.35)"/>
  <!-- Envelope -->
  <rect x="275" y="370" width="340" height="162" rx="10" fill="rgba(255,255,255,0.8)"/>
  <!-- Flag post -->
  <rect x="786" y="162" width="26" height="620" rx="8" fill="white"/>
  <!-- Flag -->
  <path d="M 812 162 L 812 266 L 614 214 Z" fill="rgba(255,255,255,0.85)"/>
`;

// Full color icon with solid light blue background
const MAIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="#DBEAFE"/>
  ${MAILBOX_PATHS}
</svg>`;

// No background (transparent) — for adaptive foreground and splash
const FG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  ${MAILBOX_PATHS}
</svg>`;

// White silhouette on transparent — for Android monochrome adaptive icon
const MONO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  ${MONO_PATHS}
</svg>`;

async function main() {
  console.log('Generating mailbox icons...\n');

  // icon.png — 1024×1024, full color with background
  await sharp(Buffer.from(MAIN_SVG)).png().resize(1024, 1024)
    .toFile(path.join(ASSETS, 'icon.png'));
  console.log('✓ icon.png (1024×1024)');

  // splash-icon.png — 1024×1024, transparent (Expo overlays on white background)
  await sharp(Buffer.from(FG_SVG)).png().resize(1024, 1024)
    .toFile(path.join(ASSETS, 'splash-icon.png'));
  console.log('✓ splash-icon.png (1024×1024)');

  // favicon.png — 48×48 for web
  await sharp(Buffer.from(MAIN_SVG)).png().resize(48, 48)
    .toFile(path.join(ASSETS, 'favicon.png'));
  console.log('✓ favicon.png (48×48)');

  // android-icon-foreground.png — 512×512, transparent (composited over background by Android)
  await sharp(Buffer.from(FG_SVG)).png().resize(512, 512)
    .toFile(path.join(ASSETS, 'android-icon-foreground.png'));
  console.log('✓ android-icon-foreground.png (512×512)');

  // android-icon-background.png — 512×512, solid light blue (#E6F4FE)
  await sharp({
    create: { width: 512, height: 512, channels: 3, background: { r: 230, g: 244, b: 254 } },
  }).png().toFile(path.join(ASSETS, 'android-icon-background.png'));
  console.log('✓ android-icon-background.png (512×512)');

  // android-icon-monochrome.png — 432×432, white silhouette on transparent
  await sharp(Buffer.from(MONO_SVG)).png().resize(432, 432)
    .toFile(path.join(ASSETS, 'android-icon-monochrome.png'));
  console.log('✓ android-icon-monochrome.png (432×432)');

  console.log('\nAll icons generated ✅');
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
