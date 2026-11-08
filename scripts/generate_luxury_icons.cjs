const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const resDir = path.join(rootDir, 'android/app/src/main/res');
const publicDir = path.join(rootDir, 'public');

// 1. Android ic_launcher_background.xml
const backgroundXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <!-- Deep Obsidian / Midnight Onyx Base -->
    <path
        android:pathData="M0,0h108v108h-108z"
        android:fillColor="#090B10" />

    <!-- Subtle Deep Charcoal Inner Tone -->
    <path
        android:pathData="M8,8h92v92h-92z"
        android:fillColor="#10131B" />

    <!-- Outer Fine Gold Accent Squircle -->
    <path
        android:pathData="M16,16h76v76h-76z"
        android:strokeColor="#ca8a04"
        android:strokeWidth="0.8"
        android:fillColor="#0c0e15" />

    <!-- Fine Concentric Gold Aura -->
    <path
        android:pathData="M54,16 a38,38 0 1,0 0.001,0"
        android:strokeColor="#ca8a04"
        android:strokeWidth="0.4"
        android:strokeAlpha="0.3"
        android:fillColor="#00000000" />
</vector>
`;

// 2. Android ic_launcher_foreground.xml (Scaled to 108dp with 72dp safe area centered at 54, 54)
const foregroundXml = `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <!-- GRAND LUXURY ORNATE ACE OF SPADES (Centered at 54,54) -->
    <group
        android:pivotX="54"
        android:pivotY="54">

        <!-- Flared Classical Pedestal Stand with Beaded Filigree -->
        <path
            android:pathData="M48.5,76 L44,83 C43.2,84.5 44.5,86 46.5,86 L61.5,86 C63.5,86 64.8,84.5 64,83 L59.5,76 Z"
            android:fillColor="#0D0E13"
            android:strokeColor="#F59E0B"
            android:strokeWidth="1.2" />
        <path
            android:pathData="M49,78 L46.5,84 L61.5,84 L59,78 Z"
            android:fillColor="#00000000"
            android:strokeColor="#FDE68A"
            android:strokeWidth="0.5" />
        <!-- Pedestal Dots -->
        <path
            android:pathData="M54,80 a0.7,0.7 0 1,0 0.001,0 M51.5,82.5 a0.7,0.7 0 1,0 0.001,0 M54,82.5 a0.7,0.7 0 1,0 0.001,0 M56.5,82.5 a0.7,0.7 0 1,0 0.001,0 M49,85 a0.7,0.7 0 1,0 0.001,0 M51.5,85 a0.7,0.7 0 1,0 0.001,0 M54,85 a0.7,0.7 0 1,0 0.001,0 M56.5,85 a0.7,0.7 0 1,0 0.001,0 M59,85 a0.7,0.7 0 1,0 0.001,0"
            android:fillColor="#FBBF24" />

        <!-- Master Spade Outer Contour -->
        <path
            android:pathData="M54,23 C57,33 67,46 76.5,54.5 C82,59.5 82,68 75.5,73 C69,78 60,76 54,68 C48,76 39,78 32.5,73 C26,68 26,59.5 31.5,54.5 C41,46 51,33 54,23 Z"
            android:fillColor="#0A0B0E"
            android:strokeColor="#FBBF24"
            android:strokeWidth="1.8"
            android:strokeLineJoin="round" />

        <!-- Inner Golden Filigree Inset -->
        <path
            android:pathData="M54,26.5 C56.5,35 65.5,47 74,54.5 C79,59 79,66 73.5,70 C68,74.5 60,72.5 54,65 C48,72.5 40,74.5 34.5,70 C29,66 29,59 34,54.5 C42.5,47 51.5,35 54,26.5 Z"
            android:fillColor="#11131A"
            android:strokeColor="#D97706"
            android:strokeWidth="0.7"
            android:strokeLineJoin="round" />

        <!-- Beaded Filigree Pearls (Wings) -->
        <path
            android:pathData="M72,57 a0.7,0.7 0 1,0 0.001,0 M74,60 a0.7,0.7 0 1,0 0.001,0 M75,63 a0.7,0.7 0 1,0 0.001,0 M74.5,66 a0.7,0.7 0 1,0 0.001,0 M72.5,69 a0.7,0.7 0 1,0 0.001,0 M69.5,71.5 a0.7,0.7 0 1,0 0.001,0 M66.5,72.5 a0.7,0.7 0 1,0 0.001,0 M63.5,72 a0.7,0.7 0 1,0 0.001,0 M60.5,70.5 a0.7,0.7 0 1,0 0.001,0 M58,68 a0.7,0.7 0 1,0 0.001,0"
            android:fillColor="#FDE68A" />
        <path
            android:pathData="M36,57 a0.7,0.7 0 1,0 0.001,0 M34,60 a0.7,0.7 0 1,0 0.001,0 M33,63 a0.7,0.7 0 1,0 0.001,0 M33.5,66 a0.7,0.7 0 1,0 0.001,0 M35.5,69 a0.7,0.7 0 1,0 0.001,0 M38.5,71.5 a0.7,0.7 0 1,0 0.001,0 M41.5,72.5 a0.7,0.7 0 1,0 0.001,0 M44.5,72 a0.7,0.7 0 1,0 0.001,0 M47.5,70.5 a0.7,0.7 0 1,0 0.001,0 M50,68 a0.7,0.7 0 1,0 0.001,0"
            android:fillColor="#FDE68A" />

        <!-- Tapered Inner Dots to Point -->
        <path
            android:pathData="M56,33 a0.6,0.6 0 1,0 0.001,0 M59,38 a0.6,0.6 0 1,0 0.001,0 M62,43 a0.6,0.6 0 1,0 0.001,0 M66,48 a0.6,0.6 0 1,0 0.001,0 M70,53 a0.6,0.6 0 1,0 0.001,0"
            android:fillColor="#FBBF24" />
        <path
            android:pathData="M52,33 a0.6,0.6 0 1,0 0.001,0 M49,38 a0.6,0.6 0 1,0 0.001,0 M46,43 a0.6,0.6 0 1,0 0.001,0 M42,48 a0.6,0.6 0 1,0 0.001,0 M38,53 a0.6,0.6 0 1,0 0.001,0"
            android:fillColor="#FBBF24" />

        <!-- Celestial Engraving Stars inside the Spade -->
        <path
            android:pathData="M54,34 L54.5,36 L56.5,36.5 L54.5,37 L54,39 L53.5,37 L51.5,36.5 L53.5,36 Z"
            android:fillColor="#FDE68A" />
        <path
            android:pathData="M47.5,43 L48,44.2 L49.2,44.5 L48,44.8 L47.5,46 L47,44.8 L45.8,44.5 L47,44.2 Z"
            android:fillColor="#FBBF24" />
        <path
            android:pathData="M60.5,43 L61,44.2 L62.2,44.5 L61,44.8 L60.5,46 L60,44.8 L58.8,44.5 L60,44.2 Z"
            android:fillColor="#FBBF24" />
        <path
            android:pathData="M44.5,51 L45,52 M63.5,51 L64,52 M43,58 L43.5,59 M65,58 L65.5,59"
            android:strokeColor="#FDE68A"
            android:strokeWidth="0.8" />

        <!-- MAJESTIC CENTRAL GODDESS / QUEEN EMBLEM (Lady of Spades) -->
        <!-- Plinth Base -->
        <path
            android:pathData="M50.5,67.5 L57.5,67.5 L56.8,69 L51.2,69 Z"
            android:fillColor="#D97706" />

        <!-- Draped Gown Body (Ivory & Gold) -->
        <path
            android:pathData="M52,52 C51.5,57 51,62 51.5,67.5 L56.5,67.5 C57,62 56.5,57 56,52 Z"
            android:fillColor="#FFFBEB" />
        <!-- Robe Shading Lines -->
        <path
            android:pathData="M52.8,53 Q52.5,60 52.3,67.5 M54,53.5 Q54,61 54,67.5 M55.2,53 Q55.5,60 55.7,67.5"
            android:strokeColor="#B45309"
            android:strokeWidth="0.35"
            android:strokeLineCap="round" />

        <!-- Bodice & Robe Waist Sash -->
        <path
            android:pathData="M52.2,45 L55.8,45 L56,52 L52,52 Z"
            android:fillColor="#FFFBEB"
            android:strokeColor="#D97706"
            android:strokeWidth="0.4" />
        <path
            android:pathData="M51.8,52 C52.5,53.5 55.5,53.5 56.2,52"
            android:strokeColor="#F59E0B"
            android:strokeWidth="0.5" />

        <!-- Scepter in Right Arm -->
        <path
            android:pathData="M50.5,42 L50.5,67"
            android:strokeColor="#F59E0B"
            android:strokeWidth="0.6"
            android:strokeLineCap="round" />
        <path
            android:pathData="M50.5,41.5 a0.8,0.8 0 1,0 0.001,0"
            android:fillColor="#FDE68A" />

        <!-- Laurel Sprig in Left Arm -->
        <path
            android:pathData="M57.5,50 C58.5,49 59.2,50.5 60,49"
            android:strokeColor="#F59E0B"
            android:strokeWidth="0.5"
            android:strokeLineCap="round" />

        <!-- Classic Head, Hair & Tiara Diadem -->
        <path
            android:pathData="M54,41 a1.4,1.7 0 1,0 0.001,0"
            android:fillColor="#FFFBEB" />
        <path
            android:pathData="M52.8,40.5 C52.5,39 55.5,39 55.2,40.5 C55.5,42 55.3,43.5 55.1,44.5 L52.9,44.5 C52.7,43.5 52.5,42 52.8,40.5 Z"
            android:fillColor="#D97706" />
        <path
            android:pathData="M52.8,39 L53.3,38 L54,37 L54.7,38 L55.2,39 Z"
            android:fillColor="#FDE68A"
            android:strokeColor="#F59E0B"
            android:strokeWidth="0.2" />
        <path
            android:pathData="M54,36.8 a0.4,0.4 0 1,0 0.001,0"
            android:fillColor="#FFFFFF" />
    </group>
</vector>
`;

// 3. Full-Fidelity Master SVG for Web Favicon and High-Resolution Render
const fullMasterSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Luxury Background Radial Gradient -->
    <radialGradient id="bgGlow" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="#181B24"/>
      <stop offset="40%" stop-color="#0E1017"/>
      <stop offset="85%" stop-color="#08090C"/>
      <stop offset="100%" stop-color="#030406"/>
    </radialGradient>

    <!-- Metallic 24K Gold Gradient -->
    <linearGradient id="goldPlate" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFBEB"/>
      <stop offset="20%" stop-color="#FDE68A"/>
      <stop offset="45%" stop-color="#F59E0B"/>
      <stop offset="70%" stop-color="#D97706"/>
      <stop offset="90%" stop-color="#B45309"/>
      <stop offset="100%" stop-color="#78350F"/>
    </linearGradient>

    <linearGradient id="goldRim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="25%" stop-color="#FEF08A"/>
      <stop offset="60%" stop-color="#F59E0B"/>
      <stop offset="85%" stop-color="#B45309"/>
      <stop offset="100%" stop-color="#FDE68A"/>
    </linearGradient>

    <!-- Drop Shadows -->
    <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.95"/>
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#F59E0B" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Premium Obsidian / Midnight Onyx Base -->
  <rect width="512" height="512" rx="112" fill="url(#bgGlow)"/>

  <!-- Outer Fine Dual Gold Pinstripe Border -->
  <rect x="22" y="22" width="468" height="468" rx="94" fill="none" stroke="url(#goldRim)" stroke-width="2.5" opacity="0.6"/>
  <rect x="30" y="30" width="452" height="452" rx="86" fill="none" stroke="url(#goldPlate)" stroke-width="1" opacity="0.35"/>

  <!-- Ornate Corner Filigree Elements -->
  <g stroke="url(#goldPlate)" stroke-width="1.2" fill="none" opacity="0.5">
    <path d="M52,82 C68,66 68,66 84,50 M52,50 L84,82"/>
    <circle cx="84" cy="82" r="3" fill="url(#goldPlate)"/>
    <path d="M460,82 C444,66 444,66 428,50 M460,50 L428,82"/>
    <circle cx="428" cy="82" r="3" fill="url(#goldPlate)"/>
    <path d="M52,430 C68,446 68,446 84,462 M52,462 L84,430"/>
    <circle cx="84" cy="430" r="3" fill="url(#goldPlate)"/>
    <path d="M460,430 C444,446 444,446 428,462 M460,462 L428,430"/>
    <circle cx="428" cy="430" r="3" fill="url(#goldPlate)"/>
  </g>

  <!-- Central Concentric Gold Halo Ring -->
  <circle cx="256" cy="245" r="185" fill="none" stroke="url(#goldRim)" stroke-width="1.5" opacity="0.3" stroke-dasharray="8 6"/>
  <circle cx="256" cy="245" r="192" fill="none" stroke="url(#goldPlate)" stroke-width="0.8" opacity="0.2"/>

  <!-- GRAND ORNATE ACE OF SPADES EMBLEM -->
  <g filter="url(#goldGlow)">
    <!-- Base Pedestal (Flared Classical Stand with Beaded Dots) -->
    <path d="M226,380 L205,424 C200,435 208,442 220,442 L292,442 C304,442 312,435 307,424 L286,380 Z"
          fill="#0D0E13" stroke="url(#goldPlate)" stroke-width="5"/>
    <path d="M228,390 L216,428 C214,434 219,437 225,437 L287,437 C293,437 298,434 296,428 L284,390 Z"
          fill="none" stroke="url(#goldRim)" stroke-width="1.8"/>
    <!-- Pedestal Beading Dots -->
    <g fill="url(#goldPlate)">
      <circle cx="256" cy="402" r="3"/>
      <circle cx="244" cy="414" r="3"/>
      <circle cx="256" cy="414" r="3"/>
      <circle cx="268" cy="414" r="3"/>
      <circle cx="234" cy="426" r="3"/>
      <circle cx="245" cy="426" r="3"/>
      <circle cx="256" cy="426" r="3"/>
      <circle cx="267" cy="426" r="3"/>
      <circle cx="278" cy="426" r="3"/>
    </g>

    <!-- Outer Spade Silhouette Body -->
    <path d="M256,68 
             C272,130 330,205 385,255 
             C418,285 418,335 380,365 
             C342,395 285,385 256,335 
             C227,385 170,395 132,365 
             C94,335 94,285 127,255 
             C182,205 240,130 256,68 Z"
          fill="#0A0B0E" stroke="url(#goldRim)" stroke-width="7" stroke-linejoin="round"/>

    <!-- Inner Golden Filigree Inset Border -->
    <path d="M256,86 
             C270,140 322,210 372,255 
             C400,280 400,322 368,348 
             C336,374 286,364 256,318 
             C226,364 176,374 144,348 
             C112,322 112,280 140,255 
             C190,210 242,140 256,86 Z"
          fill="#11131A" stroke="url(#goldPlate)" stroke-width="2.5" stroke-linejoin="round"/>

    <!-- Beaded Filigree Pearls along the Inner Wings -->
    <g fill="url(#goldRim)">
      <circle cx="360" cy="270" r="3.2"/>
      <circle cx="372" cy="285" r="3.2"/>
      <circle cx="378" cy="302" r="3.2"/>
      <circle cx="376" cy="320" r="3.2"/>
      <circle cx="366" cy="336" r="3.2"/>
      <circle cx="350" cy="348" r="3.2"/>
      <circle cx="332" cy="353" r="3.2"/>
      <circle cx="314" cy="352" r="3.2"/>
      <circle cx="296" cy="344" r="3.2"/>
      <circle cx="280" cy="332" r="3.2"/>

      <circle cx="152" cy="270" r="3.2"/>
      <circle cx="140" cy="285" r="3.2"/>
      <circle cx="134" cy="302" r="3.2"/>
      <circle cx="136" cy="320" r="3.2"/>
      <circle cx="146" cy="336" r="3.2"/>
      <circle cx="162" cy="348" r="3.2"/>
      <circle cx="180" cy="353" r="3.2"/>
      <circle cx="198" cy="352" r="3.2"/>
      <circle cx="216" cy="344" r="3.2"/>
      <circle cx="232" cy="332" r="3.2"/>

      <circle cx="268" cy="115" r="2.8"/>
      <circle cx="282" cy="142" r="2.8"/>
      <circle cx="298" cy="170" r="3"/>
      <circle cx="318" cy="202" r="3"/>
      <circle cx="338" cy="235" r="3"/>

      <circle cx="244" cy="115" r="2.8"/>
      <circle cx="230" cy="142" r="2.8"/>
      <circle cx="214" cy="170" r="3"/>
      <circle cx="194" cy="202" r="3"/>
      <circle cx="174" cy="235" r="3"/>
    </g>

    <!-- Starfield Inside the Spade -->
    <g fill="url(#goldRim)">
      <path d="M256,125 L258,133 L266,135 L258,137 L256,145 L254,137 L246,135 L254,133 Z"/>
      <path d="M222,175 L223.5,180 L228.5,181.5 L223.5,183 L222,188 L220.5,183 L215.5,181.5 L220.5,180 Z"/>
      <path d="M290,175 L291.5,180 L296.5,181.5 L291.5,183 L290,188 L288.5,183 L283.5,181.5 L288.5,180 Z"/>
      <path d="M205,215 L206,219 L210,220 L206,221 L205,225 L204,221 L200,220 L204,219 Z"/>
      <path d="M307,215 L308,219 L312,220 L308,221 L307,225 L306,221 L302,220 L306,219 Z"/>
      <path d="M195,260 L196,264 L200,265 L196,266 L195,270 L194,266 L190,265 L194,264 Z"/>
      <path d="M317,260 L318,264 L322,265 L318,266 L317,270 L316,266 L312,265 L316,264 Z"/>
      <path d="M198,300 L199,303 L202,304 L199,305 L198,308 L197,305 L194,304 L197,303 Z"/>
      <path d="M314,300 L315,303 L318,304 L315,305 L314,308 L313,305 L310,304 L313,303 Z"/>
    </g>

    <!-- CENTRAL MAJESTIC GODDESS OF CARDS (Lady of Spades) -->
    <path d="M236,335 L276,335 L272,342 L240,342 Z" fill="url(#goldPlate)"/>

    <g stroke="url(#goldRim)" stroke-width="1.4" fill="none" stroke-linecap="round">
      <path d="M246,260 Q243,295 242,335"/>
      <path d="M251,262 Q250,298 250,335"/>
      <path d="M256,262 Q256,300 256,335"/>
      <path d="M261,262 Q262,298 262,335"/>
      <path d="M266,260 Q269,295 270,335"/>
      <path d="M243,248 C248,256 264,256 269,248" stroke-width="2"/>
      <path d="M244,253 C249,260 263,260 268,253" stroke-width="1.2"/>
      <path d="M247,208 L266,252" stroke="url(#goldPlate)" stroke-width="2"/>
    </g>

    <path d="M245,250 C242,280 238,310 241,335 L271,335 C274,310 270,280 267,250 Z"
          fill="#FFFBEB" opacity="0.95"/>
    <path d="M248,206 L264,206 L267,250 L245,250 Z"
          fill="#FFFBEB" stroke="url(#goldPlate)" stroke-width="1.2"/>

    <path d="M265,212 C274,222 278,235 275,252 C273,250 270,248 267,246"
          stroke="url(#goldRim)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M275,248 C280,242 284,248 286,242 M278,252 C282,254 285,250 288,252 M276,258 C281,260 283,266 287,264"
          stroke="url(#goldPlate)" stroke-width="1.5" fill="none" stroke-linecap="round"/>

    <path d="M247,212 C240,222 236,236 238,252 C240,250 243,248 245,246"
          stroke="url(#goldRim)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <line x1="236" y1="190" x2="238" y2="330" stroke="url(#goldPlate)" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="236" cy="188" r="3.5" fill="url(#goldRim)"/>

    <path d="M249,198 C251,192 261,192 263,198 Z" fill="url(#goldPlate)"/>
    <ellipse cx="256" cy="184" rx="6" ry="7.5" fill="#FFFBEB"/>
    <path d="M250,183 C249,176 263,176 262,183 C264,188 264,194 263,198 L249,198 C248,194 248,188 250,183 Z"
          fill="url(#goldPlate)"/>
    <path d="M250,175 L252,170 L256,165 L260,170 L262,175 Z"
          fill="url(#goldRim)" stroke="url(#goldPlate)" stroke-width="0.8"/>
    <circle cx="256" cy="164" r="2.2" fill="#FFFFFF"/>
    <circle cx="252" cy="169" r="1.5" fill="url(#goldRim)"/>
    <circle cx="260" cy="169" r="1.5" fill="url(#goldRim)"/>
  </g>
</svg>
`;

// Write vector assets
fs.writeFileSync(path.join(resDir, 'drawable/ic_launcher_background.xml'), backgroundXml);
fs.writeFileSync(path.join(resDir, 'drawable-v24/ic_launcher_foreground.xml'), foregroundXml);
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), fullMasterSvg);
const masterSvgPath = path.join(rootDir, 'master_luxury_ace.svg');
fs.writeFileSync(masterSvgPath, fullMasterSvg);

console.log('Saved vector XMLs and master SVG.');

// Render master PNG (512x512)
const masterPngPath = path.join(publicDir, 'favicon.png');
execSync(`sips -s format png "${masterSvgPath}" --out "${masterPngPath}"`);
console.log('Rendered 512x512 master favicon.png.');

// Generate raster mipmaps across all Android densities
const densities = [
  { name: 'mipmap-mdpi', size: 48, fgSize: 108 },
  { name: 'mipmap-hdpi', size: 72, fgSize: 162 },
  { name: 'mipmap-xhdpi', size: 96, fgSize: 216 },
  { name: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
  { name: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
];

densities.forEach(({ name, size, fgSize }) => {
  const dir = path.join(resDir, name);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const iconPath = path.join(dir, 'ic_launcher.png');
  const roundPath = path.join(dir, 'ic_launcher_round.png');
  const fgPath = path.join(dir, 'ic_launcher_foreground.png');

  // Generate standard & round icons by scaling master
  execSync(`sips -z ${size} ${size} "${masterPngPath}" --out "${iconPath}"`);
  execSync(`sips -z ${size} ${size} "${masterPngPath}" --out "${roundPath}"`);

  // Generate foreground raster
  execSync(`sips -z ${fgSize} ${fgSize} "${masterPngPath}" --out "${fgPath}"`);
  console.log(`Generated ${name} (${size}x${size}, fg ${fgSize}x${fgSize})`);
});

// Also copy a preview to brain artifact
const artifactPreview = '/Users/tejovarmaalluri/.gemini/antigravity/brain/e65bf1f2-f0c0-43c2-8677-b7c05bbce6d7/rummy_luxury_ace_icon.png';
execSync(`cp "${masterPngPath}" "${artifactPreview}"`);
console.log('Saved preview to brain artifact.');
